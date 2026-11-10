"""Web check (throwaway local server, needs ./dist): the Voice rooms card is the first card of the Connect ad carousel.

  python3 tests/check-connect-voice-card-web.py [shots_dir]

- Farmer and admin see Voice rooms as the first card of the ad carousel: same size, row and rounded shape as the ad cards.
- The carousel still moves on its own. The card has an Open button and no create / Start a room button.
- Tapping it opens the Voice rooms list; with a room live it says "1 live now" and the farmer joins from the list.
- The mic icon next to the filter is still the only way to start a room. English + Bangla, light + dark, phone and computer.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/connect-voice-card"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="cvc-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="cvc-web-secret-0123456789abcdef0123456789abcdef")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/cvc-web-server.log", "a"),
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


results, fails = {}, []


def check(key, cond, label):
    results.setdefault(key, {})[label] = bool(cond)
    if not cond:
        fails.append(f"{key}: {label}")


def init_script(user, lang):
    u = dict(user["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(user["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


async def open_app(b, user, lang, w, scheme="light"):
    ctx = await b.new_context(viewport={"width": w, "height": 820}, device_scale_factor=2, permissions=["microphone"], color_scheme=scheme)
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
    await pg.wait_for_timeout(2000)


async def width(pg):
    return await pg.evaluate("()=>document.documentElement.scrollWidth")


async def route(pg):
    return await pg.evaluate("()=>window.__nav.getCurrentRoute()?.name")


async def header_title(pg):
    return await pg.evaluate("""()=>{
      const hs=[...document.querySelectorAll('[role=heading]')].filter(e=>e.offsetParent!==null);
      return hs.length? hs[hs.length-1].innerText : '';
    }""")


async def visible(loc):
    n = await loc.count()
    for i in range(n):
        if await loc.nth(i).is_visible():
            return loc.nth(i)
    return None


VC = "connect-carousel-card-voice-rooms"


async def boxes(pg):
    return await pg.evaluate("""()=>[...document.querySelectorAll('[data-testid^="connect-carousel-card-"]')].map(e=>{const r=e.getBoundingClientRect();const g=e.firstElementChild?getComputedStyle(e.firstElementChild):null;return {id:e.dataset.testid,x:r.x,y:r.y,w:r.width,h:r.height,rad:g?g.borderTopLeftRadius:''}})""")


async def show_voice(pg):
    await pg.evaluate(f"()=>document.querySelector('[data-testid=\"{VC}\"]')?.scrollIntoView({{inline:'start',block:'nearest'}})")
    await pg.wait_for_timeout(400)


async def connect_checks(key, pg, w, who, lang):
    bs = await boxes(pg)
    ids = [b["id"] for b in bs]
    check(key, ids[:1] == [VC], f"Voice rooms is the first card of the carousel ({who}): {ids[:3]}")
    check(key, len(ids) >= 2, f"ad cards still follow it ({who}, {len(ids)} cards)")
    check(key, await pg.locator('[data-testid="connect-top-row"]').count() == 0 and await pg.get_by_test_id("connect-voice-rooms").count() == 0, f"no separate side tile any more ({who})")
    if len(bs) >= 2:
        v, o = bs[0], bs[1]
        check(key, abs(v["w"] - o["w"]) <= 1 and abs(v["h"] - o["h"]) <= 1, f"Voice rooms card is the same size as the ad cards ({who}, {v['w']:.0f}x{v['h']:.0f} vs {o['w']:.0f}x{o['h']:.0f})")
        check(key, abs(v["y"] - o["y"]) <= 1 and v["rad"] == o["rad"], f"same row and same rounded shape ({who}, {v['rad']})")
    card = pg.get_by_test_id(VC)
    if await card.count():
        txt = (await card.inner_text()).strip()
        check(key, ("ভয়েস রুম" if lang == "bn" else "Voice rooms") in txt and ("খুলুন" if lang == "bn" else "Open") in txt, f"card says Voice rooms with an Open button ({who}): {txt!r}")
        bad = ["start", "new room", "create", "শুরু", "নতুন রুম", "তৈরি"]
        check(key, not any(x in txt.lower() for x in bad), f"card has no create / start text ({who})")
    check(key, await width(pg) <= w, f"Connect fits the screen ({who})")


async def moves(key, pg):
    # the carousel moves on its own: after a while the first card is no longer the one in view
    await show_voice(pg)
    x0 = await pg.evaluate(f"()=>document.querySelector('[data-testid=\"{VC}\"]').getBoundingClientRect().x")
    await pg.wait_for_timeout(10500)
    x1 = await pg.evaluate(f"()=>document.querySelector('[data-testid=\"{VC}\"]').getBoundingClientRect().x")
    check(key, x1 < x0 - 50, f"carousel moves on its own past the Voice rooms card ({x0:.0f} -> {x1:.0f})")


async def main():
    start()
    boss, farmer = signup("boss"), signup("farmer")
    api("GET", "/api/voice-rooms/permission", token=farmer["token"])  # makes the tables
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), boss["user"]["id"]], check=True)
    start()
    for u in (boss, farmer):
        login(u)

    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        only = os.environ.get("ONLY")
        for scheme in ("light", "dark"):
            for lang, w in (("en", 320), ("en", 390), ("bn", 360), ("bn", 412), ("en", 1280), ("bn", 1280)):
                key = f"{scheme}-{lang}-{w}"
                if only and only != key:
                    continue
                mic_sel = '[data-testid="connect-voice-room-create-icon"]'
                fctx, fpg, ferrs = await open_app(b, farmer, lang, w, scheme)
                await go(fpg, "Main", {"screen": "Connect"})
                await fpg.wait_for_timeout(1000)
                await connect_checks(key, fpg, w, "farmer", lang)
                check(key, await visible(fpg.locator(mic_sel)) is None, "plain farmer has no mic icon")
                if w in (390, 1280):
                    await moves(key, fpg)
                await fpg.screenshot(path=f"{SHOTS}/{key}-1-farmer-connect.png")

                hctx, hpg, herrs = await open_app(b, boss, lang, w, scheme)
                await go(hpg, "Main", {"screen": "Connect"})
                await hpg.wait_for_timeout(1000)
                await connect_checks(key, hpg, w, "admin", lang)
                mic = await visible(hpg.locator(mic_sel))
                check(key, mic is not None, "admin still sees the mic icon")
                room = None
                if mic:
                    await mic.click()
                    await hpg.wait_for_timeout(1500)
                    check(key, await route(hpg) == "VoiceRoomCreate", "mic icon still opens New room")
                    title = f"Tile check {key}"
                    await hpg.get_by_test_id("voice-room-title").fill(title)
                    await hpg.get_by_test_id("voice-room-start").click()
                    await hpg.wait_for_timeout(3500)
                    rooms = api("GET", "/api/voice-rooms", token=boss["token"])["rooms"]
                    room = next((x for x in rooms if x["title"] == title), None)
                    check(key, room is not None, "room started from the mic icon is live")

                # farmer comes back to Connect: tile shows the live count, tap -> list -> join
                await go(fpg, "Main", {"screen": "Community"})
                await go(fpg, "Main", {"screen": "Connect"})
                await fpg.wait_for_timeout(1500)
                live_txt = "এখন ১টি লাইভ" if lang == "bn" else "1 live now"
                await show_voice(fpg)
                vt = (await fpg.get_by_test_id(VC).inner_text()) if await fpg.get_by_test_id(VC).count() else ""
                check(key, live_txt in vt, f"card says {live_txt!r} with one room live: {vt!r}")
                await fpg.screenshot(path=f"{SHOTS}/{key}-2-farmer-connect-live.png")
                await show_voice(fpg)
                tile = await visible(fpg.get_by_test_id(VC))
                check(key, tile is not None, "Voice rooms card is in view to tap")
                if tile:
                    await tile.click()
                    await fpg.wait_for_timeout(2500)
                    check(key, await route(fpg) == "VoiceRooms", "tapping the card opens the Voice rooms list")
                    check(key, await fpg.get_by_text("New room", exact=True).count() == 0 and await fpg.get_by_text("নতুন রুম", exact=True).count() == 0, "Voice rooms list still has no New room button")
                    await fpg.screenshot(path=f"{SHOTS}/{key}-3-voice-rooms-list.png")
                    if room:
                        item = await visible(fpg.get_by_test_id(f"voice-room-{room['id']}"))
                        check(key, item is not None, "the live room is in the list")
                        if item:
                            await item.click()
                            await fpg.wait_for_timeout(3500)
                            check(key, await route(fpg) == "VoiceRoom", "farmer joins the live room")
                if room:
                    api("POST", f"/api/voice-rooms/{room['id']}/end", {}, boss["token"])
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
total = sum(len(v) for v in results.values()); passed = sum(sum(v.values()) for v in results.values())
print(f"\n{passed}/{total} checks passed")
print("RESULT:", "PASS" if not fails else f"{len(fails)} failed")
sys.exit(1 if fails else 0)
