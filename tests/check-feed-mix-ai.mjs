// Feed Making Calculator AI protein check, on a throwaway local server with a fake Omni route gateway.
//   node tests/check-feed-mix-ai.mjs
import { createServer } from "node:http";
for (const k of Object.keys(process.env)) if (/^GOOGLE_API_KEY|^GEMINI_API_KEY/.test(k)) process.env[k] = "";
const { ok, call, setup, finish } = await import("./harness.mjs");

const GW_PORT = 8100 + Math.floor(Math.random() * 800);
const GW = `http://127.0.0.1:${GW_PORT}/v1`;
const GOOD = "sk-omni-good-key-1234";
const seen = [];
let reply = null;
const gw = createServer((req, res) => {
  const b = [];
  req.on("data", (d) => b.push(d));
  req.on("end", () => {
    let body = {}; try { body = JSON.parse(Buffer.concat(b).toString()); } catch {}
    seen.push({ path: req.url, body });
    const json = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/v1/models") return json(200, { data: [{ id: "gpt-4o-mini" }] });
    if (req.url === "/v1/chat/completions") return json(200, { choices: [{ message: { content: reply } }], model: body.model });
    json(404, {});
  });
});
await new Promise((r) => gw.listen(GW_PORT, "127.0.0.1", r));

const A = "/api/admin/manage/ai";
const mix = {
  lang: "en",
  feedType: "Tilapia grower",
  lossPercent: 2,
  ingredients: [
    { name: "De-oiled rice bran (DORB)", kg: 600, protein: 15 },
    { name: "Mustard oil cake", kg: 300, protein: 35 },
    { name: "Shutki guro", kg: 100, protein: null },
  ],
};
try {
  const [admin, farmer] = await setup(["boss", "farmer"]);

  // no key yet -> friendly not_configured
  let r = await call("POST", "/api/ai/feed-mix", farmer.token, mix);
  ok(r.status >= 400 && r.data?.code === "not_configured", "no AI key -> not_configured (app shows the friendly message)", r);

  await call("POST", `${A}/keys`, admin.token, { provider: "omniroute", label: "Omni", baseUrl: GW, apiKey: GOOD });
  await call("PUT", `${A}/settings`, admin.token, { features: { chat: { enabled: true, model: "gpt-4o-mini" } }, limits: { perMinute: 120, userDaily: 1000, guestDaily: 1000 } });

  // AI answers; farmer values kept, unknown estimated, math done on the server
  reply = "```json\n" + JSON.stringify({
    feedTypeUnderstood: "Nile tilapia, grow-out",
    ingredients: [
      { index: 1, recognizedAs: "De-oiled rice bran", proteinPercent: 16, note: "" },
      { index: 2, recognizedAs: "Mustard oil cake", proteinPercent: 34, note: "" },
      { index: 3, recognizedAs: "Dry fish powder", proteinPercent: 45, note: "varies" },
    ],
    standard: { minProtein: 25, maxProtein: 30, basis: "WorldFish / DoF grow-out" },
    advice: ["Keep fish meal share as it is"],
    caution: "Estimate, not a lab test.",
    confidence: 70,
  }) + "\n```";
  seen.length = 0;
  r = await call("POST", "/api/ai/feed-mix", farmer.token, mix);
  const res = r.data?.result;
  ok(r.status === 200 && res, "AI check answers", r);
  const expected = (600 * 15 + 300 * 35 + 100 * 45) / 1000; // 24.0
  ok(Math.abs(res.mixProtein - expected) < 0.01, `mix protein = weighted average with farmer values kept (${expected})`, res?.mixProtein);
  ok(res.ingredients[0].source === "farmer" && res.ingredients[0].proteinPercent === 15, "farmer's 15% kept, not the AI's 16%", res?.ingredients?.[0]);
  ok(res.ingredients[2].source === "ai" && res.ingredients[2].proteinPercent === 45, "blank protein estimated by AI", res?.ingredients?.[2]);
  ok(res.verdict === "low" && res.standard.minProtein === 25 && Math.abs(res.gap - 1) < 0.01, "verdict low vs 25-30% range, gap 1 point", res);
  ok(res.model === "gpt-4o-mini", "used the admin's chat model", res?.model);
  const prompt = JSON.stringify(seen.find((s) => s.path === "/v1/chat/completions")?.body || {});
  ok(prompt.includes("Tilapia grower") && prompt.includes("600 kg") && prompt.includes("UNKNOWN"), "prompt carries feed type, kg and which protein is unknown");

  // Bangla
  r = await call("POST", "/api/ai/feed-mix", null, { ...mix, lang: "bn" });
  const p2 = JSON.stringify(seen[seen.length - 1]?.body || {});
  ok(r.status === 200 && /Bangla/.test(p2), "Bangla request asks for Bangla text; guests allowed", r.status);

  // high / optimal
  reply = JSON.stringify({ ingredients: [], standard: { minProtein: 20, maxProtein: 26 }, advice: [], confidence: 50 });
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { ...mix, ingredients: [{ name: "Fish meal", kg: 10, protein: 55 }] });
  ok(r.data?.result?.verdict === "high", "55% vs 20-26% -> high", r.data?.result?.verdict);
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { ...mix, ingredients: [{ name: "X", kg: 10, protein: 22 }] });
  ok(r.data?.result?.verdict === "optimal", "22% vs 20-26% -> looks right", r.data?.result?.verdict);

  // unreadable answer
  reply = "Sorry, I can't.";
  r = await call("POST", "/api/ai/feed-mix", farmer.token, mix);
  ok(r.status >= 400 && r.data?.code, "unreadable AI answer -> clean error, no crash", r);

  // bad input
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { feedType: "Tilapia", ingredients: [] });
  ok(r.status === 400, "no ingredients -> 400", r);
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { feedType: "", ingredients: mix.ingredients });
  ok(r.status === 400, "no feed type -> 400", r);
  r = await call("POST", "/api/ai/feed-mix", farmer.token, { ...mix, ingredients: [{ name: "Big", kg: 25000, protein: 30 }] });
  ok(r.status === 200 || r.status >= 400, "25 ton row accepted or refused cleanly", r.status);
} catch (e) {
  await finish(e);
}
gw.close();
await finish();
