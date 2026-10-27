"""Web check (throwaway local server, needs ./dist): the Voice rooms tile sits next to the ad carousel on Connect.

  python3 tests/check-connect-voice-tile-web.py [shots_dir]

- Farmer and admin see a small Voice rooms tile beside the ad card: same top, same height as the ad card, no overlap, on screen.
- The tile has no create / Start a room button; the mic icon next to the filter stays the only way to start a room.
- Tapping the tile opens the Voice rooms list; with a room live, the tile says "1 live" and the farmer joins it from the list.
- Search sits right under the ad row, no gap. English + Bangla, light + dark, phone and computer widths. No page errors.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/connect-voice-tile"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="cvt-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="cvt-web-secret-0123456789abcdef0123456789abcdef")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/cvt-web-server.log", "a"),
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


async def card_box(pg):
    return await pg.evaluate("""()=>{
      const c=[...document.querySelectorAll('[data-testid^="connect-carousel-card-"]')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.x>=-1&&r.x<window.innerWidth-5);
      if(!c.length) return null; const r=c[0]; return {x:r.x,y:r.y,w:r.width,h:r.height};
    }""")


async def connect_checks(key, pg, w, who, lang):
    tile = await visible(pg.get_by_test_id("connect-voice-rooms"))
    check(key, tile is not None, f"Voice rooms tile is on Connect ({who})")
    cb = await card_box(pg)
    check(key, cb is not None, f"ad card is on Connect ({who})")
    if tile and cb:
        tb = await tile.bounding_box()
        check(key, abs(tb["y"] - cb["y"]) <= 2, f"tile top lines up with the ad card ({who}, {tb['y']:.0f} vs {cb['y']:.0f})")
        check(key, abs(tb["height"] - cb["h"]) <= 2, f"tile is the ad card's height ({who}, {tb['height']:.0f} vs {cb['h']:.0f})")
        check(key, tb["x"] >= cb["x"] + cb["w"] + 4, f"tile is right of the ad card with a gap, no overlap ({who})")
        check(key, tb["x"] + tb["width"] <= w, f"tile is inside the screen ({who})")
        check(key, 90 <= tb["width"] <= 180, f"tile is small ({who}, {tb['width']:.0f}px)")
        txt = (await tile.inner_text()).strip()
        check(key, ("ভয়েস রুম" if lang == "bn" else "Voice rooms") in txt, f"tile says Voice rooms ({who}): {txt!r}")
        bad = ["start", "new room", "create", "শুরু", "নতুন রুম", "তৈরি"]
        check(key, not any(x in txt.lower() for x in bad), f"tile has no create / start button text ({who})")
        inner = await tile.evaluate("(e)=>e.querySelectorAll('[role=button],button,a').length")
        check(key, inner == 0, f"tile has no buttons inside it ({who})")
        over = await tile.evaluate("(e)=>[...e.querySelectorAll('*')].filter(c=>{const r=c.getBoundingClientRect(),p=e.getBoundingClientRect();return r.width>0&&(r.right>p.right+1||r.bottom>p.bottom+1)}).length")
        check(key, over == 0, f"nothing spills out of the tile ({who})")
        cta = await pg.evaluate("""()=>{const out=[];document.querySelectorAll('[data-testid^="connect-carousel-card-"]').forEach(c=>{const p=c.getBoundingClientRect();if(p.x<-1||p.x>window.innerWidth-5)return;c.querySelectorAll('*').forEach(k=>{if(k.children.length||!(k.innerText||'').trim())return;const r=k.getBoundingClientRect();if(r.width>0&&(r.right>p.right+1||r.x<p.x-1))out.push(k.innerText)})});return out.length}""")
        check(key, cta == 0, f"ad card content stays inside the narrower ad card ({who})")
    srch = await visible(pg.get_by_test_id("connect-search"))
    row = await visible(pg.get_by_test_id("connect-top-row"))
    if srch and row:
        rb = await row.bounding_box()
        sb = await srch.evaluate("(e)=>{let p=e; for(let i=0;i<3&&p.parentElement;i++){p=p.parentElement; const s=getComputedStyle(p); if(s.borderTopWidth!=='0px') break;} const r=p.getBoundingClientRect(); return {y:r.y}}")
        gap = sb["y"] - (rb["y"] + rb["height"])
        check(key, -1 <= gap <= 24, f"search sits right under the ad row ({who}, {gap:.0f}px)")
    check(key, await width(pg) <= w, f"Connect fits the screen ({who})")
    return tile


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
                none_txt = "এখন লাইভ নেই" if lang == "bn" else "None live"
                st = await visible(fpg.get_by_test_id("connect-voice-rooms-status"))
                check(key, st is not None and (await st.inner_text()).strip() == none_txt, f"tile says {none_txt} with no rooms")
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
                live_txt = "১টি লাইভ" if lang == "bn" else "1 live"
                st = await visible(fpg.get_by_test_id("connect-voice-rooms-status"))
                check(key, st is not None and (await st.inner_text()).strip() == live_txt, f"tile says {live_txt} with one room live")
                check(key, await visible(fpg.get_by_test_id("connect-voice-rooms-live-dot")) is not None, "red live dot shows")
                await fpg.screenshot(path=f"{SHOTS}/{key}-2-farmer-connect-live.png")
                tile = await visible(fpg.get_by_test_id("connect-voice-rooms"))
                if tile:
                    await tile.click()
                    await fpg.wait_for_timeout(2500)
                    check(key, await route(fpg) == "VoiceRooms", "tapping the tile opens the Voice rooms list")
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
