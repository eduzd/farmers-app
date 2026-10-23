// Profile numbers check: followers, following and rating come from real data, with truthful
// empty and failure states, and nobody can push stars onto someone else's profile.
//
//   npx tsx tests/check-profile-stats.mjs
//
// Part 1 checks the display rules in src/lib/profileStats.ts.
// Part 2 starts its own server on a spare port with a throwaway database (no real people touched),
// signs up throwaway accounts, follows / unfollows and reviews between them, and reads the numbers back.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as S from "../src/lib/profileStats.ts";

let failed = 0;
let passed = 0;
const ok = (cond, label) => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Part 1: display rules ----------
ok(S.countText(S.LOADING) === "…", "a count still loading shows …");
ok(S.countText(S.FAILED) === "—", "a count that failed to load shows —, not 0");
ok(S.countText({ state: "ok", value: 0 }) === "0", "a real zero shows 0");
ok(S.countText({ state: "ok", value: 12 }) === "12", "a real count shows as is");
const fc = S.parseFollowCounts({ followerCount: 3, followingCount: 0, isFollowing: true });
ok(fc.followers === 3 && fc.following === 0 && fc.isFollowing === true, "follow payload is read as is");
ok(S.countText(S.pick({ state: "ok", value: fc }, "following")) === "0", "following 0 shows 0");
ok(S.countText(S.pick(S.FAILED, "followers")) === "—", "failed follow load keeps — for each box");
ok(throws(() => S.parseFollowCounts(null)), "an empty follow reply counts as a failure");
ok(throws(() => S.parseFollowCounts({ error: "Something went wrong" })), "an error reply counts as a failure, not 0");
ok(throws(() => S.parseFollowCounts({ followerCount: -1, followingCount: 2 })), "a negative count is rejected");
ok(throws(() => S.parseRating({ error: "x" })), "an error rating reply counts as a failure");
ok(throws(() => S.parseRating({ average: 7, count: 2 })), "an impossible average is rejected");
const none = S.ratingView({ state: "ok", value: S.parseRating({ average: 0, count: 0 }) }, "en");
ok(none.value === "—" && none.label === "No ratings yet", "no reviews shows 'No ratings yet', not 0.0 or 4.9");
const noneBn = S.ratingView({ state: "ok", value: S.parseRating({ average: 0, count: 0 }) }, "bn");
ok(noneBn.label === "এখনো রেটিং নেই", "no reviews in Bangla: এখনো রেটিং নেই");
const some = S.ratingView({ state: "ok", value: S.parseRating({ average: 4.25, count: 4 }) }, "en");
ok(some.value === "4.3 ★" && some.label === "Rating (4)", "real reviews show average and how many");
ok(S.ratingView({ state: "ok", value: S.parseRating({ average: 5, count: 1 }) }, "bn").label === "রেটিং (1)", "rating label in Bangla");
ok(S.ratingView(S.FAILED, "en").value === "—" && S.ratingView(S.LOADING, "en").value === "…", "rating failed / loading states");

// Source checks: the old placeholders are gone and the Follow labels go through translation.
const prof = readFileSync(new URL("../src/screens/ProfileScreen.tsx", import.meta.url), "utf8");
const other = readFileSync(new URL("../src/screens/UserProfileScreen.tsx", import.meta.url), "utf8");
const dict = readFileSync(new URL("../src/lib/trDict.ts", import.meta.url), "utf8");
ok(!/\|\|\s*156|\|\|\s*89|>4\.9</.test(prof), "own profile has no 156 / 89 / 4.9 placeholders");
ok(prof.includes("/api/follows/") && prof.includes("/rating`"), "own profile loads follows and rating from the server");
ok(!other.includes('"ফলো করুন"') && other.includes('tr("Follow")') && other.includes('tr("Following")'), "Follow / Following button uses tr()");
ok(/"Follow": "ফলো করুন"/.test(dict) && /"Following": "ফলোয়িং"/.test(dict), "Follow / Following have Bangla and English");

