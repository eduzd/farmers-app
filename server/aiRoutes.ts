/**
 * AI routes.
 *   Main app (anyone, rate limited):  GET /api/ai/status, POST /api/ai/chat, POST /api/ai/disease,
 *                                     POST /api/ai/voice/turn, POST /api/ai/voice/greet
 *   Old app versions keep working:    POST /api/ai-chat, /api/analyze-disease, /api/voice-to-text, /api/text-to-speech
 *   Admin only (checked on server):   /api/admin/manage/ai/...
 * Keys never leave the server. Admin responses carry only the last 4 characters.
 */
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { requireAdmin, audit } from "./platformRoutes";
import {
  aiConfig, saveAiConfig, newId, encrypt, last4, AiError, runFeature, runFeatureJson, featureReady, featureTargets, gatewayTarget, callChat, listModels, listModelInfo, FEATURES,
  tts, transcribe, speak, voiceStatus, usageOf, hasServerBackup, GATEWAY_PRESETS, VOICE_COMPANIES, OPENAI_VOICES, GEMINI_VOICES, TTS_MODELS, HEYGEN_API,
  providerKey, type AiConfig, type ChatMsg, type FeatureName, type GatewayKey, type VoiceProvider,
} from "./aiEngine";

const A = "/api/admin/manage/ai";
// The app's language decides the answer's language. Bangla is the default: only a request that says
// English, or (from old app versions that send no language) a message written only in English, gets English.
const langOf = (v: any, sample = ""): "en" | "bn" => {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("bn") || s.startsWith("ban")) return "bn";
  if (s) return "en";
  return /[A-Za-z]/.test(sample) && !/[\u0980-\u09FF]/.test(sample) ? "en" : "bn";
};
// A last word to the model so a question typed in English still gets a Bangla answer when the app is in Bangla.
const langNudgeText = (lang: "en" | "bn") => lang === "bn"
  ? "\n\nReply ONLY in Bangla (বাংলা), even if the farmer wrote in English. Keep technical or medicine names in English inside brackets."
  : "\n\nReply in English.";
/** Adds the language rule to the system prompt (first message), keeping the farmer's question last. */
const withLang = (msgs: ChatMsg[], lang: "en" | "bn"): ChatMsg[] => {
  const i = msgs.findIndex((m) => m.role === "system" && typeof m.content === "string");
  if (i < 0) return [{ role: "system", content: langNudgeText(lang).trim() }, ...msgs];
  const out = msgs.slice();
  out[i] = { ...out[i], content: String(out[i].content) + langNudgeText(lang) };
  return out;
};

function uidOf(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null; } catch { return null; }
}

// ---------------------------------------------------------------- rate limiting (per account, else per IP)
const hits = new Map<string, { min: number[]; day: string; count: number }>();
async function limit(req: Request, res: Response, cost = 1): Promise<boolean> {
  const c = await aiConfig();
  const uid = uidOf(req);
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const id = uid ? `u:${uid}` : `ip:${ip}`;
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const h = hits.get(id) || { min: [], day, count: 0 };
  if (h.day !== day) { h.day = day; h.count = 0; }
  h.min = h.min.filter((t) => now - t < 60_000);
  const perMin = Math.max(1, Number(c.limits.perMinute) || 8);
  const daily = Math.max(1, Number(uid ? c.limits.userDaily : c.limits.guestDaily) || 25);
  if (h.min.length >= perMin) {
    res.status(429).json({ error: "Too many AI requests. Please wait a minute and try again.", code: "rate_limited", retryAfter: 60 });
    return false;
  }
  if (h.count + cost > daily) {
    res.status(429).json({ error: uid ? "You've reached today's AI limit. Please try again tomorrow." : "Today's free AI limit is used up. Sign in to keep going.", code: "daily_limit" });
    return false;
  }
  h.min.push(now);
  h.count += cost;
  hits.set(id, h);
  if (hits.size > 20000) for (const [k, v] of hits) if (v.day !== day) hits.delete(k);
  return true;
}

function fail(res: Response, e: any) {
  if (e instanceof AiError) return res.status(e.status).json({ error: e.message, code: e.code });
  console.error("[ai]", e?.message || e);
  return res.status(500).json({ error: "Something went wrong with the AI. Please try again.", code: "failed" });
}

