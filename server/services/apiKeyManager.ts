import { GoogleGenerativeAI } from "@google/generative-ai";

interface ApiKeyConfig {
  id: string;
  name: string;
  apiKey: string;
  purpose: string;
  priority: number;
  isActive: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsage: number;
  monthlyUsage: number;
  errorCount: number;
  lastError?: string;
  lastUsed?: Date;
}

interface ApiKeyUsageResult {
  success: boolean;
  keyId: string;
  responseTime?: number;
  error?: string;
}

class ApiKeyManager {
  private keys: Map<string, ApiKeyConfig> = new Map();
  private genAIInstances: Map<string, GoogleGenerativeAI> = new Map();
  private currentKeyIndex: Map<string, number> = new Map();
  private usageCallbacks: ((result: ApiKeyUsageResult) => void)[] = [];

  constructor() {
    this.loadEnvKeys();
  }

  private loadEnvKeys(): void {
    const keyPatterns = [
      "GOOGLE_API_KEY",
      "GOOGLE_API_KEY_1",
      "GOOGLE_API_KEY_2",
      "GOOGLE_API_KEY_3",
      "GOOGLE_API_KEY_4",
      "GOOGLE_API_KEY_5",
      "GOOGLE_API_KEY_6",
      "GOOGLE_API_KEY_7",
      "GOOGLE_API_KEY_8",
      "GOOGLE_API_KEY_9",
      "GOOGLE_API_KEY_10",
    ];

    let priority = 0;
    for (const keyName of keyPatterns) {
      const apiKey = process.env[keyName];
      if (apiKey && apiKey.trim()) {
        this.addKey({
          id: `env-${keyName.toLowerCase()}`,
          name: keyName,
          apiKey: apiKey.trim(),
          purpose: "general",
          priority: priority++,
          isActive: true,
          dailyLimit: 1500,
          monthlyLimit: 50000,
          dailyUsage: 0,
          monthlyUsage: 0,
          errorCount: 0,
        });
        console.log(`Loaded API key: ${keyName}`);
      }
    }

    if (this.keys.size === 0) {
      console.warn("No Google API keys found in environment variables");
    } else {
      console.log(`Total ${this.keys.size} API keys loaded for failover`);
    }
  }

  addKey(config: ApiKeyConfig): void {
    this.keys.set(config.id, config);
    if (config.isActive) {
      this.genAIInstances.set(config.id, new GoogleGenerativeAI(config.apiKey));
    }
  }

  removeKey(id: string): void {
    this.keys.delete(id);
    this.genAIInstances.delete(id);
  }

