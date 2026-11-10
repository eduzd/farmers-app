/**
 * AI engine: every AI feature in the Farmers app goes through here, using the keys the admin enters in
 * Admin > More > AI settings.
 *
 *  - Text and photo AI (AI help chat, disease detector, the brain of the AI call) uses "Omni route" keys:
 *    any OpenAI-compatible gateway (OmniRoute, OpenRouter, OpenAI, Google Gemini's OpenAI endpoint or a
 *    custom URL). A key is a base URL + API key; each feature picks its model. Several keys fail over in order.
 *  - Voice (AI call) uses voice providers from different companies: OpenAI, ElevenLabs, Google Gemini or any
 *    OpenAI-compatible speech endpoint. Each language (English, Bangla) gets its own provider + voice.
 *
 * Keys are encrypted at rest (AES-256-GCM, key from AI_KEYS_SECRET or JWT_SECRET) inside app_settings
 * ('ai_config') and are never sent to any client; the admin sees only the last 4 characters.
 * If no admin key works, the old server Gemini keys (GOOGLE_API_KEY*) are used as a backup when the admin
 * leaves "Use server backup key" on.
 */
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { apiKeyManager } from "./services/apiKeyManager";

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const J = (v: any) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

// ---------------------------------------------------------------- types
export const GATEWAY_PRESETS: Record<string, { label: string; baseUrl: string; hint: string }> = {
  omniroute: { label: "OmniRoute", baseUrl: "", hint: "Your OmniRoute address ending in /v1, e.g. https://omniroute.example.com/v1" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", hint: "Models look like openai/gpt-4o-mini or google/gemini-2.5-flash" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", hint: "Models like gpt-4o-mini, gpt-4.1-mini" },
  gemini: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", hint: "Models like gemini-2.5-flash" },
  custom: { label: "Other (OpenAI-compatible)", baseUrl: "", hint: "Any OpenAI-compatible base URL ending in /v1" },
};
export type GatewayKind = keyof typeof GATEWAY_PRESETS;

export type GatewayKey = {
  id: string;
  label: string;
  provider: GatewayKind;
  baseUrl: string;
  keyEnc: string;
  keyLast4: string;
  enabled: boolean;
  models?: string[];
  modelInfo?: ModelInfo[];
  modelsAt?: string | null;
  modelsError?: string | null;
  lastTest?: { ok: boolean; at: string; message: string; ms?: number } | null;
  createdAt: string;
  updatedAt?: string;
};

/** One model a key offers. vision: can it read photos (from the provider when it says so, else a guess from the name). */
export type ModelInfo = { id: string; name?: string; vision: boolean; visionFrom: "provider" | "guess"; context?: number; free?: boolean };

export type FeatureName = "chat" | "disease" | "voice" | "feedmix";
export const FEATURES: FeatureName[] = ["chat", "disease", "voice", "feedmix"];
export type FeatureCfg = { enabled: boolean; model: string; keyId: string | null; temperature: number };

export const VOICE_COMPANIES = ["openai", "elevenlabs", "gemini", "heygen", "compatible"] as const;
export type VoiceCompany = (typeof VOICE_COMPANIES)[number];
export type VoiceProvider = {
  id: string;
  label: string;
  company: VoiceCompany;
  baseUrl?: string;
  keyEnc: string;
  keyLast4: string;
  enabled: boolean;
  lastTest?: { ok: boolean; at: string; message: string } | null;
  createdAt: string;
};
export type VoiceChoice = { providerId: string; voiceId: string; voiceName: string; model: string };

