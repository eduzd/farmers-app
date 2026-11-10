// AI settings check on a throwaway local server with a fake Omni route (OpenAI-compatible) gateway.
//  - admin adds Omni route keys (stored encrypted, only last 4 shown), tests them, reorders, deletes
//  - admin picks the model for AI help chat / disease detector / AI call brain
//  - farmer app: /api/ai/chat, /api/ai/disease, /api/ai/voice/turn and greet use those settings,
//    and fall back to the next key when the first one fails
//  - voice providers (Omni route voice): voice list, preview, chosen voice per language used in calls
//  - normal users can't read or change the settings; keys never leave the server
//   node tests/check-ai-settings.mjs
import { createServer } from "node:http";
for (const k of Object.keys(process.env)) if (/^GOOGLE_API_KEY|^GEMINI_API_KEY/.test(k)) process.env[k] = "";
const { ok, call, setup, finish } = await import("./harness.mjs");

const GW_PORT = 8100 + Math.floor(Math.random() * 800);
const GW = `http://127.0.0.1:${GW_PORT}/v1`;
process.env.HEYGEN_API_BASE = `http://127.0.0.1:${GW_PORT}`;
const HG = "hg-key-good-1234567";
const GOOD = "sk-omni-good-key-1234";
const GOOD2 = "sk-omni-second-key-5678";
const BAD = "sk-omni-broken-key-0000";
const seen = [];
const gw = createServer((req, res) => {
  let b = [];
  req.on("data", (d) => b.push(d));
  req.on("end", () => {
    const raw = Buffer.concat(b);
    const auth = (req.headers.authorization || "").replace("Bearer ", "");
    const json = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    let body = {}; try { body = JSON.parse(raw.toString()); } catch {}
    seen.push({ path: req.url, auth, model: body.model, voice: body.voice, body, ctype: req.headers["content-type"] || "" });
    if (auth === BAD) return json(401, { error: { message: "Invalid API key" } });
    if (req.url === "/v1/models") return json(200, { data: [
      { id: "gpt-4o-mini" }, { id: "gpt-4o" }, { id: "gemini-2.5-flash" },
      { id: "text-embedding-3-small" }, { id: "whisper-1" },
      { id: "meta/llama-text", name: "Llama text", context_length: 128000, architecture: { input_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
      { id: "acme/seer-pro", name: "Seer Pro", architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } },
    ] });
    if (req.url === "/v1/chat/completions") {
      const msgs = body.messages || [];
      const last = msgs[msgs.length - 1];
      const hasImage = Array.isArray(last?.content) && last.content.some((p) => p.type === "image_url");
      const sys = msgs[0]?.content || "";
      if (String(JSON.stringify(msgs)).includes("JSON") && /disease|diagnos/i.test(JSON.stringify(msgs))) {
        return json(200, { choices: [{ message: { content: "```json\n" + JSON.stringify({ healthy: false, subject: "Tilapia", diseaseName: "White spot (Ich)", scientificName: "Ichthyophthirius multifiliis", confidence: 82, severity: "medium", summary: "Small white spots on skin and fins.", symptoms: ["White spots"], causes: ["Parasite"], treatment: ["Salt bath"], prevention: ["Quarantine new fish"], otherPossibilities: [{ name: "Lymphocystis", confidence: 10 }], seeSpecialist: false, notClear: false }) + "\n```" } }], model: body.model });
      }
      if (last?.content === "Reply with just: OK") return json(200, { choices: [{ message: { content: "OK" } }], model: body.model });
      return json(200, { choices: [{ message: { content: `**Answer** from ${body.model} via ${auth.slice(-4)}${hasImage ? " (saw photo)" : ""}${/বাংলা|Bangla/.test(sys) ? " [bn-aware]" : ""}` } }], model: body.model });
    }
    if (req.url.startsWith("/v3/models/audio/voices")) {
      if (req.headers["x-api-key"] !== HG) return json(401, { error: { code: "unauthorized", message: "Invalid API key" } });
      const priv = req.url.includes("type=private");
      return json(200, { data: priv ? [{ voice_id: "myvoice1", name: "My farm voice", language: "English", mode: "instant", status: "ACTIVE" }]
        : [{ voice_id: "hgv-en-1", name: "Ava", language: "English", preview_audio_url: "http://x/a.mp3", status: "ACTIVE" }, { voice_id: "hgv-hi-1", name: "Ravi", language: "Hindi", status: "ACTIVE" }, { voice_id: "pro1", name: "Pro clone", language: "English", mode: "professional", status: "ACTIVE" }], has_more: false });
    }
    if (req.url === "/v3/models/audio/tts") {
      if (req.headers["x-api-key"] !== HG) return json(401, { error: { message: "Invalid API key" } });
      return json(200, { data: { audio_url: `http://127.0.0.1:${GW_PORT}/hgaudio/${body.voice_id}/${body.model}`, duration: 1.2 } });
    }
    if (req.url.startsWith("/hgaudio/")) { res.writeHead(200, { "Content-Type": "audio/mpeg" }); return res.end(Buffer.from("ID3heygen-" + req.url.split("/").slice(2).join("|"))); }
    if (req.url === "/v1/audio/speech") { res.writeHead(200, { "Content-Type": "audio/mpeg" }); return res.end(Buffer.from("ID3fakeaudio-" + body.voice)); }
    if (req.url === "/v1/audio/transcriptions") return json(200, { text: raw.length > 1500 ? "My fish are gasping at dawn" : "" });
    json(404, { error: { message: "not found " + req.url } });
  });
});
await new Promise((r) => gw.listen(GW_PORT, "127.0.0.1", r));

const A = "/api/admin/manage/ai";
try {
  const [admin, farmer] = await setup(["boss", "farmer"]);

  // ---- before setup
  let st = await call("GET", "/api/ai/status");
  ok(st.status === 200 && st.data.chat === false && st.data.disease === false, "status: AI not ready before any key", st.data);
  let r = await call("POST", "/api/ai/chat", farmer.token, { message: "hello" });
  ok(r.status >= 400 && r.data?.code === "not_configured", "chat without keys -> clear not_configured error", r);

  // ---- access control
  r = await call("GET", A, farmer.token);
  ok(r.status === 401 || r.status === 403, "normal user can't read AI settings", r.status);
  r = await call("POST", `${A}/keys`, farmer.token, { provider: "custom", baseUrl: GW, apiKey: GOOD });
  ok(r.status === 401 || r.status === 403, "normal user can't add a key", r.status);
  r = await call("GET", A, admin.token);
  ok(r.status === 200 && Array.isArray(r.data.keys) && r.data.keys.length === 0 && r.data.presets?.omniroute, "admin reads empty AI settings with Omni route preset", r.data);

  // ---- keys
  r = await call("POST", `${A}/keys`, admin.token, { provider: "custom", label: "Broken", baseUrl: GW, apiKey: BAD });
  ok(r.status === 200 && r.data.keys.length === 1, "admin adds key 1", r);
  r = await call("POST", `${A}/keys`, admin.token, { provider: "omniroute", label: "Omni main", baseUrl: GW, apiKey: GOOD });
  ok(r.status === 200 && r.data.keys.length === 2, "admin adds Omni route key 2", r.data?.keys);
  r = await call("POST", `${A}/keys`, admin.token, { provider: "omniroute", label: "Omni spare", baseUrl: GW, apiKey: GOOD2 });
  ok(r.status === 200 && r.data.keys.length === 3, "admin adds key 3 (unlimited keys)", r.data?.keys?.length);
  const keys = r.data.keys;
  const raw = JSON.stringify(r.data);
  ok(!raw.includes(GOOD) && !raw.includes(BAD) && !raw.includes(GOOD2), "full keys never come back to the admin app");
  ok(keys[1].keyLast4 === GOOD.slice(-4) && keys[0].keyLast4 === BAD.slice(-4), "only last 4 characters shown", keys.map((k) => k.keyLast4));
  r = await call("POST", `${A}/keys`, admin.token, { provider: "custom", baseUrl: "not a url", apiKey: GOOD });
  ok(r.status === 400, "bad address rejected", r);
  r = await call("POST", `${A}/keys`, admin.token, { provider: "custom", baseUrl: GW, apiKey: "short" });
  ok(r.status === 400, "too-short key rejected", r);

  // test keys
  r = await call("POST", `${A}/keys/${keys[1].id}/test`, admin.token, {});
  ok(r.status === 200 && r.data.ok === true && r.data.models.includes("gpt-4o"), "test good key: connected, models listed", r.data);
  ok(seen.some((s) => s.path === "/v1/models" && s.auth === GOOD), "server used the real key against the gateway");
  r = await call("POST", `${A}/keys/${keys[0].id}/test`, admin.token, {});
  ok(r.status === 200 && r.data.ok === false && /401|invalid/i.test(r.data.message), "test broken key: shows the failure", r.data);

  // model list from the key (admin picks a model from what the key offers)
  r = await call("GET", `${A}/keys/${keys[1].id}/models?refresh=1`, admin.token);
  const ml = r.data?.models || [];
  ok(r.status === 200 && !r.data.error && ml.some((m) => m.id === "gpt-4o") && ml.some((m) => m.id === "acme/seer-pro"), "key's model list read from its provider", r.data);
  ok(!ml.some((m) => /embedding|whisper/.test(m.id)), "embeddings and speech models left out of the list", ml.map((m) => m.id));
  ok(ml.find((m) => m.id === "acme/seer-pro")?.vision === true && ml.find((m) => m.id === "acme/seer-pro")?.visionFrom === "provider", "provider-reported image model marked Sees photos", ml.find((m) => m.id === "acme/seer-pro"));
  ok(ml.find((m) => m.id === "meta/llama-text")?.vision === false && ml.find((m) => m.id === "meta/llama-text")?.free === true && ml.find((m) => m.id === "meta/llama-text")?.context === 128000, "text-only model, free and context shown", ml.find((m) => m.id === "meta/llama-text"));
  ok(ml.find((m) => m.id === "gpt-4o")?.vision === true && ml.find((m) => m.id === "gpt-4o")?.visionFrom === "guess", "gpt-4o guessed as Sees photos when provider doesn't say");
  r = await call("GET", `${A}/keys/${keys[0].id}/models`, admin.token);
  ok(r.status === 200 && r.data.error && Array.isArray(r.data.models), "broken key: model list error shown, manual name still possible", r.data);
  r = await call("GET", `${A}/keys/${keys[1].id}/models`, farmer.token);
  ok(r.status === 401 || r.status === 403, "normal user can't read a key's model list", r.status);
  r = await call("GET", A, admin.token);
  ok(r.data.keys.every((k) => !("modelInfo" in k) && !("keyEnc" in k)) && r.data.keys.find((k) => k.id === keys[1].id)?.modelCount >= 5, "settings show model counts, not the full lists", r.data.keys.map((k) => k.modelCount));

  // models
  r = await call("PUT", `${A}/settings`, admin.token, { features: { chat: { enabled: true, model: "gpt-4o-mini" }, disease: { enabled: true, model: "gpt-4o" }, voice: { enabled: true, model: "gemini-2.5-flash" } } });
  await call("PUT", `${A}/settings`, admin.token, { limits: { perMinute: 120, userDaily: 1000, guestDaily: 1000 } });
  ok(r.status === 200 && r.data.features.chat.model === "gpt-4o-mini" && r.data.features.disease.model === "gpt-4o" && r.data.ready.chat && r.data.ready.disease, "admin saves a model per feature", r.data?.features);
  st = await call("GET", "/api/ai/status");
  ok(st.data.chat === true && st.data.disease === true, "status: chat and disease ready", st.data);

  // ---- farmer app uses it, with fallback past the broken first key
  seen.length = 0;
  r = await call("POST", "/api/ai/chat", farmer.token, { message: "Why is my pond green?", lang: "en", history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] });
  ok(r.status === 200 && /gpt-4o-mini/.test(r.data.reply) && r.data.reply.includes(GOOD.slice(-4)), "chat answered by the chosen model through the working key", r.data);
  ok(seen.some((s) => s.auth === BAD) && seen.some((s) => s.auth === GOOD && s.model === "gpt-4o-mini"), "broken key 1 tried first, then key 2 took over", seen.map((s) => [s.auth.slice(-4), s.model]));
  const sent = seen.find((s) => s.auth === GOOD && s.path === "/v1/chat/completions");
  ok(sent?.body?.messages?.length === 4 && sent.body.messages[0].role === "system", "chat sends system prompt + history + question", sent?.body?.messages?.map((m) => m.role));

  r = await call("POST", "/api/ai/chat", null, { message: "photo question", imageBase64: "aGVsbG8=", mimeType: "image/jpeg" });
  ok(r.status === 200 && /gpt-4o via/.test(r.data.reply) && /saw photo/.test(r.data.reply), "chat with a photo uses the disease (vision) model; guests allowed", r.data);

  // older app versions
  r = await call("POST", "/api/ai-chat", null, { message: "legacy" });
  ok(r.status === 200 && typeof r.data.response === "string" && r.data.response.length > 0, "old app /api/ai-chat still answers", r.data);

  // disease
  r = await call("POST", "/api/ai/disease", farmer.token, { imageBase64: "aGVsbG8=", mimeType: "image/jpeg", category: "fish", lang: "en" });
  ok(r.status === 200 && r.data.result?.diseaseName === "White spot (Ich)" && r.data.result.confidence === 82 && r.data.result.treatment[0] === "Salt bath", "disease detector returns a structured diagnosis", r.data);
  ok(seen.some((s) => s.model === "gpt-4o" && JSON.stringify(s.body).includes("image_url")), "disease detector sent the photo to the vision model");
  r = await call("POST", "/api/analyze-disease", farmer.token, { imageBase64: "aGVsbG8=", language: "en" });
  ok(r.status === 200 && r.data.diseaseName === "White spot (Ich)" && typeof r.data.analysis === "string", "old app /api/analyze-disease still works", r.data);
  r = await call("POST", "/api/ai/disease", farmer.token, {});
  ok(r.status === 400, "disease with no photo or description -> 400", r);

  // admin try
  r = await call("POST", `${A}/try`, admin.token, { feature: "voice", lang: "bn" });
  ok(r.status === 200 && r.data.model === "gemini-2.5-flash" && r.data.via === "Omni main", "admin Try it shows the answer, model and key used", r.data);

  // reorder + disable + per-feature key
  r = await call("PUT", `${A}/keys/${keys[2].id}`, admin.token, { moveUp: true });
  ok(r.data.keys[1].id === keys[2].id, "move a key up the list", r.data.keys.map((k) => k.label));
  r = await call("PUT", `${A}/keys/${keys[0].id}`, admin.token, { enabled: false });
  ok(r.data.keys[0].enabled === false, "turn a key off");
  seen.length = 0;
  await call("POST", "/api/ai/chat", farmer.token, { message: "order" });
  ok(!seen.some((s) => s.auth === BAD) && seen[0]?.auth === GOOD2, "turned-off key skipped, new order used", seen.map((s) => s.auth.slice(-4)));
  r = await call("PUT", `${A}/settings`, admin.token, { features: { chat: { keyId: keys[1].id } } });
  seen.length = 0;
  await call("POST", "/api/ai/chat", farmer.token, { message: "pinned" });
  ok(seen[0]?.auth === GOOD, "chat pinned to a chosen key", seen.map((s) => s.auth.slice(-4)));

  // feature off
  await call("PUT", `${A}/settings`, admin.token, { features: { chat: { enabled: false } } });
  r = await call("POST", "/api/ai/chat", farmer.token, { message: "off" });
  ok(r.status >= 400 && /off|disabled/i.test(JSON.stringify(r.data)), "chat turned off -> clear error", r);
  await call("PUT", `${A}/settings`, admin.token, { features: { chat: { enabled: true } } });

  // ---- voice providers
  r = await call("POST", `${A}/voice/providers`, admin.token, { company: "compatible", label: "Omni voice", baseUrl: GW, apiKey: GOOD });
  ok(r.status === 200 && r.data.voice.providers.length === 1 && !JSON.stringify(r.data).includes(GOOD), "admin adds an Omni route voice provider (key hidden)", r.data?.voice);
  const vp = r.data.voice.providers[0];
  r = await call("POST", `${A}/voice/providers`, admin.token, { company: "elevenlabs", apiKey: "el-key-abcdefgh" });
  ok(r.status === 200 && r.data.voice.providers.length === 2 && r.data.voice.providers[1].company === "elevenlabs", "admin adds an ElevenLabs provider too");
  r = await call("GET", `${A}/voice/providers/${vp.id}/voices`, admin.token);
  ok(r.status === 200 && r.data.voices.length >= 6 && r.data.voices.some((v) => v.id === "nova"), "voice list for the provider", r.data?.voices?.length);
  r = await call("POST", `${A}/voice/preview`, admin.token, { providerId: vp.id, voiceId: "nova", model: "gpt-4o-mini-tts", lang: "bn" });
  ok(r.status === 200 && Buffer.from(r.data.audioBase64, "base64").toString().includes("nova"), "voice preview returns playable audio", r.data);
  r = await call("PUT", `${A}/settings`, admin.token, { voice: { bn: { providerId: vp.id, voiceId: "nova", voiceName: "Nova", model: "gpt-4o-mini-tts" }, en: { providerId: vp.id, voiceId: "onyx", voiceName: "Onyx", model: "gpt-4o-mini-tts" }, speed: 1.15 } });
  ok(r.status === 200 && r.data.voice.bn.voiceName === "Nova" && r.data.voice.en.voiceName === "Onyx" && r.data.voice.speed === 1.15, "admin picks a voice per language", r.data?.voice);
  st = await call("GET", "/api/ai/status");
  ok(st.data.voiceCall === true && st.data.voice.bn === "Nova" && st.data.voice.en === "Onyx", "status: AI call ready with chosen voices", st.data);

  // AI call
  r = await call("POST", "/api/ai/voice/greet", farmer.token, { lang: "bn" });
  ok(r.status === 200 && /^Nova/.test(r.data.voice) && Buffer.from(r.data.audioBase64, "base64").toString().includes("nova") && /কৃষি এআই/.test(r.data.reply), "call greeting spoken in the Bangla voice", r.data);
  seen.length = 0;
  const audio = Buffer.alloc(3000, 7).toString("base64");
  r = await call("POST", "/api/ai/voice/turn", farmer.token, { audioBase64: audio, mimeType: "audio/webm", lang: "en", history: [] });
  ok(r.status === 200 && r.data.heard && r.data.transcript === "My fish are gasping at dawn" && /gemini-2.5-flash/.test(r.data.reply) && /^Onyx/.test(r.data.voice), "call turn: speech -> text -> AI call brain -> English voice", r.data);
  ok(!/[*#]/.test(r.data.reply), "spoken reply has no markdown symbols", r.data.reply);
  ok(seen.some((s) => s.path === "/v1/audio/transcriptions" && s.ctype.includes("multipart")), "speech sent to the provider's transcription endpoint");
  r = await call("POST", "/api/ai/voice/turn", farmer.token, { audioBase64: Buffer.alloc(10, 1).toString("base64"), mimeType: "audio/webm", lang: "en" });
  ok(r.status === 200 && r.data.heard === false, "silence -> heard:false (app asks to try again)", r.data);
  await call("PUT", `${A}/settings`, admin.token, { voice: { callEnabled: false } });
  r = await call("POST", "/api/ai/voice/greet", farmer.token, { lang: "en" });
  ok(r.status >= 400, "AI call turned off by admin -> refused", r);
  await call("PUT", `${A}/settings`, admin.token, { voice: { callEnabled: true } });

  // HeyGen Voice (speaks English, free turbo model, no Bangla, never listens)
  r = await call("POST", `${A}/voice/providers`, admin.token, { company: "heygen", apiKey: HG });
  const hgp = r.data?.voice?.providers?.find((p) => p.company === "heygen");
  ok(r.status === 200 && hgp && !JSON.stringify(r.data).includes(HG), "admin adds a HeyGen voice provider (key hidden)", r.data?.voice);
  r = await call("GET", `${A}/voice/providers/${hgp.id}/voices`, admin.token);
  ok(r.status === 200 && r.data.voices[0]?.id === "myvoice1" && r.data.voices.some((v) => v.id === "hgv-en-1") && r.data.models[0] === "heygen-voice-1-turbo-free", "HeyGen voices fetched with the key (own voices first), free turbo model offered first", r.data);
  ok(/Not on turbo/.test(r.data.voices.find((v) => v.id === "pro1")?.note || ""), "professional clones marked as not for turbo models");
  r = await call("POST", `${A}/voice/preview`, admin.token, { providerId: hgp.id, voiceId: "hgv-en-1", model: "heygen-voice-1-turbo-free", lang: "en" });
  ok(r.status === 200 && Buffer.from(r.data.audioBase64 || "", "base64").toString() === "ID3heygen-hgv-en-1|heygen-voice-1-turbo-free", "HeyGen sample plays (audio downloaded from HeyGen's link)", r.data);
  r = await call("POST", `${A}/voice/preview`, admin.token, { providerId: hgp.id, voiceId: "hgv-en-1", model: "heygen-voice-1-turbo-free", lang: "bn" });
  ok(r.status >= 400 && /Bangla/.test(JSON.stringify(r.data)), "HeyGen asked for Bangla -> clear 'no Bangla' message", r.data);
  r = await call("PUT", `${A}/settings`, admin.token, { voice: { bn: { providerId: hgp.id, voiceId: "hgv-en-1", voiceName: "Ava", model: "heygen-voice-1-turbo-free" } } });
  ok(r.status === 400 && /Bangla/.test(r.data?.error || ""), "HeyGen can't be saved as the Bangla voice", r.data);
  r = await call("PUT", `${A}/settings`, admin.token, { voice: { en: { providerId: hgp.id, voiceId: "hgv-en-1", voiceName: "Ava", model: "heygen-voice-1-turbo-free" }, sttProviderId: null } });
  r = await call("POST", "/api/ai/voice/turn", farmer.token, { audioBase64: audio, mimeType: "audio/webm", lang: "en", history: [] });
  const enTurn = r;
  r = await call("POST", "/api/ai/voice/turn", farmer.token, { text: "পুকুরে চুন কতটুকু?", lang: "bn", history: [] });
  ok(r.status === 200 && !/^Ava/.test(r.data.voice || "") && !Buffer.from(r.data.audioBase64 || "", "base64").toString().startsWith("ID3heygen"), "app in Bangla: AI call keeps the Bangla voice, not HeyGen", { voice: r.data.voice });
  r = enTurn;
  ok(r.status === 200 && r.data.heard && /^Ava/.test(r.data.voice) && Buffer.from(r.data.audioBase64, "base64").toString().startsWith("ID3heygen-hgv-en-1"), "AI call: listens with another provider, answers in the HeyGen English voice", { voice: r.data.voice, t: r.data.transcript });
  await call("PUT", `${A}/settings`, admin.token, { voice: { en: { providerId: vp.id, voiceId: "onyx", voiceName: "Onyx", model: "gpt-4o-mini-tts" } } });
  await call("DELETE", `${A}/voice/providers/${hgp.id}`, admin.token);

  // Bangla is the default answer language
  seen.length = 0;
  r = await call("POST", "/api/ai/chat", farmer.token, { message: "How much lime per decimal?", lang: "bn", history: [] });
  ok(r.status === 200 && JSON.stringify(seen.find((x) => x.path === "/v1/chat/completions")?.body?.messages || []).includes("Reply ONLY in Bangla"), "app in Bangla + English question -> model told to answer in Bangla", r.data);

  // feed mix check: own model, or borrows the help chat's
  seen.length = 0;
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { lang: "bn", feedType: "Tilapia grower", ingredients: [{ name: "DORB", kg: 500, protein: 14 }, { name: "Soybean meal", kg: 300, protein: 44 }] });
  const fmModel1 = seen.find((x) => x.path === "/v1/chat/completions")?.model;
  r = await call("PUT", `${A}/settings`, admin.token, { features: { feedmix: { model: "acme/seer-pro" } } });
  ok(r.status === 200 && r.data.features.feedmix.model === "acme/seer-pro", "admin sets a model for the feed mix check", r.data?.features?.feedmix);
  seen.length = 0;
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { lang: "bn", feedType: "Tilapia grower", ingredients: [{ name: "DORB", kg: 500, protein: 14 }, { name: "Soybean meal", kg: 300, protein: 44 }] });
  ok(seen.find((x) => x.path === "/v1/chat/completions")?.model === "acme/seer-pro" && fmModel1 && fmModel1 !== "acme/seer-pro", "feed mix check uses its own model, else the help chat's", { before: fmModel1, after: seen.find((x) => x.path === "/v1/chat/completions")?.model });
  await call("PUT", `${A}/settings`, admin.token, { features: { feedmix: { model: "" } } });

  // limits
  r = await call("PUT", `${A}/settings`, admin.token, { limits: { perMinute: 2, userDaily: 100, guestDaily: 10 }, extraInstructions: "Recommend our marketplace." });
  ok(r.data.limits.perMinute === 2 && r.data.extraInstructions === "Recommend our marketplace.", "limits and extra instructions saved");
  const lim = [];
  for (let i = 0; i < 4; i++) lim.push((await call("POST", "/api/ai/chat", farmer.token, { message: "limit " + i })).status);
  ok(lim.includes(429), "per-minute limit enforced (429)", lim);

  // delete
  r = await call("DELETE", `${A}/voice/providers/${vp.id}`, admin.token);
  ok(r.status === 200 && r.data.voice.providers.length === 1 && r.data.voice.bn === null && r.data.voice.en === null, "deleting a voice provider clears its chosen voices", r.data?.voice);
  r = await call("DELETE", `${A}/keys/${keys[1].id}`, admin.token);
  ok(r.status === 200 && r.data.keys.length === 2 && r.data.features.chat.keyId === null, "deleting a key unpins it from features", r.data?.features?.chat);

  // persisted + encrypted at rest
  r = await call("GET", A, admin.token);
  ok(r.data.keys.length === 2 && r.data.features.disease.model === "gpt-4o" && r.data.updatedAt, "settings persist", r.data?.keys?.length);
} catch (e) {
  await finish(e);
}
gw.close();
await finish();
