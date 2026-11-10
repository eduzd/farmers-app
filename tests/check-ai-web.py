"""Web check for the AI work, on a throwaway local server with a fake Omni route gateway.
  Admin: More > AI settings: add an Omni route key in the slide-up sheet, Test it, pick models, Try it,
         add a voice provider, pick a Bangla voice. English + Bangla, phone + computer, light + dark.
  Farmer app: AI help chat (empty state, suggestion, answer, photo button, call button),
         Disease detector (category chips, buttons, description -> structured result),
         AI call screen (greeting with chosen voice, controls).
  python3 tests/check-ai-web.py   (needs ./dist from `npm run web:export`)
"""
import asyncio, json, threading, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
import sys
sys.path.insert(0, os.path.dirname(__file__))
from webharness import Harness, T

GW_PORT = 8950
GW = f"http://127.0.0.1:{GW_PORT}/v1"
KEY = "sk-omni-webcheck-9876"

class GW_(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _json(self, code, o):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/v1/models": return self._json(200, {"data": [{"id": "gpt-4o-mini"}, {"id": "gpt-4o"}, {"id": "gemini-2.5-flash"}]})
        self._json(404, {})
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); raw = self.rfile.read(n)
        try: body = json.loads(raw)
        except Exception: body = {}
        if self.path == "/v1/chat/completions":
            s = json.dumps(body.get("messages", []), ensure_ascii=False)
            if "JSON" in s and ("disease" in s.lower() or "diagnos" in s.lower()):
                d = {"healthy": False, "subject": "Tilapia", "diseaseName": "White spot (Ich)", "scientificName": "Ichthyophthirius multifiliis", "confidence": 82, "severity": "medium",
                     "summary": "Small white spots on the skin and fins.", "symptoms": ["White spots on body"], "causes": ["Parasite"], "treatment": ["Salt bath 3 g per litre"], "prevention": ["Quarantine new fish"],
                     "otherPossibilities": [{"name": "Lymphocystis", "confidence": 10}], "seeSpecialist": False, "notClear": False}
                return self._json(200, {"choices": [{"message": {"content": json.dumps(d)}}]})
            if "Reply with just: OK" in s: return self._json(200, {"choices": [{"message": {"content": "OK"}}]})
            return self._json(200, {"choices": [{"message": {"content": "**Check the water first.**\n- Add lime 1 kg per decimal\n- Stop feeding for a day\n\nModel: " + str(body.get("model"))}}]})
        if self.path == "/v1/audio/speech":
            b = b"ID3fake"; self.send_response(200); self.send_header("Content-Type", "audio/mpeg"); self.send_header("Content-Length", str(len(b))); self.end_headers(); return self.wfile.write(b)
        if self.path == "/v1/audio/transcriptions": return self._json(200, {"text": "hello"})
        self._json(404, {})

gw = ThreadingHTTPServer(("127.0.0.1", GW_PORT), GW_)
threading.Thread(target=gw.serve_forever, daemon=True).start()

h = Harness("aiweb")
for k in list(h.env.keys()):
    if k.startswith("GOOGLE_API_KEY") or k.startswith("GEMINI_API_KEY"): h.env[k] = ""
h.start()
admin = h.signup("boss", "Admin Rahim"); farmer = h.signup("farmer", "Karim Mia")
h.make_admin(admin)
admin = h.login(admin); farmer = h.login(farmer)
ok = h.ok

async def admin_flow(b, lang, w, dark):
    tag = f"admin {lang} {w}px {'dark' if dark else 'light'}"
    ctx, pg = await h.page(b, admin, lang, w, "/admin", h=860)
    if dark: await pg.evaluate("()=>{localStorage.setItem('admin_theme','dark');localStorage.setItem('themeMode','dark')}"); await pg.reload(); await pg.wait_for_timeout(2500)
    ok(await h.wait_for(pg, "admin-app", 120000), f"{tag}: admin app opens")
    await pg.locator(T("admin-tab-more")).first.click(); await pg.wait_for_timeout(900)
    ok(await h.wait_for(pg, "more-ai"), f"{tag}: More has AI settings row")
    row = await h.text(pg, "more-ai")
    ok(row and (("AI settings" in row) if lang == "en" else ("এআই সেটিং" in row)), f"{tag}: row title in the right language", row)
    await pg.locator(T("more-ai")).first.click(); await pg.wait_for_timeout(1500)
    ok(await h.wait_for(pg, "ai-settings"), f"{tag}: AI settings page opens")
    ok(await h.wait_for(pg, "ai-status-chat") and await h.wait_for(pg, "ai-status-voice"), f"{tag}: status rows for chat, disease, call")
    ok(await h.no_overflow(pg), f"{tag}: no sideways overflow")
    await pg.screenshot(path=f"/tmp/aiweb-admin-{lang}-{w}-{'d' if dark else 'l'}.png", full_page=False)
    await ctx.close()