  updateKey(id: string, updates: Partial<ApiKeyConfig>): void {
    const existing = this.keys.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.keys.set(id, updated);
      if (updates.apiKey || updates.isActive !== undefined) {
        if (updated.isActive) {
          this.genAIInstances.set(id, new GoogleGenerativeAI(updated.apiKey));
        } else {
          this.genAIInstances.delete(id);
        }
      }
    }
  }

  loadKeysFromDB(keys: ApiKeyConfig[]): void {
    this.keys.clear();
    this.genAIInstances.clear();
    
    this.loadEnvKeys();

    keys.forEach((key) => this.addKey(key));
  }

  private getAvailableKeys(purpose: string = "general"): ApiKeyConfig[] {
    const available: ApiKeyConfig[] = [];
    
    this.keys.forEach((key) => {
      if (!key.isActive) return;
      if (key.dailyUsage >= key.dailyLimit) return;
      if (key.monthlyUsage >= key.monthlyLimit) return;
      if (key.errorCount >= 5) return;
      if (purpose !== "general" && key.purpose !== "general" && key.purpose !== purpose) return;
      
      available.push(key);
    });

    return available.sort((a, b) => {
      if (a.purpose === purpose && b.purpose !== purpose) return -1;
      if (b.purpose === purpose && a.purpose !== purpose) return 1;
      return a.priority - b.priority;
    });
  }

  async getGenAI(purpose: string = "general"): Promise<{ genAI: GoogleGenerativeAI; keyId: string } | null> {
    const availableKeys = this.getAvailableKeys(purpose);
    
    if (availableKeys.length === 0) {
      console.warn("No available API keys for purpose:", purpose);
      return null;
    }

    const purposeKey = `purpose-${purpose}`;
    let currentIndex = this.currentKeyIndex.get(purposeKey) || 0;
    
    if (currentIndex >= availableKeys.length) {
      currentIndex = 0;
    }

    const selectedKey = availableKeys[currentIndex];
    const genAI = this.genAIInstances.get(selectedKey.id);

    if (!genAI) {
      console.warn("GenAI instance not found for key:", selectedKey.id);
      return null;
    }

    this.currentKeyIndex.set(purposeKey, currentIndex + 1);

    return { genAI, keyId: selectedKey.id };
  }

  async executeWithFailover<T>(
    purpose: string,
    operation: (genAI: GoogleGenerativeAI) => Promise<T>,
    maxRetries: number = 3
  ): Promise<{ result: T; keyId: string } | null> {
    const availableKeys = this.getAvailableKeys(purpose);
    
    if (availableKeys.length === 0) {
      return null;
    }

    for (let attempt = 0; attempt < Math.min(maxRetries, availableKeys.length); attempt++) {
      const keyConfig = availableKeys[attempt];
      const genAI = this.genAIInstances.get(keyConfig.id);
      
      if (!genAI) continue;

      const startTime = Date.now();
      
      try {
        const result = await operation(genAI);
        const responseTime = Date.now() - startTime;

        this.recordUsage(keyConfig.id, true, responseTime);

        return { result, keyId: keyConfig.id };
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error?.message || "Unknown error";
        
        console.error(`API key ${keyConfig.name} failed:`, errorMessage);
        
        this.recordUsage(keyConfig.id, false, responseTime, errorMessage);

        const isRateLimit = 
          errorMessage.includes("429") || 
          errorMessage.includes("rate limit") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("RESOURCE_EXHAUSTED");

        if (isRateLimit) {
          const key = this.keys.get(keyConfig.id);
          if (key) {
            key.dailyUsage = key.dailyLimit;
          }
        }

        continue;
      }
    }

    return null;
  }

  private recordUsage(keyId: string, success: boolean, responseTime: number, error?: string): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.dailyUsage++;
      key.monthlyUsage++;
      key.lastUsed = new Date();
      
      if (!success) {
        key.errorCount++;
        key.lastError = error;
      } else {
        if (key.errorCount > 0) {
          key.errorCount = Math.max(0, key.errorCount - 1);
        }
      }
    }

    this.usageCallbacks.forEach((callback) => {
      callback({ success, keyId, responseTime, error });
    });
  }

  onUsage(callback: (result: ApiKeyUsageResult) => void): void {
    this.usageCallbacks.push(callback);
  }

  resetDailyUsage(): void {
    this.keys.forEach((key) => {
      key.dailyUsage = 0;
      key.errorCount = 0;
    });
  }

  resetMonthlyUsage(): void {
    this.keys.forEach((key) => {
      key.monthlyUsage = 0;
    });
  }

  getStats(): {
    totalKeys: number;
    activeKeys: number;
    availableKeys: number;
    keys: Array<{
      id: string;
      name: string;
      purpose: string;
      isActive: boolean;
      dailyUsage: number;
      dailyLimit: number;
      monthlyUsage: number;
      monthlyLimit: number;
      errorCount: number;
      lastUsed?: Date;
    }>;
  } {
    const stats = {
      totalKeys: this.keys.size,
      activeKeys: 0,
      availableKeys: 0,
      keys: [] as any[],
    };

    this.keys.forEach((key) => {
      if (key.isActive) stats.activeKeys++;
      if (key.isActive && key.dailyUsage < key.dailyLimit && key.monthlyUsage < key.monthlyLimit && key.errorCount < 5) {
        stats.availableKeys++;
      }
      
      stats.keys.push({
        id: key.id,
        name: key.name,
        purpose: key.purpose,
        isActive: key.isActive,
        dailyUsage: key.dailyUsage,
        dailyLimit: key.dailyLimit,
        monthlyUsage: key.monthlyUsage,
        monthlyLimit: key.monthlyLimit,
        errorCount: key.errorCount,
        lastUsed: key.lastUsed,
      });
    });

    return stats;
  }

  hasAvailableKeys(purpose: string = "general"): boolean {
    return this.getAvailableKeys(purpose).length > 0;
  }

  getAllKeys(): Array<{ name: string; key: string }> {
    const result: Array<{ name: string; key: string }> = [];
    this.keys.forEach((keyConfig) => {
      if (keyConfig.isActive) {
        result.push({ name: keyConfig.name, key: keyConfig.apiKey });
      }
    });
    return result;
  }

  getNextKey(): string | null {
    const available = this.getAvailableKeys("general");
    if (available.length === 0) return null;
    return available[0].apiKey;
  }
}

export const apiKeyManager = new ApiKeyManager();
export type { ApiKeyConfig, ApiKeyUsageResult };
