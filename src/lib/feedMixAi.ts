import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";
import { AiRequestError } from "@/lib/aiApi";

/** Feed Making Calculator: client for POST /api/ai/feed-mix (server/feedMixAi.ts). */

export type FeedMixAiIngredient = {
  name: string;
  kg: number;
  recognizedAs: string;
  proteinPercent: number | null;
  source: "farmer" | "ai" | "none";
  aiEstimate: number | null;
  note: string;
};

export type FeedMixAiResult = {
  feedType: string;
  feedTypeUnderstood: string;
  ingredients: FeedMixAiIngredient[];
  mixProtein: number;
  totalKg: number;
  missingProtein: number;
  standard: { minProtein: number; maxProtein: number; basis: string } | null;
  verdict: "low" | "optimal" | "high" | "unknown";
  gap: number | null;
  advice: string[];
  caution: string;
  confidence: number;
  model?: string;
  checkedAt?: string;
};

export async function aiFeedMixCheck(p: {
  lang: string;
  feedType: string;
  ingredients: { name: string; kg: number; protein: number | null }[];
  lossPercent: number;
}): Promise<FeedMixAiResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const t = await useAuthStore.getState().getToken?.();
    if (t) headers.Authorization = `Bearer ${t}`;
  } catch {}
  let r: Response;
  try {
    r = await fetch(new URL("/api/ai/feed-mix", getApiUrl()).toString(), { method: "POST", headers, body: JSON.stringify(p) });
  } catch {
    throw new AiRequestError("offline", "offline");
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiRequestError(j?.error || `Error ${r.status}`, j?.code || (r.status === 429 ? "rate_limited" : "failed"));
  return j.result as FeedMixAiResult;
}

/** A key for the inputs the AI check used, so the screen can tell when the mix changed after it. */
export function feedMixSignature(feedType: string, ingredients: { name: string; kg: number; protein: number | null }[]): string {
  return JSON.stringify([feedType.trim().toLowerCase(), ingredients.map((x) => [x.name.trim().toLowerCase(), x.kg, x.protein])]);
}