// ---------------------------------------------------------------- prompts
function advisorPrompt(c: AiConfig, lang: "en" | "bn", voice = false) {
  const base = `You are "Krishi AI", the friendly farm assistant inside the Farmers app for farmers in Bangladesh.
You help with fish farming and aquaculture (pond care, water quality, feed, fish diseases and medicines), crops, livestock, poultry, weather risks and selling produce.
Give practical, specific, safe advice that a small farmer can act on today. Use local units (decimal, bigha, maund, kg, ppm) when useful.
For medicines, give general guidance and say to follow the label or a vet/fisheries officer for exact doses. Never invent prices or laws.
If you are unsure or it sounds serious (mass deaths, spreading disease, human health), say so and suggest talking to a specialist in the app's Connect tab.
${lang === "bn" ? "Always reply in clear, simple Bangla (বাংলা), the way people speak in Bangladesh. Technical names may stay in English in brackets." : "Reply in simple English. If the farmer writes in Bangla, reply in Bangla."}`;
  const style = voice
    ? "\nThis is a live voice call: answer in 1-3 short spoken sentences, no lists, no markdown, no emojis. Ask a short follow-up question when you need details."
    : "\nKeep answers well organized: a short direct answer first, then short bullet points or steps when helpful. Use **bold** sparingly. No tables.";
  return base + style + (c.extraInstructions.trim() ? `\nAdmin notes: ${c.extraInstructions.trim().slice(0, 1500)}` : "");
}

function cleanHistory(h: any, max = 12): ChatMsg[] {
  if (!Array.isArray(h)) return [];
  return h.slice(-max).map((m: any): ChatMsg => ({
    role: m?.role === "assistant" || m?.role === "model" || m?.isUser === false ? "assistant" : "user",
    content: String(m?.content ?? m?.text ?? m?.parts?.[0]?.text ?? "").slice(0, 2000),
  })).filter((m) => String(m.content).trim());
}


const CATEGORY: Record<string, string> = { fish: "fish or shrimp (aquaculture)", crop: "crop or plant", livestock: "livestock (cattle, goat)", poultry: "poultry (chicken, duck)" };

async function diagnose(input: { imageBase64?: string; mimeType?: string; description?: string; category?: string; lang: "en" | "bn" }) {
  const c = await aiConfig();
  const img = String(input.imageBase64 || "").replace(/^data:[^;]+;base64,/, "");
  const desc = String(input.description || "").slice(0, 1500);
  if (!img && !desc.trim()) throw new AiError("bad_request", "Add a photo or describe the problem", 400);
  if (img.length > 9_000_000) throw new AiError("bad_request", "The photo is too large. Please use a smaller one.", 413);
  const kind = CATEGORY[String(input.category || "fish")] || CATEGORY.fish;
  const L = input.lang === "bn" ? "Write every text value in simple Bangla (বাংলা)." : "Write every text value in simple English.";
  const prompt = `You are an expert ${kind} health advisor for farmers in Bangladesh. Look at the ${img ? "photo" : "description"} and identify the most likely health problem.
${desc ? `Farmer's notes: "${desc}"` : ""}
Reply with ONLY a JSON object, no other text, in this shape:
{"healthy": boolean, "subject": "what is in the photo, e.g. Tilapia", "diseaseName": "most likely problem, or Healthy", "scientificName": "pathogen or cause, or empty", "confidence": number 0-100, "severity": "low"|"medium"|"high", "summary": "2 sentence plain explanation", "symptoms": ["signs seen"], "causes": ["likely causes"], "treatment": ["step by step actions, safe general doses only with 'follow the label'"], "prevention": ["tips"], "otherPossibilities": [{"name": "...", "confidence": number}], "seeSpecialist": boolean, "notClear": boolean}
Set notClear true if the photo isn't a ${kind} or is too unclear. Set seeSpecialist true when confidence is under 70, severity is high, or animals are dying. ${L}`;
  const content: any[] = [{ type: "text", text: prompt }];
  if (img) content.push({ type: "image_url", image_url: { url: `data:${input.mimeType || "image/jpeg"};base64,${img}` } });
  const r = await runFeatureJson("disease", [{ role: "user", content }], { maxTokens: 2500, timeoutMs: 90000 });
  const j = r.json;
  const arr = (v: any) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 8) : []);
  const confidence = Math.max(0, Math.min(100, Math.round(Number(j.confidence) || 0)));
  const severity = ["low", "medium", "high"].includes(j.severity) ? j.severity : "medium";
  return {
    healthy: !!j.healthy,
    subject: String(j.subject || ""),
    diseaseName: String(j.diseaseName || (j.healthy ? "Healthy" : "Unknown")),
    scientificName: String(j.scientificName || ""),
    confidence,
    severity,
    summary: String(j.summary || ""),
    symptoms: arr(j.symptoms),
    causes: arr(j.causes),
    treatment: arr(j.treatment),
    prevention: arr(j.prevention),
    otherPossibilities: Array.isArray(j.otherPossibilities) ? j.otherPossibilities.slice(0, 3).map((o: any) => ({ name: String(o?.name || ""), confidence: Math.round(Number(o?.confidence) || 0) })).filter((o: any) => o.name) : [],
    seeSpecialist: !!j.seeSpecialist || confidence < 70 || severity === "high",
    notClear: !!j.notClear,
    model: r.model,
  };
}

