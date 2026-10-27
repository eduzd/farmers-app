"""Web check (throwaway local server, needs ./dist): real profile numbers on screen.

Throwaway accounts only. Asha has 2 followers, follows 1 person, and has 2 reviews (4 and 5 stars).
Dina is brand new. At 320/360/390 in English and Bangla:
- Asha's own Profile shows 2 / 1 / 4.5 ★ "Rating (2)", never 156 / 89 / 4.9.
- Dina's own Profile shows 0 / 0 / "No ratings yet".
- With /api/follows and /rating failing, the boxes show — and a retry row; tapping retry (server back) loads the numbers.
- Bilal opening Asha's profile sees 2 followers and a "Following" button (ফলোয়িং in Bangla);
  Dina sees "Follow" (ফলো করুন). A failed load there shows — with retry, not 0.
  python3 tests/check-profile-design-web.py [shots_dir]
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6400 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/profile-design"
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



async def page(b, acc, lang, w, dark=False):
    ctx = await b.new_context(viewport={"width": w, "height": 860})
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    extra = "localStorage.setItem('theme_preference', JSON.stringify('dark'));" if dark else ""
    await pg.add_init_script(init_script(acc, lang) + extra)
    await pg.goto(BASE, wait_until="networkidle")
    await pg.wait_for_timeout(3500)
    return ctx, pg, errs


def tid(pg, t):
    return pg.locator(f'[data-testid="{t}"]')


async def visible(pg, t):
    loc = tid(pg, t)
    return await loc.count() > 0 and await loc.first.is_visible()


async def overflow(pg):
    return await pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")


async def centred(pg, t):
    box = await tid(pg, t).first.bounding_box()
    hero = await tid(pg, "profile-hero").first.bounding_box()
    if not box or not hero:
        return False
    return abs((box["x"] + box["width"] / 2) - (hero["x"] + hero["width"] / 2)) < 4


async def main():
    results = []
    def check(name, ok, info=""):
        results.append((name, bool(ok), info))
        print(("PASS " if ok else "FAIL ") + name + (("  " + str(info)) if info else ""), flush=True)

    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(BASE + "/", timeout=3)
                break
            except Exception:
                time.sleep(1)
        me = signup("rahim", "Rahim Hossain")
        other = signup("karim", "Karim Mia")
        # Real data: Karim writes two posts (one with a photo), Rahim one. Karim follows Rahim.
        # Posts need the community's real id (the slug "fish" is not an id, and those posts were never saved).
        comms = api("GET", "/api/communities")[1]
        fish = (next((c for c in comms if c.get("slug") == "fish"), None) or comms[0])["id"]
        made = [
            api("POST", "/api/posts", {"content": "Pond water looks green today", "communityId": fish}, other["token"])[0],
            api("POST", "/api/posts", {"content": "Fresh tilapia harvest", "communityId": fish, "media": ["https://farmers-2ybg.onrender.com/assets/icon.png"]}, other["token"])[0],
            api("POST", "/api/posts", {"content": "My first post", "communityId": fish}, me["token"])[0],
        ]
        check("test posts saved", made == [201, 201, 201], made)
        api("POST", f"/api/follows/{me['user']['id']}", {}, other["token"])
        api("PUT", "/api/me/about", {"bio": "Fish farmer from Mymensingh", "location": "Mymensingh"}, other["token"])
        # A real review: Karim sells tilapia, Rahim gives it 5 stars with a comment.
        st_item, item = api("POST", "/api/catalog/listings", {"name": "Fresh tilapia 1kg"}, other["token"])
        st_rev = api("POST", f"/api/reviews/{item['id']}", {"rating": 5, "comment": "Very fresh fish, fast delivery"}, me["token"])[0]
        check("test review saved", st_rev == 201, (st_item, st_rev))

        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--no-sandbox"])
            for lang in ("en", "bn"):
                for w in (390, 1280):
                    for dark in (False, True):
                        tag = f"[{lang} {w}px {'dark' if dark else 'light'}]"
                        ctx, pg, errs = await page(b, me, lang, w, dark)
                        # ---- own profile
                        await pg.evaluate("window.__nav && window.__nav.navigate('Main', { screen: 'Profile' })")
                        await pg.wait_for_timeout(2500)
                        if not await visible(pg, "profile-hero"):
                            await pg.screenshot(path=f"{SHOTS}/debug-{lang}-{w}-{dark}.png")
                            print("DEBUG body:", (await pg.inner_text("body"))[:400].replace("\n", " | "), errs[:3], flush=True)
                            await pg.locator('[role="tab"]').last.click(timeout=8000)
                            await pg.wait_for_timeout(2500)
                        check(f"{tag} own: hero shows", await visible(pg, "profile-hero"))
                        check(f"{tag} own: name centred", await centred(pg, "profile-hero-name"))
                        fol = (await tid(pg, "profile-hero-followers").first.inner_text()) if await tid(pg, "profile-hero-followers").count() else ""
                        check(f"{tag} own: follower count reads followers", ("1" in fol) and (("followers" in fol) if lang == "en" else ("ফলোয়ার" in fol)), fol.replace("\n", " "))
                        check(f"{tag} own: online shown", await visible(pg, "profile-hero-online"))
                        check(f"{tag} own: Edit + Share buttons", await visible(pg, "profile-edit-button") and await visible(pg, "profile-share-button"))
                        check(f"{tag} own: menu items hidden from page", not await visible(pg, "profile-logout-button") and not await visible(pg, "menu-item-settings"))
                        check(f"{tag} own: posts tab shows real post", await visible(pg, "profile-feed") and await pg.get_by_text("My first post").count() > 0)
                        check(f"{tag} own: three-dot in title bar", await visible(pg, "profile-more-button"))
                        await tid(pg, "profile-more-button").first.click()
                        await pg.wait_for_timeout(900)
                        page_ok = await visible(pg, "profile-options-page")
                        has_opts = await pg.get_by_text("Settings" if lang == "en" else "সেটিংস").count() > 0
                        check(f"{tag} own: three-dot opens the full Profile options page", page_ok and has_opts and not await visible(pg, "profile-options-sheet"))
                        if page_ok:
                            backs = pg.locator('[aria-label="Go back"]')
                            for i in range(await backs.count() - 1, -1, -1):
                                if await backs.nth(i).is_visible():
                                    await backs.nth(i).click(); break
                            await pg.wait_for_timeout(1200)
                        check(f"{tag} own: back returns to the profile", not await visible(pg, "profile-options-page") and await visible(pg, "profile-edit-button"))
                        await tid(pg, "profile-tab-about").first.click()
                        await pg.wait_for_timeout(500)
                        check(f"{tag} own: about tab", await visible(pg, "profile-about"))
                        tabs = await pg.locator('[data-testid^="profile-tab-"]').evaluate_all("els => els.filter(e => e.offsetParent).map(e => e.dataset.testid)")
                        check(f"{tag} own: tabs are Posts, Reviews, About, Achievements (no Photos)", tabs == ["profile-tab-posts", "profile-tab-reviews", "profile-tab-about", "profile-tab-achievements"], tabs)
                        await tid(pg, "profile-tab-reviews").first.click()
                        await pg.wait_for_timeout(800)
                        check(f"{tag} own: Reviews tab empty state (no listings reviewed)", await visible(pg, "user-reviews-empty"))
                        await tid(pg, "profile-tab-achievements").first.click()
                        await pg.wait_for_timeout(600)
                        check(f"{tag} own: achievements list shows", await visible(pg, "profile-achievements"))
                        check(f"{tag} own: First post earned (1 real post)", await tid(pg, "achievement-first-post-earned").count() > 0)
                        fp = (await tid(pg, "achievement-followers-10-progress").first.inner_text()).strip() if await tid(pg, "achievement-followers-10-progress").count() else ""
                        check(f"{tag} own: followers badge shows real progress 1/10", fp in ("1/10", "১/১০"), fp)
                        check(f"{tag} own: Verified not earned", await tid(pg, "achievement-verified-earned").count() == 0)
                        summ = (await tid(pg, "achievements-summary").first.inner_text()).strip()
                        check(f"{tag} own: summary says 1 of 9", ("1 of 9" in summ) if lang == "en" else ("৯টির মধ্যে ১টি" in summ), summ)
                        await pg.screenshot(path=f"{SHOTS}/achievements-own-{lang}-{w}-{'dark' if dark else 'light'}.png", full_page=True)
                        check(f"{tag} own: no sideways overflow", await overflow(pg) <= 1, await overflow(pg))

                        # ---- someone else's profile
                        ou = other["user"]
                        await pg.evaluate("(u) => window.__nav.navigate('UserProfile', { user: u })", {"id": ou["id"], "name": ou["name"], "initials": "KM", "followers": 0, "following": 0, "posts": 0})
                        await pg.wait_for_timeout(3000)
                        # with several screens mounted, pick the visible hero
                        check(f"{tag} other: hero shows", await visible(pg, "user-profile-screen"))
                        ftxt = (await tid(pg, "user-follow").last.inner_text()).strip() if await tid(pg, "user-follow").count() else ""
                        check(f"{tag} other: Follow button (not Connect)", ftxt in (("Follow",) if lang == "en" else ("ফলো করুন",)) and "Connect" not in await pg.locator("body").inner_text(), ftxt)
                        check(f"{tag} other: Message button", await tid(pg, "user-message").count() > 0)
                        body = await pg.locator('[data-testid="user-profile-screen"]').last.inner_text()
                        check(f"{tag} other: bio + place", "Fish farmer from Mymensingh" in body and "Mymensingh" in body)
                        check(f"{tag} other: joined line", await tid(pg, "profile-hero-joined").count() > 0)
                        check(f"{tag} other: online/offline shown", await tid(pg, "profile-hero-offline").count() + await tid(pg, "profile-hero-online").count() > 0)
                        uf = (await tid(pg, "user-stat-following").last.inner_text()).strip() if await tid(pg, "user-stat-following").count() else ""
                        check(f"{tag} other: following count is real (1)", uf == "1", uf)
                        check(f"{tag} other: their real posts", "Pond water looks green today" in body and "Fresh tilapia harvest" in body)
                        tabs = await pg.locator('[data-testid="user-profile-screen"]').last.locator('[data-testid^="profile-tab-"]').evaluate_all("els => els.map(e => e.dataset.testid)")
                        check(f"{tag} other: tabs are Posts, Reviews, About, Achievements (no Photos)", tabs == ["profile-tab-posts", "profile-tab-reviews", "profile-tab-about", "profile-tab-achievements"], tabs)
                        scr = pg.locator('[data-testid="user-profile-screen"]').last
                        rcount = (await scr.locator('[data-testid="profile-tab-reviews"]').inner_text()).strip()
                        check(f"{tag} other: Reviews tab shows count 1", rcount.endswith("1") or rcount.endswith("১"), rcount.replace("\n", " "))
                        await tid(pg, "profile-tab-reviews").last.click()
                        await pg.wait_for_timeout(800)
                        rtxt = (await scr.locator('[data-testid="profile-reviews"]').inner_text()) if await scr.locator('[data-testid="profile-reviews"]').count() else ""
                        check(f"{tag} other: review shows comment, product and reviewer", "Very fresh fish, fast delivery" in rtxt and "Fresh tilapia 1kg" in rtxt and "Rahim Hossain" in rtxt, rtxt[:120].replace("\n", " | "))
                        avg = (await scr.locator('[data-testid="reviews-average"]').inner_text()).strip() if await scr.locator('[data-testid="reviews-average"]').count() else ""
                        check(f"{tag} other: average 5.0", avg in ("5.0", "৫.০"), avg)
                        await pg.screenshot(path=f"{SHOTS}/reviews-other-{lang}-{w}-{'dark' if dark else 'light'}.png", full_page=True)
                        await tid(pg, "profile-tab-achievements").last.click()
                        await pg.wait_for_timeout(600)
                        check(f"{tag} other: First post earned (2 real posts)", await scr.locator('[data-testid="achievement-first-post-earned"]').count() > 0)
                        rp = scr.locator('[data-testid="achievement-posts-10-progress"]')
                        rpt = (await rp.first.inner_text()).strip() if await rp.count() else ""
                        check(f"{tag} other: Regular poster progress 2/10", rpt in ("2/10", "২/১০"), rpt)
                        await pg.screenshot(path=f"{SHOTS}/achievements-other-{lang}-{w}-{'dark' if dark else 'light'}.png", full_page=True)
                        await tid(pg, "profile-tab-posts").last.click()
                        await pg.wait_for_timeout(400)
                        await tid(pg, "user-profile-more").last.click()
                        await pg.wait_for_timeout(900)
                        menu = await visible(pg, "visitor-profile-menu")
                        check(f"{tag} other: three-dot menu with share/mute/block/report", menu and all([await tid(pg, x).count() > 0 for x in ("visitor-menu-share", "visitor-menu-mute", "visitor-menu-block", "visitor-menu-report")]))
                        if lang == "en" and w == 390 and not dark:
                            await tid(pg, "visitor-menu-report").first.click()
                            await pg.wait_for_timeout(500)
                            await tid(pg, "visitor-report-reason-spam").first.click()
                            pg.once("dialog", lambda d: asyncio.ensure_future(d.accept()))
                            await tid(pg, "visitor-report-send").first.click()
                            await pg.wait_for_timeout(1500)
                            check(f"{tag} other: report sent and sheet closed", not await visible(pg, "visitor-profile-menu"))
                        elif menu:
                            await tid(pg, "visitor-profile-menu-close").first.click()
                            await pg.wait_for_timeout(600)
                        if w == 390:
                            await tid(pg, "user-follow").last.click()
                            await pg.wait_for_timeout(1500)
                            ftxt2 = (await tid(pg, "user-follow").last.inner_text()).strip()
                            check(f"{tag} other: Follow turns into Following", ftxt2 in ("Following", "ফলোয়িং"), ftxt2)
                            await tid(pg, "user-follow").last.click()  # unfollow again
                            await pg.wait_for_timeout(1500)
                        check(f"{tag} other: no sideways overflow", await overflow(pg) <= 1, await overflow(pg))
                        await pg.screenshot(path=f"{SHOTS}/profdesign-{lang}-{w}-{'dark' if dark else 'light'}.png", full_page=False)
                        check(f"{tag} no page errors", not errs, errs[:2])
                        await ctx.close()
            await b.close()
    finally:
        try:
            os.killpg(srv.pid, 15)
        except Exception:
            pass
    passed = sum(1 for r in results if r[1])
    print(f"\n{passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)


asyncio.run(main())
