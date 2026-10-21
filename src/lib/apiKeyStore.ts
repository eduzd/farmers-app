import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const API_KEYS_STORAGE_KEY = "@farmers_api_keys";

export interface ApiKeyEntry {
  id: string;
  key: string;
  name: string;
  addedAt: string;
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  lastError?: string;
}

interface ApiKeyState {
  keys: ApiKeyEntry[];
  currentKeyIndex: number;
  isLoaded: boolean;
  loadKeys: () => Promise<void>;
  addKey: (key: string, name?: string) => Promise<void>;
  removeKey: (id: string) => Promise<void>;
  updateKey: (id: string, updates: Partial<ApiKeyEntry>) => Promise<void>;
  rotateToNextKey: () => void;
  getCurrentKey: () => ApiKeyEntry | null;
  getActiveKeys: () => ApiKeyEntry[];
}

export const useApiKeyStore = create<ApiKeyState>((set, get) => ({
  keys: [],
  currentKeyIndex: 0,
  isLoaded: false,

  loadKeys: async () => {
    try {
      const stored = await AsyncStorage.getItem(API_KEYS_STORAGE_KEY);
      if (stored) {
        const keys = JSON.parse(stored) as ApiKeyEntry[];
        set({ keys, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
      set({ isLoaded: true });
    }
  },

  addKey: async (key: string, name?: string) => {
    const { keys } = get();
    const newEntry: ApiKeyEntry = {
      id: `key_${Date.now()}`,
      key,
      name: name || `API Key ${keys.length + 1}`,
      addedAt: new Date().toISOString(),
      isActive: true,
      usageCount: 0,
    };
    const updatedKeys = [...keys, newEntry];
    await AsyncStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updatedKeys));
    set({ keys: updatedKeys });
  },

  removeKey: async (id: string) => {
    const { keys, currentKeyIndex } = get();
    const updatedKeys = keys.filter((k) => k.id !== id);
    await AsyncStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updatedKeys));
    const newIndex = currentKeyIndex >= updatedKeys.length ? 0 : currentKeyIndex;
    set({ keys: updatedKeys, currentKeyIndex: newIndex });
  },

  updateKey: async (id: string, updates: Partial<ApiKeyEntry>) => {
    const { keys } = get();
    const updatedKeys = keys.map((k) =>
      k.id === id ? { ...k, ...updates } : k
    );
    await AsyncStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updatedKeys));
    set({ keys: updatedKeys });
  },

  rotateToNextKey: () => {
    const { keys, currentKeyIndex } = get();
    const activeKeys = keys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return;
    const nextIndex = (currentKeyIndex + 1) % activeKeys.length;
    set({ currentKeyIndex: nextIndex });
  },

  getCurrentKey: () => {
    const { keys, currentKeyIndex } = get();
    const activeKeys = keys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return null;
    const safeIndex = currentKeyIndex % activeKeys.length;
    return activeKeys[safeIndex] || null;
  },

  getActiveKeys: () => {
    const { keys } = get();
    return keys.filter((k) => k.isActive);
  },
}));