// ---------------------------------------------------------------- admin view (masked)
function maskedConfig(c: AiConfig) {
  return {
    // The full model list (modelInfo) is fetched separately from /keys/:id/models to keep this small.
    keys: c.keys.map(({ keyEnc, modelInfo, ...k }) => ({ ...k, modelCount: modelInfo?.length ?? k.models?.length ?? 0, usage: usageOf(k.id) })),
    features: c.features,
    voice: { ...c.voice, providers: c.voice.providers.map(({ keyEnc, ...p }) => ({ ...p, usage: usageOf(p.id) })) },
    limits: c.limits,
    extraInstructions: c.extraInstructions,
    useServerBackup: c.useServerBackup,
    serverBackupAvailable: hasServerBackup(),
    ready: { chat: featureReady(c, "chat"), disease: featureReady(c, "disease"), voice: featureReady(c, "voice") && c.voice.callEnabled, feedmix: featureReady(c, "feedmix") },
    usingBackup: {
      chat: featureReady(c, "chat") && featureTargets(c, "chat")[0]?.target.id.startsWith("server-backup"),
      disease: featureReady(c, "disease") && featureTargets(c, "disease")[0]?.target.id.startsWith("server-backup"),
      voice: featureReady(c, "voice") && featureTargets(c, "voice")[0]?.target.id.startsWith("server-backup"),
      feedmix: featureReady(c, "feedmix") && featureTargets(c, "feedmix")[0]?.target.id.startsWith("server-backup"),
    },
    voiceStatus: voiceStatus(c),
    presets: GATEWAY_PRESETS,
    ttsModels: TTS_MODELS,
    updatedAt: c.updatedAt,
  };
}

const clean = (v: any, n = 200) => String(v ?? "").trim().slice(0, n);
const validUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);