// ---------- Part 2: real server ----------
const PORT = 6000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "profile-check-"));
const server = spawn("npx", ["tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "development",
    DATA_DIR: dataDir,
    DATABASE_URL: "",
    FIREBASE_PROJECT_ID: "",
    PUSH_DISABLED: "1",
    JWT_SECRET: "profile-check-secret-0123456789abcdef0123456789ab",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}
async function signUp(tag) {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  const r = await call("POST", "/api/auth/signup", null, {
    email: `${tag}-${stamp}@check.test`,
    password: "Check-pass-123",
    name: tag,
    username: `${tag}_${stamp}`,
  });
  if (!r.json?.token) throw new Error(`sign-up failed for ${tag}: ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.token, id: String(r.json.user.id) };
}
const counts = async (id, token) => S.parseFollowCounts((await call("GET", `/api/follows/${id}`, token)).json);
const rating = async (id) => S.parseRating((await call("GET", `/api/sellers/${id}/rating`)).json);

try {
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    await sleep(1000);
    try {
      up = (await fetch(`${BASE}/api/health`)).ok;
    } catch {}
  }
  if (!up) throw new Error("server did not start\n" + log.slice(-2000));

  const a = await signUp("asha");
  const b = await signUp("bilal");
  const c = await signUp("chandni");

  let ca = await counts(a.id, a.token);
  ok(ca.followers === 0 && ca.following === 0, "a new account really has 0 followers and 0 following");
  ok(S.ratingView({ state: "ok", value: await rating(a.id) }, "en").label === "No ratings yet", "a new account shows 'No ratings yet'");

  ok((await call("POST", `/api/follows/${a.id}`, b.token, {})).json?.following === true, "Bilal follows Asha");
  await call("POST", `/api/follows/${a.id}`, c.token, {});
  await call("POST", `/api/follows/${b.id}`, a.token, {});
  ca = await counts(a.id, a.token);
  ok(ca.followers === 2 && ca.following === 1, "Asha's own profile: 2 followers, 1 following");
  ok((await counts(a.id, b.token)).isFollowing === true, "seen by Bilal: Asha's profile says Following");
  ok((await counts(a.id, null)).followers === 2, "the same count shows on Asha's public profile");
  const cb = await counts(b.id, b.token);
  ok(cb.followers === 1 && cb.following === 1, "Bilal: 1 follower, 1 following");

  ok((await call("POST", `/api/follows/${a.id}`, c.token, {})).json?.following === false, "Chandni unfollows Asha");
  ca = await counts(a.id, a.token);
  ok(ca.followers === 1 && (await counts(a.id, c.token)).isFollowing === false, "Asha drops to 1 follower and Chandni sees Follow again");
  ok((await call("POST", `/api/follows/${a.id}`, a.token, {})).status >= 400, "nobody can follow themselves");
  ok((await call("POST", `/api/follows/${b.id}`, null, {})).status === 401, "following needs sign-in");

  // Ratings: only reviews of Asha's own listings count toward Asha.
  const item = await call("POST", "/api/catalog/listings", a.token, { name: "Check rice 5kg" });
  ok(item.status === 201 && item.json?.id, "Asha lists an item");
  ok((await call("POST", `/api/reviews/${item.json.id}`, b.token, { rating: 4 })).status === 201, "Bilal rates it 4 stars");
  ok((await call("POST", `/api/reviews/${item.json.id}`, c.token, { rating: 5 })).status === 201, "Chandni rates it 5 stars");
  let ra = await rating(a.id);
  ok(ra.count === 2 && ra.average === 4.5, "Asha's rating is 4.5 from 2 reviews");
  ok(S.ratingView({ state: "ok", value: ra }, "en").value === "4.5 ★", "it shows as 4.5 ★");
  ok((await call("POST", `/api/reviews/${item.json.id}`, a.token, { rating: 5 })).status === 400, "Asha can't rate her own listing");
  await call("POST", `/api/reviews/fake-target-${Date.now()}`, c.token, { rating: 1, targetOwnerId: a.id });
  await call("POST", `/api/reviews/fake-target2-${Date.now()}`, c.token, { rating: 5, targetOwnerId: b.id });
  ra = await rating(a.id);
  ok(ra.count === 2 && ra.average === 4.5, "a review of something that isn't Asha's can't change her rating");
  ok((await rating(b.id)).count === 0, "nobody can push stars onto Bilal's profile with a made-up owner");
  ok((await call("POST", `/api/reviews/${item.json.id}`, b.token, { rating: 2 })).status === 201, "Bilal changes his review to 2 stars");
  ra = await rating(a.id);
  ok(ra.count === 2 && ra.average === 3.5, "a changed review updates, not doubles: 3.5 from 2");
} catch (e) {
  ok(false, `check crashed: ${e?.message || e}`);
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  await sleep(500);
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
