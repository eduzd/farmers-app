"""Web check for shop selling units on a throwaway local server: admin opens a company shop and adds a product\nsold by kg from the dashboard; a buyer sees the shop in Market, its page, and the product page amount picker, cart.\n\n  python3 tests/check-shop-units-web.py [shots_dir]   (needs a web export in ./dist)\n"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6200 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/shop-units"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="shop-units-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="admin-web-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/shop-units-server.log", "a"),
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


def init_script(acc, lang):
    u = dict(acc["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))



async def main():
    rep = {}
    start()
    admin = signup("boss", "Admin Rahim")
    buyer = signup("buy", "Buyer Karim")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"])], check=True)
    start()
    st, j = api("POST", "/api/auth/login", {"email": admin["email"], "password": "Check-pass-123"})
    admin["token"], admin["user"] = j["token"], j["user"]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- 1. admin opens a company shop and adds a product sold by kg, all through the dashboard
        ctx = await b.new_context(viewport={"width": 390, "height": 820})
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        await pg.add_init_script(init_script(admin, "en"))
        await pg.goto(BASE, wait_until="networkidle")
        await pg.wait_for_timeout(3500)
        await pg.evaluate("()=>window.__nav.navigate('AdminApp')")
        await pg.wait_for_timeout(2500)
        await pg.locator('[data-testid="admin-tab-shop"]').click()
        await pg.wait_for_timeout(1200)
        await pg.locator('[data-testid="shop-section-shops"]').click()
        await pg.wait_for_timeout(1200)
        await pg.locator('[data-testid="add-shop"]').click()
        await pg.wait_for_timeout(1200)
        rep["company_tile"] = await pg.locator('[data-testid="store-kind-company"]').count()
        await pg.locator('[data-testid="sf-name"]').fill("ACI Agro")
        await pg.locator('[data-testid="sf-location"]').fill("Dhaka")
        await pg.screenshot(path=f"{SHOTS}/1-open-company-shop.png", full_page=True)
        await pg.locator('[data-testid="save-store"]').click()
        await pg.wait_for_timeout(2500)
        rep["store_company_row"] = await pg.locator('[data-testid="store-company"]').count()
        await pg.screenshot(path=f"{SHOTS}/2-company-shop.png", full_page=True)
        await pg.locator('[data-testid="store-add-product"]').click()
        await pg.wait_for_timeout(1500)
        await pg.locator('[data-testid="pf-name"]').fill("Miniket rice")
        await pg.locator('[data-testid^="pf-cat-"]').first.click()
        await pg.locator('[data-testid="sell-weight"]').click()
        await pg.locator('[data-testid="pf-unit-kg"]').click()
        await pg.locator('[data-testid="pf-price"]').fill("60")
        await pg.locator('[data-testid="pf-qty"]').fill("50")
        await pg.locator('[data-testid="pf-min"]').fill("1")
        await pg.locator('[data-testid="pf-max"]').fill("20")
        await pg.locator('[data-testid="pf-step"]').fill("0.5")
        await pg.locator('[data-testid="pf-presets"]').fill("1, 5, 10")
        await pg.wait_for_timeout(500)
        await pg.locator('[data-testid="pf-preview"]').scroll_into_view_if_needed()
        await pg.screenshot(path=f"{SHOTS}/3-product-form.png", full_page=True)
        await pg.locator('[data-testid="save-product"]').click()
        await pg.wait_for_timeout(2500)
        st, stores = api("GET", "/api/stores")
        shop = next((s for s in stores if s["name"] == "ACI Agro"), None)
        rep["shop_api"] = shop and {k: shop.get(k) for k in ("companyShop", "products", "slug")}
        st, page = api("GET", f"/api/stores/{shop['slug']}") if shop else (0, {})
        rice = next((x for x in page.get("products", []) if x["name"] == "Miniket rice"), None)
        rep["rice_saved"] = rice and {k: rice.get(k) for k in ("unit", "sellAs", "step", "minOrder", "maxOrder", "presets", "quantity", "price")}
        rep["admin_errors"] = errs[:]
        await ctx.close()
        # a pack product made through the API for the cart check
        st, feed = api("POST", "/api/admin/manage/products", {"storeId": shop["id"], "name": "Fish feed", "category": "other", "price": 1500, "quantity": 40,
                                                              "unit": "bag", "sellAs": "pack", "packSize": 25, "packUnit": "kg"}, admin["token"])
        rep["feed_created"] = st
        # ---- 2. buyer: Market shows the shop, the shop page lists rice, product page follows the admin's settings
        for lang in ("en", "bn"):
            ctx = await b.new_context(viewport={"width": 390, "height": 820})
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
            await pg.add_init_script(init_script(buyer, lang))
            await pg.goto(BASE, wait_until="networkidle")
            await pg.wait_for_timeout(3500)
            await pg.evaluate("()=>window.__nav.navigate('Main', { screen: 'Market' })")
            await pg.wait_for_timeout(3000)
            r = {}
            r["market_shop_card"] = await pg.locator(f'[data-testid="market-shop-{shop["slug"]}"]').count()
            if r["market_shop_card"]:
                await pg.locator(f'[data-testid="market-shop-{shop["slug"]}"]').scroll_into_view_if_needed()
                await pg.screenshot(path=f"{SHOTS}/{lang}-4-market.png")
                await pg.locator(f'[data-testid="market-shop-{shop["slug"]}"]').click()
            else:
                await pg.evaluate(f"()=>window.__nav.navigate('ShopPage', {{ slug: '{shop['slug']}' }})")
            await pg.wait_for_timeout(2500)
            r["shop_page"] = await pg.locator('[data-testid="shop-page"]').count()
            r["shop_name"] = await pg.locator('[data-testid="shop-name"]').inner_text() if await pg.locator('[data-testid="shop-name"]').count() else None
            await pg.screenshot(path=f"{SHOTS}/{lang}-5-shop-page.png")
            await pg.locator(f'[data-testid="shop-product-{rice["id"]}"]').click()
            await pg.wait_for_timeout(2500)
            r["per_unit"] = await pg.locator('[data-testid="product-per-unit"]').inner_text()
            r["chips"] = await pg.locator('[data-testid^="qty-chip-"]').count()
            r["rules"] = await pg.locator('[data-testid="product-amount-rules"]').inner_text()
            await pg.locator('[data-testid="qty-chip-5"]').click()
            await pg.wait_for_timeout(300)
            await pg.locator('[data-testid="product-qty-plus"]').click()
            await pg.wait_for_timeout(300)
            r["qty_after"] = await pg.locator('[data-testid="product-qty-input"]').input_value()
            r["summary"] = await pg.locator('[data-testid="product-amount-summary"]').inner_text()
            await pg.locator('[data-testid="product-amount-box"]').scroll_into_view_if_needed()
            await pg.screenshot(path=f"{SHOTS}/{lang}-6-product.png")
            # typing an amount off the step snaps to the nearest step
            await pg.locator('[data-testid="product-qty-input"]').fill("7.3")
            await pg.locator('[data-testid="product-qty-input"]').blur()
            await pg.wait_for_timeout(300)
            r["typed_7_3"] = await pg.locator('[data-testid="product-qty-input"]').input_value()
            await pg.locator('[data-testid="product-qty-input"]').fill("99")
            await pg.locator('[data-testid="product-qty-input"]').blur()
            await pg.wait_for_timeout(300)
            r["typed_99"] = await pg.locator('[data-testid="product-qty-input"]').input_value()
            await pg.locator('[data-testid="qty-chip-5"]').click()
            await pg.locator('[data-testid="product-qty-plus"]').click()
            await pg.locator('[data-testid="product-add-to-cart"]').click()
            await pg.wait_for_timeout(800)
            # fish feed: whole bags
            await pg.evaluate(f"()=>window.__nav.navigate('ShopPage', {{ slug: '{shop['slug']}' }})")
            await pg.wait_for_timeout(1500)
            await pg.locator(f'[data-testid="shop-product-{feed["id"]}"]').last.click()
            await pg.wait_for_timeout(2000)
            r["feed_per_unit"] = await pg.locator('[data-testid="product-per-unit"]').last.inner_text()
            await pg.locator('[data-testid="product-qty-plus"]').last.click()
            await pg.locator('[data-testid="product-qty-plus"]').last.click()
            r["feed_summary"] = await pg.locator('[data-testid="product-amount-summary"]').last.inner_text()
            await pg.locator('[data-testid="product-buy-now"]').last.click()
            await pg.wait_for_timeout(2500)
            r["cart_text"] = (await pg.evaluate("()=>document.body.innerText"))[:1500]
            await pg.screenshot(path=f"{SHOTS}/{lang}-7-cart.png", full_page=True)
            plus = pg.locator(f'[data-testid="cart-plus-{rice["id"]}"]')
            if await plus.count():
                await plus.click()
                await pg.wait_for_timeout(400)
                r["cart_after_plus"] = "6 kg" in (await pg.evaluate("()=>document.body.innerText")) or "৬ কেজি" in (await pg.evaluate("()=>document.body.innerText"))
            r["errors"] = errs
            rep[lang] = r
            await ctx.close()
        await b.close()
    stop()
    print(json.dumps(rep, ensure_ascii=False, indent=1))


try:
    asyncio.run(main())
finally:
    stop()
