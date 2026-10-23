"""Web check for the animated order progress trackers on a throwaway local server (no Render, no APK).

Admin order page (Orders -> order) and the buyer's order page (OrderDetail), English and Bangla, 320/360/390:
- the progress bar grows from empty to the real step on first view, then stays there (no loop)
- pressing the next step (Confirm) animates forward: bar width and the line fill grow, earlier steps stay done
- the buyer sees the new step after reload, cancelled orders show the cancelled state with no moving bar
- reduce-motion: the bar is at its end state at once
- page errors and sideways overflow, with screenshots

  python3 tests/check-order-progress-web.py [shots_dir]      (needs a web export in ./dist)
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6300 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/order-progress"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="order-anim-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="order-anim-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/order-anim-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(240):
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


def init_script(acc, lang):
    u = dict(acc["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


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

# fill fraction of a progress bar (its first child's width / its own width)
BAR_JS = r"""(id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (!b || !b.firstElementChild) return null;
  return Math.round(1000 * b.firstElementChild.getBoundingClientRect().width / b.getBoundingClientRect().width) / 1000; }"""
# fill fraction of a connector line (fill height / track height)
LINE_JS = r"""(id) => { const f = document.querySelector(`[data-testid="${id}"]`); if (!f) return null;
  return Math.round(1000 * f.getBoundingClientRect().height / f.parentElement.getBoundingClientRect().height) / 1000; }"""


async def samples(pg, js, arg, n=8, gap=90):
    out = []
    for _ in range(n):
        out.append(await pg.evaluate(js, arg))
        await pg.wait_for_timeout(gap)
    return out


def new_order(buyer, oid):
    return api("POST", "/api/shop-orders", {"id": oid, "total": 1800, "itemCount": 2, "paymentMethod": "cod",
               "items": [{"productId": "p-check", "name": "Tilapia feed 25kg", "price": 900, "quantity": 2, "seller": "Green Valley Agro"}],
               "shippingAddress": {"name": "Buyer", "address": "Sherpur"}}, buyer["token"])


async def main():
    rep = {}
    start()
    admin = signup("boss", "Admin Rahim")
    buyer = signup("ann", "Ann Begum")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"])], check=True)
    start()
    st, j = api("POST", "/api/auth/login", {"email": admin["email"], "password": "Check-pass-123"})
    admin["token"], admin["user"] = j["token"], j["user"]
    rep["admin_is_super"] = bool(admin["user"].get("isSuperAdmin"))
    stamp = str(int(time.time()))

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                key = f"{lang}-{w}"
                r = rep[key] = {}
                oid = f"ord-{lang}{w}-{stamp}"
                r["order_created"] = new_order(buyer, oid)[0]

                # ---- admin: first view, then Confirm ----
                ctx = await b.new_context(viewport={"width": w, "height": 800})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
                await pg.add_init_script(init_script(admin, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(3000)
                await pg.evaluate("()=>window.__nav.navigate('AdminApp')")
                await pg.wait_for_timeout(2500)
                await pg.locator('[data-testid="admin-tab-orders"]').click()
                await pg.wait_for_timeout(1500)
                await pg.locator(f'[data-testid="order-{oid}"]').click()
                await pg.locator('[data-testid="order-progress-bar"]').wait_for(timeout=15000)
                r["admin_bar_first"] = await samples(pg, BAR_JS, "order-progress-bar")
                await pg.wait_for_timeout(1500)
                r["admin_bar_settled"] = await pg.evaluate(BAR_JS, "order-progress-bar")
                await pg.wait_for_timeout(2500)
                r["admin_bar_still"] = await pg.evaluate(BAR_JS, "order-progress-bar")
                r["admin_count"] = await pg.locator('[data-testid="order-step-count"]').inner_text()
                r["admin_overflow"] = await pg.evaluate(OVERFLOW_JS)
                await pg.locator('[data-testid="order-progress"]').screenshot(path=f"{SHOTS}/admin-{key}-pending.png")
                await pg.locator('[data-testid="next-step-confirmed"]').click()
                await pg.wait_for_timeout(250)
                r["admin_bar_after_confirm"] = await samples(pg, BAR_JS, "order-progress-bar", n=10, gap=120)
                r["admin_line_pending"] = await pg.evaluate(LINE_JS, "step-line-pending")
                r["admin_count_after"] = await pg.locator('[data-testid="order-step-count"]').inner_text()
                r["admin_steps"] = await pg.evaluate("""()=>['pending','confirmed','processing'].map(s=>document.querySelector(`[data-testid="step-${s}"]`)?.getAttribute('aria-label'))""")
                await pg.locator('[data-testid="order-progress"]').screenshot(path=f"{SHOTS}/admin-{key}-confirmed.png")
                r["admin_errors"] = errs[:]
                await ctx.close()

                # ---- buyer: sees the confirmed step ----
                ctx = await b.new_context(viewport={"width": w, "height": 800})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(buyer, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(3000)
                await pg.evaluate(f"()=>window.__nav.navigate('OrderDetail', {{ orderId: '{oid}' }})")
                bar = pg.locator('[data-testid="track-progress-bar"]')
                try:
                    await bar.wait_for(timeout=15000)
                except Exception:
                    r["buyer_text"] = (await pg.evaluate("()=>document.body.innerText"))[:300]
                r["buyer_bar_first"] = await samples(pg, BAR_JS, "track-progress-bar")
                await pg.wait_for_timeout(2500)
                r["buyer_bar_settled"] = await pg.evaluate(BAR_JS, "track-progress-bar")
                r["buyer_line_pending"] = await pg.evaluate(LINE_JS, "track-line-pending")
                r["buyer_line_confirmed"] = await pg.evaluate(LINE_JS, "track-line-confirmed")
                r["buyer_count"] = await pg.locator('[data-testid="track-step-count"]').inner_text() if await pg.locator('[data-testid="track-step-count"]').count() else None
                r["buyer_labels"] = await pg.evaluate("""()=>['pending','confirmed','processing'].map(s=>document.querySelector(`[data-testid="track-step-${s}"]`)?.getAttribute('aria-label'))""")
                r["buyer_overflow"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/buyer-{key}-confirmed.png")

                # live move while the page is open: admin marks packing, buyer page reloads data on refocus/reopen
                if w == 360:
                    api("PUT", f"/api/admin/manage/orders/{oid}", {"status": "processing"}, admin["token"])
                    await pg.evaluate("()=>window.__nav.goBack()")
                    await pg.wait_for_timeout(800)
                    await pg.evaluate(f"()=>window.__nav.navigate('OrderDetail', {{ orderId: '{oid}' }})")
                    await pg.wait_for_timeout(3500)
                    r["buyer_bar_processing"] = await pg.evaluate(BAR_JS, "track-progress-bar")
                    # cancel and reopen
                    api("PUT", f"/api/admin/manage/orders/{oid}", {"status": "cancelled"}, admin["token"])
                    await pg.evaluate("()=>window.__nav.goBack()")
                    await pg.wait_for_timeout(800)
                    await pg.evaluate(f"()=>window.__nav.navigate('OrderDetail', {{ orderId: '{oid}' }})")
                    await pg.wait_for_timeout(3500)
                    r["buyer_cancelled_banner"] = await pg.get_by_text("cancelled" if lang == "en" else "বাতিল").count()
                    r["buyer_bar_when_cancelled"] = await pg.locator('[data-testid="track-progress-bar"]').count()
                    await pg.screenshot(path=f"{SHOTS}/buyer-{key}-cancelled.png")
                r["buyer_errors"] = errs[:]
                await ctx.close()

                # ---- admin view of the cancelled order (w == 360 only) ----
                if w == 360:
                    ctx = await b.new_context(viewport={"width": w, "height": 800})
                    pg = await ctx.new_page()
                    errs = []
                    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                    await pg.add_init_script(init_script(admin, lang))
                    await pg.goto(BASE, wait_until="networkidle")
                    await pg.wait_for_timeout(3000)
                    await pg.evaluate("()=>window.__nav.navigate('AdminApp')")
                    await pg.wait_for_timeout(2500)
                    await pg.locator('[data-testid="admin-tab-orders"]').click()
                    await pg.wait_for_timeout(1500)
                    await pg.locator(f'[data-testid="order-{oid}"]').click()
                    await pg.locator('[data-testid="order-progress-bar"]').wait_for(timeout=15000)
                    await pg.wait_for_timeout(2000)
                    r["admin_cancelled_bar"] = await pg.evaluate(BAR_JS, "order-progress-bar")
                    r["admin_cancelled_next_btn"] = await pg.locator('[data-testid^="next-step-"]').count()
                    r["admin_cancelled_steps"] = await pg.evaluate("""()=>['pending','confirmed','processing','shipped'].map(s=>document.querySelector(`[data-testid="step-${s}"]`)?.getAttribute('aria-label'))""")
                    await pg.locator('[data-testid="order-progress"]').screenshot(path=f"{SHOTS}/admin-{key}-cancelled.png")
                    r["admin_cancelled_errors"] = errs[:]
                    await ctx.close()

        # ---- reduce motion: bar is at its end value straight away ----
        oid = f"ord-rm-{stamp}"
        new_order(buyer, oid)
        api("PUT", f"/api/admin/manage/orders/{oid}", {"status": "confirmed"}, admin["token"])
        ctx = await b.new_context(viewport={"width": 360, "height": 800}, reduced_motion="reduce")
        pg = await ctx.new_page()
        await pg.add_init_script(init_script(buyer, "en"))
        await pg.goto(BASE, wait_until="networkidle")
        await pg.wait_for_timeout(3000)
        await pg.evaluate(f"()=>window.__nav.navigate('OrderDetail', {{ orderId: '{oid}' }})")
        await pg.locator('[data-testid="track-progress-bar"]').wait_for(timeout=15000)
        rep["reduced_motion_buyer"] = await samples(pg, BAR_JS, "track-progress-bar", n=4, gap=60)
        await ctx.close()
        await b.close()
    stop()
    print(json.dumps(rep, indent=1, ensure_ascii=False))


asyncio.run(main())
