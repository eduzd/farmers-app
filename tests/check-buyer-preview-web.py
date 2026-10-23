"""Web check for "View as buyer" in the admin app, on a throwaway local server: after creating a shop and a product\nthe admin opens them as buyers see them; in preview nothing buys, saves or sends; hidden products and suspended shops\nopen with a warning; non-admins can't use the preview routes.\n\n  python3 tests/check-buyer-preview-web.py [shots_dir]   (needs a web export in ./dist)\n"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6400 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/buyer-preview"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="buyer-preview-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="admin-web-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/logs/buyer-preview-server.log", "a"),
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




async def cnt(pg, tid):
    return await pg.locator(f'[data-testid="{tid}"]').count()


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
        ctx = await b.new_context(viewport={"width": 390, "height": 820})
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        reqs = []
        pg.on("request", lambda r: reqs.append(f"{r.method} {r.url.replace(BASE, '')}") if r.method != "GET" and "/api/" in r.url else None)
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
        await pg.locator('[data-testid="sf-name"]').fill("ACI Agro")
        await pg.locator('[data-testid="sf-location"]').fill("Dhaka")
        await pg.locator('[data-testid="save-store"]').click()
        await pg.wait_for_timeout(2500)
        # 1. right after opening a shop
        rep["store_created_card"] = await cnt(pg, "store-created")
        rep["store_view_btn"] = await cnt(pg, "store-view-as-buyer")
        await pg.screenshot(path=f"{SHOTS}/1-shop-created.png")
        await pg.locator('[data-testid="store-created-view"]').click()
        await pg.wait_for_timeout(2500)
        rep["shop_preview"] = await cnt(pg, "shop-preview")
        rep["shop_preview_bar"] = await cnt(pg, "buyer-preview-bar")
        rep["shop_preview_name"] = await pg.locator('[data-testid="shop-name"]').last.inner_text() if await cnt(pg, "shop-name") else None
        await pg.screenshot(path=f"{SHOTS}/2-shop-preview-empty.png")
        await pg.locator('[data-testid="buyer-preview-close"]').last.click()
        await pg.wait_for_timeout(1500)
        rep["back_on_store_detail"] = await pg.locator('[data-testid="store-detail"]').last.is_visible()
        # 2. add a product from the shop, then view it as a buyer
        await pg.locator('[data-testid="store-add-product"]').last.click()
        await pg.wait_for_timeout(1500)
        await pg.locator('[data-testid="pf-name"]').fill("Miniket rice")
        await pg.locator('[data-testid^="pf-cat-"]').first.click()
        await pg.locator('[data-testid="sell-weight"]').click()
        await pg.locator('[data-testid="pf-unit-kg"]').click()
        await pg.locator('[data-testid="pf-price"]').fill("60")
        await pg.locator('[data-testid="pf-qty"]').fill("50")
        for v in ("1", "5", "10"):
            if await cnt(pg, f"pf-preset-{v}") == 0:
                await pg.locator('[data-testid="pf-preset-input"]').fill(v)
                await pg.locator('[data-testid="pf-preset-add"]').click()
                await pg.wait_for_timeout(150)
        await pg.locator('[data-testid="save-product"]').click()
        await pg.wait_for_timeout(2500)
        rep["product_created_card"] = await cnt(pg, "product-created")
        await pg.screenshot(path=f"{SHOTS}/3-product-created.png")
        await pg.locator('[data-testid="product-created-view"]').last.click()
        await pg.wait_for_timeout(2500)
        rep["product_preview"] = await cnt(pg, "product-preview")
        rep["product_preview_bar"] = await pg.locator('[data-testid="buyer-preview-bar"]').last.inner_text() if await cnt(pg, "buyer-preview-bar") else None
        rep["per_unit"] = await pg.locator('[data-testid="product-per-unit"]').last.inner_text() if await cnt(pg, "product-per-unit") else None
        rep["qty_chips"] = await pg.locator('[data-testid^="qty-chip-"]').count()
        await pg.screenshot(path=f"{SHOTS}/4-product-preview.png")
        before = list(reqs)
        await pg.locator('[data-testid="qty-chip-5"]').last.click()
        await pg.locator('[data-testid="product-add-to-cart"]').last.click()
        await pg.wait_for_timeout(500)
        rep["note_after_add"] = await pg.locator('[data-testid="buyer-preview-note"]').last.inner_text() if await cnt(pg, "buyer-preview-note") else None
        await pg.screenshot(path=f"{SHOTS}/5-add-blocked.png")
        await pg.locator('[data-testid="product-buy-now"]').last.click()
        await pg.wait_for_timeout(1200)
        rep["still_on_product_after_buy"] = await cnt(pg, "product-preview")
        rep["cart_storage"] = await pg.evaluate("()=>localStorage.getItem('cart')")
        rep["writes_during_preview"] = [r for r in reqs if r not in before]
        await pg.locator('[data-testid="buyer-preview-close"]').last.click()
        await pg.wait_for_timeout(1500)
        rep["back_on_product_detail"] = await pg.locator('[data-testid="product-detail"]').last.is_visible()
        # 3. hidden product: still opens, with a warning
        st, prods = api("GET", "/api/admin/manage/products", None, admin["token"])
        lst = prods if isinstance(prods, list) else prods.get("items", prods.get("products", []))
        rice = next(x for x in lst if x["name"] == "Miniket rice")
        st, _ = api("PUT", f"/api/admin/manage/products/{rice['id']}", {"hidden": True}, admin["token"])
        rep["hide_status"] = st
        await pg.locator('[data-testid="product-detail"]').last.evaluate("e=>0")
        await pg.evaluate("()=>window.__nav.goBack && 0")
        # products list -> eye button
        await pg.locator('[data-testid="admin-tab-shop"]').click()
        await pg.wait_for_timeout(800)
        await pg.locator('[data-testid="shop-section-products"]').last.click()
        await pg.wait_for_timeout(2000)
        rep["row_eye_buttons"] = await pg.locator('[data-testid^="product-preview-"]').count()
        await pg.screenshot(path=f"{SHOTS}/6-products-list.png")
        await pg.locator(f'[data-testid="product-preview-{rice["id"]}"]').last.click()
        await pg.wait_for_timeout(2500)
        rep["hidden_warning"] = await pg.locator('[data-testid="buyer-preview-warning"]').last.inner_text() if await cnt(pg, "buyer-preview-warning") else None
        await pg.screenshot(path=f"{SHOTS}/7-hidden-product-preview.png")
        await pg.locator('[data-testid="buyer-preview-close"]').last.click()
        await pg.wait_for_timeout(1200)
        # shops list -> eye, shop now says one product left out
        await pg.locator('[data-testid="shop-section-shops"]').last.click()
        await pg.wait_for_timeout(1500)
        st, stores = api("GET", "/api/admin/manage/stores", None, admin["token"])
        slist = stores if isinstance(stores, list) else stores.get("items", [])
        shop = next(s for s in slist if s["name"] == "ACI Agro")
        await pg.locator(f'[data-testid="shop-preview-{shop["id"]}"]').last.click()
        await pg.wait_for_timeout(2500)
        rep["shop_leftout"] = await pg.locator('[data-testid="buyer-preview-leftout"]').last.inner_text() if await cnt(pg, "buyer-preview-leftout") else None
        await pg.screenshot(path=f"{SHOTS}/8-shop-preview-leftout.png")
        await pg.locator('[data-testid="buyer-preview-close"]').last.click()
        await pg.wait_for_timeout(1000)
        rep["admin_errors"] = errs[:]
        await ctx.close()
        # 4. unhide; Bangla preview of the shop then the product from inside it
        api("PUT", f"/api/admin/manage/products/{rice['id']}", {"hidden": False}, admin["token"])
        ctx = await b.new_context(viewport={"width": 390, "height": 820})
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.add_init_script(init_script(admin, "bn"))
        await pg.goto(BASE, wait_until="networkidle")
        await pg.wait_for_timeout(3500)
        await pg.evaluate(f"()=>window.__nav.navigate('ShopPage', {{ slug: '{shop['id']}', preview: {{ kind: 'shop' }} }})")
        await pg.wait_for_timeout(2500)
        rep["bn_bar"] = await pg.locator('[data-testid="buyer-preview-bar"]').last.inner_text() if await cnt(pg, "buyer-preview-bar") else None
        await pg.screenshot(path=f"{SHOTS}/bn-1-shop-preview.png")
        await pg.locator(f'[data-testid="shop-product-{rice["id"]}"]').last.click()
        await pg.wait_for_timeout(2500)
        rep["bn_product_preview"] = await cnt(pg, "product-preview")
        await pg.locator('[data-testid="product-add-to-cart"]').last.click()
        await pg.wait_for_timeout(400)
        rep["bn_note"] = await pg.locator('[data-testid="buyer-preview-note"]').last.inner_text() if await cnt(pg, "buyer-preview-note") else None
        await pg.screenshot(path=f"{SHOTS}/bn-2-product-preview.png")
        rep["bn_errors"] = errs
        await ctx.close()
        # 5. a buyer opening the same product normally still gets working buttons, no bar
        ctx = await b.new_context(viewport={"width": 390, "height": 820})
        pg = await ctx.new_page()
        await pg.add_init_script(init_script(buyer, "en"))
        await pg.goto(BASE, wait_until="networkidle")
        await pg.wait_for_timeout(3500)
        await pg.evaluate(f"()=>window.__nav.navigate('ShopPage', {{ slug: '{shop['slug']}' }})")
        await pg.wait_for_timeout(2500)
        rep["buyer_bar"] = await cnt(pg, "buyer-preview-bar")
        await pg.locator(f'[data-testid="shop-product-{rice["id"]}"]').last.click()
        await pg.wait_for_timeout(2000)
        await pg.locator('[data-testid="product-add-to-cart"]').last.click()
        await pg.wait_for_timeout(800)
        rep["buyer_cart_after_add"] = bool(await pg.evaluate("()=>localStorage.getItem('cart')"))
        await ctx.close()
        await b.close()
    # 6. the preview routes are admin only
    rep["buyer_product_route"] = api("GET", f"/api/admin/manage/preview/products/{rice['id']}", None, buyer["token"])[0]
    rep["anon_store_route"] = api("GET", f"/api/admin/manage/preview/stores/{shop['id']}")[0]
    st, j = api("PUT", f"/api/admin/manage/stores/{shop['id']}", {"status": "suspended"}, admin["token"])
    rep["suspend_status"] = st
    st, j = api("GET", f"/api/admin/manage/preview/stores/{shop['id']}", None, admin["token"])
    rep["suspended_preview"] = (st, j.get("reasons") if isinstance(j, dict) else j)
    rep["suspended_public"] = api("GET", f"/api/stores/{shop['slug']}")[0]
    stop()
    print(json.dumps(rep, ensure_ascii=False, indent=1))


try:
    asyncio.run(main())
finally:
    stop()
