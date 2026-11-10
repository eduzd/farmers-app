/**
 * Feed Making Calculator: AI protein check.
 *   POST /api/ai/feed-mix   (anyone, rate limited like the other AI endpoints)
 *
 * The app sends the ingredients of one batch (name, kg, protein % when the farmer knows it) and the
 * feed type it is for. The AI (the admin's chat model and Omni route key from AI settings):
 *   - recognises each ingredient (e.g. "DORB" = de-oiled rice bran) and gives a typical protein %
 *     for the ones the farmer left blank,
 *   - gives the usual crude protein range for that feed type.
 * The arithmetic is done here, not by the AI: the mix protein is the weight-weighted average of the
 * farmer's own values (kept as typed) and the AI's estimates, and the verdict compares that number
 * with the AI's range. So the numbers on screen always add up.
 */
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { aiConfig, AiError, runFeature } from "./aiEngine";

type Lang = "en" | "bn";
const langOf = (v: any): Lang => (String(v || "").toLowerCase().startsWith("bn") ? "bn" : "en");
const clean = (v: any, n = 200) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

// ---- rate limit: its own small counter, the same limits the admin set for AI (per account, else per IP)
const hits = new Map<string, { min: number[]; day: string; count: number }>();
function uidOf(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null; } catch { return null; }
}
async function limit(req: Request, res: Response): Promise<boolean> {
  const c = await aiConfig();
  const uid = uidOf(req);
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const id = uid ? `u:${uid}` : `ip:${ip}`;
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const h = hits.get(id) || { min: [], day, count: 0 };
  if (h.day !== day) { h.day = day; h.count = 0; }
  h.min = h.min.filter((t) => now - t < 60_000);
  const perMin = Math.max(1, Number(c.limits?.perMinute) || 8);
  const daily = Math.max(1, Number(uid ? c.limits?.userDaily : c.limits?.guestDaily) || 25);
  if (h.min.length >= perMin) {
    res.status(429).json({ error: "Too many AI requests. Please wait a minute and try again.", code: "rate_limited", retryAfter: 60 });
    return false;
  }
  if (h.count + 1 > daily) {
    res.status(429).json({ error: uid ? "You've reached today's AI limit. Please try again tomorrow." : "Today's free AI limit is used up. Sign in to keep going.", code: "daily_limit" });
    return false;
  }
  h.min.push(now);
  h.count += 1;
  hits.set(id, h);
  if (hits.size > 20000) for (const [k, v] of hits) if (v.day !== day) hits.delete(k);
  return true;
}

const parseJson = (t: string): any => {
  const s = String(t || "").replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
};

export interface FeedMixInput {
  lang: Lang;
  feedType: string;
  ingredients: { name: string; kg: number; protein: number | null }[];
  lossPercent: number;
}

/** Validates what the app sent. Throws AiError(bad_request) with a message the farmer can act on. */
export function readFeedMixInput(body: any): FeedMixInput {
  const lang = langOf(body?.lang);
  const feedType = clean(body?.feedType, 120);
  const raw = Array.isArray(body?.ingredients) ? body.ingredients.slice(0, 40) : [];
  const ingredients = raw
    .map((x: any) => {
      const kg = num(x?.kg);
      let protein = num(x?.protein);
      if (protein !== null && (protein < 0 || protein > 100)) protein = null;
      return { name: clean(x?.name, 80), kg: kg && kg > 0 ? kg : 0, protein };
    })
    .filter((x: any) => x.kg > 0);
  if (!ingredients.length) throw new AiError("bad_request", lang === "bn" ? "প্রথমে উপাদানের ওজন লিখুন।" : "Enter the ingredient weights first.", 400);
  const unnamed = ingredients.filter((x: any) => !x.name && x.protein === null).length;
  if (unnamed) throw new AiError("bad_request", lang === "bn" ? "প্রতিটি উপাদানের নাম বা প্রোটিন % লিখুন।" : "Give each ingredient a name or a protein %.", 400);
  if (!feedType) throw new AiError("bad_request", lang === "bn" ? "খাদ্যটি কোন মাছ ও কোন পর্যায়ের জন্য, তা লিখুন।" : "Say which fish and stage the feed is for.", 400);
  const loss = num(body?.lossPercent);
  return { lang, feedType, ingredients, lossPercent: loss && loss > 0 && loss < 100 ? loss : 0 };
}

