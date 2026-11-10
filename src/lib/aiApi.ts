import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";

/** Main-app client for the AI endpoints in server/aiRoutes.ts. The server uses the admin's AI keys. */

export type AiStatus = { chat: boolean; disease: boolean; voiceCall: boolean; voice: { en: string | null; bn: string | null; natural: boolean } };
export type Diagnosis = {
  healthy: boolean; subject: string; diseaseName: string; scientificName: string; confidence: number; severity: "low" | "medium" | "high";
  summary: string; symptoms: string[]; causes: string[]; treatment: string[]; prevention: string[];
  otherPossibilities: { name: string; confidence: number }[]; seeSpecialist: boolean; notClear: boolean; model?: string;
};

export class AiRequestError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

async function call<T>(method: "GET" | "POST", path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const t = await useAuthStore.getState().getToken?.();
    if (t) headers.Authorization = `Bearer ${t}`;
  } catch {}
  let r: Response;
  try {
    r = await fetch(new URL(path, getApiUrl()).toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new AiRequestError("offline", "offline");
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiRequestError(j?.error || `Error ${r.status}`, j?.code || (r.status === 429 ? "rate_limited" : "failed"));
  return j as T;
}

export const aiStatus = () => call<AiStatus>("GET", "/api/ai/status");
export const aiChat = (message: string, history: { role: "user" | "assistant"; content: string }[], lang: string, image?: { base64: string; mimeType?: string }) =>
  call<{ reply: string }>("POST", "/api/ai/chat", { message, history, lang, imageBase64: image?.base64, mimeType: image?.mimeType });
export const aiDiagnose = (p: { imageBase64?: string; mimeType?: string; description?: string; category: string; lang: string }) =>
  call<{ result: Diagnosis }>("POST", "/api/ai/disease", p);
export const aiVoiceTurn = (p: { audioBase64?: string; mimeType?: string; text?: string; history: { role: "user" | "assistant"; content: string }[]; lang: string; wantAudio?: boolean }) =>
  call<{ heard: boolean; transcript: string; reply: string; audioBase64: string | null; mimeType: string | null; voice: string | null }>("POST", "/api/ai/voice/turn", p);
export const aiVoiceGreet = (lang: string) =>
  call<{ reply: string; audioBase64: string | null; mimeType: string | null; voice: string | null }>("POST", "/api/ai/voice/greet", { lang });

/** A friendly message for an AI error, in the app's language. */
export function aiErrorText(e: any, bn: boolean): string {
  const code = e?.code || "";
  if (code === "offline") return bn ? "ইন্টারনেট সংযোগ নেই। আবার চেষ্টা করুন।" : "No internet connection. Please try again.";
  if (code === "not_configured") return bn ? "এআই এখনো চালু হয়নি। অ্যাডমিন সেট আপ করলে কাজ করবে।" : "AI isn't set up yet. It will work once the admin sets it up.";
  if (code === "disabled") return bn ? "এই এআই ফিচারটি এখন বন্ধ আছে।" : "This AI feature is turned off right now.";
  if (code === "rate_limited") return bn ? "অনেক বেশি অনুরোধ। এক মিনিট পরে আবার চেষ্টা করুন।" : "Too many requests. Please wait a minute and try again.";
  if (code === "daily_limit") return bn ? "আজকের এআই সীমা শেষ। কাল আবার চেষ্টা করুন।" : e?.message || "Today's AI limit is used up.";
  if (code === "bad_request" && e?.message) return e.message;
  return bn ? "এআই এখন উত্তর দিতে পারছে না। একটু পরে আবার চেষ্টা করুন।" : "The AI couldn't answer just now. Please try again in a moment.";
}
