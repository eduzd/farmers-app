import { registerDmRoutes } from "./dmRoutes";
import { registerConnectRoutes } from "./connectRoutes";
import { registerProfileRoutes } from "./profileRoutes";
import { registerReactionRoutes } from "./reactionRoutes";
import { initCalls, handleCallMessage, onCallClientAuthed, onCallClientGone, registerCallRoutes } from "./calls";
import { initVoiceRooms, handleVoiceRoomMessage, onVoiceClientGone, registerVoiceRoomRoutes } from "./voiceRooms";
import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { apiKeyManager } from "./services/apiKeyManager";
import { db, dbReady } from "./db";
import { apiUsageLogs, apiKeys, calcRecords } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { Request, Response } from "express";

/**
 * Calculator records belong to the signed-in user. The account is taken only from a
 * valid Bearer token; a userId sent in the body or query is never trusted.
 * Returns the user id, or sends 401 and returns null.
 */
function calcRecordsUser(req: Request, res: Response): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) {
    try {
      const uid = (jwt.verify(h.slice(7), config.jwtSecret) as any)?.userId;
      if (typeof uid === "string" && uid) return uid;
    } catch {
      /* fall through to 401 */
    }
  }
  res.status(401).json({ error: "Sign in required" });
  return null;
}

/** A supplied userId that differs from the signed-in account is refused (403). */
function spoofedUserId(supplied: unknown, authUserId: string): boolean {
  return supplied !== undefined && supplied !== null && supplied !== "" && supplied !== authUserId;
}

async function loadApiKeysFromDB() {
  if (!db) return;
  try {
    const keys = await db.select().from(apiKeys);
    const formattedKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      apiKey: k.apiKey,
      purpose: k.purpose || "general",
      priority: k.priority || 1,
      isActive: k.isActive || false,
      dailyLimit: k.dailyLimit || 1000,
      monthlyLimit: k.monthlyLimit || 30000,
      dailyUsage: k.dailyUsage || 0,
      monthlyUsage: k.monthlyUsage || 0,
      errorCount: k.errorCount || 0,
    }));
    apiKeyManager.loadKeysFromDB(formattedKeys);
    console.log(`Loaded ${keys.length} API keys from database`);
  } catch (error) {
    console.error("Failed to load API keys from DB:", error);
  }
}

async function logApiUsage(keyId: string, endpoint: string, status: string, responseTime?: number, errorMessage?: string) {
  if (!db) return;
  try {
    await db.insert(apiUsageLogs).values({
      apiKeyId: keyId,
      endpoint,
      status,
      responseTime,
      errorMessage,
    });

    if (status === "success") {
      await db.update(apiKeys)
        .set({
          dailyUsage: (await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)))[0]?.dailyUsage! + 1 || 1,
          monthlyUsage: (await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)))[0]?.monthlyUsage! + 1 || 1,
          lastUsed: new Date(),
        })
        .where(eq(apiKeys.id, keyId));
    }
  } catch (error) {
    console.error("Failed to log API usage:", error);
  }
}

dbReady.then(loadApiKeysFromDB);

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "user" | "company";
  content: string;
  messageType: "text" | "image" | "voice";
  createdAt: string;
}

interface ChatClient {
  ws: WebSocket;
  userId: string;
  conversationIds: Set<string>;
}

// One person can be connected from several phones/tabs at once.
const chatClients = new Map<string, Set<ChatClient>>();

function addChatClient(userId: string, client: ChatClient) {
  let set = chatClients.get(userId);
  if (!set) chatClients.set(userId, (set = new Set()));
  set.add(client);
}

function removeChatClient(userId: string, client: ChatClient) {
  const set = chatClients.get(userId);
  if (!set) return;
  set.delete(client);
  if (!set.size) chatClients.delete(userId);
}

function userOnline(userId: string) {
  const set = chatClients.get(userId);
  return !!set && [...set].some((c) => c.ws.readyState === WebSocket.OPEN);
}

function sendToUser(userId: string, message: any, except?: WebSocket) {
  const set = chatClients.get(userId);
  if (!set) return false;
  let sent = false;
  const text = JSON.stringify(message);
  for (const c of set) {
    if (c.ws === except) continue;
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(text);
      sent = true;
    }
  }
  return sent;
}