async def admin_setup(b):
    tag = "admin setup"
    ctx, pg = await h.page(b, admin, "en", 1280, "/admin", h=900)
    await h.wait_for(pg, "admin-app", 120000)
    await pg.locator(T("admin-tab-more")).first.click(); await pg.wait_for_timeout(800)
    await pg.locator(T("more-ai")).first.click(); await pg.wait_for_timeout(1500)
    ok(await h.wait_for(pg, "ai-keys-empty"), f"{tag}: empty keys card")
    await pg.locator(T("ai-key-add")).first.click(); await pg.wait_for_timeout(900)
    ok(await h.wait_for(pg, "ai-key-sheet"), f"{tag}: Add key opens the slide-up sheet")
    ok(await pg.locator(T("ai-key-provider-omniroute")).count() == 1, f"{tag}: Omni route is a service choice")
    await pg.locator(T("ai-key-label")).first.fill("Omni main")
    await pg.locator(T("ai-key-url")).first.fill(GW)
    await pg.locator(T("ai-key-value")).first.fill(KEY)
    await pg.locator(T("ai-key-save")).first.click(); await pg.wait_for_timeout(1800)
    ok(await h.wait_for(pg, "ai-key-0"), f"{tag}: key card appears")
    card = await h.text(pg, "ai-key-0")
    ok(card and "9876" in card and KEY not in card, f"{tag}: card shows only last 4", card)
    await pg.locator(T("ai-key-0-test")).first.click(); await pg.wait_for_timeout(2500)
    card = await h.text(pg, "ai-key-0")
    ok(card and "Connected" in card, f"{tag}: Test shows connected", card)
    # models
    await pg.locator(T("ai-feature-chat-model")).first.fill("gpt-4o-mini")
    await pg.locator(T("ai-feature-disease-model")).first.fill("gpt-4o")
    await pg.locator(T("ai-feature-voice-model")).first.fill("gemini-2.5-flash")
    await pg.wait_for_timeout(300)
    ok(await pg.locator(T("ai-models-save")).count() == 1, f"{tag}: Save models shows after a change")
    await pg.locator(T("ai-models-save")).first.click(); await pg.wait_for_timeout(1800)
    st = await h.text(pg, "ai-status-chat")
    ok(st and "Ready" in st, f"{tag}: chat status turns Ready", st)
    await pg.locator(T("ai-feature-chat-try")).first.click(); await pg.wait_for_timeout(2500)
    out = await h.text(pg, "ai-feature-chat-out")
    ok(out and "gpt-4o-mini" in out, f"{tag}: Try it shows the model's answer", out)
    # voice provider
    await pg.locator(T("ai-voice-add")).first.click(); await pg.wait_for_timeout(900)
    ok(await h.wait_for(pg, "ai-vprov-sheet"), f"{tag}: Add voice provider sheet")
    for c in ["openai", "elevenlabs", "gemini", "compatible"]:
        ok(await pg.locator(T(f"ai-vprov-company-{c}")).count() == 1, f"{tag}: voice company {c} offered")
    await pg.locator(T("ai-vprov-company-compatible")).first.click(); await pg.wait_for_timeout(300)
    await pg.locator(T("ai-vprov-url")).first.fill(GW)
    await pg.locator(T("ai-vprov-key")).first.fill(KEY)
    await pg.locator(T("ai-vprov-save")).first.click(); await pg.wait_for_timeout(2500)
    ok(await h.wait_for(pg, "ai-vprov-0"), f"{tag}: voice provider card appears")
    ok(await h.wait_for(pg, "ai-voice-pick"), f"{tag}: voice picker shows")
    ok(await h.wait_for(pg, "ai-voice-nova"), f"{tag}: voices listed")
    await pg.locator(T("ai-voice-nova")).first.click(); await pg.wait_for_timeout(400)
    await pg.locator(T("ai-voice-save")).first.click(); await pg.wait_for_timeout(1800)
    st = await h.text(pg, "ai-status-voice")
    ok(st and "Nova" in st, f"{tag}: call status names the Bangla voice", st)
    await pg.screenshot(path="/tmp/aiweb-admin-setup.png", full_page=True)
    await ctx.close()