export function feedMixPrompt(inp: FeedMixInput): string {
  const lines = inp.ingredients
    .map((x, i) => `${i + 1}. name: "${x.name || "(no name)"}", ${x.kg} kg, protein: ${x.protein === null ? "UNKNOWN - estimate it" : `${x.protein}% (given by the farmer, keep it)`}`)
    .join("\n");
  const L = inp.lang === "bn" ? "Write every text value in simple Bangla (বাংলা) as spoken in Bangladesh; ingredient names may keep the English name in brackets." : "Write every text value in simple English.";
  return `You are a fish feed formulation expert for fish farmers and small feed mills in Bangladesh.
A farmer is making a batch of fish feed. Feed type (fish and stage): "${inp.feedType}".
Ingredients:
${lines}
Local names are common: DORB = de-oiled rice bran, rice polish/kura = rice bran, khoil = oil cake (mustard oil cake), soybean meal, meat and bone meal (MBM), fish meal, maize/bhutta, wheat bran/bhushi, molasses, etc.
Tasks:
1. For each ingredient say what it is and give its typical crude protein % (as-fed). Keep the farmer's value when given. If you cannot recognise an ingredient, give your best guess and say so in note.
2. Give the usual recommended crude protein range (min and max, %) for complete feed of this fish and stage, as used by fisheries departments / feed industry (e.g. WorldFish, DoF Bangladesh, FAO, NRC). Name the basis briefly.
Reply with ONLY a JSON object, no other text:
{"feedTypeUnderstood": "fish and stage as you understood it", "ingredients": [{"index": 1, "recognizedAs": "what it is", "proteinPercent": number, "note": "short, or empty"}], "standard": {"minProtein": number, "maxProtein": number, "basis": "short source/basis"}, "advice": ["2-4 short practical suggestions to move the protein toward the range using common local ingredients; or to keep it"], "caution": "one short sentence, or empty", "confidence": number 0-100}
${L}`;
}

export type FeedMixVerdict = "low" | "optimal" | "high";

/** Combines the AI's answer with the farmer's numbers. All math here. */
export function combineFeedMix(inp: FeedMixInput, j: any) {
  if (!j || typeof j !== "object") throw new AiError("failed", "The AI's answer couldn't be read. Please try again.", 502);
  const ai: any[] = Array.isArray(j.ingredients) ? j.ingredients : [];
  const byIndex = new Map<number, any>();
  ai.forEach((x, k) => {
    const i = Number(x?.index);
    byIndex.set(Number.isInteger(i) && i >= 1 && i <= inp.ingredients.length ? i : k + 1, x);
  });
  let totalKg = 0;
  let weighted = 0;
  let missing = 0;
  const ingredients = inp.ingredients.map((x, k) => {
    const a = byIndex.get(k + 1) || {};
    const est = num(a.proteinPercent);
    const estOk = est !== null && est >= 0 && est <= 100 ? Math.round(est * 10) / 10 : null;
    const protein = x.protein !== null ? x.protein : estOk;
    const source: "farmer" | "ai" | "none" = x.protein !== null ? "farmer" : estOk !== null ? "ai" : "none";
    if (protein === null) missing++;
    totalKg += x.kg;
    weighted += x.kg * (protein ?? 0);
    return {
      name: x.name,
      kg: x.kg,
      recognizedAs: clean(a.recognizedAs, 120),
      proteinPercent: protein,
      source,
      aiEstimate: estOk,
      note: clean(a.note, 200),
    };
  });
  const mixProtein = totalKg > 0 ? weighted / totalKg : 0;
  let min = num(j?.standard?.minProtein);
  let max = num(j?.standard?.maxProtein);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const rangeOk = min !== null && max !== null && min >= 0 && max <= 100 && max > 0;
  let verdict: FeedMixVerdict | "unknown" = "unknown";
  if (rangeOk) verdict = mixProtein < (min as number) ? "low" : mixProtein > (max as number) ? "high" : "optimal";
  const arr = (v: any, n = 4) => (Array.isArray(v) ? v.map((s) => clean(s, 300)).filter(Boolean).slice(0, n) : []);
  return {
    feedType: inp.feedType,
    feedTypeUnderstood: clean(j.feedTypeUnderstood, 120),
    ingredients,
    mixProtein: Math.round(mixProtein * 100) / 100,
    totalKg,
    missingProtein: missing,
    standard: rangeOk ? { minProtein: min as number, maxProtein: max as number, basis: clean(j?.standard?.basis, 200) } : null,
    verdict,
    gap: rangeOk ? Math.round((verdict === "low" ? (min as number) - mixProtein : verdict === "high" ? mixProtein - (max as number) : 0) * 100) / 100 : null,
    advice: arr(j.advice),
    caution: clean(j.caution, 300),
    confidence: Math.max(0, Math.min(100, Math.round(Number(j.confidence) || 0))),
  };
}

export function registerFeedMixAiRoutes(app: Express) {
  app.post("/api/ai/feed-mix", async (req: Request, res: Response) => {
    try {
      const inp = readFeedMixInput(req.body);
      if (!(await limit(req, res))) return;
      const r = await runFeature("feedmix", [
        { role: "system", content: "You are a careful aquaculture feed nutrition expert. Answer only with the JSON object asked for." },
        { role: "user", content: feedMixPrompt(inp) },
      ], { maxTokens: 1400, temperature: 0.2, timeoutMs: 60000 });
      const result = combineFeedMix(inp, parseJson(r.text));
      res.json({ success: true, result: { ...result, model: r.model, checkedAt: new Date().toISOString() } });
    } catch (e: any) {
      if (e instanceof AiError) return res.status(e.status).json({ error: e.message, code: e.code });
      console.error("[ai feed-mix]", e?.message || e);
      res.status(500).json({ error: "Something went wrong with the AI. Please try again.", code: "failed" });
    }
  });
}
