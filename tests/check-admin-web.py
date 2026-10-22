"""Web check for the admin app round on a throwaway local server (no Render, no APK).

1. Category switch: an admin adds a category and renames another through the admin API; the main
   app's Market chips, the sell form and Seller Hub must show the change (they read /api/market/categories).
2. Help flow: a normal user taps Help on the home header, sends a message from the popup; the admin
   sees it in the admin app's Support tab and replies there; the user sees the reply in their Help chat.
3. Admin screens at 320/360/390 in English and Bangla: Home, Shop (products, shops, categories),
   Orders, Support, More. Records page errors, sideways overflow and cut-off tab labels, with screenshots.

  python3 scripts/check_admin_web.py [shots_dir]      (needs a web export in ./dist)
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6200 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/admin"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="admin-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="admin-web-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/admin-web-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); return
        except Exception:
            time.sleep(1)
    raise SystemExit("server did not start")


def stop():
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass
    for _ in range(40):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=1); time.sleep(0.25)
        except Exception:
            break
    time.sleep(1)


def api(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def signup(tag, name):
    s = str(int(time.time() * 1000))[-7:]
    email = f"{tag}{s}@check.test"
    st, j = api("POST", "/api/auth/signup", {"email": email, "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
    assert j and j.get("token"), (st, j)
    return {"email": email, "token": j["token"], "user": j["user"]}


OVERFLOW_JS = r"""() => {
  const vw = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll('div,span,img')) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= vw + 1) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1) { clipped = true; break; } } p = p.parentElement; }
    if (!clipped) out.push((el.innerText || el.tagName).slice(0, 40) + ' @' + Math.round(r.right));
  }
  return out.slice(0, 8);
}"""

# Leaf text inside a testID'd box that is wider than its box = cut off (ellipsis).
CUT_JS = r"""(sel) => {
  const out = [];
  for (const box of document.querySelectorAll(sel)) {
    for (const el of box.querySelectorAll('div,span')) {
      if (el.children.length || !el.innerText) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(el.innerText.slice(0, 30));
    }
  }
  return out;
}"""


def init_script(acc, lang):
    u = dict(acc["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


async def main():
    rep = {}
    start()
    admin = signup("boss", "Admin Rahim")
    ann = signup("ann", "Ann Begum")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"])], check=True)
    start()
    st, j = api("POST", "/api/auth/login", {"email": admin["email"], "password": "Check-pass-123"})
    admin["token"], admin["user"] = j["token"], j["user"]
    rep["admin_is_super"] = bool(admin["user"].get("isSuperAdmin"))

    # ---- category switch via the admin API ----
    st, cats = api("GET", "/api/admin/manage/categories", tok=admin["token"])
    veg = next(c for c in cats if c["slug"] == "vegetables")
    rep["add_category"] = api("POST", "/api/admin/manage/categories", {"nameEn": "Spices", "nameBn": "মসলা", "icon": "star", "color": "#B45309"}, admin["token"])[0]
    rep["rename_category"] = api("PUT", f"/api/admin/manage/categories/{veg['id']}", {"nameEn": "Fresh Vegetables", "nameBn": "তাজা সবজি"}, admin["token"])[0]
    dairy = next(c for c in cats if c["slug"] == "dairy")
    rep["hide_dairy"] = api("PUT", f"/api/admin/manage/categories/{dairy['id']}", {"active": False}, admin["token"])[0]
    pub = api("GET", "/api/market/categories")[1]
    rep["public_list"] = [c["nameEn"] for c in pub]

    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---- main app as Ann: Market chips, sell form, Help popup -> chat ----
        for lang in ("en", "bn"):
            r = rep[f"user-{lang}"] = {}
            ctx = await b.new_context(viewport={"width": 360, "height": 760})
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
            await pg.add_init_script(init_script(ann, lang))
            await pg.goto(BASE, wait_until="networkidle")
            await pg.wait_for_timeout(4000)
            hb = pg.locator('[data-testid="help-button"]')
            r["help_button"] = await hb.count()
            if r["help_button"]:
                bb = await hb.first.bounding_box()
                r["help_box"] = [round(bb["x"]), round(bb["y"]), round(bb["width"]), round(bb["height"])]
            r["overflow_home"] = await pg.evaluate(OVERFLOW_JS)
            await pg.screenshot(path=f"{SHOTS}/home-help-{lang}-360.png")
            if r["help_button"]:
                await hb.first.click()  # Help goes straight to the Support chat (no popup any more)
                await pg.wait_for_timeout(2500)
                msg = "My order hasn't arrived yet" if lang == "en" else "আমার অর্ডার এখনও আসেনি"
                await pg.locator('[data-testid="support-input"]').fill(msg)
                await pg.locator('[data-testid="support-send"]').click()
                await pg.wait_for_timeout(2000)
                r["chat_open"] = await pg.locator('[data-testid="support-chat"]').count()
                r["chat_has_msg"] = await pg.get_by_text(msg).count()
                r["overflow_chat"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/help-chat-{lang}-360.png")
            await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Market'})")
            await pg.wait_for_timeout(3000)
            body = await pg.evaluate("()=>document.body.innerText")
            if lang == "en":
                r["market_has_spices"] = "Spices" in body
                r["market_has_renamed"] = "Fresh Vegetables" in body
                r["market_has_dairy"] = "Dairy" in body
            else:
                r["market_has_spices"] = "মসলা" in body
                r["market_has_renamed"] = "তাজা সবজি" in body
                r["market_has_dairy"] = "দুগ্ধ" in body
            await pg.screenshot(path=f"{SHOTS}/market-cats-{lang}-360.png")
            await pg.evaluate("()=>window.__nav.navigate('SellerApp')")
            await pg.wait_for_timeout(3000)
            r["seller_spices_chip"] = await pg.locator('[data-testid="seller-cat-spices"]').count()
            r["seller_dairy_chip"] = await pg.locator('[data-testid="seller-cat-dairy"]').count()
            await pg.screenshot(path=f"{SHOTS}/seller-cats-{lang}-360.png")
            r["errors"] = errs
            await ctx.close()

        # ---- Connect page: ad carousel instead of the intro line, floating Help button -> admin chat ----
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                r = rep[f"connect-{lang}-{w}"] = {}
                ctx = await b.new_context(viewport={"width": w, "height": 760})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(ann, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(3500)
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Connect'})")
                await pg.wait_for_timeout(3000)
                body = await pg.evaluate("()=>document.body.innerText")
                r["old_intro_gone"] = ("Talk to real" not in body) and ("আসল" not in body)
                car = pg.locator('[data-testid="connect-carousel"]')
                r["carousel"] = await car.count()
                fab = pg.locator('[data-testid="connect-help-fab"]')
                r["fab"] = await fab.count()
                if r["carousel"]:
                    cb = await car.first.bounding_box()
                    r["carousel_box"] = [round(cb["x"]), round(cb["y"]), round(cb["width"]), round(cb["height"])]
                    first = pg.locator('[data-testid="connect-carousel-card-advertise"]')
                    x0 = (await first.bounding_box())["x"]
                    await pg.wait_for_timeout(4800)
                    r["auto_moved_px"] = round(x0 - (await first.bounding_box())["x"])
                    r["card_cut"] = await pg.evaluate(CUT_JS, '[data-testid^="connect-carousel-card-"]')
                if r["fab"]:
                    fb = await fab.first.bounding_box()
                    r["fab_box"] = [round(fb["x"]), round(fb["y"]), round(fb["width"]), round(fb["height"])]
                    tabs = await pg.evaluate("()=>{const t=[...document.querySelectorAll('[role=tablist],[role=tab]')].map(e=>e.getBoundingClientRect().top);return t.length?Math.min(...t):null}")
                    r["tabbar_top"] = tabs and round(tabs)
                    r["fab_above_tabbar"] = (tabs is None) or (fb["y"] + fb["height"] <= tabs)
                r["overflow"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/connect-{lang}-{w}.png")
                if r["fab"] and w == 360:
                    await fab.first.click()
                    await pg.wait_for_timeout(2500)
                    r["fab_opens_chat"] = await pg.locator('[data-testid="support-chat"]').count()
                    await pg.screenshot(path=f"{SHOTS}/connect-fab-chat-{lang}.png")
                r["errors"] = errs
                await ctx.close()

        # ---- admin app: reply to Ann in Support, then all tabs at 3 widths x 2 languages ----
        replied = False
        quick = os.environ.get("QUICK") == "1"
        for lang in (("en",) if quick else ("en", "bn")):
            for w in ((360,) if quick else (320, 360, 390)):
                key = f"admin-{lang}-{w}"
                r = rep[key] = {}
                ctx = await b.new_context(viewport={"width": w, "height": 760})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(admin, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(3500)
                await pg.evaluate("()=>window.__nav.navigate('AdminApp')")
                await pg.wait_for_timeout(3000)
                r["admin_app"] = await pg.locator('[data-testid="admin-app"]').count()
                r["denied"] = await pg.locator('[data-testid="admin-denied"]').count()
                r["tabbar_cut"] = await pg.evaluate(CUT_JS, '[data-testid="admin-tabbar"]')
                shots = [("home", None), ("shop", "products"), ("shop", "shops"), ("shop", "categories"), ("orders", None), ("support", None), ("more", None)]
                r["overflow"] = {}
                r["cut"] = {}
                for tab, section in shots:
                    name = tab + (f"-{section}" if section else "")
                    await pg.locator(f'[data-testid="admin-tab-{tab}"]').click()
                    await pg.wait_for_timeout(1500)
                    if section:
                        await pg.locator(f'[data-testid="shop-section-{section}"]').click()
                        await pg.wait_for_timeout(1500)
                        r["cut"][name] = await pg.evaluate(CUT_JS, '[data-testid^="shop-section-"]')
                    ov = await pg.evaluate(OVERFLOW_JS)
                    if ov:
                        r["overflow"][name] = ov
                    await pg.screenshot(path=f"{SHOTS}/{key}-{name}.png")
                    if name == "shop-categories":
                        r["cat_spices"] = await pg.locator('[data-testid="category-spices"]').count()
                    if tab == "support":
                        r["support_text"] = (await pg.evaluate("()=>document.querySelector('[data-testid=\"admin-support\"]')?.innerText || ''"))[:200]
                        if not replied:
                            row = pg.get_by_text("Ann Begum").first
                            r["ann_thread"] = await row.count()
                            if r["ann_thread"]:
                                await row.click()
                                await pg.wait_for_timeout(2000)
                                r["thread_text"] = (await pg.evaluate("()=>document.body.innerText"))[:400]
                                inp = pg.locator('[data-testid="reply-input"], [data-testid="support-input"]').first
                                await inp.fill("We're checking your order now. Sorry for the wait.")
                                send = pg.locator('[data-testid="thread-send"], [data-testid="reply-send"], [data-testid="support-send"]').first
                                r["send_btn"] = await send.count()
                                if r["send_btn"]:
                                    await send.first.click()
                                else:
                                    await inp.press("Enter")
                                await pg.wait_for_timeout(2000)
                                r["thread_after"] = (await pg.evaluate("()=>document.body.innerText"))[-300:]
                                ov = await pg.evaluate(OVERFLOW_JS)
                                if ov:
                                    r["overflow"]["thread"] = ov
                                await pg.screenshot(path=f"{SHOTS}/{key}-support-thread.png")
                                replied = True
                                await pg.locator('[data-testid="support-back"], [data-testid="admin-back"]').first.click()
                                await pg.wait_for_timeout(800)
                r["errors"] = errs
                await ctx.close()

        # ---- Ann sees the reply in her Help chat; the Help button shows the unread dot ----
        # /api/support/unread does not mark anything read (opening the thread does), so read it first.
        rep["ann_unread_api"] = api("GET", "/api/support/unread", tok=ann["token"])[1]
        ctx = await b.new_context(viewport={"width": 360, "height": 760})
        pg = await ctx.new_page()
        await pg.add_init_script(init_script(ann, "en"))
        await pg.goto(BASE, wait_until="networkidle")
        await pg.wait_for_timeout(4000)
        rep["ann_unread_dot"] = await pg.locator('[data-testid="help-unread"]').count()
        await pg.locator('[data-testid="help-button"]').first.click()
        await pg.wait_for_timeout(2500)
        rep["ann_sees_reply"] = await pg.get_by_text("We're checking your order now").count()
        await pg.screenshot(path=f"{SHOTS}/help-chat-reply-en-360.png")
        await ctx.close()
        st, th = api("GET", "/api/support/thread", tok=ann["token"])
        rep["ann_thread_api"] = [(m.get("fromAdmin"), m.get("body")) for m in (th or {}).get("messages", [])]
        await b.close()
    print(json.dumps(rep, ensure_ascii=False, indent=1))


try:
    asyncio.run(main())
finally:
    stop()
