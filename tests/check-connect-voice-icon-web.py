"""Web check (throwaway local server, needs ./dist): the voice room icon next to the filter on Connect.

  python3 tests/check-connect-voice-icon-web.py [shots_dir]

- A plain farmer (not allowed to start rooms) sees the filter icon and no voice room icon.
- Someone allowed (admin, then a farmer the admin picks) sees a mic icon just left of the filter, same row, same size.
- The Voice rooms card is gone from Connect (its "Start a room" button went first), and the Voice rooms page
  has no "New room" button either. The Voice rooms page is reached from Home > Services now.
- Tapping the icon opens the New room page.
- From there the room starts like before (Let's start! -> the room).
- The filter icon still opens the filter sheet. English + Bangla, phone widths and a computer width.
- No page errors and nothing wider than the screen.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/connect-voice-icon"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="cvi-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="cvi-web-secret-0123456789abcdef0123456789abcdef")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/cvi-web-server.log", "a"),
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
        for lang, w in (("en", 320), ("en", 390), ("bn", 360), ("en", 1280), ("bn", 1280)):
            key = f"{lang}-{w}"
            if only and only != key:
                continue
            mic_sel = '[data-testid="connect-voice-room-create-icon"]'
            fil_sel = '[data-testid="connect-filter-button"]'

            # Plain farmer: filter yes, voice room icon no
            fctx, fpg, ferrs = await open_app(b, farmer, lang, w)
            await go(fpg, "Main", {"screen": "Connect"})
            check(key, await visible(fpg.locator(fil_sel)) is not None, "farmer sees the filter icon")
            check(key, await visible(fpg.locator(mic_sel)) is None, "plain farmer has no voice room icon")
            check(key, await width(fpg) <= w, "Connect fits the screen (farmer)")
            check(key, await fpg.get_by_test_id("connect-voice-rooms").count() == 1, "Voice rooms tile is on Connect (farmer)")
            check(key, await fpg.get_by_test_id("connect-voice-room-create").count() == 0, "no Start a room under the card (farmer)")
            await fpg.screenshot(path=f"{SHOTS}/{key}-1-farmer-connect.png")

            # Admin: icon next to the filter
            hctx, hpg, herrs = await open_app(b, boss, lang, w)
            await go(hpg, "Main", {"screen": "Connect"})
            mic = await visible(hpg.locator(mic_sel))
            fil = await visible(hpg.locator(fil_sel))
            check(key, mic is not None, "admin sees the voice room icon")
            check(key, fil is not None, "admin sees the filter icon")
            if mic and fil:
                mb, fb = await mic.bounding_box(), await fil.bounding_box()
                check(key, abs((mb["y"] + mb["height"] / 2) - (fb["y"] + fb["height"] / 2)) < 2, "icon is on the same row as the filter")
                gap = fb["x"] - (mb["x"] + mb["width"])
                check(key, 0 < gap <= 16, f"icon sits just left of the filter (gap {gap:.0f}px)")
                check(key, abs(mb["width"] - fb["width"]) < 1 and abs(mb["height"] - fb["height"]) < 1, "same size as the filter icon")
                check(key, fb["x"] + fb["width"] <= w, "icons stay inside the screen")
                # does not overlap the page title
                tb = await hpg.evaluate("""()=>{
                  const hs=[...document.querySelectorAll('[role=heading]')].filter(e=>e.offsetParent!==null);
                  if(!hs.length) return null; const r=hs[hs.length-1].getBoundingClientRect(); return {x:r.x,w:r.width};
                }""")
                check(key, tb is None or tb["x"] + tb["w"] <= mb["x"] + 1, "icon does not cover the page title")
            check(key, await width(hpg) <= w, "Connect fits the screen (admin)")
            await hpg.screenshot(path=f"{SHOTS}/{key}-2-admin-connect.png")

            # The Voice rooms card (and its old "Start a room" button) is gone from Connect
            check(key, await hpg.get_by_test_id("connect-voice-rooms").count() == 1, "Voice rooms tile is on Connect (admin)")
            check(key, await hpg.get_by_test_id("connect-voice-room-create").count() == 0, "no Start a room button on Connect (admin)")
            await go(hpg, "VoiceRooms")
            check(key, await route(hpg) == "VoiceRooms", "Voice rooms page still opens")
            await hpg.wait_for_timeout(1000)
            check(key, await hpg.get_by_test_id("voice-room-new").count() == 0, "no New room button inside the Voice rooms page (admin)")
            check(key, await width(hpg) <= w, "Voice rooms page fits the screen")
            await hpg.screenshot(path=f"{SHOTS}/{key}-2c-admin-voice-rooms-page.png")
            await hpg.evaluate("()=>window.__nav.goBack()")
            await hpg.wait_for_timeout(1500)
            ref_route, ref_title = "VoiceRoomCreate", ("\u09a8\u09a4\u09c1\u09a8 \u09b0\u09c1\u09ae" if lang == "bn" else "New room")
            mic = await visible(hpg.locator(mic_sel))

            # New icon -> same page
            if mic:
                await mic.click()
                await hpg.wait_for_timeout(1500)
                r = await route(hpg)
                t = await header_title(hpg)
                check(key, r == "VoiceRoomCreate" and r == ref_route, f"icon opens the New room page ({r}, card: {ref_route})")
                check(key, bool(t), f"New room page has its title ({t!r})")
                check(key, await hpg.get_by_test_id("voice-room-title").count() > 0, "New room form is there")
                await hpg.screenshot(path=f"{SHOTS}/{key}-3-new-room-from-icon.png")
                if w == 390:
                    await hpg.get_by_test_id("voice-room-title").fill("Icon room check")
                    await hpg.get_by_test_id("voice-room-start").click()
                    await hpg.wait_for_timeout(3500)
                    check(key, await route(hpg) == "VoiceRoom", "Let's start! opens the room from the icon flow")
                    rooms = api("GET", "/api/voice-rooms", token=boss["token"])["rooms"]
                    room = next((x for x in rooms if x["title"] == "Icon room check"), None)
                    check(key, room is not None, "room is live on the server")
                    if room:
                        api("POST", f"/api/voice-rooms/{room['id']}/end", {}, boss["token"])

            # Filter still works
            await go(hpg, "Main", {"screen": "Connect"})
            fil = await visible(hpg.locator(fil_sel))
            if fil:
                await fil.locator('[role=button]').first.click()
                await hpg.wait_for_timeout(800)
                check(key, await visible(hpg.get_by_test_id("connect-filter-sheet")) is not None, "filter icon still opens the filter sheet")
                done = await visible(hpg.get_by_test_id("connect-filter-done"))
                if done:
                    await done.click()

            # Admin picks the farmer -> farmer gets the icon
            api("PUT", "/api/admin/manage/voice-rooms", {"who": "selected"}, boss["token"])
            api("PUT", f"/api/admin/manage/voice-rooms/hosts/{farmer['user']['id']}", {}, boss["token"])
            check(key, api("GET", "/api/voice-rooms/permission", token=farmer["token"])["canCreate"] is True, "picked farmer allowed by server")
            await go(fpg, "Main", {"screen": "Community"})
            await go(fpg, "Main", {"screen": "Connect"})
            fm = await visible(fpg.locator(mic_sel))
            check(key, fm is not None, "picked farmer sees the voice room icon")
            check(key, await fpg.get_by_test_id("connect-voice-room-create").count() == 0, "picked farmer has no Start a room under the card")
            if fm:
                await fm.click()
                await fpg.wait_for_timeout(1500)
                check(key, await route(fpg) == "VoiceRoomCreate", "picked farmer's icon opens New room")
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
