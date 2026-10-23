// Code-level check of polls in community posts: a poll post is created with a title and
// options, people vote once (voting again moves the vote), counts come back right in the feed
// and on the post, comments work like any post, and bad input is refused.
//
//   node tests/check-post-polls.mjs
//
// Starts its own server on a spare port with a throwaway database, then stops it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 5000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "poll-check-"));
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
    JWT_SECRET: "poll-check-secret-0123456789abcdef0123456789",
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

  const a = await signUp("alice");
  const b = await signUp("bob");
  const c = await signUp("carol");

  const comms = await call("GET", "/api/communities", null);
  const communityId = (Array.isArray(comms.json) ? comms.json : comms.json?.communities || [])[0]?.id;
  ok(!!communityId, "A community exists to post in");

  // Bad polls are refused and nothing is saved
  let r = await call("POST", "/api/posts", a.token, { communityId, content: "", media: [], poll: { question: "Which feed?", options: ["Only one"] } });
  ok(r.status === 400, "A poll with one option is refused");
  r = await call("POST", "/api/posts", a.token, { communityId, content: "", media: [], poll: { question: "  ", options: ["A", "B"] } });
  ok(r.status === 400, "A poll without a question is refused");
  r = await call("POST", "/api/posts", a.token, { communityId, content: "", media: [], poll: { question: "Q", options: ["Same", "same"] } });
  ok(r.status === 400, "A poll with two identical options is refused");
  r = await call("POST", "/api/posts", a.token, { communityId, content: "", media: [], poll: { question: "Q", options: ["1", "2", "3", "4", "5", "6", "7"] } });
  ok(r.status === 400, "A poll with seven options is refused");
  r = await call("POST", "/api/posts", null, { communityId, content: "", media: [], poll: { question: "Q", options: ["A", "B"] } });
  ok(r.status === 401, "Signed out can't post a poll");
  let feed = await call("GET", `/api/posts?communityId=${communityId}`, a.token);
  ok(Array.isArray(feed.json) && feed.json.length === 0, "No post was saved from the refused polls");

  // A real poll
  r = await call("POST", "/api/posts", a.token, {
    communityId,
    content: "Thinking of switching feed",
    media: [],
    poll: { question: "Which fish feed is better?", options: ["Mega feed", " Quality feed ", "", "ACI feed"] },
  });
  ok(r.status === 201 && r.json?.poll?.question === "Which fish feed is better?", "Alice posts a poll");
  const pid = r.json?.id;
  ok(
    JSON.stringify(r.json?.poll?.options?.map((o) => [o.id, o.text, o.votes])) === JSON.stringify([["a", "Mega feed", 0], ["b", "Quality feed", 0], ["c", "ACI feed", 0]]),
    "Options are A, B, C with empty ones dropped and spaces trimmed",
  );
  ok(r.json?.poll?.totalVotes === 0 && r.json?.poll?.myVote === null, "New poll starts with no votes");

  // A normal post still works and has no poll
  r = await call("POST", "/api/posts", b.token, { communityId, content: "Plain post", media: [] });
  ok(r.status === 201 && r.json?.poll === null, "A normal post still works and has no poll");

  // Voting
  r = await call("POST", `/api/posts/${pid}/poll/vote`, b.token, { optionId: "b" });
  ok(r.status === 200 && r.json?.poll?.myVote === "b" && r.json.poll.options[1].votes === 1, "Bob votes B");
  r = await call("POST", `/api/posts/${pid}/poll/vote`, c.token, { optionId: "b" });
  ok(r.status === 200 && r.json?.poll?.options[1].votes === 2 && r.json.poll.totalVotes === 2, "Carol votes B, B has 2");
  r = await call("POST", `/api/posts/${pid}/poll/vote`, a.token, { optionId: "a" });
  ok(r.status === 200 && r.json?.poll?.options[0].votes === 1, "Alice votes for her own poll (A)");
  r = await call("POST", `/api/posts/${pid}/poll/vote`, b.token, { optionId: "b" });
  ok(r.status === 200 && r.json?.poll?.options[1].votes === 2 && r.json.poll.totalVotes === 3, "Bob voting B again doesn't add a second vote");
  r = await call("POST", `/api/posts/${pid}/poll/vote`, c.token, { optionId: "c" });
  ok(
    r.status === 200 && r.json?.poll?.options[1].votes === 1 && r.json.poll.options[2].votes === 1 && r.json.poll.totalVotes === 3 && r.json.poll.myVote === "c",
    "Carol switches to C: B goes down, C goes up, total stays 3",
  );
  r = await call("POST", `/api/posts/${pid}/poll/vote`, b.token, { optionId: "z" });
  ok(r.status === 400, "Voting for an option that doesn't exist is refused");
  r = await call("POST", `/api/posts/${pid}/poll/vote`, null, { optionId: "a" });
  ok(r.status === 401, "Signed out can't vote");
  r = await call("POST", `/api/posts/no-such-post/poll/vote`, b.token, { optionId: "a" });
  ok(r.status === 404, "Voting on a missing poll gives not found");

  // Feed and post page show the counts and each person's own vote
  feed = await call("GET", `/api/posts?communityId=${communityId}`, b.token);
  let fp = (feed.json || []).find((p) => p.id === pid);
  ok(fp?.poll && fp.poll.options.map((o) => o.votes).join(",") === "1,1,1" && fp.poll.myVote === "b", "Bob's feed shows 1/1/1 and his vote B");
  feed = await call("GET", `/api/posts?communityId=${communityId}`, null);
  fp = (feed.json || []).find((p) => p.id === pid);
  ok(fp?.poll?.totalVotes === 3 && fp.poll.myVote === null, "Signed-out feed shows the counts but no vote");
  r = await call("GET", `/api/posts/${pid}`, c.token);
  ok(r.status === 200 && r.json?.poll?.myVote === "c" && r.json.poll.totalVotes === 3, "The post page shows the poll with Carol's vote");
  ok(!JSON.stringify(r.json.poll).includes(b.id), "Who voted is never sent, only counts");

  // Comments work on polls like on any post
  r = await call("POST", `/api/posts/${pid}/comments`, b.token, { body: "Quality feed worked for my tilapia" });
  ok(r.status === 200 || r.status === 201, "Bob comments on the poll");
  r = await call("GET", `/api/posts/${pid}/comments`, a.token);
  const comments = Array.isArray(r.json) ? r.json : r.json?.comments || [];
  ok(comments.some((x) => (x.body ?? x.content) === "Quality feed worked for my tilapia"), "The comment shows on the poll");

  // Likes, save and edit still work
  r = await call("POST", `/api/posts/${pid}/like`, c.token);
  ok(r.status === 200 || r.status === 201, "Carol likes the poll");
  r = await call("PATCH", `/api/posts/${pid}`, a.token, { content: "" });
  ok(r.status === 200, "Alice can clear the text of her poll post (the poll stays)");
  r = await call("GET", `/api/posts/${pid}`, a.token);
  ok(r.json?.poll?.totalVotes === 3, "The poll is still there after editing");

  // Deleting the post deletes the poll and its votes
  r = await call("DELETE", `/api/posts/${pid}`, a.token);
  ok(r.status === 200, "Alice deletes her poll");
  r = await call("POST", `/api/posts/${pid}/poll/vote`, b.token, { optionId: "a" });
  ok(r.status === 404, "A deleted poll can't be voted on");
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
