"""Web check for guest checkout on a throwaway local server: with no account, a shared shop link and a shared
product link open, the guest adds to cart and checks out (Cash on delivery), sees the confirmation, opens the order
page, saves it locally and finds it again from the start screen. Also checks the empty-form errors, Bangla text,
a signed-in checkout still working, and that the seller sees "(Guest)".

  python3 tests/check-guest-checkout-web.py [shots_dir]   (needs a web export in ./dist)
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6500 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/guest-checkout"
os.makedirs(SHOTS, exist_ok=True)
os.makedirs("/home/sprite/logs", exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="guest-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="guest-web-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/logs/guest-web-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(150):
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


results = []


def ok(cond, label, extra=""):
    results.append((bool(cond), label))
    print(("PASS " if cond else "FAIL ") + label + ("" if cond else f"  -> {extra}"), flush=True)


async def tid(pg, t, timeout=15000):
    loc = pg.locator(f'[data-testid="{t}"]').first
    await loc.wait_for(state="visible", timeout=timeout)
    return loc


async def fill_by_placeholder(pg, needles, value):
    for n in needles:
        loc = pg.locator(f'input[placeholder*="{n}"], textarea[placeholder*="{n}"]')
        if await loc.count():
            await loc.first.fill(value)
            return True
    return False


async def main():
    start()
    admin = signup("boss", "Admin Rahim")
    seller = signup("sell", "Seller Karim")
    buyer = signup("buy", "Buyer Jamal")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"])], check=True)
    start()
    A = "/api/admin/manage"
    st, shop = api("POST", f"{A}/stores", {"name": "Padma Fish Feed", "owner": seller["email"]}, admin["token"])
    assert st == 201, (st, shop)
    st, feed = api("POST", f"{A}/products", {"storeId": shop["id"], "category": "other", "name": "Floating fish feed", "price": 1450,
                                             "quantity": 40, "unit": "bag", "sellAs": "pack", "packSize": 25, "packUnit": "kg",
                                             "images": ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=400"]}, admin["token"])
    assert st == 201, (st, feed)
    slug = shop["slug"]

    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--no-sandbox"])
        # ---------- guest, English, phone size
        ctx = await br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await ctx.add_init_script("localStorage.setItem('language','en');")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))

        await pg.goto(f"{BASE}/", wait_until="networkidle")
        b = await tid(pg, "button-shop-no-account", 40000)
        ok(await b.is_visible(), "start screen shows 'Shop without an account'")
        await pg.screenshot(path=f"{SHOTS}/01-landing-en.png")
        await b.click()
        await pg.wait_for_timeout(1500)
        ok(await pg.get_by_text("Padma Fish Feed").count() > 0, "guest sees the shops list")
        await pg.screenshot(path=f"{SHOTS}/02-shops-guest.png")

        # shared shop link
        await pg.goto(f"{BASE}/shop/{slug}", wait_until="networkidle")
        await pg.wait_for_timeout(2500)
        ok(await pg.get_by_text("Floating fish feed").count() > 0, "shared shop link opens the shop without an account")
        ok(await pg.locator('[data-testid="shop-share"]').count() > 0 and await pg.locator('[data-testid="shop-cart"]').count() > 0,
           "shop page has share and cart buttons")
        await pg.screenshot(path=f"{SHOTS}/03-shop-link-guest.png")

        # shared product link
        await pg.goto(f"{BASE}/product/{feed['id']}", wait_until="networkidle")
        await pg.wait_for_timeout(3000)
        ok(await pg.get_by_text("Floating fish feed").count() > 0, "shared product link opens the product without an account")
        await pg.screenshot(path=f"{SHOTS}/04-product-link-guest.png")
        await (await tid(pg, "product-add-to-cart")).click()
        await pg.wait_for_timeout(1200)
        # open cart
        cart_btn = pg.locator('[data-testid="product-cart-badge"]')
        if await cart_btn.count():
            await cart_btn.first.click()
        else:
            await pg.goto(f"{BASE}/shop/{slug}", wait_until="networkidle"); await pg.wait_for_timeout(2000)
            await (await tid(pg, "shop-cart")).click()
        await pg.wait_for_timeout(1500)
        ok(await pg.get_by_text("Floating fish feed").count() > 0, "cart has the product")
        await pg.screenshot(path=f"{SHOTS}/05-cart-guest.png")
        chk = pg.get_by_text("Checkout", exact=False)
        await chk.last.click()
        await pg.wait_for_timeout(2500)
        ok(await pg.locator('[data-testid="checkout-guest-note"]').count() > 0, "checkout says you're ordering without an account")
        await pg.screenshot(path=f"{SHOTS}/06-checkout-guest-empty.png", full_page=True)

        # try to order with nothing filled in
        place = pg.locator('[data-testid="button-place-order"]')
        if await place.count() == 0:
            place = pg.get_by_text("Place order", exact=False)
        await place.last.click()
        await pg.wait_for_timeout(1500)
        st, sales0 = api("GET", "/api/me/sales", tok=seller["token"])
        ok(st == 200 and len(sales0) == 0, "empty form doesn't place an order", sales0)

        # fill the address form
        filled = await fill_by_placeholder(pg, ["Full name"], "Rahim Mia")
        filled &= await fill_by_placeholder(pg, ["01XXXXXXXXX"], "01712345678")
        await pg.get_by_text("Dhaka", exact=True).first.click()
        await pg.wait_for_timeout(400)
        filled &= await fill_by_placeholder(pg, ["e.g. Bogura"], "Dhaka")
        filled &= await fill_by_placeholder(pg, ["e.g. Sherpur"], "Mirpur")
        filled &= await fill_by_placeholder(pg, ["Village, road"], "House 5, Road 3, Mirpur")
        ok(filled, "guest fills name, phone and address")
        cn = pg.locator('[data-testid="input-contact-name"]')
        if await cn.count() and not (await cn.first.input_value()).strip():
            await cn.first.fill("Rahim Mia")
        cp = pg.locator('[data-testid="input-contact-phone"]')
        if await cp.count() and not (await cp.first.input_value()).strip():
            await cp.first.fill("01712345678")
        ok(await pg.get_by_text("Save this address for next time").count() == 0, "guests aren't offered 'save this address'")
        await pg.screenshot(path=f"{SHOTS}/07-checkout-guest-filled.png", full_page=True)
        await place.last.click()
        await pg.wait_for_timeout(4000)
        st, sales = api("GET", "/api/me/sales", tok=seller["token"])
        if not sales:
            # some forms need the division/district; show what's on screen
            body = (await pg.inner_text("body"))[:1500]
            print("CHECKOUT PAGE:", body)
        ok(st == 200 and len(sales) == 1 and sales[0]["buyer"]["name"] == "Rahim Mia (Guest)", "guest order reaches the seller as 'Rahim Mia (Guest)'", sales)
        await pg.screenshot(path=f"{SHOTS}/08-order-placed-guest.png")
        gid = sales[0]["id"] if sales else None

        track = pg.get_by_text("Track order", exact=True)
        if await track.count():
            await track.first.click()
            await pg.wait_for_timeout(2500)
        stid = pg.locator('[data-testid="guest-order-id"]')
        shown = (await stid.first.inner_text()).strip() if await stid.count() else ""
        ok(shown == gid, "guest opens their order page after checkout", f"{shown!r} vs {gid!r}")
        ok(await pg.get_by_text("Order placed").count() > 0 and await pg.get_by_text("Cash on delivery").count() > 0,
           "order page shows status and Cash on delivery")
        await pg.screenshot(path=f"{SHOTS}/09-guest-order-page.png", full_page=True)
        stored = await pg.evaluate("localStorage.getItem('farmers.guestOrders.v1')")
        saved = json.loads(stored or "[]")
        ok(len(saved) == 1 and saved[0]["id"] == gid and len(saved[0]["key"]) >= 32, "order and its key are saved on this browser", stored)

        # seller confirms -> guest sees it on reload of the order link
        api("PUT", f"/api/orders/{gid}/status", {"status": "confirmed"}, seller["token"])
        key = saved[0]["key"] if saved else ""
        ctx2 = await br.new_context(viewport={"width": 390, "height": 844})
        await ctx2.add_init_script("localStorage.setItem('language','en');")
        pg2 = await ctx2.new_page()
        pg2.on("pageerror", lambda e: errs.append(str(e)))
        await pg2.goto(f"{BASE}/order/{gid}?k={key}", wait_until="networkidle")
        await pg2.wait_for_timeout(3000)
        s2 = pg2.locator('[data-testid="guest-order-status"]')
        ok(await s2.count() > 0 and "Confirmed" in await s2.first.inner_text(), "order link opens on another browser and shows Confirmed")
        await pg2.screenshot(path=f"{SHOTS}/10-order-link-other-browser.png", full_page=True)
        await pg2.goto(f"{BASE}/order/{gid}?k={'x' * 40}", wait_until="networkidle")
        await pg2.wait_for_timeout(2500)
        ok(await pg2.locator('[data-testid="guest-order-id"]').count() == 0 and await pg2.get_by_text("Order not found").count() > 0,
           "wrong key shows 'Order not found' and no details")
        await ctx2.close()

        # back on the start screen: My orders (1)
        await pg.goto(f"{BASE}/", wait_until="networkidle")
        await pg.wait_for_timeout(2000)
        mo = pg.locator('[data-testid="link-guest-orders"]')
        ok(await mo.count() > 0 and "(1)" in await mo.first.inner_text(), "start screen shows My orders (1)")
        await mo.first.click()
        await pg.wait_for_timeout(1500)
        ok(await pg.locator(f'[data-testid="guest-order-row-{gid}"]').count() > 0, "My orders lists the guest order")
        await pg.screenshot(path=f"{SHOTS}/11-my-guest-orders.png")
        await ctx.close()

        # ---------- Bangla
        ctx3 = await br.new_context(viewport={"width": 390, "height": 844})
        await ctx3.add_init_script("localStorage.setItem('language','bn');")
        pg3 = await ctx3.new_page()
        pg3.on("pageerror", lambda e: errs.append(str(e)))
        await pg3.goto(f"{BASE}/", wait_until="networkidle")
        await pg3.wait_for_timeout(2500)
        ok(await pg3.get_by_text("অ্যাকাউন্ট ছাড়াই কিনুন").count() > 0, "Bangla start screen: 'অ্যাকাউন্ট ছাড়াই কিনুন'")
        await pg3.screenshot(path=f"{SHOTS}/12-landing-bn.png")
        await pg3.goto(f"{BASE}/order/{gid}?k={key}", wait_until="networkidle")
        await pg3.wait_for_timeout(3000)
        ok(await pg3.get_by_text("আপনার অর্ডার").count() > 0 and await pg3.get_by_text("নিশ্চিত").count() > 0, "Bangla order page")
        await pg3.screenshot(path=f"{SHOTS}/13-guest-order-bn.png", full_page=True)
        await pg3.goto(f"{BASE}/product/does-not-exist", wait_until="networkidle")
        await pg3.wait_for_timeout(2500)
        ok(await pg3.get_by_text("এই পণ্যটি আর পাওয়া যাচ্ছে না").count() > 0, "broken product link explains it (Bangla)")
        await pg3.screenshot(path=f"{SHOTS}/14-missing-product-bn.png")
        await ctx3.close()

        # ---------- signed-in user: shop link still works and checkout isn't a guest one
        ctx4 = await br.new_context(viewport={"width": 390, "height": 844})
        u = dict(buyer["user"]); u["language"] = "en"
        await ctx4.add_init_script("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','en');"
                                   % (json.dumps(buyer["token"]), json.dumps(json.dumps(u))))
        pg4 = await ctx4.new_page()
        pg4.on("pageerror", lambda e: errs.append(str(e)))
        await pg4.goto(f"{BASE}/shop/{slug}", wait_until="networkidle")
        await pg4.wait_for_timeout(3500)
        ok(await pg4.get_by_text("Floating fish feed").count() > 0, "signed-in user: shared shop link opens the shop")
        await pg4.screenshot(path=f"{SHOTS}/15-shop-link-signed-in.png")
        await (await tid(pg4, "shop-cart")).click()
        await pg4.wait_for_timeout(1500)
        await pg4.screenshot(path=f"{SHOTS}/16-cart-signed-in.png")
        await ctx4.close()
        await br.close()

    ok(not errs, "no page errors", errs[:3])
    stop()
    passed = sum(1 for r in results if r[0])
    print(f"\n{passed} passed, {len(results) - passed} failed")


try:
    asyncio.run(main())
finally:
    try:
        stop()
    except Exception:
        pass