export type AiConfig = {
  keys: GatewayKey[];
  features: Record<FeatureName, FeatureCfg>;
  voice: {
    callEnabled: boolean;
    providers: VoiceProvider[];
    en: VoiceChoice | null;
    bn: VoiceChoice | null;
    speed: number;
    sttProviderId: string | null; // a voice provider id, or null = automatic
  };
  limits: { perMinute: number; userDaily: number; guestDaily: number };
  extraInstructions: string;
  useServerBackup: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const DEFAULT_AI: AiConfig = {
  keys: [],
  features: {
    chat: { enabled: true, model: "", keyId: null, temperature: 0.6 },
    disease: { enabled: true, model: "", keyId: null, temperature: 0.2 },
    voice: { enabled: true, model: "", keyId: null, temperature: 0.6 },
    // Feed mix protein check. An empty model means "use the AI help chat model and key".
    feedmix: { enabled: true, model: "", keyId: null, temperature: 0.2 },
  },
  voice: { callEnabled: true, providers: [], en: null, bn: null, speed: 1, sttProviderId: null },
  limits: { perMinute: 8, userDaily: 150, guestDaily: 25 },
  extraInstructions: "",
  useServerBackup: true,
  updatedAt: null,
  updatedBy: null,
};

// Voices each company offers. ElevenLabs voices are read live from the admin's account.
export const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
export const GEMINI_VOICES: [string, string][] = [
  ["Kore", "Firm"], ["Puck", "Upbeat"], ["Charon", "Informative"], ["Zephyr", "Bright"], ["Fenrir", "Excitable"],
  ["Leda", "Youthful"], ["Orus", "Firm"], ["Aoede", "Breezy"], ["Callirrhoe", "Easy-going"], ["Autonoe", "Bright"],
  ["Enceladus", "Breathy"], ["Iapetus", "Clear"], ["Umbriel", "Easy-going"], ["Algieba", "Smooth"], ["Despina", "Smooth"],
  ["Erinome", "Clear"], ["Algenib", "Gravelly"], ["Rasalgethi", "Informative"], ["Laomedeia", "Upbeat"], ["Achernar", "Soft"],
  ["Alnilam", "Firm"], ["Schedar", "Even"], ["Gacrux", "Mature"], ["Pulcherrima", "Forward"], ["Achird", "Friendly"],
  ["Zubenelgenubi", "Casual"], ["Vindemiatrix", "Gentle"], ["Sadachbia", "Lively"], ["Sadaltager", "Knowledgeable"], ["Sulafat", "Warm"],
];
export const TTS_MODELS: Record<VoiceCompany, string[]> = {
  openai: ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
  elevenlabs: ["eleven_v3", "eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_turbo_v2_5"],
  gemini: ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"],
  // HeyGen Voice (Starfish): the free turbo tier first. It speaks only (no speech to text) and has no Bangla.
  heygen: ["heygen-voice-1-turbo-free", "heygen-voice-1-turbo", "heygen-voice-1"],
  // Omni route: OpenAI speech needs OpenAI set up in Omni route; Gemini speech works with a Gemini voice name (Kore, Puck...).
  compatible: ["gpt-4o-mini-tts", "tts-1", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"],
};
export const HEYGEN_API = process.env.HEYGEN_API_BASE || "https://api.heygen.com";
/** Text HeyGen can't say: its voices don't include Bangla, so Bangla script goes to another voice or the phone. */
export const hasBangla = (t: string) => /[\u0980-\u09FF]/.test(t);

// ---------------------------------------------------------------- encryption
function secretKey(): Buffer {
  const base = process.env.AI_KEYS_SECRET || config.jwtSecret || "farmers-dev";
  return crypto.createHash("sha256").update(`farmers-ai-keys:${base}`).digest();
}
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}
export function decrypt(blob: string): string | null {
  try {
    const [v, iv, tag, data] = String(blob || "").split(":");
    if (v !== "v1") return null;
    const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
export const last4 = (k: string) => k.trim().slice(-4);

// ---------------------------------------------------------------- storage
let ready: Promise<void> | null = null;
function ensure() {
  if (!ready) {
    ready = db.execute(sql`CREATE TABLE IF NOT EXISTS app_settings (key varchar PRIMARY KEY, value text)`).then(() => {}).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
let cache: { at: number; v: AiConfig } | null = null;

function normalize(v: any): AiConfig {
  const d: AiConfig = JSON.parse(JSON.stringify(DEFAULT_AI));
  if (!v || typeof v !== "object") return d;
  d.keys = Array.isArray(v.keys) ? v.keys : [];
  for (const f of FEATURES) d.features[f] = { ...d.features[f], ...(v.features?.[f] || {}) };
  d.voice = { ...d.voice, ...(v.voice || {}) };
  d.voice.providers = Array.isArray(v.voice?.providers) ? v.voice.providers : [];
  d.limits = { ...d.limits, ...(v.limits || {}) };
  d.extraInstructions = String(v.extraInstructions || "");
  d.useServerBackup = v.useServerBackup !== false;
  d.updatedAt = v.updatedAt || null;
  d.updatedBy = v.updatedBy || null;
  return d;
}

export async function aiConfig(fresh = false): Promise<AiConfig> {
  if (!fresh && cache && Date.now() - cache.at < 5000) return cache.v;
  await ensure();
  let v: AiConfig = normalize(null);
  try {
    const r = rows(await db.execute(sql`SELECT value FROM app_settings WHERE key = 'ai_config' LIMIT 1`));
    v = normalize(J(r[0]?.value));
  } catch (e: any) {
    console.error("[ai] load config", e?.message);
  }
  cache = { at: Date.now(), v };
  return v;
}

export async function saveAiConfig(c: AiConfig, by: string | null) {
  await ensure();
  c.updatedAt = new Date().toISOString();
  c.updatedBy = by;
  const s = JSON.stringify(c);
  await db.execute(sql`INSERT INTO app_settings (key, value) VALUES ('ai_config', ${s})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
  cache = { at: Date.now(), v: c };
}

// ---------------------------------------------------------------- usage (kept in memory, shown to the admin)
const usage = new Map<string, { day: string; today: number; total: number; errors: number; lastError?: string; lastAt?: string }>();
const today = () => new Date().toISOString().slice(0, 10);
export function noteUse(id: string, ok: boolean, err?: string) {
  const u = usage.get(id) || { day: today(), today: 0, total: 0, errors: 0 };
  if (u.day !== today()) { u.day = today(); u.today = 0; }
  if (ok) { u.today++; u.total++; u.lastAt = new Date().toISOString(); } else { u.errors++; u.lastError = err?.slice(0, 160); }
  usage.set(id, u);
}
export function usageOf(id: string) {
  const u = usage.get(id);
  return u ? { today: u.day === today() ? u.today : 0, sinceRestart: u.total, errors: u.errors, lastError: u.lastError || null, lastAt: u.lastAt || null } : { today: 0, sinceRestart: 0, errors: 0, lastError: null, lastAt: null };
}
const cooldown = new Map<string, number>(); // key id -> until (ms) after a 429

// ---------------------------------------------------------------- errors
export class AiError extends Error {
  constructor(public code: "not_configured" | "disabled" | "failed" | "bad_request" | "rate_limited", message: string, public status = 503) {
    super(message);
  }
}

async function readErr(r: Response): Promise<string> {
  const t = await r.text().catch(() => "");
  const j = J(t);
  const m = j?.error?.message || j?.error?.code || j?.detail?.message || j?.detail || j?.message || t;
  return `${r.status} ${typeof m === "string" ? m : JSON.stringify(m)}`.slice(0, 300);
}

const withTimeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

// ---------------------------------------------------------------- OpenAI-compatible chat
export type ChatMsg = { role: "system" | "user" | "assistant"; content: any };
type Target = { id: string; label: string; baseUrl: string; key: string; provider: string };

function gatewayHeaders(t: { key: string; provider: string }) {
  const h: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` };
  if (t.provider === "openrouter") { h["HTTP-Referer"] = "https://farmers-2ybg.onrender.com"; h["X-Title"] = "Farmers"; }
  return h;
}
const trimBase = (u: string) => String(u || "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");

export async function callChat(t: Target, model: string, messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number; json?: boolean; timeoutMs?: number } = {}) {
  const body: any = { model, messages, temperature: opts.temperature ?? 0.6, max_tokens: opts.maxTokens ?? 900 };
  const to = withTimeout(opts.timeoutMs ?? 45000);
  const started = Date.now();
  try {
    const r = await fetch(`${trimBase(t.baseUrl)}/chat/completions`, { method: "POST", headers: gatewayHeaders(t), body: JSON.stringify(body), signal: to.signal });
    if (!r.ok) {
      const e: any = new Error(await readErr(r));
      e.status = r.status;
      throw e;
    }
    const j: any = await r.json();
    const c = j?.choices?.[0]?.message?.content;
    const text = Array.isArray(c) ? c.map((p: any) => p?.text || "").join("") : String(c ?? "");
    if (!text.trim()) throw new Error("The AI sent back an empty answer");
    return { text: text.trim(), model: j?.model || model, ms: Date.now() - started };
  } catch (e: any) {
    if (e?.name === "AbortError") throw Object.assign(new Error("The AI took too long to answer"), { status: 504 });
    throw e;
  } finally {
    to.done();
  }
}

// Models that can't answer a chat (embeddings, speech, image makers, moderation) are left out of the list.
const NOT_CHAT = /(^|[\/:-])(text-)?embed|embedding|whisper|(^|[\/-])tts|transcribe|dall-e|imagen|moderation|^babbage|^davinci|realtime|-audio|^veo|^aqa|image-generation|rerank|^sora|lyria/i;
// Families known to read photos, used only when the provider doesn't say.
const VISION_GUESS = /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|gpt-5|chatgpt-4o|(^|[\/])o[134](-|$)|gemini|gemma-3|claude-3|claude-(sonnet|opus|haiku)|claude-.*-4|vision|[-_]vl\b|-vl-|llava|pixtral|qwen.*vl|qvq|llama-4|llama-3\.2-(11|90)b|grok-(2-vision|4)|mistral-(small|medium)-3|phi-4-multimodal|minicpm-v|internvl|glm-4\.?5?v|kimi-vl|nova-(lite|pro)/i;
const NO_VISION_GUESS = /gemini-(1\.0|pro$)|gpt-4o-mini-(audio|search|transcribe|tts)|gpt-5-(nano-)?chat-latest-audio|o1-mini|o3-mini|-instruct$|codex/i;

function parseModel(m: any): ModelInfo | null {
  const id = String(typeof m === "string" ? m : m?.id || m?.name || "").replace(/^models\//, "").trim();
  if (!id || NOT_CHAT.test(id)) return null;
  if (m && typeof m === "object") {
    const methods: any = m.supportedGenerationMethods || m.supported_generation_methods;
    if (Array.isArray(methods) && methods.length && !methods.includes("generateContent")) return null;
    const outMods: any = m.architecture?.output_modalities || m.output_modalities;
    if (Array.isArray(outMods) && outMods.length && !outMods.includes("text")) return null;
  }
  let said: boolean | null = null;
  if (m && typeof m === "object") {
    const mods: any = m.architecture?.input_modalities || m.input_modalities || m.modalities?.input || m.inputModalities || (Array.isArray(m.modalities) ? m.modalities : null);
    if (Array.isArray(mods) && mods.length) said = mods.map(String).some((x: string) => /image|vision/i.test(x));
    const arch = m.architecture?.modality || (typeof m.modality === "string" ? m.modality : "");
    if (said === null && typeof arch === "string" && arch.includes("->")) said = /image/i.test(arch.split("->")[0]);
    const caps: any = m.capabilities;
    if (said === null && caps && typeof caps === "object") {
      if (Array.isArray(caps)) { if (caps.length) said = caps.map(String).some((x: string) => /vision|image/i.test(x)); }
      else if ("vision" in caps) said = !!caps.vision;
      else if ("image_input" in caps) said = !!caps.image_input;
    }
    if (said === null && typeof m.supports_vision === "boolean") said = m.supports_vision;
    if (said === null && typeof m.vision === "boolean") said = m.vision;
  }
  const guess = VISION_GUESS.test(id) && !NO_VISION_GUESS.test(id);
  const info: ModelInfo = { id, vision: said ?? guess, visionFrom: said === null ? "guess" : "provider" };
  if (m && typeof m === "object") {
    const name = String(m.name && m.name !== m.id && !String(m.name).startsWith("models/") ? m.name : m.displayName || m.display_name || "").trim();
    if (name && name !== id) info.name = name.slice(0, 80);
    const ctx = Number(m.context_length || m.contextLength || m.inputTokenLimit || m.context_window || m.top_provider?.context_length || 0);
    if (ctx > 0) info.context = ctx;
    const pr = m.pricing;
    if (pr && typeof pr === "object" && Number(pr.prompt) === 0 && Number(pr.completion) === 0) info.free = true;
    else if (/:free$/.test(id)) info.free = true;
  }
  return info;
}

/** The chat models a key offers, read live from its provider's /models list. */
export async function listModelInfo(t: Target): Promise<ModelInfo[]> {
  const to = withTimeout(15000);
  try {
    const r = await fetch(`${trimBase(t.baseUrl)}/models`, { headers: gatewayHeaders(t), signal: to.signal });
    if (!r.ok) throw new Error(await readErr(r));
    const j: any = await r.json().catch(() => { throw new Error("The provider's model list wasn't readable"); });
    const list = Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : Array.isArray(j) ? j : [];
    const seen = new Set<string>();
    const out: ModelInfo[] = [];
    for (const m of list) {
      const x = parseModel(m);
      if (!x || seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
      if (out.length >= 600) break;
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The provider took too long to send its model list");
    throw e;
  } finally {
    to.done();
  }
}

export async function listModels(t: Target): Promise<string[]> {
  return (await listModelInfo(t)).map((m) => m.id);
}

export function gatewayTarget(k: GatewayKey): Target | null {
  const key = decrypt(k.keyEnc);
  if (!key || !k.baseUrl) return null;
  return { id: k.id, label: k.label, baseUrl: k.baseUrl, key, provider: k.provider };
}

function backupTargets(): Target[] {
  try {
    return apiKeyManager.getAllKeys().map((k: any, i: number) => ({
      id: `server-backup-${i}`, label: "Server backup key", baseUrl: GATEWAY_PRESETS.gemini.baseUrl, key: k.key || k.apiKey, provider: "gemini",
    })).filter((t: Target) => !!t.key);
  } catch {
    return [];
  }
}
export const hasServerBackup = () => backupTargets().length > 0;
const BACKUP_MODEL = "gemini-2.5-flash";

/** Which keys a feature would use, in order. */
/** The model/key settings a feature really uses: the feed mix check borrows the help chat's when it has no model of its own. */
export function effectiveFeature(c: AiConfig, f: FeatureName): FeatureCfg {
  const fc = c.features[f];
  if (f === "feedmix" && !fc.model.trim()) return { ...c.features.chat, enabled: fc.enabled, temperature: fc.temperature };
  return fc;
}

export function featureTargets(c: AiConfig, f: FeatureName): { target: Target; model: string }[] {
  const fc = effectiveFeature(c, f);
  const out: { target: Target; model: string }[] = [];
  if (fc.model.trim()) {
    const keys = c.keys.filter((k) => k.enabled && (!fc.keyId || k.id === fc.keyId));
    for (const k of keys) {
      const t = gatewayTarget(k);
      if (t) out.push({ target: t, model: fc.model.trim() });
    }
  }
  if (c.useServerBackup) for (const t of backupTargets()) out.push({ target: t, model: BACKUP_MODEL });
  return out;
}

export function featureReady(c: AiConfig, f: FeatureName) {
  return c.features[f].enabled && (f !== "feedmix" || c.features.feedmix.model.trim() || c.features.chat.enabled) && featureTargets(c, f).length > 0;
}

/** Run a chat completion for a feature, failing over across its keys. */
export async function runFeature(f: FeatureName, messages: ChatMsg[], opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}) {
  const c = await aiConfig();
  if (!c.features[f].enabled || (f === "feedmix" && !c.features.feedmix.model.trim() && !c.features.chat.enabled)) throw new AiError("disabled", "This AI feature is turned off by the admin");
  const targets = featureTargets(c, f);
  if (!targets.length) throw new AiError("not_configured", "AI isn't set up yet. The admin needs to add an Omni route key and choose a model in AI settings.");
  let last = "";
  for (const { target, model } of targets) {
    if ((cooldown.get(target.id) || 0) > Date.now()) continue;
    try {
      const o = { temperature: opts.temperature ?? effectiveFeature(c, f).temperature, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs };
      let r;
      try { r = await callChat(target, model, messages, o); }
      catch (e: any) {
        // Routers sometimes hand back an empty answer once; one more try on the same key usually works.
        if (!/empty answer/i.test(e?.message || "")) throw e;
        console.warn(`[ai] ${f} via ${target.label} (${model}): empty answer, trying once more`);
        r = await callChat(target, model, messages, { ...o, temperature: Math.min(1, (o.temperature ?? 0.5) + 0.2) });
      }
      noteUse(target.id, true);
      return { ...r, keyId: target.id };
    } catch (e: any) {
      last = e?.message || "failed";
      noteUse(target.id, false, last);
      if (e?.status === 429) cooldown.set(target.id, Date.now() + 60_000);
      console.warn(`[ai] ${f} via ${target.label} (${model}) failed: ${last}`);
    }
  }
  throw new AiError("failed", `The AI service didn't answer. ${last ? `(${last.slice(0, 140)})` : ""}`.trim(), 502);
}

/** Read a JSON object out of a model's answer: drops thinking blocks and code fences, finds the first
 *  balanced {...}, and mends trailing commas and smart quotes. Returns null when nothing usable is there. */
export function extractJson(t: string): any {
  let s = String(t || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "");
  s = s.replace(/```(?:json|JSON)?/g, "").trim();
  const tryParse = (x: string) => { try { const v = JSON.parse(x); return v && typeof v === "object" ? v : null; } catch { return null; } };
  const direct = tryParse(s);
  if (direct) return direct;
  for (let start = s.indexOf("{"); start >= 0; start = s.indexOf("{", start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        const chunk = s.slice(start, i + 1);
        const v = tryParse(chunk) || tryParse(chunk.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D]/g, '"'));
        if (v) return v;
        break;
      }
    }
  }
  return null;
}

/** Run a feature that must answer with JSON; asks once more, more firmly, when the first answer isn't readable. */
export async function runFeatureJson(f: FeatureName, messages: ChatMsg[], opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}) {
  const r = await runFeature(f, messages, opts);
  let j = extractJson(r.text);
  if (j) return { ...r, json: j };
  console.warn(`[ai] ${f}: answer wasn't JSON, asking again. Start: ${String(r.text).slice(0, 160)}`);
  const again = await runFeature(f, [...messages, { role: "assistant", content: String(r.text).slice(0, 2000) }, { role: "user", content: "That wasn't valid JSON. Send ONLY the JSON object, starting with { and ending with }, nothing else." }], opts);
  j = extractJson(again.text);
  if (!j) throw new AiError("failed", "The AI's answer couldn't be read. Please try again.", 502);
  return { ...again, json: j };
}

// ---------------------------------------------------------------- voice: text to speech
export type Audio = { base64: string; mime: string };

function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function providerKey(p: VoiceProvider) {
  return decrypt(p.keyEnc);
}

export async function tts(p: VoiceProvider, voiceId: string, model: string, text: string, lang: "en" | "bn", speed = 1): Promise<Audio> {
  const key = providerKey(p);
  if (!key) throw new AiError("not_configured", "This voice provider's key can't be read. Enter the key again.");
  const input = text.slice(0, 3000);
  const to = withTimeout(45000);
  try {
    if (p.company === "openai" || p.company === "compatible") {
      const base = p.company === "openai" ? "https://api.openai.com/v1" : trimBase(p.baseUrl || "");
      if (!base) throw new AiError("bad_request", "Add the speech address (base URL) for this provider", 400);
      const m = model || "gpt-4o-mini-tts";
      const body: any = { model: m, voice: voiceId || "alloy", input, response_format: "mp3", speed: Math.min(2, Math.max(0.5, speed)) };
      if (m.includes("gpt-4o")) body.instructions = lang === "bn" ? "Speak natural, warm Bangladeshi Bangla, clearly and at a relaxed pace, like a friendly farm advisor." : "Speak warmly and clearly, like a friendly farm advisor.";
      const r = await fetch(`${base}/audio/speech`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: to.signal });
      if (!r.ok) throw new Error(await readErr(r));
      const buf = Buffer.from(await r.arrayBuffer());
      // A gateway may answer with WAV (Gemini speech through Omni route) even when MP3 was asked for.
      const ct = String(r.headers.get("content-type") || "");
      const mime = buf.slice(0, 4).toString("latin1") === "RIFF" ? "audio/wav" : buf.slice(0, 4).toString("latin1") === "OggS" ? "audio/ogg" : /audio\/(wav|x-wav|ogg|aac|flac)/.test(ct) ? ct.split(";")[0] : "audio/mpeg";
      return { base64: buf.toString("base64"), mime };
    }
    if (p.company === "elevenlabs") {
      if (!voiceId) throw new AiError("bad_request", "Choose an ElevenLabs voice", 400);
      const body: any = { text: input, model_id: model || "eleven_v3" };
      if ((model || "eleven_v3") !== "eleven_v3") body.voice_settings = { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, speed)) };
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: "POST", headers: { "Content-Type": "application/json", "xi-api-key": key, Accept: "audio/mpeg" }, body: JSON.stringify(body), signal: to.signal,
      });
      if (!r.ok) throw new Error(await readErr(r));
      return { base64: Buffer.from(await r.arrayBuffer()).toString("base64"), mime: "audio/mpeg" };
    }
    if (p.company === "heygen") {
      if (!voiceId) throw new AiError("bad_request", "Choose a HeyGen voice or type its voice ID", 400);
      if (hasBangla(input)) throw new AiError("bad_request", "HeyGen Voice doesn't speak Bangla. Pick a Bangla voice from OpenAI, ElevenLabs or Gemini.", 400);
      const body: any = { voice_id: voiceId, text: input.slice(0, 5000), model: model || "heygen-voice-1-turbo-free", speed: Math.min(2, Math.max(0.5, speed)), output_format: "mp3", sample_rate: 44100 };
      if (lang === "en") body.language = "en";
      const r = await fetch(`${HEYGEN_API}/v3/models/audio/tts`, { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": key, Accept: "application/json" }, body: JSON.stringify(body), signal: to.signal });
      if (!r.ok) throw new Error(await readErr(r));
      const j: any = await r.json().catch(() => ({}));
      const url = j?.data?.audio_url || j?.audio_url;
      if (!url) throw new Error(j?.error?.message || "HeyGen sent no audio");
      const a = await fetch(url, { signal: to.signal });
      if (!a.ok) throw new Error(`HeyGen audio download failed (${a.status})`);
      return { base64: Buffer.from(await a.arrayBuffer()).toString("base64"), mime: "audio/mpeg" };
    }
    // Google Gemini
    const m = model || "gemini-2.5-flash-preview-tts";
    const say = lang === "bn" ? `Say this in warm, natural Bangladeshi Bangla: ${input}` : `Say this warmly and clearly: ${input}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: say }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId || "Kore" } } } },
      }),
      signal: to.signal,
    });
    if (!r.ok) throw new Error(await readErr(r));
    const j: any = await r.json();
    const part = j?.candidates?.[0]?.content?.parts?.find((x: any) => x?.inlineData?.data)?.inlineData;
    if (!part?.data) throw new Error("Gemini sent no audio");
    const rate = Number(String(part.mimeType || "").match(/rate=(\d+)/)?.[1] || 24000);
    return { base64: pcmToWav(Buffer.from(part.data, "base64"), rate).toString("base64"), mime: "audio/wav" };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The voice service took too long");
    throw e;
  } finally {
    to.done();
  }
}

// ---------------------------------------------------------------- voice: speech to text
export async function stt(p: VoiceProvider, audio: Buffer, mime: string, lang: "en" | "bn"): Promise<string> {
  const key = providerKey(p);
  if (!key) throw new AiError("not_configured", "This voice provider's key can't be read. Enter the key again.");
  const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "m4a";
  if (p.company === "heygen") throw new AiError("bad_request", "HeyGen Voice only speaks; it can't listen (speech to text).", 400);
  const to = withTimeout(45000);
  try {
    if (p.company === "openai" || p.company === "compatible") {
      const base = p.company === "openai" ? "https://api.openai.com/v1" : trimBase(p.baseUrl || "");
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(audio)], { type: mime }), `speech.${ext}`);
      fd.append("model", p.company === "openai" ? "gpt-4o-mini-transcribe" : "whisper-1");
      fd.append("language", lang);
      const r = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd, signal: to.signal });
      if (!r.ok) {
        const err = await readErr(r);
        if (p.company !== "compatible") throw new Error(err);
        // Omni route without OpenAI: let a Gemini model on the same gateway write down the speech instead.
        return await gatewayAudioStt(base, key, audio, ext, lang, to.signal, err);
      }
      const j: any = await r.json();
      return String(j?.text || "").trim();
    }
    if (p.company === "elevenlabs") {
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(audio)], { type: mime }), `speech.${ext}`);
      fd.append("model_id", "scribe_v1");
      fd.append("language_code", lang === "bn" ? "ben" : "eng");
      const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd, signal: to.signal });
      if (!r.ok) throw new Error(await readErr(r));
      const j: any = await r.json();
      return String(j?.text || "").trim();
    }
    return await geminiStt(key, audio, mime, lang, to.signal);
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The voice service took too long");
    throw e;
  } finally {
    to.done();
  }
}

/** Speech to text through a gateway's chat endpoint: sends the clip as input_audio to Gemini models. */
async function gatewayAudioStt(base: string, key: string, audio: Buffer, ext: string, lang: "en" | "bn", signal: AbortSignal, firstErr: string) {
  let last = firstErr;
  for (const model of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]) {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 600, messages: [{ role: "user", content: [
        { type: "input_audio", input_audio: { data: audio.toString("base64"), format: ext } },
        { type: "text", text: `Transcribe this ${lang === "bn" ? "Bangla (or mixed Bangla/English)" : "English (or Bangla)"} speech exactly. Reply with only the words spoken, nothing else. If nothing is said, reply with an empty line.` },
      ] }] }),
      signal,
    });
    if (!r.ok) { last = await readErr(r); continue; }
    const j: any = await r.json().catch(() => ({}));
    const t = String(j?.choices?.[0]?.message?.content || "").trim();
    if (t) return t;
    last = "empty transcript";
  }
  throw new Error(`whisper-1: ${firstErr.slice(0, 90)}; Gemini: ${last.slice(0, 90)}`);
}

async function geminiStt(key: string, audio: Buffer, mime: string, lang: "en" | "bn", signal?: AbortSignal) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { inlineData: { data: audio.toString("base64"), mimeType: mime.split(";")[0] || "audio/mp4" } },
        { text: `Transcribe this ${lang === "bn" ? "Bangla (or mixed Bangla/English)" : "English (or Bangla)"} speech exactly. Reply with only the words spoken, nothing else. If nothing is said, reply with an empty line.` },
      ] }],
    }),
    signal,
  });
  if (!r.ok) throw new Error(await readErr(r));
  const j: any = await r.json();
  return String(j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "").trim();
}

/** Pick the speech-to-text provider: the admin's choice, else the first working voice provider, else the server backup key. */
export async function transcribe(c: AiConfig, audio: Buffer, mime: string, lang: "en" | "bn"): Promise<string> {
  const ps = c.voice.providers.filter((p) => p.enabled);
  // Order: the provider the admin chose for listening, then the one behind this language's voice,
  // then the big companies, then any other OpenAI-compatible (Omni route) speech address.
  const first = [c.voice.sttProviderId, c.voice[lang]?.providerId, c.voice[lang === "bn" ? "en" : "bn"]?.providerId].filter(Boolean) as string[];
  const order: typeof ps = [];
  for (const id of first) { const p = ps.find((x) => x.id === id); if (p && !order.includes(p)) order.push(p); }
  for (const p of ps) if (!order.includes(p) && p.company !== "compatible") order.push(p);
  for (const p of ps) if (!order.includes(p)) order.push(p);
  // HeyGen only speaks, so it never listens.
  for (let i = order.length - 1; i >= 0; i--) if (order[i].company === "heygen") order.splice(i, 1);
  let last = "";
  for (const p of order) {
    try {
      const t = await stt(p, audio, mime, lang);
      noteUse(p.id, true);
      return t;
    } catch (e: any) {
      last = e?.message || "failed";
      noteUse(p.id, false, last);
      console.warn(`[ai] stt via ${p.label} failed: ${last}`);
    }
  }
  if (c.useServerBackup) {
    for (const t of backupTargets()) {
      try {
        return await geminiStt(t.key, audio, mime, lang);
      } catch (e: any) {
        last = e?.message || last;
      }
    }
  }
  if (!order.length && !(c.useServerBackup && hasServerBackup())) throw new AiError("not_configured", "AI calling isn't set up yet. The admin needs to add a voice provider in AI settings.");
  throw new AiError("failed", `Couldn't understand the recording. ${last ? `(${last.slice(0, 120)})` : ""}`.trim(), 502);
}

/** Speak with the voice the admin chose for this language. Falls back to the other language's voice, then null (the app uses the phone's voice). */
export const lastSpeakError = { message: "" };
export async function speak(c: AiConfig, text: string, lang: "en" | "bn"): Promise<(Audio & { voice: string }) | null> {
  lastSpeakError.message = "";
  const choices = [c.voice[lang], c.voice[lang === "bn" ? "en" : "bn"]].filter(Boolean) as VoiceChoice[];
  for (const ch of choices) {
    const p = c.voice.providers.find((x) => x.id === ch.providerId && x.enabled);
    if (!p) continue;
    try {
      const a = await tts(p, ch.voiceId, ch.model, text, lang, c.voice.speed);
      noteUse(p.id, true);
      return { ...a, voice: `${ch.voiceName} (${p.label})` };
    } catch (e: any) {
      noteUse(p.id, false, e?.message);
      lastSpeakError.message = `${p.label}: ${String(e?.message || "failed").slice(0, 160)}`;
      console.warn(`[ai] tts via ${p.label} failed: ${e?.message}`);
    }
  }
  return null;
}

export function voiceStatus(c: AiConfig) {
  const ps = c.voice.providers.filter((p) => p.enabled);
  const pick = (lang: "en" | "bn") => {
    const ch = c.voice[lang];
    const p = ch && ps.find((x) => x.id === ch.providerId);
    return ch && p ? { voice: ch.voiceName, provider: p.label, company: p.company } : null;
  };
  const sttReady = ps.some((p) => p.company !== "heygen") || (c.useServerBackup && hasServerBackup());
  return { en: pick("en"), bn: pick("bn"), sttReady };
}
