"""Web check (throwaway local server, needs ./dist): voice rooms end to end in the browser, English + Bangla, phone widths.

  python3 tests/check-voice-rooms-web.py [shots_dir]

- Connect tab: a Voice rooms card for everyone; "Start a room" only for people the admin allows.
- Start a room -> New room page (name, share-to-feed tick box) -> Let's start! opens the room with mic, hand,
  leave and the chat box; a chat message shows.
- The ticked room shows in the community feed as a card with LIVE and Join; a listener taps it and lands in the room.
- After the room ends, the same feed card shows the ended state (no Join).
- Admin > More > Voice rooms: the who-can-start rule saves and a picked person gets "Start a room" (server says canCreate).
- No page errors and nothing wider than the screen.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6700 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/voice-rooms"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="vr-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="vr-web-secret-0123456789abcdef0123456789abcdef")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/vr-web-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); return
        except Exception:
            time.sleep(1)
    raise SystemExit("server did not start")


def stop():
    try:
        os.killpg(srv.pid, 15)
    except Exception:
        srv.terminate()
    time.sleep(2)


def api(method, path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


def signup(tag):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    email = f"{tag}{s}@check.test"
    r = api("POST", "/api/auth/signup", {"email": email, "password": "Check-pass-123", "name": tag.title(), "username": f"{tag}_{s}"})
    r["email"] = email
    return r


def login(u):
    r = api("POST", "/api/auth/login", {"email": u["email"], "password": "Check-pass-123"})
    u["token"], u["user"] = r["token"], r["user"]


T = {
    "en": {"card": "Voice rooms", "start": "Start a room", "live": "LIVE", "join": "Join", "ended": "This voice room has ended.",
           "title": "Tilapia feeding Q&A", "chat": "Hello from the host"},
    "bn": {"card": "ভয়েস রুম", "start": "নতুন রুম শুরু করুন", "live": "লাইভ", "join": "যোগ দিন", "ended": "এই ভয়েস রুমটি শেষ হয়ে গেছে।",
           "title": "তেলাপিয়া খাবার প্রশ্নোত্তর", "chat": "হোস্টের পক্ষ থেকে শুভেচ্ছা"},
}
results, fails = {}, []


def check(key, cond, label):
    results.setdefault(key, {})[label] = bool(cond)
    if not cond:
        fails.append(f"{key}: {label}")


def init_script(user, lang):
    u = dict(user["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(user["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


async def open_app(b, user, lang, w):
    ctx = await b.new_context(viewport={"width": w, "height": 820}, device_scale_factor=2, permissions=["microphone"])
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script(init_script(user, lang))
    await pg.goto(BASE, wait_until="networkidle")
    await pg.wait_for_function("()=>window.__nav && window.__nav.isReady()", timeout=30000)
    await pg.wait_for_timeout(1500)
    return ctx, pg, errs


async def go(pg, *args):
    await pg.evaluate("(a)=>window.__nav.navigate(...a)", list(args))
    await pg.wait_for_timeout(1500)


async def width(pg):
    return await pg.evaluate("()=>document.documentElement.scrollWidth")


async def main():
    start()
    boss, farmer, bob = signup("boss"), signup("farmer"), signup("bob")
    api("GET", "/api/voice-rooms/permission", token=farmer["token"])  # makes the tables
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), boss["user"]["id"]], check=True)
    start()
    for u in (boss, farmer, bob):
        login(u)

    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        only = os.environ.get("ONLY")
        for lang, w in (("en", 320), ("en", 390), ("bn", 360)):
            key = f"{lang}-{w}"
            if only and only != key:
                continue
            L = T[lang]
            title = f"{L['title']} {w}"

            # Plain farmer: card yes, Start no
            fctx, fpg, ferrs = await open_app(b, farmer, lang, w)
            await go(fpg, "Main", {"screen": "Connect"})
            card = fpg.get_by_test_id("connect-voice-rooms")
            check(key, await card.is_visible(), "Connect shows the Voice rooms card")
            check(key, L["card"] in (await card.inner_text()), "card title")
            check(key, await fpg.get_by_test_id("connect-voice-room-create").count() == 0, "plain farmer has no Start a room")
            check(key, await width(fpg) <= w, "Connect fits the screen (farmer)")

            # Admin host: Start a room -> New room -> Let's start!
            hctx, hpg, herrs = await open_app(b, boss, lang, w)
            await go(hpg, "Main", {"screen": "Connect"})
            start_btn = hpg.get_by_test_id("connect-voice-room-create")
            check(key, await start_btn.is_visible() and L["start"] in (await start_btn.inner_text()), "admin sees Start a room")
            await hpg.screenshot(path=f"{SHOTS}/{key}-1-connect.png")
            await start_btn.click()
            await hpg.wait_for_timeout(1500)
            route = await hpg.evaluate("()=>window.__nav.getCurrentRoute()?.name")
            check(key, route == "VoiceRoomCreate", f"Start a room opens the New room page ({route})")
            await hpg.get_by_test_id("voice-room-title").fill(title)
            share = hpg.get_by_test_id("voice-room-share")
            check(key, (await share.get_attribute("aria-checked")) == "false", "share tick box starts unticked")
            await share.click()
            await hpg.wait_for_timeout(300)
            check(key, (await share.get_attribute("aria-checked")) == "true", "share tick box ticks")
            check(key, await width(hpg) <= w, "New room page fits the screen")
            await hpg.screenshot(path=f"{SHOTS}/{key}-2-new-room.png", full_page=True)
            await hpg.get_by_test_id("voice-room-start").click()
            await hpg.wait_for_timeout(3500)
            route = await hpg.evaluate("()=>window.__nav.getCurrentRoute()?.name")
            check(key, route == "VoiceRoom", f"Let's start! opens the room ({route})")
            for t in ("vr-mic", "vr-leave", "vr-chat-input"):
                check(key, await hpg.get_by_test_id(t).count() > 0, f"room has {t}")
            if await hpg.get_by_test_id("vr-chat-input").count():
                await hpg.get_by_test_id("vr-chat-input").first.fill(L["chat"])
                await hpg.get_by_test_id("vr-chat-send").first.click()
                await hpg.wait_for_timeout(1200)
                check(key, L["chat"] in (await hpg.inner_text("body")), "room chat message shows")
            check(key, await width(hpg) <= w, "room fits the screen")
            await hpg.screenshot(path=f"{SHOTS}/{key}-3-room-host.png")

            rooms = api("GET", "/api/voice-rooms", token=boss["token"])["rooms"]
            room = next((r for r in rooms if r["title"] == title), None)
            check(key, room is not None, "room is live on the server")

            # Listener: feed card -> Join
            await go(fpg, "Main", {"screen": "Community"})
            await fpg.reload(wait_until="networkidle")
            await fpg.wait_for_timeout(2500)
            cards = fpg.get_by_test_id("post-voice-room")
            mine = cards.filter(has_text=title)
            check(key, await mine.count() > 0, "feed shows the room card")
            if await mine.count():
                txt = await mine.first.inner_text()
                check(key, L["live"] in txt and L["join"] in txt, "card shows LIVE and Join")
                check(key, await width(fpg) <= w, "feed fits the screen")
                await fpg.screenshot(path=f"{SHOTS}/{key}-4-feed-live.png")
                await mine.first.click()
                await fpg.wait_for_timeout(3500)
                route = await fpg.evaluate("()=>window.__nav.getCurrentRoute()?.name")
                check(key, route == "VoiceRoom", f"tapping the card joins the room ({route})")
                check(key, await fpg.get_by_test_id("vr-hand").count() > 0, "listener sees Raise hand")
                body = await fpg.inner_text("body")
                check(key, L["chat"] in body, "listener sees the room chat")
                await fpg.screenshot(path=f"{SHOTS}/{key}-5-room-listener.png")

            # End the room -> ended card
            if room:
                api("POST", f"/api/voice-rooms/{room['id']}/end", {}, boss["token"])
            await fpg.wait_for_timeout(1500)
            await go(fpg, "Main", {"screen": "Community"})
            await fpg.reload(wait_until="networkidle")
            await fpg.wait_for_timeout(2500)
            mine = fpg.get_by_test_id("post-voice-room").filter(has_text=title)
            if await mine.count():
                txt = await mine.first.inner_text()
                check(key, L["ended"] in txt and L["join"] not in txt, "ended room shows the ended state, no Join")
                await fpg.screenshot(path=f"{SHOTS}/{key}-6-feed-ended.png")
            else:
                check(key, False, "ended card still in the feed")

            # Admin > More > Voice rooms
            await go(hpg, "AdminApp")
            await hpg.get_by_test_id("admin-tab-more").click()
            await hpg.wait_for_timeout(800)
            await hpg.get_by_test_id("more-voicerooms").click()
            await hpg.wait_for_timeout(1500)
            check(key, await hpg.get_by_test_id("admin-voice-rooms").is_visible(), "admin Voice rooms page opens")
            await hpg.get_by_test_id("vr-who-selected").click()
            await hpg.wait_for_timeout(1200)
            check(key, api("GET", "/api/admin/manage/voice-rooms", token=boss["token"])["who"] == "selected", "rule saves (only people I pick)")
            await hpg.get_by_test_id("vr-host-search").fill(farmer["email"][:12])
            await hpg.wait_for_timeout(2000)
            add = hpg.get_by_test_id(f"vr-add-{farmer['user']['id']}")
            if await add.count():
                await add.click()
                await hpg.wait_for_timeout(1500)
            perm = api("GET", "/api/voice-rooms/permission", token=farmer["token"])
            check(key, perm["canCreate"] is True, "picked farmer can now start rooms")
            check(key, await width(hpg) <= w, "admin page fits the screen")
            await hpg.screenshot(path=f"{SHOTS}/{key}-7-admin.png", full_page=True)
            await go(fpg, "Main", {"screen": "Connect"})
            await fpg.reload(wait_until="networkidle")
            await fpg.wait_for_timeout(2500)
            await go(fpg, "Main", {"screen": "Connect"})
            check(key, await fpg.get_by_test_id("connect-voice-room-create").count() > 0, "picked farmer sees Start a room")
            # reset for the next round
            api("DELETE", f"/api/admin/manage/voice-rooms/hosts/{farmer['user']['id']}", token=boss["token"])
            api("PUT", "/api/admin/manage/voice-rooms", {"who": "experts"}, boss["token"])

            check(key, not ferrs and not herrs, f"no page errors {(ferrs + herrs)[:2]}")
            await fctx.close(); await hctx.close()
        await b.close()


try:
    asyncio.run(main())
finally:
    if srv:
        stop()

for k, v in results.items():
    print(k, "PASS" if all(v.values()) else "FAIL", sum(v.values()), "/", len(v))
for f in fails:
    print("FAIL ", f)
print("\nRESULT:", "PASS" if not fails else f"{len(fails)} failed")
sys.exit(1 if fails else 0)