export function registerAiRoutes(app: Express) {
  // ============================================================ main app
  app.get("/api/ai/status", async (_req, res) => {
    try {
      const c = await aiConfig();
      const v = voiceStatus(c);
      res.json({
        chat: featureReady(c, "chat"),
        disease: featureReady(c, "disease"),
        feedmix: featureReady(c, "feedmix"),
        voiceCall: c.voice.callEnabled && featureReady(c, "voice") && v.sttReady,
        voice: { en: v.en?.voice || null, bn: v.bn?.voice || null, natural: !!(v.en || v.bn) },
      });
    } catch (e) { fail(res, e); }
  });

  const chatHandler = (legacy: boolean) => async (req: Request, res: Response) => {
    try {
      const message = clean(req.body?.message ?? req.body?.text, 3000);
      const lang = langOf(req.body?.lang ?? req.body?.language, message);
      const history = cleanHistory(req.body?.history ?? req.body?.messages);
      if (!message && !history.length) return res.status(400).json({ error: "Write a message first", code: "bad_request" });
      if (!(await limit(req, res))) return;
      const c = await aiConfig();
      const msgs: ChatMsg[] = [{ role: "system", content: advisorPrompt(c, lang) }, ...history];
      const img = String(req.body?.imageBase64 || "").replace(/^data:[^;]+;base64,/, "");
      if (message) {
        msgs.push(img
          ? { role: "user", content: [{ type: "text", text: message }, { type: "image_url", image_url: { url: `data:${req.body?.mimeType || "image/jpeg"};base64,${img}` } }] }
          : { role: "user", content: message });
      }
      const r = await runFeature(img ? "disease" : "chat", withLang(msgs, lang), { maxTokens: legacy ? 400 : 1200, timeoutMs: img ? 90000 : 60000 });
      res.json({ reply: r.text, response: r.text, success: true, timestamp: new Date().toISOString() });
    } catch (e: any) {
      // Older app versions expect a 200 with a "response" text
      if (legacy) return res.json({ response: e instanceof AiError ? e.message : "The AI didn't answer just now. Please try again.", offline: true, aiConfigured: false, timestamp: new Date().toISOString() });
      fail(res, e);
    }
  };
  app.post("/api/ai/chat", chatHandler(false));
  app.post("/api/ai-chat", chatHandler(true)); // older app versions
  app.get("/api/ai-status", async (_req, res) => {
    try { res.json({ aiConfigured: featureReady(await aiConfig(), "chat") }); } catch { res.json({ aiConfigured: false }); }
  });

  app.post("/api/ai/disease", async (req, res) => {
    try {
      if (!(await limit(req, res, 2))) return;
      const result = await diagnose({ ...req.body, lang: langOf(req.body?.lang) });
      res.json({ success: true, result });
    } catch (e) { fail(res, e); }
  });

  // older app versions: same shape the old Gemini endpoint returned
  app.post("/api/analyze-disease", async (req, res) => {
    try {
      if (!(await limit(req, res, 2))) return;
      const r = await diagnose({ imageBase64: req.body?.imageBase64 || req.body?.image, mimeType: req.body?.mimeType, description: req.body?.description, category: req.body?.category, lang: langOf(req.body?.language ?? req.body?.lang) });
      res.json({
        success: true,
        diseaseName: r.diseaseName, disease: r.diseaseName, scientificName: r.scientificName, confidence: r.confidence, severity: r.severity,
        description: r.summary, symptoms: r.symptoms, causes: r.causes, treatment: r.treatment, treatments: r.treatment, prevention: r.prevention,
        isHealthy: r.healthy, result: r,
        analysis: [
          `${r.diseaseName}${r.scientificName ? ` (${r.scientificName})` : ""} - ${r.confidence}%`,
          r.summary,
          r.symptoms.length ? `Symptoms:\n${r.symptoms.map((x) => `- ${x}`).join("\n")}` : "",
          r.treatment.length ? `Treatment:\n${r.treatment.map((x, i) => `${i + 1}. ${x}`).join("\n")}` : "",
          r.prevention.length ? `Prevention:\n${r.prevention.map((x) => `- ${x}`).join("\n")}` : "",
          r.seeSpecialist ? "Please also talk to a specialist in Connect." : "",
        ].filter(Boolean).join("\n\n"),
        timestamp: new Date().toISOString(),
      });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/voice-to-text", async (req, res) => {
    try {
      const b64 = String(req.body?.audioBase64 || req.body?.audio || "").replace(/^data:[^;]+;base64,/, "");
      if (!b64) return res.status(400).json({ error: "No audio", code: "bad_request" });
      if (!(await limit(req, res))) return;
      const c = await aiConfig();
      const text = await transcribe(c, Buffer.from(b64, "base64"), String(req.body?.mimeType || "audio/mp4"), langOf(req.body?.language ?? req.body?.lang));
      res.json({ success: true, text, transcript: text, transcription: text, confidence: 0.9 });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const text = clean(req.body?.text, 3000);
      if (!text) return res.status(400).json({ error: "No text", code: "bad_request" });
      if (!(await limit(req, res))) return;
      const c = await aiConfig();
      const a = await speak(c, text, langOf(req.body?.language ?? req.body?.lang));
      if (!a) return res.status(503).json({ error: "No AI voice is set up", code: "not_configured", useDeviceVoice: true });
      res.json({ success: true, audioContent: a.base64, audioBase64: a.base64, mimeType: a.mime });
    } catch (e) { fail(res, e); }
  });

  // One round of an AI call: speech in -> words -> answer -> voice out
  app.post("/api/ai/voice/turn", async (req, res) => {
    try {
      const lang = langOf(req.body?.lang);
      const c = await aiConfig();
      if (!c.voice.callEnabled) throw new AiError("disabled", "AI calling is turned off by the admin");
      if (!(await limit(req, res))) return;
      let transcript = clean(req.body?.text, 2000);
      const b64 = String(req.body?.audioBase64 || "").replace(/^data:[^;]+;base64,/, "");
      if (!transcript && b64) {
        if (b64.length > 12_000_000) throw new AiError("bad_request", "That recording is too long", 413);
        transcript = await transcribe(c, Buffer.from(b64, "base64"), String(req.body?.mimeType || "audio/mp4"), lang);
      }
      if (!transcript) return res.json({ transcript: "", reply: "", heard: false });
      const msgs: ChatMsg[] = [{ role: "system", content: advisorPrompt(c, lang, true) }, ...cleanHistory(req.body?.history, 10), { role: "user", content: transcript }];
      const r = await runFeature("voice", withLang(msgs, lang), { maxTokens: 300, timeoutMs: 30000 });
      const reply = r.text.replace(/[*#_`>]/g, "").trim();
      const audio = req.body?.wantAudio === false ? null : await speak(c, reply, lang);
      res.json({ heard: true, transcript, reply, audioBase64: audio?.base64 || null, mimeType: audio?.mime || null, voice: audio?.voice || null });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/ai/voice/greet", async (req, res) => {
    try {
      const lang = langOf(req.body?.lang);
      const c = await aiConfig();
      if (!c.voice.callEnabled) throw new AiError("disabled", "AI calling is turned off by the admin");
      if (!(await limit(req, res))) return;
      const text = lang === "bn" ? "আসসালামু আলাইকুম! আমি কৃষি এআই। আপনার মাছ, ফসল বা খামার নিয়ে কী জানতে চান, বলুন।" : "Hello! I'm Krishi AI. Tell me what's happening on your farm, and I'll help.";
      const audio = await speak(c, text, lang);
      res.json({ reply: text, audioBase64: audio?.base64 || null, mimeType: audio?.mime || null, voice: audio?.voice || null });
    } catch (e) { fail(res, e); }
  });

  // ============================================================ admin
  const wrap = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (e: any) {
      if (e instanceof AiError) return res.status(e.status === 503 ? 400 : e.status).json({ error: e.message });
      console.error("[ai admin]", e?.message);
      res.status(500).json({ error: e?.message || "Failed" });
    }
  };
  const by = (req: Request) => (req as any).admin?.email || (req as any).uid || null;

  app.get(A, requireAdmin, wrap(async (_req, res) => res.json(maskedConfig(await aiConfig(true)))));

  // ---- Omni route keys
  app.post(`${A}/keys`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const provider = (Object.keys(GATEWAY_PRESETS).includes(req.body?.provider) ? req.body.provider : "omniroute") as GatewayKey["provider"];
    const baseUrl = clean(req.body?.baseUrl, 300) || GATEWAY_PRESETS[provider].baseUrl;
    const key = clean(req.body?.apiKey, 500);
    if (!key || key.length < 8) return res.status(400).json({ error: "Paste the API key" });
    if (!validUrl(baseUrl)) return res.status(400).json({ error: "Enter the address (base URL), starting with https://" });
    const k: GatewayKey = {
      id: newId(), label: clean(req.body?.label, 60) || `${GATEWAY_PRESETS[provider].label} key ${c.keys.length + 1}`, provider, baseUrl,
      keyEnc: encrypt(key), keyLast4: last4(key), enabled: req.body?.enabled !== false, lastTest: null, createdAt: new Date().toISOString(),
    };
    c.keys.push(k);
    await saveAiConfig(c, by(req));
    await audit(req, "AI_KEY_ADD", "settings", k.id, { label: k.label, provider, last4: k.keyLast4 });
    res.json(maskedConfig(c));
  }));

  app.put(`${A}/keys/:id`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const k = c.keys.find((x) => x.id === req.params.id);
    if (!k) return res.status(404).json({ error: "Key not found" });
    if (req.body?.label !== undefined) k.label = clean(req.body.label, 60) || k.label;
    if (req.body?.provider && Object.keys(GATEWAY_PRESETS).includes(req.body.provider)) k.provider = req.body.provider;
    if (req.body?.baseUrl !== undefined) {
      const u = clean(req.body.baseUrl, 300);
      if (!validUrl(u)) return res.status(400).json({ error: "Enter the address (base URL), starting with https://" });
      if (u !== k.baseUrl) { k.models = undefined; k.modelInfo = undefined; k.modelsAt = null; k.modelsError = null; }
      k.baseUrl = u;
    }
    if (req.body?.apiKey) {
      const key = clean(req.body.apiKey, 500);
      if (key.length < 8) return res.status(400).json({ error: "That key looks too short" });
      k.keyEnc = encrypt(key); k.keyLast4 = last4(key); k.lastTest = null;
      k.models = undefined; k.modelInfo = undefined; k.modelsAt = null; k.modelsError = null;
    }
    if (typeof req.body?.enabled === "boolean") k.enabled = req.body.enabled;
    if (typeof req.body?.moveUp === "boolean") {
      const i = c.keys.indexOf(k);
      const j = req.body.moveUp ? i - 1 : i + 1;
      if (j >= 0 && j < c.keys.length) [c.keys[i], c.keys[j]] = [c.keys[j], c.keys[i]];
    }
    k.updatedAt = new Date().toISOString();
    await saveAiConfig(c, by(req));
    await audit(req, "AI_KEY_UPDATE", "settings", k.id, { label: k.label, enabled: k.enabled, keyChanged: !!req.body?.apiKey });
    res.json(maskedConfig(c));
  }));

  app.delete(`${A}/keys/:id`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const k = c.keys.find((x) => x.id === req.params.id);
    if (!k) return res.status(404).json({ error: "Key not found" });
    c.keys = c.keys.filter((x) => x.id !== k.id);
    for (const f of Object.values(c.features)) if (f.keyId === k.id) f.keyId = null;
    await saveAiConfig(c, by(req));
    await audit(req, "AI_KEY_DELETE", "settings", k.id, { label: k.label, last4: k.keyLast4 });
    res.json(maskedConfig(c));
  }));

  // The models a key offers, read live from its provider (cached on the key for an hour; ?refresh=1 reads again).
  // When the provider can't be reached, the last list (if any) comes back with the error, so the admin can still
  // pick from it or type a model name by hand.
  app.get(`${A}/keys/:id/models`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const k = c.keys.find((x) => x.id === req.params.id);
    if (!k) return res.status(404).json({ error: "Key not found" });
    const fresh = k.modelInfo?.length && k.modelsAt && Date.now() - Date.parse(k.modelsAt) < 3600_000;
    if (fresh && req.query.refresh !== "1") return res.json({ models: k.modelInfo, fetchedAt: k.modelsAt, cached: true, error: null });
    const t = gatewayTarget(k);
    if (!t) return res.json({ models: k.modelInfo || [], fetchedAt: k.modelsAt || null, cached: true, error: "This key can't be read any more. Enter it again." });
    try {
      const info = await listModelInfo(t);
      if (!info.length) throw new Error("The provider sent back an empty model list");
      k.modelInfo = info; k.models = info.map((m) => m.id).slice(0, 300); k.modelsAt = new Date().toISOString(); k.modelsError = null;
      await saveAiConfig(c, by(req));
      res.json({ models: info, fetchedAt: k.modelsAt, cached: false, error: null });
    } catch (e: any) {
      const msg = String(e?.message || "Couldn't read the model list").slice(0, 240);
      k.modelsError = msg;
      await saveAiConfig(c, by(req));
      res.json({ models: k.modelInfo || [], fetchedAt: k.modelsAt || null, cached: true, error: msg });
    }
  }));

  // Test a key: list its models, then (if a model is given) ask it one short question
  app.post(`${A}/keys/:id/test`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const k = c.keys.find((x) => x.id === req.params.id);
    if (!k) return res.status(404).json({ error: "Key not found" });
    const t = gatewayTarget(k);
    if (!t) return res.status(400).json({ error: "This key can't be read any more. Enter it again." });
    const started = Date.now();
    let info: Awaited<ReturnType<typeof listModelInfo>> = [];
    let modelsErr = "";
    try { info = await listModelInfo(t); } catch (e: any) { modelsErr = e?.message || ""; }
    const models = info.map((m) => m.id);
    const model = clean(req.body?.model, 120) || c.features.chat.model || models[0] || "";
    let reply = "";
    let ok = models.length > 0;
    let message = ok ? `Connected. ${models.length} models available.` : modelsErr;
    if (model) {
      try {
        const r = await callChat(t, model, [{ role: "user", content: "Reply with just: OK" }], { maxTokens: 10, temperature: 0, timeoutMs: 25000 });
        reply = r.text; ok = true; message = `Working. ${model} answered in ${(r.ms / 1000).toFixed(1)}s.`;
      } catch (e: any) {
        ok = false; message = `${model}: ${e?.message || "failed"}`;
      }
    }
    k.lastTest = { ok, at: new Date().toISOString(), message: message.slice(0, 240), ms: Date.now() - started };
    if (info.length) { k.models = models.slice(0, 300); k.modelInfo = info; k.modelsAt = new Date().toISOString(); k.modelsError = null; }
    await saveAiConfig(c, by(req));
    res.json({ ok, message: k.lastTest.message, reply, models: models.slice(0, 300), config: maskedConfig(c) });
  }));

  // ---- features (which model does what), limits, instructions
  app.put(`${A}/settings`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const f = req.body?.features || {};
    for (const name of FEATURES) {
      const v = f[name];
      if (!v) continue;
      if (typeof v.enabled === "boolean") c.features[name].enabled = v.enabled;
      if (v.model !== undefined) c.features[name].model = clean(v.model, 120);
      if (v.keyId !== undefined) c.features[name].keyId = v.keyId && c.keys.some((k) => k.id === v.keyId) ? v.keyId : null;
      if (v.temperature !== undefined) c.features[name].temperature = Math.max(0, Math.min(1.5, Number(v.temperature) || 0));
    }
    const l = req.body?.limits;
    if (l) {
      if (l.perMinute !== undefined) c.limits.perMinute = Math.max(1, Math.min(120, Math.round(Number(l.perMinute) || 8)));
      if (l.userDaily !== undefined) c.limits.userDaily = Math.max(1, Math.min(10000, Math.round(Number(l.userDaily) || 150)));
      if (l.guestDaily !== undefined) c.limits.guestDaily = Math.max(1, Math.min(10000, Math.round(Number(l.guestDaily) || 25)));
    }
    if (req.body?.extraInstructions !== undefined) c.extraInstructions = clean(req.body.extraInstructions, 1500);
    if (typeof req.body?.useServerBackup === "boolean") c.useServerBackup = req.body.useServerBackup;
    const v = req.body?.voice;
    if (v) {
      if (typeof v.callEnabled === "boolean") c.voice.callEnabled = v.callEnabled;
      if (v.speed !== undefined) c.voice.speed = Math.max(0.7, Math.min(1.3, Number(v.speed) || 1));
      if (v.sttProviderId !== undefined) c.voice.sttProviderId = v.sttProviderId && c.voice.providers.some((p) => p.id === v.sttProviderId) ? v.sttProviderId : null;
      for (const lang of ["en", "bn"] as const) {
        if (v[lang] === undefined) continue;
        const ch = v[lang];
        if (!ch) { c.voice[lang] = null; continue; }
        if (!c.voice.providers.some((p) => p.id === ch.providerId)) return res.status(400).json({ error: "Choose a voice provider first" });
        c.voice[lang] = { providerId: ch.providerId, voiceId: clean(ch.voiceId, 120), voiceName: clean(ch.voiceName || ch.voiceId, 80), model: clean(ch.model, 80) };
      }
    }
    await saveAiConfig(c, by(req));
    await audit(req, "AI_SETTINGS_UPDATE", "settings", "ai_config", { features: Object.fromEntries(Object.entries(c.features).map(([k, x]) => [k, x.model])), limits: c.limits, voice: { en: c.voice.en?.voiceName, bn: c.voice.bn?.voiceName } });
    res.json(maskedConfig(c));
  }));

  // Try a feature with the saved settings (admin sees the real answer)
  app.post(`${A}/try`, requireAdmin, wrap(async (req, res) => {
    const feature = ((FEATURES as string[]).includes(req.body?.feature) ? req.body.feature : "chat") as FeatureName;
    const lang = langOf(req.body?.lang);
    const c = await aiConfig(true);
    const prompt = clean(req.body?.prompt, 1000) || (lang === "bn" ? "পুকুরে মাছ ভেসে উঠছে, কী করব?" : "My pond fish are gasping at the surface in the morning. What should I do?");
    const started = Date.now();
    const r = await runFeature(feature, [{ role: "system", content: advisorPrompt(c, lang, feature === "voice") }, { role: "user", content: prompt }], { maxTokens: feature === "voice" ? 200 : 500 });
    res.json({ ok: true, reply: r.text, model: r.model, ms: Date.now() - started, via: r.keyId.startsWith("server-backup") ? "Server backup key" : c.keys.find((k) => k.id === r.keyId)?.label || "" });
  }));

  // ---- voice providers
  app.post(`${A}/voice/providers`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const company = (VOICE_COMPANIES as readonly string[]).includes(req.body?.company) ? req.body.company : "openai";
    const key = clean(req.body?.apiKey, 500);
    if (!key || key.length < 8) return res.status(400).json({ error: "Paste the API key" });
    const baseUrl = clean(req.body?.baseUrl, 300);
    if (company === "compatible" && !validUrl(baseUrl)) return res.status(400).json({ error: "Enter the speech address (base URL), starting with https://" });
    const names: Record<string, string> = { openai: "OpenAI", elevenlabs: "ElevenLabs", gemini: "Google Gemini", heygen: "HeyGen Voice", compatible: "Omni route voice" };
    const p: VoiceProvider = {
      id: newId(), label: clean(req.body?.label, 60) || names[company], company, baseUrl: company === "compatible" ? baseUrl : undefined,
      keyEnc: encrypt(key), keyLast4: last4(key), enabled: true, lastTest: null, createdAt: new Date().toISOString(),
    };
    c.voice.providers.push(p);
    await saveAiConfig(c, by(req));
    await audit(req, "AI_VOICE_PROVIDER_ADD", "settings", p.id, { label: p.label, company, last4: p.keyLast4 });
    res.json(maskedConfig(c));
  }));

  app.put(`${A}/voice/providers/:id`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const p = c.voice.providers.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Provider not found" });
    if (req.body?.label !== undefined) p.label = clean(req.body.label, 60) || p.label;
    if (req.body?.baseUrl !== undefined && p.company === "compatible") {
      const u = clean(req.body.baseUrl, 300);
      if (!validUrl(u)) return res.status(400).json({ error: "Enter the speech address (base URL), starting with https://" });
      p.baseUrl = u;
    }
    if (req.body?.apiKey) {
      const key = clean(req.body.apiKey, 500);
      if (key.length < 8) return res.status(400).json({ error: "That key looks too short" });
      p.keyEnc = encrypt(key); p.keyLast4 = last4(key); p.lastTest = null;
    }
    if (typeof req.body?.enabled === "boolean") p.enabled = req.body.enabled;
    await saveAiConfig(c, by(req));
    await audit(req, "AI_VOICE_PROVIDER_UPDATE", "settings", p.id, { label: p.label, enabled: p.enabled, keyChanged: !!req.body?.apiKey });
    res.json(maskedConfig(c));
  }));

  app.delete(`${A}/voice/providers/:id`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const p = c.voice.providers.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Provider not found" });
    c.voice.providers = c.voice.providers.filter((x) => x.id !== p.id);
    if (c.voice.en?.providerId === p.id) c.voice.en = null;
    if (c.voice.bn?.providerId === p.id) c.voice.bn = null;
    if (c.voice.sttProviderId === p.id) c.voice.sttProviderId = null;
    await saveAiConfig(c, by(req));
    await audit(req, "AI_VOICE_PROVIDER_DELETE", "settings", p.id, { label: p.label, last4: p.keyLast4 });
    res.json(maskedConfig(c));
  }));

  // Voices a provider offers (ElevenLabs: read live from the account)
  app.get(`${A}/voice/providers/:id/voices`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const p = c.voice.providers.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Provider not found" });
    let voices: { id: string; name: string; note?: string; previewUrl?: string }[] = [];
    if (p.company === "openai" || p.company === "compatible") voices = OPENAI_VOICES.map((v) => ({ id: v, name: v[0].toUpperCase() + v.slice(1) }));
    else if (p.company === "gemini") voices = GEMINI_VOICES.map(([v, note]) => ({ id: v, name: v, note }));
    else if (p.company === "heygen") {
      // HeyGen: the account's own voices first, then HeyGen's public voices. The turbo models don't take
      // professional clones, so those are marked.
      const key = providerKey(p);
      if (!key) return res.status(400).json({ error: "This key can't be read any more. Enter it again." });
      const seen = new Set<string>();
      let lastErr = "";
      for (const type of ["private", "public"]) {
        let token = "";
        for (let page = 0; page < 6; page++) {
          const r = await fetch(`${HEYGEN_API}/v3/models/audio/voices?type=${type}&limit=100${token ? `&token=${encodeURIComponent(token)}` : ""}`, { headers: { "X-Api-Key": key, Accept: "application/json" } }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e?.message } }) } as any));
          const j: any = await r.json().catch(() => ({}));
          if (!r.ok) { lastErr = `HeyGen said ${r.status || "no answer"}${j?.error?.message ? `: ${String(j.error.message).slice(0, 120)}` : ""}. Check the key.`; break; }
          for (const v of j?.data || []) {
            if (!v?.voice_id || seen.has(v.voice_id) || (v.status && v.status !== "ACTIVE")) continue;
            seen.add(v.voice_id);
            voices.push({ id: v.voice_id, name: String(v.name || v.voice_id).slice(0, 60), previewUrl: v.preview_audio_url || undefined,
              note: [type === "private" ? "My voice" : "", v.language, v.mode === "professional" ? "Not on turbo models" : ""].filter(Boolean).join(" · ") });
          }
          if (!j?.has_more || !j?.next_token || voices.length >= 500) break;
          token = j.next_token;
        }
      }
      if (!voices.length && lastErr) {
        p.lastTest = { ok: false, at: new Date().toISOString(), message: lastErr };
        await saveAiConfig(c, by(req));
        return res.status(400).json({ error: lastErr, models: TTS_MODELS.heygen });
      }
      voices.sort((a, b) => Number(/^My voice/.test(b.note || "")) - Number(/^My voice/.test(a.note || "")) || Number(/english/i.test(b.note || "")) - Number(/english/i.test(a.note || "")));
    }
    else {
      const key = providerKey(p);
      if (!key) return res.status(400).json({ error: "This key can't be read any more. Enter it again." });
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
      if (!r.ok) {
        const msg = `ElevenLabs said ${r.status}. Check the key.`;
        p.lastTest = { ok: false, at: new Date().toISOString(), message: msg };
        await saveAiConfig(c, by(req));
        return res.status(400).json({ error: msg });
      }
      const j: any = await r.json();
      voices = (j?.voices || []).slice(0, 200).map((v: any) => ({
        id: v.voice_id, name: v.name, previewUrl: v.preview_url || undefined,
        note: [v.labels?.gender, v.labels?.accent, v.labels?.age, v.labels?.description || v.labels?.descriptive].filter(Boolean).join(" · "),
      }));
    }
    res.json({ voices, models: TTS_MODELS[p.company] });
  }));

  // Preview a voice: returns a short clip for the admin to play
  app.post(`${A}/voice/preview`, requireAdmin, wrap(async (req, res) => {
    const c = await aiConfig(true);
    const p = c.voice.providers.find((x) => x.id === req.body?.providerId);
    if (!p) return res.status(404).json({ error: "Provider not found" });
    const lang = langOf(req.body?.lang);
    const text = clean(req.body?.text, 400) || (lang === "bn" ? "আসসালামু আলাইকুম! আমি কৃষি এআই। আপনার পুকুরের মাছ কেমন আছে?" : "Hello! I'm Krishi AI. How are the fish in your pond today?");
    try {
      const a = await tts(p, clean(req.body?.voiceId, 120), clean(req.body?.model, 80), text, lang, c.voice.speed);
      p.lastTest = { ok: true, at: new Date().toISOString(), message: "Voice works" };
      await saveAiConfig(c, by(req));
      res.json({ ok: true, audioBase64: a.base64, mimeType: a.mime });
    } catch (e: any) {
      p.lastTest = { ok: false, at: new Date().toISOString(), message: String(e?.message || "failed").slice(0, 240) };
      await saveAiConfig(c, by(req));
      res.status(400).json({ error: p.lastTest.message });
    }
  }));
}
