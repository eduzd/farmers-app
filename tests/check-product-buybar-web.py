"""Web check for the product page purchase bar and amount picker on a throwaway local server.

- The bottom bar holds only two buttons: Add to Cart (cart icon + words) on the left and Buy Now (words only,
  a different colour) on the right. No amount box or other control in the bar.
- Under the name, rating and price, "How much do you want?" has a dropdown of the product's amounts (kg, packet...)
  and a minus / plus count next to it. Amount = size x count, kept inside the product's limits and stock.
- Add to Cart and Buy Now put that amount in the cart; Buy Now opens the cart. Out of stock disables both.
- English and Bangla, light and dark, phone (360, 390) and desktop (1280), signed in and guest; no sideways overflow.

  python3 tests/check-product-buybar-web.py [shots_dir]   (needs a web export in ./dist)
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T  # noqa: E402

h = H("product-buybar")
if h.port in (6665, 6666, 6667, 6668, 6669, 6697):  # ports Chrome refuses
    h.port = 6710
    h.base = f"http://127.0.0.1:{h.port}"

BAR_JS = """() => {
  const add = [...document.querySelectorAll('[data-testid="product-add-to-cart"]')].filter(e => e.offsetWidth).pop();
  const buy = [...document.querySelectorAll('[data-testid="product-buy-now"]')].filter(e => e.offsetWidth).pop();
  if (!add || !buy) return null;
  // the bar = the closest ancestor holding both buttons
  let bar = add.parentElement; while (bar && !bar.contains(buy)) bar = bar.parentElement;
  const outer = bar.parentElement;
  const r = (e) => { const b = e.getBoundingClientRect(); return {x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom}; };
  const bg = (e) => { let p = e; for (let i = 0; i < 3 && p; i++) { const c = getComputedStyle(p).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') return c; p = p.firstElementChild; } return null; };
  const clickable = [...outer.querySelectorAll('[tabindex], input, button, [role="button"]')].filter(e => e.offsetWidth);
  return {
    add: r(add), buy: r(buy), vw: innerWidth, vh: innerHeight,
    addText: add.innerText.trim(), buyText: buy.innerText.trim(),
    addSvg: add.querySelectorAll('svg').length, buySvg: buy.querySelectorAll('svg').length,
    addBg: bg(add), buyBg: bg(buy),
    controls: clickable.length, inputs: outer.querySelectorAll('input').length,
    addDisabled: add.getAttribute('aria-disabled'), buyDisabled: buy.getAttribute('aria-disabled'),
  };
}"""

Y_JS = """(id) => { const e = [...document.querySelectorAll(`[data-testid="${id}"]`)].filter(e => e.offsetWidth).pop(); return e ? e.getBoundingClientRect().top + scrollY : null; }"""


async def vis(pg, tid):
    return pg.locator(T(tid)).locator("visible=true").last


async def main():
    h.start()
    admin = h.signup("boss", "Admin Rahim")
    seller = h.signup("sell", "Seller Karim")
    buyer = h.signup("buy", "Buyer Jamal")
    h.make_admin(admin)
    A = "/api/admin/manage"
    st, shop = h.api("POST", f"{A}/stores", {"name": "Padma Agro", "owner": seller["email"]}, admin["token"])
    h.ok(st == 201, "seed shop", (st, shop))
    seeds = {
        "rice": {"name": "Miniket rice", "category": "other", "price": 60, "quantity": 50, "unit": "kg", "sellAs": "weight",
                 "step": 1, "minOrder": 1, "maxOrder": 20, "presets": [1, 5, 10]},
        "feed": {"name": "Fish feed", "category": "other", "price": 95, "quantity": 30, "unit": "packet", "sellAs": "pack",
                 "packSize": 1, "packUnit": "kg"},
        "gone": {"name": "Sold out mango", "category": "fruits", "price": 120, "quantity": 0, "unit": "kg", "sellAs": "weight"},
    }
    prods = {}
    for k, body in seeds.items():
        st, pr = h.api("POST", f"{A}/products", {"storeId": shop["id"], **body}, admin["token"])
        h.ok(st == 201, f"seed product {k}", (st, pr if st != 201 else pr.get("id")))
        prods[k] = pr

    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        runs = [("en", 390, "light", buyer), ("bn", 360, "light", buyer), ("en", 390, "dark", buyer), ("bn", 390, "dark", None),
                ("en", 1280, "light", None)]
        for lang, w, scheme, acc in runs:
            tag = f"{lang}-{w}-{scheme}-{'guest' if not acc else 'buyer'}"
            ctx = await b.new_context(viewport={"width": w, "height": 820}, color_scheme=scheme, device_scale_factor=2 if w < 500 else 1)
            if acc:
                await ctx.add_init_script(h.init_script(acc, lang))
            else:
                await ctx.add_init_script("localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);" % json.dumps(lang))
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, t=tag: h.errors.append(f"{t}: {str(e)[:200]}"))
            pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(h.base + f"/product/{prods['rice']['id']}", wait_until="load", timeout=180000)
            ok = await h.wait_for(pg, "product-buy-now", 30000)
            h.ok(ok, f"{tag}: product page opens")
            if not ok:
                await pg.screenshot(path=f"{h.shots}/{tag}-fail.png")
                await ctx.close()
                continue
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f"{h.shots}/{tag}-1-product.png")

            bar = await pg.evaluate(BAR_JS)
            en = lang == "en"
            h.ok(bar and bar["controls"] == 2 and bar["inputs"] == 0, f"{tag}: bottom bar has only the two buttons, no amount box", bar and (bar["controls"], bar["inputs"]))
            h.ok(bar["add"]["x"] < bar["buy"]["x"], f"{tag}: Add to Cart is on the left, Buy Now on the right")
            h.ok(bar["addText"] == ("Add to Cart" if en else "কার্টে যোগ করুন") and bar["addSvg"] >= 1, f"{tag}: Add to Cart shows the cart icon and its words", (bar["addText"], bar["addSvg"]))
            h.ok(bar["buyText"] == ("Buy Now" if en else "এখনই কিনুন") and bar["buySvg"] == 0, f"{tag}: Buy Now is words only, no icon", (bar["buyText"], bar["buySvg"]))
            h.ok(bar["addBg"] and bar["buyBg"] and bar["addBg"] != bar["buyBg"], f"{tag}: Buy Now is a different colour from Add to Cart", (bar["addBg"], bar["buyBg"]))
            h.ok(bar["buy"]["right"] <= bar["vw"] + 0.5 and bar["add"]["x"] >= 0 and bar["buy"]["bottom"] <= bar["vh"] + 0.5,
                 f"{tag}: both buttons fit on screen", (bar["add"], bar["buy"], bar["vw"]))
            h.ok(abs(bar["add"]["w"] - bar["buy"]["w"]) < 2, f"{tag}: the two buttons are the same width", (bar["add"]["w"], bar["buy"]["w"]))
            # the bar stays at the bottom while the page scrolls
            await pg.mouse.wheel(0, 900)
            await pg.wait_for_timeout(600)
            bar2 = await pg.evaluate(BAR_JS)
            h.ok(abs(bar2["buy"]["y"] - bar["buy"]["y"]) < 2, f"{tag}: the bar stays at the bottom while scrolling", (bar["buy"]["y"], bar2["buy"]["y"]))
            await pg.mouse.wheel(0, -2000)
            await pg.wait_for_timeout(600)

            # amount picker sits after the name, rating and price
            y_price = await pg.evaluate(Y_JS, "product-per-unit")
            y_box = await pg.evaluate(Y_JS, "product-amount-box")
            h.ok(y_price is not None and y_box is not None and y_box > y_price, f"{tag}: amount picker comes right after the price", (y_price, y_box))
            sel = await vis(pg, "product-amount-select")
            h.ok(await sel.count() == 1, f"{tag}: amount dropdown is there")
            h.ok(await (await vis(pg, "product-qty-minus")).count() == 1 and await (await vis(pg, "product-qty-plus")).count() == 1,
                 f"{tag}: minus and plus sit next to the dropdown")
            first = (await (await vis(pg, "product-amount-size")).inner_text()).strip()
            h.ok(first == ("1 kg" if en else "১ কেজি"), f"{tag}: dropdown starts on the first amount", first)
            await sel.click()
            await pg.wait_for_timeout(500)
            items = await pg.locator(T("product-amount-menu")).locator("visible=true").last.inner_text()
            h.ok(all(x in items for x in (("1 kg", "5 kg", "10 kg") if en else ("১ কেজি", "৫ কেজি", "১০ কেজি"))), f"{tag}: dropdown lists the product's amounts", items.replace("\n", " | ")[:120])
            await pg.screenshot(path=f"{h.shots}/{tag}-2-dropdown-open.png")
            await (await vis(pg, "qty-chip-5")).click()
            await pg.wait_for_timeout(400)
            h.ok(await pg.locator(T("product-amount-menu")).locator("visible=true").count() == 0, f"{tag}: dropdown closes after a pick")
            plus = await vis(pg, "product-qty-plus")
            await plus.click(); await plus.click()
            await pg.wait_for_timeout(300)
            summ = (await (await vis(pg, "product-amount-summary")).inner_text()).strip()
            h.ok(("5 kg × 3 = 15 kg" in summ and "৳900" in summ) if en else ("৫ কেজি × ৩ = ১৫ কেজি" in summ), f"{tag}: 5 kg x 3 = 15 kg and its price", summ)
            for _ in range(3):
                if await plus.is_enabled():
                    await plus.click()
            await pg.wait_for_timeout(300)
            cnt = await (await vis(pg, "product-qty-input")).input_value()
            h.ok(cnt == "4" and not await plus.is_enabled(), f"{tag}: plus stops at the maximum (20 kg = 4 x 5 kg)", cnt)
            inp = await vis(pg, "product-qty-input")
            await inp.fill("2")
            await inp.blur()
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{h.shots}/{tag}-3-picked.png")
            h.ok(await h.no_overflow(pg), f"{tag}: no sideways overflow")

            await (await vis(pg, "product-add-to-cart")).click()
            await pg.wait_for_timeout(800)
            cart = await pg.evaluate("""()=>{for(const k of Object.keys(localStorage)){if(/cart/i.test(k)){try{const v=JSON.parse(localStorage.getItem(k));const items=Array.isArray(v)?v:(v.state||v).items;if(Array.isArray(items))return items.map(i=>[i.name,i.quantity])}catch(e){}}}return null}""")
            h.ok(cart and ["Miniket rice", 10] in cart, f"{tag}: Add to Cart puts 5 kg x 2 = 10 kg in the cart", cart)

            # Buy Now opens the cart
            await (await vis(pg, "product-buy-now")).click()
            await pg.wait_for_timeout(2000)
            url = pg.url
            body = await pg.evaluate("()=>document.body.innerText")
            h.ok("/product/" not in url or "Miniket rice" in body and await pg.locator(T("product-buy-now")).locator("visible=true").count() == 0,
                 f"{tag}: Buy Now opens the cart", url)
            await pg.screenshot(path=f"{h.shots}/{tag}-4-after-buy.png")

            if w == 390 and scheme == "light":
                # pack product: sizes read as packets with what is inside
                await pg.goto(h.base + f"/product/{prods['feed']['id']}", wait_until="load")
                await h.wait_for(pg, "product-amount-select", 30000)
                await pg.wait_for_timeout(800)
                sz = (await (await vis(pg, "product-amount-size")).inner_text()).strip()
                h.ok(sz == "1 packet (1 kg)", f"{tag}: pack product shows '1 packet (1 kg)'", sz)
                await (await vis(pg, "product-amount-select")).click()
                await pg.wait_for_timeout(400)
                await pg.screenshot(path=f"{h.shots}/{tag}-5-pack-dropdown.png")
                items = await pg.locator(T("product-amount-menu")).locator("visible=true").last.inner_text()
                h.ok("2 packets (2 kg)" in items, f"{tag}: pack dropdown lists packet sizes", items.replace("\n", " | ")[:120])

            # out of stock: both buttons off, no amount picker
            await pg.goto(h.base + f"/product/{prods['gone']['id']}", wait_until="load")
            await h.wait_for(pg, "product-buy-now", 30000)
            await pg.wait_for_timeout(800)
            bar = await pg.evaluate(BAR_JS)
            h.ok(bar and bar["addDisabled"] == "true" and bar["buyDisabled"] == "true" and bar["buyText"] in ("Out of stock", "স্টক নেই"),
                 f"{tag}: out of stock turns both buttons off", bar and (bar["addDisabled"], bar["buyDisabled"], bar["buyText"]))
            h.ok(await pg.locator(T("product-amount-select")).locator("visible=true").count() == 0, f"{tag}: no amount picker when out of stock")
            await pg.screenshot(path=f"{h.shots}/{tag}-6-out-of-stock.png")
            await ctx.close()
        await b.close()
    h.done()


asyncio.run(main())
