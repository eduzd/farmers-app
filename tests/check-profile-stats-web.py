"""Web check (throwaway local server, needs ./dist): real profile numbers on screen.

Throwaway accounts only. Asha has 2 followers, follows 1 person, and has 2 reviews (4 and 5 stars).
Dina is brand new. At 320/360/390 in English and Bangla:
- Asha's own Profile shows 2 / 1 / 4.5 ★ "Rating (2)", never 156 / 89 / 4.9.
- Dina's own Profile shows 0 / 0 / "No ratings yet".
- With /api/follows and /rating failing, the boxes show — and a retry row; tapping retry (server back) loads the numbers.
- Bilal opening Asha's profile sees 2 followers and a "Following" button (ফলোয়িং in Bangla);
  Dina sees "Follow" (ফলো করুন). A failed load there shows — with retry, not 0.
  python3 tests/check-profile-stats-web.py [shots_dir]
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6400 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/profile-stats"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="profile-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="profile-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/profile-web-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)
fails = []


def check(cond, label):
    print(("PASS  " if cond else "FAIL  ") + label)
    if not cond:
        fails.append(label)


def api(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def signup(tag, name):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    st, j = api("POST", "/api/auth/signup", {"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
    assert j and j.get("token"), (st, j)
    return {"token": j["token"], "user": j["user"], "id": str(j["user"]["id"])}


def init_script(acc, lang):
    u = dict(acc["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


async def text(pg, tid):
    loc = pg.locator(f'[data-testid="{tid}"]')
    return (await loc.first.inner_text()).strip() if await loc.count() else None


async def page(b, acc, lang, w, fail_stats=False):
    ctx = await b.new_context(viewport={"width": w, "height": 800})
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    if fail_stats:
        async def boom(route):
            await route.fulfill(status=500, content_type="application/json", body='{"error":"Something went wrong"}')
        await pg.route("**/api/follows/*", boom)
        await pg.route("**/api/sellers/*/rating", boom)
    await pg.add_init_script(init_script(acc, lang))
    await pg.goto(BASE, wait_until="networkidle")
    await pg.wait_for_timeout(3500)
    return ctx, pg, errs


async def main():
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/health", timeout=2); break
        except Exception:
            time.sleep(1)
    asha, bilal, chan, dina = signup("asha", "Asha Khatun"), signup("bilal", "Bilal Hossain"), signup("chan", "Chandni Das"), signup("dina", "Dina Roy")
    api("POST", f"/api/follows/{asha['id']}", {}, bilal["token"])
    api("POST", f"/api/follows/{asha['id']}", {}, chan["token"])
    api("POST", f"/api/follows/{bilal['id']}", {}, asha["token"])
    st, item = api("POST", "/api/catalog/listings", {"name": "Check rice 5kg"}, asha["token"])
    api("POST", f"/api/reviews/{item['id']}", {"rating": 4}, bilal["token"])
    api("POST", f"/api/reviews/{item['id']}", {"rating": 5}, chan["token"])
    asha_pub = {"id": asha["id"], "name": "Asha Khatun", "avatar": "", "bio": "", "location": "", "followersCount": 0, "followingCount": 0, "isFollowing": False}
    open_asha = "(u)=>window.__nav.navigate('UserProfile',{user:u})"

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            L = {"rating": "রেটিং (2)" if lang == "bn" else "Rating (2)", "none": "এখনো রেটিং নেই" if lang == "bn" else "No ratings yet",
                 "following": "ফলোয়িং" if lang == "bn" else "Following", "follow": "ফলো করুন" if lang == "bn" else "Follow"}
            for w in (320, 360, 390):
                tag = f"{lang}-{w}"
                # Asha, own profile
                ctx, pg, errs = await page(b, asha, lang, w)
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Profile'})")
                await pg.wait_for_timeout(2500)
                got = [await text(pg, t) for t in ("profile-stat-followers", "profile-stat-following", "profile-stat-rating", "profile-stat-rating-label")]
                check(got == ["2", "1", "4.5 ★", L["rating"]], f"{tag} Asha's own profile shows real 2 / 1 / 4.5 ★ {L['rating']}: {got}")
                body = await pg.locator("body").inner_text()
                check("156" not in body and "4.9" not in body, f"{tag} no 156 or 4.9 anywhere on Asha's profile")
                lab = pg.locator('[data-testid="profile-stat-rating-label"]').first
                check(await lab.evaluate("e=>e.scrollWidth<=e.clientWidth+1"), f"{tag} rating label not cut off")
                await pg.screenshot(path=f"{SHOTS}/own-asha-{tag}.png")
                check(not errs, f"{tag} no page errors (Asha) {errs}")
                await ctx.close()
                # Dina, own profile, brand new
                ctx, pg, errs = await page(b, dina, lang, w)
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Profile'})")
                await pg.wait_for_timeout(2500)
                got = [await text(pg, t) for t in ("profile-stat-followers", "profile-stat-following", "profile-stat-rating", "profile-stat-rating-label")]
                check(got == ["0", "0", "—", L["none"]], f"{tag} new account shows 0 / 0 / {L['none']}: {got}")
                lab = pg.locator('[data-testid="profile-stat-rating-label"]').first
                check(await lab.evaluate("e=>e.scrollWidth<=e.clientWidth+1"), f"{tag} 'no ratings' label not cut off")
                await pg.screenshot(path=f"{SHOTS}/own-dina-{tag}.png")
                await ctx.close()
                # Own profile while the server fails, then retry
                ctx, pg, errs = await page(b, asha, lang, w, fail_stats=True)
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Profile'})")
                await pg.wait_for_timeout(2500)
                got = [await text(pg, t) for t in ("profile-stat-followers", "profile-stat-following", "profile-stat-rating")]
                retry = pg.locator('[data-testid="profile-stats-retry"]')
                check(got == ["—", "—", "—"] and await retry.count() == 1, f"{tag} failed load shows — / — / — and a retry row, not 0: {got}")
                await pg.screenshot(path=f"{SHOTS}/own-failed-{tag}.png")
                await pg.unroute("**/api/follows/*")
                await pg.unroute("**/api/sellers/*/rating")
                await retry.first.click()
                await pg.wait_for_timeout(2000)
                got = [await text(pg, t) for t in ("profile-stat-followers", "profile-stat-following", "profile-stat-rating")]
                check(got == ["2", "1", "4.5 ★"] and await retry.count() == 0, f"{tag} retry loads the real numbers: {got}")
                await ctx.close()
                # Bilal opens Asha's profile
                ctx, pg, errs = await page(b, bilal, lang, w)
                await pg.evaluate(open_asha, asha_pub)
                await pg.wait_for_timeout(2500)
                f = await text(pg, "user-stat-followers"); g = await text(pg, "user-stat-following")
                check(f == "2" and g == "1", f"{tag} Asha's profile seen by Bilal: 2 followers, 1 following ({f}, {g})")
                check(await pg.get_by_text(L["following"], exact=True).count() >= 2, f"{tag} Bilal sees the button as {L['following']}")
                if lang == "en":
                    check(await pg.get_by_text("ফলোয়িং").count() == 0 and await pg.get_by_text("ফলো করুন").count() == 0, f"{tag} no Bangla Follow text in English")
                await pg.screenshot(path=f"{SHOTS}/other-bilal-{tag}.png")
                check(not errs, f"{tag} no page errors (Bilal) {errs}")
                await ctx.close()
                # Dina opens Asha's profile (not following)
                ctx, pg, errs = await page(b, dina, lang, w)
                await pg.evaluate(open_asha, asha_pub)
                await pg.wait_for_timeout(2500)
                check(await pg.get_by_text(L["follow"], exact=True).count() == 1, f"{tag} Dina sees the button as {L['follow']}")
                await ctx.close()
                # Asha's profile while the server fails
                ctx, pg, errs = await page(b, dina, lang, w, fail_stats=True)
                await pg.evaluate(open_asha, asha_pub)
                await pg.wait_for_timeout(2500)
                f = await text(pg, "user-stat-followers"); g = await text(pg, "user-stat-following")
                retry = pg.locator('[data-testid="user-stats-retry"]')
                check(f == "—" and g == "—" and await retry.count() == 1, f"{tag} other profile failed load shows — and retry ({f}, {g})")
                await pg.screenshot(path=f"{SHOTS}/other-failed-{tag}.png")
                await pg.unroute("**/api/follows/*")
                await retry.first.click()
                await pg.wait_for_timeout(2000)
                check(await text(pg, "user-stat-followers") == "2", f"{tag} retry on other profile loads 2 followers")
                await ctx.close()
        # Following from the UI (throwaway accounts): Dina taps Follow on Asha, count goes to 3 and the server agrees.
        ctx, pg, errs = await page(b, dina, "en", 360)
        await pg.evaluate(open_asha, asha_pub)
        await pg.wait_for_timeout(2500)
        await pg.get_by_text("Follow", exact=True).first.click()
        await pg.wait_for_timeout(2500)
        st, fj = api("GET", f"/api/follows/{asha['id']}", None, dina["token"])
        check(await text(pg, "user-stat-followers") == "3" and fj["followerCount"] == 3 and fj["isFollowing"], "Dina taps Follow: screen and server both say 3 followers")
        check(await pg.get_by_text("Following", exact=True).count() >= 2, "button switches to Following")
        await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Profile'})")
        await pg.wait_for_timeout(2500)
        check(await text(pg, "profile-stat-following") == "1", "Dina's own profile now shows following 1 when she comes back to it")
        await ctx.close()
        await b.close()
    print(f"\n{len(fails)} failed")


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass
sys.exit(1 if fails else 0)
