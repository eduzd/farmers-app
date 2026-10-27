"""Web check for the pages the whole-app Maya check could not reach, plus the market clean-up and the web calculator:
product page, cart and checkout (no order placed) with sample products, admin Carousel ads (EN/BN), the Bepari
calculator in Bangla, market header and rows, the 3 s typing pause and the saved-list slide-up sheet on web.

    python3 tests/check-maya-gaps-web.py [shots_dir]   (needs a web export in ./dist)
"""
import asyncio, sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "check-maya-every-page-web.py")).read()
SCAN = re.search(r'SCAN = """(.*?)"""', src, re.S).group(1).encode().decode("unicode_escape")

h = H("maya-gaps")
h.start()
admin = h.signup("boss", "Admin Rahim")
seller = h.signup("sell", "Seller Karim")
h.make_admin(admin)
A = "/api/admin/manage"
st, shop = h.api("POST", f"{A}/stores", {"name": "Padma Fresh", "owner": seller["email"]}, admin["token"])
assert st == 201, (st, shop)
prods = []
for body in [
    {"category": "vegetables", "name": "Fresh tomatoes", "price": 80, "quantity": 200, "unit": "kg",
     "images": ["https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=400"]},
    {"category": "fruits", "name": "Rajshahi mangoes", "price": 120, "quantity": 150, "unit": "kg",
     "images": ["https://images.unsplash.com/photo-1553279768-865429fa0078?w=400"]},
    {"category": "other", "name": "Floating fish feed", "price": 1450, "quantity": 40, "unit": "bag", "sellAs": "pack",
     "packSize": 25, "packUnit": "kg", "images": ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=400"]},
]:
    st, p = h.api("POST", f"{A}/products", {"storeId": shop["id"], **body}, admin["token"])
    h.ok(st == 201, f"sample product made: {body['name']}", (st, p))
    if st == 201:
        prods.append(p)
st, ad = h.api("POST", f"{A}/ads", {"titleEn": "Monsoon feed offer", "titleBn": "বর্ষার খাবার অফার", "subtitleEn": "10% off", "placement": "home"}, admin["token"])
print("ad create", st, str(ad)[:160])


def maya(r, lang, name):
    f = r["fonts"]
    jak = sum(v for k, v in f.items() if "Jakarta" in k)
    dm = sum(v for k, v in f.items() if k.startswith("DMSans") or k == "DM Sans" or k.startswith("Anton"))
    h.ok(not r["old"], f"{lang} {name}: no old Farmers green", json.dumps(r["old"], ensure_ascii=False))
    h.ok(not r["stray"], f"{lang} {name}: no other stray green/teal", json.dumps(r["stray"], ensure_ascii=False))
    h.ok(jak == 0, f"{lang} {name}: no Plus Jakarta text", str(f))
    h.ok(r["sky"] + r["navy"] > 0, f"{lang} {name}: Maya colours in use", str({k: r[k] for k in ('sky', 'pink', 'navy')}))
    if lang == "en":
        h.ok(dm > 0, f"en {name}: DM Sans text", str(f))
    h.ok(not r["wide"], f"{lang} {name}: nothing wider than the phone screen")


async def click_text(pg, en, bn, lang, timeout=8000):
    want = bn if lang == "bn" else en
    for cand in (pg.get_by_text(want, exact=True), pg.get_by_text(en, exact=True), pg.get_by_text(want)):
        if await cand.count():
            await cand.first.scroll_into_view_if_needed(timeout=timeout)
            await cand.first.click(timeout=timeout)
            return True
    return False


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            # ---- market tab: header and rows
            ctx, pg = await h.page(b, admin, lang, 390, path="/", h=844)
            await pg.locator('[role="tab"]').nth(2).click()
            await pg.wait_for_timeout(3500)
            body = await pg.inner_text("body")
            await pg.screenshot(path=f"{h.shots}/{lang}-market.png")
            gone = [w for w in ["Flash Sale", "Flash sale", "Ocean", "Black Water", "Black water", "Market Price", "Compare", "Newest", "Nearby",
                                "Price: Low", "Price: High", "Price low", "Price high", "ফ্ল্যাশ", "সাগর", "নতুন আগে", "কাছাকাছি"] if w in body]
            h.ok(not gone, f"{lang} market: promo shortcuts and sort row gone", gone)
            h.ok(await pg.get_by_text("Fresh tomatoes").count() > 0, f"{lang} market: products listed")
            cats = await pg.evaluate("""()=>[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).overflowX==='auto'||getComputedStyle(d).overflowX==='scroll').map(d=>d.innerText.replace(/\\n+/g,'|').slice(0,120))""")
            print(lang, "horizontal rows:", cats)
            all_lbl = "সব" if lang == "bn" else "All"
            h.ok(any(c.split("|")[0].strip() == all_lbl for c in cats), f"{lang} market: category row (All, ...) kept", cats)
            hdr = await pg.evaluate("""()=>{const r=[];for(const e of document.querySelectorAll('[aria-label],[data-testid]')){const b=e.getBoundingClientRect();if(b.top<110&&b.width&&b.height&&b.left>200)r.push(e.getAttribute('aria-label')||e.dataset.testid)}return r}""")
            print(lang, "top-right controls:", hdr)
            top_text = await pg.evaluate("""()=>{const r=[];for(const e of document.querySelectorAll('body *')){const b=e.getBoundingClientRect();if(b.top<110&&b.height&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))r.push(e.innerText.trim())}return r}""")
            h.ok(not any(t.lower() in ("sale", "sell", "বিক্রি", "বিক্রয়") for t in top_text), f"{lang} market: no Sale/Sell text at top", top_text)
            h.ok(await pg.locator(T("market-bell")).count() > 0, f"{lang} market: notification bell at top")
            h.ok(any("Cart" in (x or "") or "কার্ট" in (x or "") for x in hdr), f"{lang} market: cart at top", hdr)
            h.ok(not any((x or "").lower() in ("add", "sell", "add listing", "new listing") or "plus" in (x or "").lower() for x in hdr), f"{lang} market: no plus/sell button at top", hdr)
            maya(await pg.evaluate(SCAN), lang, "market")
            await ctx.close()

            # ---- product page, cart, checkout (no order placed)
            if prods:
                ctx, pg = await h.page(b, admin, lang, 390, path=f"/product/{prods[0]['id']}", h=844)
                await pg.wait_for_timeout(3000)
                ok_p = await pg.get_by_text("Fresh tomatoes").count() > 0
                h.ok(ok_p, f"{lang} product page opens")
                await pg.screenshot(path=f"{h.shots}/{lang}-product.png")
                maya(await pg.evaluate(SCAN), lang, "product page")
                h.ok(await pg.locator(T("product-add-to-cart")).count() > 0 and await pg.locator(T("product-buy-now")).count() > 0,
                     f"{lang} product page: Add to Cart and Buy Now")
                try:
                    await pg.locator(T("product-add-to-cart")).first.click(timeout=8000)
                    await pg.wait_for_timeout(1500)
                    await pg.locator(T("product-cart-badge")).first.click(timeout=8000)
                    await pg.wait_for_timeout(2500)
                    h.ok(await pg.get_by_text("Fresh tomatoes").count() > 0, f"{lang} cart has the product")
                    await pg.screenshot(path=f"{h.shots}/{lang}-cart.png")
                    maya(await pg.evaluate(SCAN), lang, "cart")
                    chk = pg.get_by_text("চেকআউট" if lang == "bn" else "Checkout", exact=False)
                    if not await chk.count():
                        chk = pg.get_by_text("Checkout", exact=False)
                    await chk.last.click(timeout=8000)
                    await pg.wait_for_timeout(3000)
                    h.ok(await pg.locator(T("button-place-order")).count() > 0 or await pg.get_by_text("Place order", exact=False).count() > 0
                         or await pg.get_by_text("অর্ডার", exact=False).count() > 0, f"{lang} checkout opens")
                    await pg.screenshot(path=f"{h.shots}/{lang}-checkout.png", full_page=True)
                    maya(await pg.evaluate(SCAN), lang, "checkout")
                except Exception as e:
                    h.ok(False, f"{lang} cart/checkout reached", str(e)[:200])
                await ctx.close()

            # ---- admin carousel ads
            ctx, pg = await h.page(b, admin, lang, 390, path="/admin", h=844)
            await pg.wait_for_timeout(2500)
            reached = False
            try:
                # Carousel ads is a shortcut on the admin Home tab
                await pg.locator(T("shortcut-ads")).first.scroll_into_view_if_needed(timeout=10000)
                await pg.locator(T("shortcut-ads")).first.click(timeout=10000)
                reached = True
                await pg.wait_for_timeout(2500)
                txt = await pg.inner_text("body")
                reached = reached and ("Ads slide in the carousel" in txt or "ক্যারোসেলে" in txt)
            except Exception as e:
                print("carousel err", str(e)[:200])
            h.ok(reached, f"{lang} admin Carousel ads: screen reached")
            await pg.screenshot(path=f"{h.shots}/{lang}-admin-carousel-ads.png", full_page=True)
            maya(await pg.evaluate(SCAN), lang, "admin Carousel ads")
            await ctx.close()

            # ---- calculators: Bepari (both langs), typing pause and saved sheet
            for calc, en, bn in (("bepari", "Bepari calculator", "ব্যাপারী ক্যালকুলেটর"), ("arat", "Arat calculator", "আড়ত ক্যালকুলেটর")):
                ctx, pg = await h.page(b, admin, lang, 390, path="/", h=844)
                await pg.wait_for_timeout(2000)
                reached = await click_text(pg, "Calculate", "হিসাব", lang)
                await pg.wait_for_timeout(2000)
                reached = reached and await click_text(pg, en, bn, lang)
                await pg.wait_for_timeout(2500)
                h.ok(reached, f"{lang} {calc} calculator: screen reached")
                await pg.screenshot(path=f"{h.shots}/{lang}-{calc}.png")
                maya(await pg.evaluate(SCAN), lang, f"{calc} calculator")
                # typing pause: type a digit in the first numeric box, focus should stay ~3 s after both fields are filled
                inputs = pg.locator('input[inputmode="decimal"], input[inputmode="numeric"]')
                n = await inputs.count()
                if n >= 2:
                    await inputs.nth(0).click(); await pg.keyboard.type("120")
                    await pg.wait_for_timeout(600)
                    await inputs.nth(1).click(); await pg.keyboard.type("5")
                    await pg.wait_for_timeout(1200)
                    same = await pg.evaluate("(el)=>document.activeElement===el", await inputs.nth(1).element_handle())
                    await pg.wait_for_timeout(3000)
                    moved = not await pg.evaluate("(el)=>document.activeElement===el", await inputs.nth(1).element_handle())
                    h.ok(same, f"{lang} {calc}: cursor waits after typing (still in the box at 1.2 s)")
                    h.ok(moved, f"{lang} {calc}: cursor moves on after the 3 s pause")
                else:
                    print(calc, "numeric inputs found:", n)
                # saved sheet
                try:
                    await pg.locator(T("calc-saved-open")).first.click(timeout=8000)
                    await pg.wait_for_timeout(1500)
                    sheet = pg.locator(T("calc-saved-sheet")).first
                    bb = await sheet.bounding_box()
                    h.ok(bb is not None and abs(bb["y"] + bb["height"] - 844) < 3 and bb["y"] > 100,
                         f"{lang} {calc}: saved icon opens the list as a bottom slide-up sheet", bb)
                    await pg.screenshot(path=f"{h.shots}/{lang}-{calc}-saved.png")
                    await pg.mouse.click(195, 60)
                    await pg.wait_for_timeout(1000)
                    h.ok(not await pg.locator(T("calc-saved-sheet")).first.is_visible(), f"{lang} {calc}: tapping outside closes the sheet")
                except Exception as e:
                    h.ok(False, f"{lang} {calc}: saved sheet", str(e)[:200])
                await ctx.close()
        await b.close()

asyncio.run(main())
h.done()
