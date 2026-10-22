/**
 * Profile numbers (followers, following, rating) as they really are on the server.
 * - followers / following come from GET /api/follows/:userId
 * - rating comes from GET /api/sellers/:userId/rating (average of the stars buyers gave this person's listings)
 * Nothing here invents a number: while loading we show "…", when a load fails we show "—" (never 0),
 * and someone with no reviews is shown as "No ratings yet", not 0.0 or a made-up score.
 */

export type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ok"; value: T };
export type FollowCounts = { followers: number; following: number; isFollowing: boolean };
export type RatingSummary = { average: number; count: number };

export const LOADING = { state: "loading" } as const;
export const FAILED = { state: "error" } as const;

const isCount = (n: number) => Number.isInteger(n) && n >= 0;

/** Reads the follows payload; throws when it isn't real data, so a broken reply never shows as 0. */
export function parseFollowCounts(f: any): FollowCounts {
  const followers = Number(f?.followerCount);
  const following = Number(f?.followingCount);
  if (!f || !isCount(followers) || !isCount(following)) throw new Error("Bad follow data");
  return { followers, following, isFollowing: !!f.isFollowing };
}

/** Reads the rating payload; throws when it isn't real data. */
export function parseRating(r: any): RatingSummary {
  const count = Number(r?.count);
  const average = Number(r?.average);
  if (!r || !isCount(count) || !Number.isFinite(average)) throw new Error("Bad rating data");
  if (count > 0 && (average < 1 || average > 5)) throw new Error("Bad rating data");
  return { average: count > 0 ? Math.round(average * 10) / 10 : 0, count };
}

/** Text for a follower/following box. */
export function countText(s: Loaded<number>): string {
  if (s.state === "loading") return "…";
  if (s.state === "error") return "—";
  return String(s.value);
}

/** Value and label for the rating box. */
export function ratingView(s: Loaded<RatingSummary>, lang: string): { value: string; label: string } {
  const bn = lang === "bn";
  const base = bn ? "রেটিং" : "Rating";
  if (s.state === "loading") return { value: "…", label: base };
  if (s.state === "error") return { value: "—", label: base };
  if (s.value.count === 0) return { value: "—", label: bn ? "এখনো রেটিং নেই" : "No ratings yet" };
  return { value: `${s.value.average.toFixed(1)} ★`, label: `${base} (${s.value.count})` };
}

/** Map a loaded follow-counts state to one of its numbers. */
export function pick(s: Loaded<FollowCounts>, key: "followers" | "following"): Loaded<number> {
  return s.state === "ok" ? { state: "ok", value: s.value[key] } : s;
}
