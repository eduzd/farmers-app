// Code-level check of the live-data endpoints that replaced sample numbers:
// people search, post likers, trending, a person's posts and product ratings.
// Everything must come from the database: empty when there's nothing, real counts otherwise.
//
//   node tests/check-live-data.mjs
//
// Starts its own server on a spare port with a throwaway database, then stops it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 5000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "ld-check-"));
let failed = 0;
let passed = 0;
const ok = (cond, label) => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};

const server = spawn("npx", ["tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "development",
    DATA_DIR: dataDir,
    DATABASE_URL: "",
    FIREBASE_PROJECT_ID: "",
    PUSH_DISABLED: "1",
    JWT_SECRET: "livedata-check-secret-0123456789abcdef0123456789",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // own process group, so the whole npx -> tsx -> node chain can be stopped
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
  const stamp = Date.now().toString(36);
  const r = await call("POST", "/api/auth/signup", null, {
    email: `${tag}-${stamp}@check.test`,
    password: "Check-pass-123",
    name: tag,
    username: `${tag}_${stamp}`,
  });
  if (!r.json?.token) throw new Error(`sign-up failed for ${tag}: ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.token, id: String(r.json.user.id) };
}

try {
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      up = (await fetch(`${BASE}/api/health`)).ok;
    } catch {}
  }
  if (!up) throw new Error("server did not start\n" + log.slice(-2000));

  // Empty database: honest empties, no samples
  let r = await call("GET", "/api/trending", null);
  if (r.status !== 200) console.log("trending:", r.status, JSON.stringify(r.json), log.split("\n").filter((l) => l.includes("live-data")).join("\n").slice(0, 1500));
  ok(r.status === 200 && r.json.hashtags.length === 0 && r.json.posts.length === 0, "Trending is empty with no posts (no samples)");
  r = await call("GET", "/api/reviews-summary?ids=nope", null);
  ok(r.status === 200 && Object.keys(r.json).length === 0, "Unreviewed product has no rating at all (not 0.0)");

  const a = await signUp("alice");
  const b = await signUp("bob");
  const c = await signUp("carol");

  r = await call("GET", "/api/communities", null);
  const community = (r.json || [])[0];
  ok(!!community?.id, "A community exists to post in");

  r = await call("POST", "/api/posts", a.token, { communityId: community.id, content: "Rice harvest is early this year #rice #boro", media: [] });
  ok(r.status === 201 && r.json?.id, "Alice posts");
  const pid = r.json.id;
  r = await call("POST", "/api/posts", a.token, { communityId: community.id, content: "Quiet post", media: [] });
  const quiet = r.json.id;

  r = await call("GET", `/api/posts/${pid}/likers`, null);
  ok(r.status === 200 && Array.isArray(r.json) && r.json.length === 0, "No likers before anyone likes");

  await call("POST", `/api/posts/${pid}/like`, b.token, { liked: true });
  await call("POST", `/api/posts/${pid}/like`, c.token, { liked: true });
  await call("POST", `/api/posts/${pid}/comments`, c.token, { body: "Great!" });
  await call("POST", `/api/follows/${b.id}`, c.token, {});

  r = await call("GET", `/api/posts/${pid}/likers`, c.token);
  const likerIds = (r.json || []).map((x) => x.id).sort();
  ok(r.status === 200 && likerIds.join() === [b.id, c.id].sort().join(), "Likers are exactly Bob and Carol");
  const bobRow = (r.json || []).find((x) => x.id === b.id);
  ok(bobRow?.followerCount === 1 && bobRow?.isFollowing === true, "Bob shows 1 real follower, and Carol sees she follows him");
  ok(bobRow && !("email" in bobRow) && !("phone" in bobRow), "No email or phone in the people list");
  r = await call("GET", `/api/posts/no-such-post/likers`, null);
  ok(r.status === 404, "Likers of a missing post is 404");

  r = await call("GET", "/api/trending", a.token);
  ok(r.status === 200 && r.json.hashtags.some((h) => h.tag === "#rice" && h.postsCount === 1 && h.growth === null), "Trending hashtag #rice counted from the real post, marked new");
  const tp = r.json.posts.find((p) => p.id === pid);
  ok(tp?.likeCount === 2 && tp?.commentCount === 1, "Trending post has its real 2 likes and 1 comment");
  ok(!r.json.posts.some((p) => p.id === quiet), "A post nobody reacted to isn't called trending");
  ok(r.json.topics.some((t) => t.postsCount === 2), "Community activity counts Alice's 2 posts");

  r = await call("GET", `/api/users/search?q=bob`, a.token);
  ok(r.status === 200 && r.json.length === 1 && r.json[0].id === b.id && r.json[0].followerCount === 1, "Searching 'bob' finds Bob with his real follower count");
  r = await call("GET", `/api/users/search?q=`, a.token);
  ok(r.status === 200 && !r.json.some((x) => x.id === a.id) && r.json[0]?.id === b.id, "Browsing leaves you out and puts the most followed first");
  r = await call("GET", `/api/users/search?q=zzzz-nobody`, a.token);
  ok(r.status === 200 && r.json.length === 0, "No match gives an empty list");

  r = await call("GET", `/api/users/${a.id}/posts`, a.token);
  ok(r.status === 200 && r.json.length === 2 && r.json[0].id === quiet, "Alice's own posts: both, newest first");
  ok(r.json.find((p) => p.id === pid)?.likeCount === 2, "Her post shows its real like count");

  // Blocking hides people both ways
  r = await call("POST", "/api/relations", b.token, { kind: "block", targetId: a.id });
  ok(r.status === 200 || r.status === 201, "Bob blocks Alice");
  r = await call("GET", `/api/users/search?q=bob`, a.token);
  ok(r.status === 200 && r.json.length === 0, "Alice can't find Bob after he blocked her");
  r = await call("GET", `/api/users/${a.id}/posts`, b.token);
  ok(r.status === 200 && r.json.length === 0, "Bob doesn't get the posts of someone he blocked");

  // Ratings from real reviews
  const productId = `cat-check-${Date.now()}`;
  await call("POST", `/api/reviews/${productId}`, b.token, { rating: 5 });
  await call("POST", `/api/reviews/${productId}`, c.token, { rating: 4 });
  r = await call("GET", `/api/reviews-summary?ids=${productId},unrated-one`, null);
  ok(r.status === 200 && r.json[productId]?.average === 4.5 && r.json[productId]?.count === 2 && !r.json["unrated-one"], "Product rating is the real 4.5 from 2 reviews; unrated product left out");
} catch (e) {
  failed++;
  console.log("FAIL  " + (e?.message || e));
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await new Promise((r) => setTimeout(r, 500));
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
