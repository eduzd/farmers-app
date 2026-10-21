import WebSocket from "ws";
import { apiKeyManager } from "./apiKeyManager";

interface GeminiLiveSession {
  ws: WebSocket | null;
  isConnected: boolean;
  clientWs: WebSocket;
  voiceName: string;
}

const GEMINI_LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

const KRISHI_BHAI_SYSTEM_INSTRUCTION = `তুমি "কৃষি ভাই" - একজন বন্ধুভাবাপন্ন বাংলাদেশি কৃষি বিশেষজ্ঞ। তুমি গ্রামের কৃষকদের সাথে ফোনে কথা বলছ।

তোমার বৈশিষ্ট্য:
- তুমি সবসময় বাংলায় কথা বল, সহজ ভাষায়
- তুমি গ্রামীণ কৃষকদের বন্ধু, তাই আন্তরিক ও উষ্ণ কথা বল
- "ভাই", "আপা" সম্বোধন ব্যবহার কর
- ছোট ছোট বাক্যে কথা বল, ২-৩ বাক্যের বেশি না
- মাছ চাষ, ধান চাষ, সবজি চাষ, গবাদি পশু পালন সম্পর্কে জান
- আবহাওয়া, সার, কীটনাশক, রোগবালাই নিয়ে পরামর্শ দাও
- সহানুভূতি দেখাও যখন কৃষকরা সমস্যার কথা বলে

মনে রাখ: এটা একটা ফোন কল, তাই কথোপকথন স্বাভাবিক রাখ।`;

export function createGeminiLiveSession(clientWs: WebSocket, voiceName: string = "Charon"): GeminiLiveSession {
  return {
    ws: null,
    isConnected: false,
    clientWs,
    voiceName,
  };
}

export async function connectToGeminiLive(session: GeminiLiveSession): Promise<boolean> {
  const apiKey = apiKeyManager.getNextKey();
  if (!apiKey) {
    console.error("No API key available for Gemini Live");
    return false;
  }

  const wsUrl = `${GEMINI_LIVE_URL}?key=${apiKey}`;

  return new Promise((resolve) => {
    try {
      session.ws = new WebSocket(wsUrl);

      session.ws.on("open", () => {
        console.log("Connected to Gemini Live API");
        
        const setupMessage = {
          setup: {
            model: `models/${MODEL}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: session.voiceName,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: KRISHI_BHAI_SYSTEM_INSTRUCTION }],
            },
          },
        };

        session.ws?.send(JSON.stringify(setupMessage));
        session.isConnected = true;
        resolve(true);
      });

      session.ws.on("message", (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.setupComplete) {
            console.log("Gemini Live setup complete");
            session.clientWs.send(JSON.stringify({ type: "setup_complete" }));
            return;
          }

          if (response.serverContent?.modelTurn?.parts) {
            for (const part of response.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                session.clientWs.send(JSON.stringify({
                  type: "audio",
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType || "audio/pcm",
                }));
              }
              if (part.text) {
                session.clientWs.send(JSON.stringify({
                  type: "text",
                  text: part.text,
                }));
              }
            }
          }

          if (response.serverContent?.turnComplete) {
            session.clientWs.send(JSON.stringify({ type: "turn_complete" }));
          }

        } catch (error) {
          console.error("Error parsing Gemini response:", error);
        }
      });

      session.ws.on("error", (error) => {
        console.error("Gemini Live WebSocket error:", error);
        session.isConnected = false;
        session.clientWs.send(JSON.stringify({ type: "error", message: "Connection error" }));
        resolve(false);
      });

      session.ws.on("close", () => {
        console.log("Gemini Live WebSocket closed");
        session.isConnected = false;
        session.clientWs.send(JSON.stringify({ type: "session_ended" }));
      });

    } catch (error) {
      console.error("Error connecting to Gemini Live:", error);
      resolve(false);
    }
  });
}

export function sendAudioToGemini(session: GeminiLiveSession, audioBase64: string, mimeType: string = "audio/pcm") {
  if (!session.ws || !session.isConnected) {
    console.log("Gemini Live not connected");
    return;
  }

  const message = {
    realtimeInput: {
      mediaChunks: [
        {
          data: audioBase64,
          mimeType: mimeType,
        },
      ],
    },
  };

  session.ws.send(JSON.stringify(message));
}

export function endGeminiSession(session: GeminiLiveSession) {
  if (session.ws) {
    try {
      session.ws.close();
    } catch (e) {}
    session.ws = null;
  }
  session.isConnected = false;
}

export function sendTextToGemini(session: GeminiLiveSession, text: string) {
  if (!session.ws || !session.isConnected) {
    console.log("Gemini Live not connected");
    return;
  }

  const message = {
    clientContent: {
      turns: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
      turnComplete: true,
    },
  };

  session.ws.send(JSON.stringify(message));
}