async def farmer_flow(b, lang, w, dark):
    tag = f"farmer {lang} {w}px {'dark' if dark else 'light'}"
    ctx, pg = await h.page(b, farmer, lang, w, "/", h=860)
    if dark: await pg.evaluate("()=>localStorage.setItem('themeMode','dark')"); await pg.reload(); await pg.wait_for_timeout(3000)
    ok(await h.wait_for(pg, "quick-ai", 60000), f"{tag}: Home has AI help")
    await pg.locator(T("quick-ai")).first.click(); await pg.wait_for_timeout(1800)
    ok(await h.wait_for(pg, "ai-input"), f"{tag}: AI chat opens")
    ok(await pg.locator(T("ai-suggestion-0")).count() == 1, f"{tag}: suggestions show")
    ok(await pg.locator(T("ai-not-ready")).count() == 0, f"{tag}: no 'not set up' warning once admin set it up")
    ok(await pg.locator(T("ai-call-button")).count() >= 1 and await pg.locator(T("ai-attach")).count() == 1, f"{tag}: call and photo buttons")
    await pg.locator(T("ai-input")).first.fill("My pond is green" if lang == "en" else "পুকুরের পানি সবুজ")
    await pg.locator(T("ai-send")).first.click()
    ok(await h.wait_for(pg, "ai-reply", 20000), f"{tag}: AI answers")
    rep = await h.text(pg, "ai-reply")
    ok(rep and "Check the water first." in rep and "**" not in rep and "gpt-4o-mini" in rep, f"{tag}: answer formatted, from the chosen model", rep)
    ok(await h.no_overflow(pg), f"{tag}: chat has no sideways overflow")
    await pg.screenshot(path=f"/tmp/aiweb-chat-{lang}-{w}-{'d' if dark else 'l'}.png")
    # disease
    await pg.go_back(); await pg.wait_for_timeout(1500)
    await pg.locator(T("quick-disease")).first.click(); await pg.wait_for_timeout(1800)
    ok(await h.wait_for(pg, "disease-screen"), f"{tag}: disease detector opens")
    ok(all([await pg.locator(T(f"disease-cat-{c}")).count() == 1 for c in ["fish", "crop", "poultry", "livestock"]]), f"{tag}: four categories")
    ok(await pg.locator(T("disease-camera")).count() == 1 and await pg.locator(T("disease-gallery")).count() == 1, f"{tag}: camera and gallery buttons")
    await pg.locator(T("disease-desc")).first.fill("White spots on the body, fish rubbing on the side")
    await pg.locator(T("disease-analyze")).first.click()
    ok(await h.wait_for(pg, "disease-result", 20000), f"{tag}: diagnosis shows")
    nm = await h.text(pg, "disease-name")
    ok(nm == "White spot (Ich)", f"{tag}: disease name", nm)
    res = await h.text(pg, "disease-result")
    ok(res and "82%" in res and "Salt bath" in res, f"{tag}: confidence and treatment", (res or "")[:200])
    ok(await h.no_overflow(pg), f"{tag}: disease page has no sideways overflow")
    await pg.screenshot(path=f"/tmp/aiweb-disease-{lang}-{w}-{'d' if dark else 'l'}.png", full_page=True)
    await ctx.close()

async def call_flow(b, lang, w):
    tag = f"call {lang} {w}px"
    ctx, pg = await h.page(b, farmer, lang, w, "/", h=860)
    await h.wait_for(pg, "quick-ai", 60000)
    await pg.locator(T("quick-ai")).first.click(); await pg.wait_for_timeout(1500)
    await pg.locator(T("ai-call-button")).first.click(); await pg.wait_for_timeout(2500)
    ok(await h.wait_for(pg, "ai-call-screen"), f"{tag}: AI call opens")
    ok(await h.wait_for(pg, "ai-call-reply", 15000), f"{tag}: greeting shows")
    rep = await h.text(pg, "ai-call-reply")
    ok(rep and (("Krishi AI" in rep) if lang == "en" else ("কৃষি এআই" in rep)), f"{tag}: greeting in the right language", rep)
    ok(all([await pg.locator(T(t)).count() == 1 for t in ["ai-call-mic", "ai-call-end", "ai-call-mute", "ai-call-timer"]]), f"{tag}: mic, end, speaker and timer")
    await pg.screenshot(path=f"/tmp/aiweb-call-{lang}-{w}.png")
    await pg.locator(T("ai-call-end")).first.click(); await pg.wait_for_timeout(1200)
    ok(await pg.locator(T("ai-call-screen")).count() == 0, f"{tag}: End closes the call")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        await admin_setup(b)
        for lang in ["en", "bn"]:
            for w in [390, 1280]:
                await admin_flow(b, lang, w, dark=(w == 390 and lang == "bn"))
                await farmer_flow(b, lang, w, dark=(w == 1280 and lang == "bn"))
        await call_flow(b, "bn", 390)
        await call_flow(b, "en", 1280)
        await b.close()

asyncio.run(main())
gw.shutdown()
h.done()