const farmingResponses = [
  "For healthy crop growth, ensure proper spacing between plants and maintain consistent watering schedules.",
  "Consider using organic fertilizers like compost or manure to improve soil health naturally.",
  "Crop rotation is essential - it prevents soil depletion and reduces pest buildup.",
  "Monitor your crops regularly for early signs of disease or pest infestation.",
  "Proper drainage is crucial - waterlogged soil can lead to root rot and fungal diseases.",
  "For livestock health, maintain clean housing and provide balanced nutrition.",
  "Fish farming requires regular water quality monitoring - check pH, ammonia, and oxygen levels.",
  "Companion planting can naturally repel pests and improve crop yields.",
  "Keep detailed records of planting dates, treatments, and yields to improve future seasons.",
  "During dry seasons, consider mulching to retain soil moisture and regulate temperature.",
];

// No sample shops: these endpoints answer with empty lists until real shops are stored on the server.
const demoCompanies: any[] = [];

const demoProducts: Record<string, Array<{
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  category: string;
  status: string;
}>> = {};

export async function registerRoutes(app: Express): Promise<Server> {
  registerDmRoutes(app, sendToUser);
  registerConnectRoutes(app);
  registerCallRoutes(app);
  registerVoiceRoomRoutes(app);
  registerProfileRoutes(app);
  registerReactionRoutes(app, sendToUser);
  
  app.post("/api/voice-to-text", async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      
      if (!audioBase64) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      const audioContent = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
      const audioMime = mimeType || "audio/mp4";
      
      const result = await apiKeyManager.executeWithFailover(
        "general",
        async (genAI) => {
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: "শুধু বাংলা transcription দাও।"
          });
          
          const response = await model.generateContent([
            { inlineData: { data: audioContent, mimeType: audioMime } },
            { text: "transcribe" }
          ]);
          
          return response.response.text();
        }
      );

      if (result) {
        let transcript = result.result.trim();
        
        const promptPatterns = [
          /এই অডিও রেকর্ডিংটি শুনুন.*/gi,
          /শুধুমাত্র কথার টেক্সট.*/gi,
          /কোনো ব্যাখ্যা বা অতিরিক্ত.*/gi,
          /যদি কিছু শোনা না যায়.*/gi,
          /Transcribe this audio.*/gi,
        ];
        
        for (const pattern of promptPatterns) {
          transcript = transcript.replace(pattern, "").trim();
        }
        
        console.log("Gemini STT transcript:", transcript);
        
        return res.json({ 
          success: true, 
          transcript,
          confidence: 0.9
        });
      }
      
      res.status(500).json({ error: "Speech recognition failed" });
      
    } catch (error: any) {
      console.error("Voice-to-text error:", error?.message || error);
      res.status(500).json({ error: "Speech recognition failed" });
    }
  });

  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const apiKeys = apiKeyManager.getAllKeys();
      if (apiKeys.length === 0) {
        return res.status(500).json({ error: "TTS API not configured" });
      }

      let lastError: any = null;
      const maxRetries = 3;
      
      const attemptTTS = async (keyInfo: any): Promise<any> => {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${keyInfo.key}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{ text: `Read aloud the following text exactly as written, in Bengali: ${text}` }]
              }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: "Charon"
                    }
                  }
                }
              }
            }),
          }
        );

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error("Failed to parse TTS response");
        }
        
        if (response.ok) {
          const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          const mimeType = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "";
          
          console.log("TTS response mimeType:", mimeType, "audioData length:", audioData?.length || 0);
          
          if (audioData && audioData.length > 100) {
            let finalAudioContent = audioData;
            
            if (mimeType.includes("L16") || mimeType.includes("pcm")) {
              const pcmBuffer = Buffer.from(audioData, "base64");
              const sampleRate = 24000;
              const numChannels = 1;
              const bitsPerSample = 16;
              const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
              const blockAlign = numChannels * (bitsPerSample / 8);
              const dataSize = pcmBuffer.length;
              const wavHeader = Buffer.alloc(44);
              wavHeader.write("RIFF", 0);
              wavHeader.writeUInt32LE(36 + dataSize, 4);
              wavHeader.write("WAVE", 8);
              wavHeader.write("fmt ", 12);
              wavHeader.writeUInt32LE(16, 16);
              wavHeader.writeUInt16LE(1, 20);
              wavHeader.writeUInt16LE(numChannels, 22);
              wavHeader.writeUInt32LE(sampleRate, 24);
              wavHeader.writeUInt32LE(byteRate, 28);
              wavHeader.writeUInt16LE(blockAlign, 32);
              wavHeader.writeUInt16LE(bitsPerSample, 34);
              wavHeader.write("data", 36);
              wavHeader.writeUInt32LE(dataSize, 40);
              const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
              finalAudioContent = wavBuffer.toString("base64");
            }
            
            return { success: true, audioContent: finalAudioContent };
          }
        }

        const errorMsg = data?.error?.message || "No audio in response";
        if (errorMsg.includes("quota") || errorMsg.includes("429") || response.status === 429) {
          const retryMatch = errorMsg.match(/retry in (\d+\.?\d*)/i);
          const retryDelay = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 5000;
          throw { quotaExceeded: true, retryDelay, message: errorMsg };
        }
        
        throw new Error(errorMsg);
      };
      
      for (let retry = 0; retry < maxRetries; retry++) {
        let quotaExceededCount = 0;
        let minRetryDelay = 60000;
        
        for (const keyInfo of apiKeys) {
          try {
            const result = await attemptTTS(keyInfo);
            if (result.success) {
              console.log("TTS success, audio length:", result.audioContent.length);
              return res.json({ 
                success: true, 
                audioContent: result.audioContent,
                mimeType: "audio/wav",
              });
            }
          } catch (err: any) {
            if (err.quotaExceeded) {
              quotaExceededCount++;
              minRetryDelay = Math.min(minRetryDelay, err.retryDelay || 5000);
              console.log(`TTS key ${keyInfo.name} quota exceeded, retry in ${err.retryDelay}ms`);
            } else {
              console.log(`TTS key ${keyInfo.name} failed:`, err.message || err);
            }
            lastError = err;
          }
        }
        
        if (quotaExceededCount === apiKeys.length && retry < maxRetries - 1) {
          const waitTime = Math.min(minRetryDelay, 10000);
          console.log(`All keys quota exceeded. Waiting ${waitTime}ms before retry ${retry + 2}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (quotaExceededCount < apiKeys.length) {
          break;
        }
      }

      console.error("All TTS keys failed:", lastError);
      return res.status(500).json({ error: "Text-to-speech failed" });
    } catch (error: any) {
      console.error("Text-to-speech error:", error?.message || error);
      res.status(500).json({ error: "Text-to-speech failed" });
    }
  });

  const AI_NOT_CONFIGURED_NOTICE =
    "AI is not set up on the server yet (add GOOGLE_API_KEY to .env). Showing a general farming tip instead.";

  app.get("/api/ai-status", (_req, res) => {
    res.json({ aiConfigured: apiKeyManager.hasAvailableKeys("chat") });
  });

  app.post("/api/ai-chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const systemPrompt = `আপনি "কৃষি ভাই" - বাংলাদেশের কৃষি বিশেষজ্ঞ। এটা রিয়েল-টাইম ভয়েস কল।

অবশ্যই মানতে হবে:
- শুধু ১-২ বাক্যে উত্তর দিন। বেশি বলবেন না।
- শুধু বাংলায়। ইংরেজি নিষেধ।
- কথ্য ভাষা: "জি ভাই," "দেখুন," "আসলে" ব্যবহার করুন।
- কোনো *, #, বুলেট, ইমোজি নেই।
- সরাসরি উত্তর দিন, ভূমিকা বা বিদায় বাক্য দরকার নেই।

বিষয়: মাছ চাষ, পুকুর, ধান, সবজি, গবাদি পশু।`;

      const startTime = Date.now();
      const aiResult = await apiKeyManager.executeWithFailover("chat", async (genAI) => {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(`${systemPrompt}\n\nপ্রশ্ন: ${message}`);
        return result.response.text();
      });

      if (aiResult) {
        await logApiUsage(aiResult.keyId, "/api/ai-chat", "success", Date.now() - startTime);
        res.json({ 
          response: aiResult.result || "I apologize, but I couldn't generate a response. Please try again.",
          context: context || "general_farming",
          timestamp: new Date().toISOString()
        });
      } else {
        const randomIndex = Math.floor(Math.random() * farmingResponses.length);
        res.json({ 
          response: farmingResponses[randomIndex],
          context: "general_farming",
          aiConfigured: apiKeyManager.hasAvailableKeys("chat"),
          offline: true,
          notice: AI_NOT_CONFIGURED_NOTICE,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error("AI chat error:", error?.message || error);
      const randomIndex = Math.floor(Math.random() * farmingResponses.length);
      res.json({ 
        response: farmingResponses[randomIndex],
        context: "general_farming",
        aiConfigured: apiKeyManager.hasAvailableKeys("chat"),
        offline: true,
        notice: apiKeyManager.hasAvailableKeys("chat") ? "The AI service did not answer just now. Showing a general farming tip instead." : AI_NOT_CONFIGURED_NOTICE,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/analyze-disease", async (req, res) => {
    try {
      const { description, imageBase64, imageUri } = req.body;
      
      const fallbackAnalysis = `AI Disease Analysis:

Based on the information provided, here are potential observations:

1. Visual Assessment: The sample appears to show signs that may require further examination.

2. Recommendations:
   - Consult with a local agricultural expert for precise diagnosis
   - Monitor the affected area for changes over the next few days
   - Consider taking samples to your nearest agricultural extension office

3. General Tips:
   - Ensure proper drainage and soil health
   - Maintain appropriate spacing between plants
   - Use disease-resistant varieties when possible

Note: This is an AI-assisted preliminary analysis. Always verify with agricultural professionals for accurate diagnosis and treatment.`;

      const systemPrompt = `You are an expert agricultural disease diagnostician. You help farmers identify plant diseases, livestock health issues, and fish farming problems. Provide practical, actionable advice based on symptoms described or images provided. Always recommend consulting local agricultural experts for confirmation. Format your response clearly with numbered sections. সর্বদা বাংলায় উত্তর দিন।`;

      const userMessage = description 
        ? `I'm a farmer and I need help identifying a potential disease or problem. Here's what I'm observing: ${description}. Please analyze the symptoms and provide:
1. Possible diseases or conditions that match these symptoms
2. Treatment recommendations
3. Prevention tips for the future
4. When to seek professional help`
        : `I'm a farmer and I've noticed something concerning with my crops/livestock/fish. Please provide general guidance on:
1. Common diseases to look out for
2. How to identify symptoms early
3. Basic treatment approaches
4. Prevention best practices`;

      const startTime = Date.now();
      const aiResult = await apiKeyManager.executeWithFailover("disease", async (genAI) => {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        if (imageBase64) {
          const imagePart = {
            inlineData: {
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
              mimeType: "image/jpeg",
            },
          };
          const result = await model.generateContent([
            `${systemPrompt}\n\n${userMessage}\n\nPlease analyze the attached image for any signs of disease, pest damage, or health issues.`,
            imagePart,
          ]);
          return result.response.text();
        } else {
          const result = await model.generateContent(`${systemPrompt}\n\n${userMessage}`);
          return result.response.text();
        }
      });

      const analysis = aiResult?.result || fallbackAnalysis;
      if (aiResult) {
        await logApiUsage(aiResult.keyId, "/api/analyze-disease", "success", Date.now() - startTime);
      }
      
      res.json({
        success: true,
        analysis,
        offline: !aiResult,
        notice: aiResult ? undefined : AI_NOT_CONFIGURED_NOTICE.replace("a general farming tip", "general guidance"),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Disease detection error:", error?.message || error);
      res.json({
        success: true,
        offline: true,
        notice: "The AI service did not answer just now. Showing general guidance instead.",
        analysis: `AI Disease Analysis:

Based on your submission, here are some general recommendations:

1. Document the symptoms with clear photos from multiple angles
2. Note when symptoms first appeared and how they've progressed
3. Check nearby plants/animals for similar signs
4. Consult with your local agricultural extension office for expert diagnosis

Common issues to consider:
- Fungal infections (often show as spots, discoloration, or mold)
- Bacterial diseases (may cause wilting, rotting, or unusual growths)
- Nutrient deficiencies (typically show as yellowing or stunted growth)
- Pest damage (look for bite marks, webbing, or visible insects)

Note: For accurate diagnosis, please consult with local agricultural professionals.`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Calculator Records Sync API
  app.post("/api/calc-records/sync", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const {
        localId,
        userId: suppliedUserId,
        deviceId,
        recordType,
        createdAt,
        updatedAt,
        language,
        title,
        inputsJson,
        outputsJson,
        notes,
        tagsJson,
        archived,
      } = req.body;

      if (spoofedUserId(suppliedUserId, authUserId)) {
        return res.status(403).json({ error: "You can only sync your own records" });
      }
      const userId = authUserId;

      if (!recordType || !inputsJson || !outputsJson) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Only ever match records owned by the signed-in user.
      const existingByLocalId = localId
        ? await db
            .select()
            .from(calcRecords)
            .where(and(eq(calcRecords.localId, String(localId)), eq(calcRecords.userId, userId)))
        : [];

      if (existingByLocalId.length > 0) {
        const existing = existingByLocalId[0];
        await db
          .update(calcRecords)
          .set({
            recordType,
            language: language || "bn",
            title: title || null,
            inputsJson,
            outputsJson,
            notes: notes || null,
            tagsJson: tagsJson || null,
            archived: archived || false,
            updatedAt: new Date(),
          })
          .where(and(eq(calcRecords.id, existing.id), eq(calcRecords.userId, userId)));

        return res.json({ id: existing.id, action: "updated" });
      }

      const result = await db
        .insert(calcRecords)
        .values({
          localId: localId ? String(localId) : null,
          userId,
          deviceId: deviceId || null,
          recordType,
          language: language || "bn",
          title: title || null,
          inputsJson,
          outputsJson,
          notes: notes || null,
          tagsJson: tagsJson || null,
          archived: archived || false,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        })
        .returning({ id: calcRecords.id });

      res.json({ id: result[0].id, action: "created" });
    } catch (error) {
      console.error("Sync calc record error:", error);
      res.status(500).json({ error: "Failed to sync record" });
    }
  });

  app.get("/api/calc-records", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const { userId: suppliedUserId, limit = "100" } = req.query;
      if (spoofedUserId(suppliedUserId, authUserId)) {
        return res.status(403).json({ error: "You can only read your own records" });
      }

      const n = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 500);
      const records = await db
        .select()
        .from(calcRecords)
        .where(eq(calcRecords.userId, authUserId))
        .limit(n);

      res.json(records);
    } catch (error) {
      console.error("Get calc records error:", error);
      res.status(500).json({ error: "Failed to get records" });
    }
  });

  // A calculation deleted on the phone or website: remove this account's copy, matched by the
  // device's own id (also catches an upload whose reply was lost) or the server id. Deleting
  // something already gone is fine, so a retry after a dropped connection never fails.
  app.delete("/api/calc-records/local/:localId", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const localId = String(req.params.localId || "").slice(0, 200);
      if (!localId) return res.status(400).json({ error: "Missing record id" });
      const serverId = typeof req.query.serverId === "string" ? req.query.serverId.slice(0, 200) : "";

      const match = serverId
        ? or(eq(calcRecords.localId, localId), eq(calcRecords.id, localId), eq(calcRecords.id, serverId))
        : or(eq(calcRecords.localId, localId), eq(calcRecords.id, localId));
      const deleted = await db
        .delete(calcRecords)
        .where(and(eq(calcRecords.userId, authUserId), match))
        .returning({ id: calcRecords.id });

      res.json({ success: true, deleted: deleted.length });
    } catch (error) {
      console.error("Delete calc record error:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  app.delete("/api/calc-records/:id", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const { id } = req.params;
      const deleted = await db
        .delete(calcRecords)
        .where(and(eq(calcRecords.id, id), eq(calcRecords.userId, authUserId)))
        .returning({ id: calcRecords.id });

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete calc record error:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const { search, category, page = "1", limit = "20" } = req.query;
      let companies = [...demoCompanies];

      if (search && typeof search === "string") {
        const query = search.toLowerCase();
        companies = companies.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.description.toLowerCase().includes(query)
        );
      }

      if (category && category !== "all" && typeof category === "string") {
        companies = companies.filter((c) => c.category === category);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const start = (pageNum - 1) * limitNum;
      const paginatedCompanies = companies.slice(start, start + limitNum);

      res.json({
        companies: paginatedCompanies,
        total: companies.length,
        page: pageNum,
        totalPages: Math.ceil(companies.length / limitNum),
      });
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const company = demoCompanies.find((c) => c.id === id);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ error: "Failed to get company" });
    }
  });

  app.get("/api/companies/:id/products", async (req, res) => {
    try {
      const { id } = req.params;
      const { page = "1", limit = "20" } = req.query;
      
      const products = demoProducts[id] || [];
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const start = (pageNum - 1) * limitNum;
      const paginatedProducts = products.slice(start, start + limitNum);

      res.json({
        products: paginatedProducts,
        total: products.length,
        page: pageNum,
        totalPages: Math.ceil(products.length / limitNum),
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      for (const companyId of Object.keys(demoProducts)) {
        const product = demoProducts[companyId].find((p) => p.id === id);
        if (product) {
          const company = demoCompanies.find((c) => c.id === companyId);
          return res.json({ ...product, company });
        }
      }

      res.status(404).json({ error: "Product not found" });
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  app.get("/api/seed-data", async (req, res) => {
    try {
      const companiesWithProducts = demoCompanies.map((company) => ({
        ...company,
        products: demoProducts[company.id] || [],
      }));

      res.json({
        companies: companiesWithProducts,
        message: "Seed data retrieved successfully",
      });
    } catch (error) {
      console.error("Seed data error:", error);
      res.status(500).json({ error: "Failed to get seed data" });
    }
  });

  // bKash Payment Gateway Configuration
  const BKASH_CONFIG = {
    sandbox: {
      baseUrl: "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized",
      username: process.env.BKASH_USERNAME || "sandboxTokenizedUser02",
      password: process.env.BKASH_PASSWORD || "sandboxTokenizedUser02@12345",
      appKey: process.env.BKASH_APP_KEY || "4f6o0cjiki2rfm34kfdadl1eqq",
      appSecret: process.env.BKASH_APP_SECRET || "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
    },
    production: {
      baseUrl: "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized",
      username: process.env.BKASH_USERNAME || "",
      password: process.env.BKASH_PASSWORD || "",
      appKey: process.env.BKASH_APP_KEY || "",
      appSecret: process.env.BKASH_APP_SECRET || "",
    },
  };

  const isSandbox = process.env.BKASH_SANDBOX !== "false";
  const bkashConfig = isSandbox ? BKASH_CONFIG.sandbox : BKASH_CONFIG.production;

  let bkashToken: { idToken: string; refreshToken: string; expiresAt: number } | null = null;

  async function getBkashToken(): Promise<string> {
    const now = Date.now();
    if (bkashToken && bkashToken.expiresAt > now + 60000) {
      return bkashToken.idToken;
    }

    try {
      const response = await fetch(`${bkashConfig.baseUrl}/checkout/token/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          username: bkashConfig.username,
          password: bkashConfig.password,
        },
        body: JSON.stringify({
          app_key: bkashConfig.appKey,
          app_secret: bkashConfig.appSecret,
        }),
      });

      const data = await response.json();
      if (data.id_token) {
        bkashToken = {
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          expiresAt: now + (data.expires_in * 1000),
        };
        return data.id_token;
      }
      throw new Error(data.statusMessage || "Failed to get bKash token");
    } catch (error) {
      console.error("bKash token error:", error);
      throw error;
    }
  }

  // Store pending payments in memory (in production, use database)
  const pendingPayments = new Map<string, {
    paymentId: string;
    amount: string;
    invoiceNumber: string;
    paymentType: "welfare" | "summit";
    userId: string;
    createdAt: Date;
  }>();

  // Public base URL of this server (PUBLIC_URL in .env wins, else the request's own host,
  // which also works behind a tunnel / reverse proxy).
  function publicBaseUrl(req: any): string {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "http";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || `localhost:${process.env.PORT || 5000}`;
    return `${proto}://${host}`;
  }

  // Simple result pages bKash redirects to after checkout.
  const paymentPage = (title: string, body: string, color: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:"DM Sans",system-ui,sans-serif;background:#F3FAFF;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.c{background:#fff;border-radius:12px;padding:32px 24px;max-width:420px;width:100%;text-align:center;border:1px solid #D6EAF8}
h1{color:${color};font-size:22px;margin:0 0 12px}p{color:#4A5568;line-height:1.5;word-break:break-word}a{display:inline-block;margin-top:16px;background:#202936;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700}</style></head>
<body><div class="c"><h1>${title}</h1><p>${body}</p><a href="/">Back to Farmers</a></div></body></html>`;
  const esc = (v: unknown) => String(v ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] as string));
  app.get("/payment-success", (req, res) => {
    res.type("html").send(paymentPage("Payment successful", `Amount: ৳${esc(req.query.amount)}<br>Transaction ID: ${esc(req.query.trxId)}<br>You can close this page and return to the app.`, "#00875A"));
  });
  app.get("/payment-failed", (req, res) => {
    res.type("html").send(paymentPage("Payment failed", `Reason: ${esc(req.query.reason || "unknown")}. No money was taken. Please try again.`, "#DA2F2F"));
  });
  app.get("/payment-cancelled", (_req, res) => {
    res.type("html").send(paymentPage("Payment cancelled", "You cancelled the payment. No money was taken.", "#B25E09"));
  });

  // bKash Create Payment
  app.post("/api/bkash/create-payment", async (req, res) => {
    try {
      const { amount, paymentType, userId, callbackUrl } = req.body;
      
      if (!amount || !paymentType || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const idToken = await getBkashToken();
      const invoiceNumber = `INV${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch(`${bkashConfig.baseUrl}/checkout/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": bkashConfig.appKey,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: userId,
          callbackURL: callbackUrl || `${publicBaseUrl(req)}/api/bkash/callback`,
          amount: amount.toString(),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: invoiceNumber,
        }),
      });

      const data = await response.json();
      
      if (data.paymentID) {
        pendingPayments.set(data.paymentID, {
          paymentId: data.paymentID,
          amount: amount.toString(),
          invoiceNumber,
          paymentType,
          userId,
          createdAt: new Date(),
        });

        res.json({
          success: true,
          paymentID: data.paymentID,
          bkashURL: data.bkashURL,
          invoiceNumber,
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.statusMessage || "Failed to create payment",
        });
      }
    } catch (error) {
      console.error("bKash create payment error:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // bKash Execute Payment
  app.post("/api/bkash/execute-payment", async (req, res) => {
    try {
      const { paymentID } = req.body;
      
      if (!paymentID) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      const idToken = await getBkashToken();

      const response = await fetch(`${bkashConfig.baseUrl}/checkout/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": bkashConfig.appKey,
        },
        body: JSON.stringify({ paymentID }),
      });

      const data = await response.json();
      
      if (data.transactionStatus === "Completed") {
        const pendingPayment = pendingPayments.get(paymentID);
        if (pendingPayment) {
          pendingPayments.delete(paymentID);
        }

        res.json({
          success: true,
          transactionId: data.trxID,
          amount: data.amount,
          paymentExecuteTime: data.paymentExecuteTime,
          customerMsisdn: data.customerMsisdn,
          paymentType: pendingPayment?.paymentType,
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.statusMessage || "Payment execution failed",
          transactionStatus: data.transactionStatus,
        });
      }
    } catch (error) {
      console.error("bKash execute payment error:", error);
      res.status(500).json({ error: "Failed to execute payment" });
    }
  });

  // bKash Callback Handler
  app.get("/api/bkash/callback", async (req, res) => {
    const { paymentID, status } = req.query;
    
    if (status === "success" && paymentID) {
      try {
        const idToken = await getBkashToken();

        const response = await fetch(`${bkashConfig.baseUrl}/checkout/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            "X-APP-Key": bkashConfig.appKey,
          },
          body: JSON.stringify({ paymentID }),
        });

        const data = await response.json();
        const pendingPayment = pendingPayments.get(paymentID as string);
        
        if (data.transactionStatus === "Completed") {
          pendingPayments.delete(paymentID as string);
          res.redirect(`/payment-success?trxId=${data.trxID}&amount=${data.amount}&type=${pendingPayment?.paymentType || ""}`);
        } else {
          res.redirect(`/payment-failed?reason=${encodeURIComponent(data.statusMessage || "Payment failed")}`);
        }
      } catch (error) {
        console.error("bKash callback error:", error);
        res.redirect("/payment-failed?reason=callback_error");
      }
    } else if (status === "cancel") {
      res.redirect("/payment-cancelled");
    } else {
      res.redirect(`/payment-failed?reason=${status || "unknown"}`);
    }
  });

  // bKash Query Payment Status
  app.get("/api/bkash/payment-status/:paymentID", async (req, res) => {
    try {
      const { paymentID } = req.params;
      const idToken = await getBkashToken();

      const response = await fetch(`${bkashConfig.baseUrl}/checkout/payment/status?paymentID=${paymentID}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": bkashConfig.appKey,
        },
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("bKash status check error:", error);
      res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  // Push tokens and sending live in server/push.ts (signed-in users only).

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat", maxPayload: 256 * 1024 });
  initCalls({ sendToUser, userOnline });
  initVoiceRooms({ sendToUser, userOnline });

  // Keep idle sockets alive through Render's proxy and drop dead ones.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    });
  }, 30000);
  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: WebSocket) => {
    let clientId: string | null = null;
    let client: ChatClient | null = null;
    (ws as any).isAlive = true;
    ws.on("pong", () => { (ws as any).isAlive = true; });
    const reply = (m: any) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "ping") return reply({ type: "pong" });

        if (message.type === "auth") {
          // The socket belongs to whoever owns the sign-in token. A bare userId is not
          // accepted any more: anyone could have claimed someone else's id and read their messages.
          let uid: string | null = null;
          try {
            const decoded = jwt.verify(String(message.token || ""), config.jwtSecret) as any;
            uid = decoded?.userId ? String(decoded.userId) : null;
          } catch {
            uid = null;
          }
          if (!uid) return reply({ type: "auth_failed", reason: "invalid_token" });
          if (client && clientId) removeChatClient(clientId, client);
          clientId = uid;
          client = { ws, userId: uid, conversationIds: new Set() };
          addChatClient(uid, client);
          reply({ type: "auth_success", userId: uid });
          // Deliver a call that is still ringing for this person (e.g. after opening the push).
          onCallClientAuthed(uid, ws);
          return;
        }

        if (!clientId) return reply({ type: "error", reason: "not_authenticated" });

        const mtype = String(message.type || "");
        if (mtype.startsWith("call_") || mtype.startsWith("webrtc_")) {
          // In-app voice calls: see server/calls.ts (who may call whom, and relaying set-up messages).
          void handleCallMessage(clientId, ws, message, reply).catch((e) => console.error("Call message error:", e?.message || e));
          return;
        }
        if (mtype.startsWith("vr_")) {
          // Voice rooms: see server/voiceRooms.ts (stage, hands, host controls, WebRTC relay).
          void handleVoiceRoomMessage(clientId, ws, message, reply).catch((e) => console.error("Voice room message error:", e?.message || e));
          return;
        }

        switch (message.type) {
          default:
            // join_conversation / send_message / typing from the old unused chat hook are
            // no longer relayed: direct messages go through the /api/dm routes, which check
            // who is in the conversation.
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    const cleanup = () => {
      if (clientId && client) removeChatClient(clientId, client);
      // A person whose last socket closed gets a short grace period before their call ends.
      if (clientId) onCallClientGone(clientId);
      if (clientId) onVoiceClientGone(clientId, ws);
      client = null;
    };
    ws.on("close", cleanup);
    ws.on("error", (error) => {
      console.error("WebSocket error:", (error as any)?.message || error);
      cleanup();
    });
  });

  console.log("WebSocket server initialized at /ws/chat");

  const liveAudioWss = new WebSocketServer({ noServer: true });
  const liveAudioSessions = new Map<WebSocket, any>();

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url?.split("?")[0];
    
    if (pathname === "/ws/live-audio") {
      liveAudioWss.handleUpgrade(request, socket, head, (ws) => {
        liveAudioWss.emit("connection", ws, request);
      });
    }
  });

  liveAudioWss.on("connection", async (clientWs) => {
    console.log("Live audio client connected");
    
    const { createGeminiLiveSession, connectToGeminiLive, sendAudioToGemini, endGeminiSession, sendTextToGemini } = await import("./services/geminiLiveAudio");
    
    const session = createGeminiLiveSession(clientWs, "Charon");
    liveAudioSessions.set(clientWs, session);

    const connected = await connectToGeminiLive(session);
    if (!connected) {
      clientWs.send(JSON.stringify({ type: "error", message: "Failed to connect to AI" }));
      clientWs.close();
      return;
    }

    clientWs.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "audio":
            sendAudioToGemini(session, message.data, message.mimeType || "audio/pcm");
            break;
          case "text":
            sendTextToGemini(session, message.text);
            break;
          case "end":
            endGeminiSession(session);
            break;
        }
      } catch (error) {
        console.error("Live audio message error:", error);
      }
    });

    clientWs.on("close", () => {
      console.log("Live audio client disconnected");
      endGeminiSession(session);
      liveAudioSessions.delete(clientWs);
    });

    clientWs.on("error", (error) => {
      console.error("Live audio WebSocket error:", error);
      endGeminiSession(session);
      liveAudioSessions.delete(clientWs);
    });
  });

  console.log("Live Audio WebSocket initialized at /ws/live-audio");

  return httpServer;
}
