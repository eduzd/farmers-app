"""Web check (throwaway local server, needs ./dist): the Voice rooms card is gone from Connect.

  python3 tests/check-connect-no-voice-card-web.py [shots_dir]

- Connect has no Voice rooms card (farmer and admin), and the search box sits right under the ad carousel
  with the normal gap, no hole where the card was.
- The mic icon next to the filter is still there for an admin and still opens New room; a room started from it goes live.
- Live rooms can still be found and joined: Home > Services > the Voice rooms tile opens the Voice rooms page,
  the live room is listed and a farmer can join it.
- English + Bangla, light + dark, phone and computer widths. No page errors, nothing wider than the screen.

- A plain farmer (not allowed to start rooms) sees the filter icon and no voice room icon.
- Someone allowed (admin, then a farmer the admin picks) sees a mic icon just left of the filter, same row, same size.
- The old "Start a room" button under the Voice rooms card is gone (card stays and still opens Voice rooms),
  and the Voice rooms page has no "New room" button either.
- Tapping the icon opens the New room page.
- From there the room starts like before (Let's start! -> the room).
- The filter icon still opens the filter sheet. English + Bangla, phone widths and a computer width.
- No page errors and nothing wider than the screen.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/connect-no-voice-card"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="cnv-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="cnv-web-secret-0123456789abcdef0123456789abcdef")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/cnv-web-server.log", "a"),
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
        n = 0
        for scheme in ("light", "dark"):
            for lang, w in (("en", 320), ("en", 390), ("bn", 360), ("en", 1280), ("bn", 1280)):
                key = f"{scheme}-{lang}-{w}"
                if only and only != key:
                    continue
                n += 1
                mic_sel = '[data-testid="connect-voice-room-create-icon"]'

                # Farmer: no card, search right under the carousel
                fctx, fpg, ferrs = await open_app(b, farmer, lang, w, scheme)
                await go(fpg, "Main", {"screen": "Connect"})
                await fpg.wait_for_timeout(1000)
                check(key, await fpg.get_by_test_id("connect-voice-rooms").count() == 0, "no Voice rooms card on Connect (farmer)")
                check(key, await fpg.get_by_test_id("connect-voice-rooms-open").count() == 0, "nothing on Connect opens Voice rooms (card gone)")
                check(key, await visible(fpg.locator(mic_sel)) is None, "plain farmer still has no mic icon")
                car = await visible(fpg.get_by_test_id("connect-carousel"))
                srch = await visible(fpg.get_by_test_id("connect-search"))
                check(key, car is not None and srch is not None, "carousel and search are on Connect")
                if car and srch:
                    cb = await car.bounding_box()
                    sb = await srch.evaluate("(e)=>{let p=e; for(let i=0;i<3&&p.parentElement;i++){p=p.parentElement; const s=getComputedStyle(p); if(s.borderTopWidth!=='0px') break;} const r=p.getBoundingClientRect(); return {y:r.y}}")
                    gap = sb["y"] - (cb["y"] + cb["height"])
                    check(key, -1 <= gap <= 24, f"search sits right under the carousel, no empty gap ({gap:.0f}px)")
                check(key, await width(fpg) <= w, "Connect fits the screen (farmer)")
                await fpg.screenshot(path=f"{SHOTS}/{key}-1-farmer-connect.png")

                # Admin: mic icon still there, no card
                hctx, hpg, herrs = await open_app(b, boss, lang, w, scheme)
                await go(hpg, "Main", {"screen": "Connect"})
                await hpg.wait_for_timeout(1000)
                check(key, await hpg.get_by_test_id("connect-voice-rooms").count() == 0, "no Voice rooms card on Connect (admin)")
                mic = await visible(hpg.locator(mic_sel))
                check(key, mic is not None, "admin still sees the mic icon")
                check(key, await width(hpg) <= w, "Connect fits the screen (admin)")
                await hpg.screenshot(path=f"{SHOTS}/{key}-2-admin-connect.png")
                room = None
                if mic:
                    await mic.click()
                    await hpg.wait_for_timeout(1500)
                    check(key, await route(hpg) == "VoiceRoomCreate", "mic icon still opens New room")
                    if w in (390, 1280) and lang == "en" or (lang == "bn" and w == 360):
                        title = f"Join check {key}"
                        await hpg.get_by_test_id("voice-room-title").fill(title)
                        await hpg.get_by_test_id("voice-room-start").click()
                        await hpg.wait_for_timeout(3500)
                        check(key, await route(hpg) == "VoiceRoom", "Let's start! opens the room")
                        rooms = api("GET", "/api/voice-rooms", token=boss["token"])["rooms"]
                        room = next((x for x in rooms if x["title"] == title), None)
                        check(key, room is not None, "room is live on the server")

                # Farmer: Home > Services > Voice rooms tile -> list -> join
                await go(fpg, "Main", {"screen": "Community"})
                svc = await visible(fpg.get_by_role("button", name="সেবা" if lang == "bn" else "Services", exact=True))
                check(key, svc is not None, "Home has the Services shortcut")
                if svc:
                    await svc.click()
                    await fpg.wait_for_timeout(1500)
                    check(key, await route(fpg) == "Services", "Services shortcut opens Services")
                    tile = await visible(fpg.get_by_text("\u09ad\u09af\u09bc\u09c7\u09b8 \u09b0\u09c1\u09ae", exact=True))
                    check(key, tile is not None, "Services has the Voice rooms tile")
                    if tile:
                        await tile.click()
                        await fpg.wait_for_timeout(2500)
                        check(key, await route(fpg) == "VoiceRooms", "Voice rooms tile opens the Voice rooms page")
                        check(key, await width(fpg) <= w, "Voice rooms page fits the screen")
                        await fpg.screenshot(path=f"{SHOTS}/{key}-3-farmer-voice-rooms.png")
                        if room:
                            item = await visible(fpg.get_by_test_id(f"voice-room-{room['id']}"))
                            check(key, item is not None, "the live room is listed")
                            if item:
                                await item.click()
                                await fpg.wait_for_timeout(3500)
                                check(key, await route(fpg) == "VoiceRoom", "farmer joins the live room from the list")
                                await fpg.screenshot(path=f"{SHOTS}/{key}-4-farmer-in-room.png")
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
