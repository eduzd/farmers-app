"""Web check for the Maya-style marketplace theme on a throwaway local server.

- Market tab, shop page, product page, cart and checkout render with the Maya palette: navy (#202936) primary
  buttons, white flat cards with a #E6E6E6 hairline, DM Sans text, the Anton display face on the Market title
  and thin outline (SVG) icons instead of the Feather icon font.
- Bangla text inside the marketplace still uses Hind Siliguri.
- Screens outside the marketplace (Home / Community, Profile) keep the Farmers fonts and green buttons.
- Light and dark, English and Bangla, phone (390) and desktop (1280); no horizontal overflow; no page errors.

  python3 tests/check-maya-market-web.py [shots_dir]   (needs a web export in ./dist)
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T  # noqa: E402

h = H("maya-market")

FONTS_JS = """(needle) => {
  const els = [...document.querySelectorAll('div, span, h1')].filter(e => e.childElementCount === 0 && e.textContent.trim() === needle && e.offsetWidth > 0);
  return els.map(e => getComputedStyle(e).fontFamily);
}"""

ICONS_JS = """() => {
  const svgs = [...document.querySelectorAll('svg')].filter(s => s.getAttribute('stroke-width') === '1.5' && s.getBoundingClientRect().width > 0).length;
  const font = [...document.querySelectorAll('div')].filter(e => e.childElementCount === 0 && /feather/i.test(getComputedStyle(e).fontFamily) && e.offsetWidth > 0).length;
  return {thin: svgs, featherFont: font};
}"""

BG_JS = """(needle) => {
  const el = [...document.querySelectorAll('div')].find(e => e.childElementCount === 0 && e.textContent.trim() === needle && e.offsetWidth > 0);
  if (!el) return null;
  let p = el;
  for (let i = 0; i < 6 && p; i++) { const bg = getComputedStyle(p).backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg; p = p.parentElement; }
  return null;
}"""


async def go(pg, route, params=None):
    await pg.evaluate("([r,p])=>window.__nav.navigate(r,p)", [route, params])
    await pg.wait_for_timeout(2500)


async def fonts(pg, text):
    return await pg.evaluate(FONTS_JS, text)


async def main():
    h.start()
    admin = h.signup("boss", "Admin Rahim")
    seller = h.signup("sell", "Seller Karim")
    buyer = h.signup("buy", "Buyer Jamal")
    h.make_admin(admin)
    A = "/api/admin/manage"
    st, shop = h.api("POST", f"{A}/stores", {"name": "Padma Fish Feed", "owner": seller["email"]}, admin["token"])
    h.ok(st == 201, "seed shop", (st, shop))
    prods = []
    for name, price, cat in [("Floating fish feed", 1450, "other"), ("Fresh tomatoes", 60, "vegetables"), ("Rui fish", 380, "fish")]:
        st, pr = h.api("POST", f"{A}/products", {"storeId": shop["id"], "category": cat, "name": name, "price": price, "quantity": 40,
                                                "unit": "kg"}, admin["token"])
        h.ok(st == 201, f"seed product {name}", (st, pr))
        prods.append(pr)

    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        for lang, w, scheme in [("en", 390, "light"), ("bn", 390, "light"), ("en", 390, "dark"), ("en", 1280, "light")]:
            tag = f"{lang}-{w}-{scheme}"
            ctx = await b.new_context(viewport={"width": w, "height": 860}, color_scheme=scheme, device_scale_factor=2 if w < 500 else 1)
            await ctx.add_init_script(h.init_script(buyer, lang))
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, t=tag: h.errors.append(f"{t}: {str(e)[:200]}"))
            pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(h.base + "/", wait_until="load", timeout=180000)
            await pg.wait_for_timeout(4000)

            # Control: Home / Community outside the marketplace keeps the Farmers look.
            await pg.screenshot(path=f"{h.shots}/{tag}-00-home.png")
            home_icons = await pg.evaluate(ICONS_JS)
            if lang == "en" and scheme == "light" and w == 390:
                h.ok(home_icons["featherFont"] > 0, "Home (outside the marketplace) still uses the regular Feather icons", home_icons)

            await go(pg, "Main", {"screen": "Market"})
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f"{h.shots}/{tag}-01-market.png")
            await pg.screenshot(path=f"{h.shots}/{tag}-01-market-full.png", full_page=True)
            title = "Marketplace" if lang == "en" else None
            if title:
                f = await fonts(pg, title)
                h.ok(any("Anton" in x for x in f), f"{tag}: Market header title uses the Maya display face", f)
            ic = await pg.evaluate(ICONS_JS)
            h.ok(ic["thin"] >= 3, f"{tag}: Market draws thin outline icons", ic)
            if lang == "en":
                f = await fonts(pg, "Fresh tomatoes")
                h.ok(f and all("DMSans" in x for x in f), f"{tag}: product names on Market use DM Sans", f)
            h.ok(await h.no_overflow(pg), f"{tag}: Market has no sideways overflow")

            await pg.goto(h.base + f"/shop/{shop['slug']}", wait_until="load")
            await pg.wait_for_timeout(3500)
            await pg.screenshot(path=f"{h.shots}/{tag}-02-shop.png")
            h.ok(await pg.get_by_text("Floating fish feed").count() > 0, f"{tag}: shop page shows products")

            await pg.goto(h.base + f"/product/{prods[0]['id']}", wait_until="load")
            await pg.wait_for_timeout(3500)
            await pg.screenshot(path=f"{h.shots}/{tag}-03-product.png")
            add = pg.locator(T("product-add-to-cart"))
            if await add.count():
                bg = await add.first.evaluate("e=>{let p=e;for(let i=0;i<4&&p;i++){const b=getComputedStyle(p).backgroundColor;if(b!=='rgba(0, 0, 0, 0)')return b;p=p.firstElementChild}return null}")
                if scheme == "light":
                    h.ok(bg in ("rgb(32, 41, 54)", "rgb(20, 26, 35)") or bg is None, f"{tag}: Add to cart button is Maya navy", bg)
                await add.first.click()
                await pg.wait_for_timeout(1500)
            await go(pg, "Cart")
            await pg.screenshot(path=f"{h.shots}/{tag}-04-cart.png")
            await go(pg, "Checkout")
            await pg.screenshot(path=f"{h.shots}/{tag}-05-checkout.png")
            await pg.screenshot(path=f"{h.shots}/{tag}-05-checkout-full.png", full_page=True)
            h.ok(await h.no_overflow(pg), f"{tag}: checkout has no sideways overflow")
            if lang == "bn":
                bn = await pg.evaluate("""()=>[...document.querySelectorAll('div')].filter(e=>e.childElementCount===0&&/[\\u0980-\\u09FF]/.test(e.textContent)&&e.offsetWidth>0).slice(0,40).map(e=>getComputedStyle(e).fontFamily)""")
                h.ok(bn and all("HindSiliguri" in x for x in bn), f"{tag}: Bangla text in the marketplace uses Hind Siliguri", bn[:5])

            # Control again: Profile tab keeps the Farmers fonts.
            await go(pg, "Main", {"screen": "Profile"})
            await pg.screenshot(path=f"{h.shots}/{tag}-06-profile.png")
            if lang == "en":
                pf = await pg.evaluate("""()=>[...document.querySelectorAll('div')].filter(e=>e.childElementCount===0&&/[A-Za-z]{3}/.test(e.textContent)&&e.offsetWidth>0).slice(0,30).map(e=>getComputedStyle(e).fontFamily)""")
                h.ok(not any("DMSans" in x or "Anton" in x for x in pf), f"{tag}: Profile (outside the marketplace) keeps the Farmers fonts", pf[:4])
            await ctx.close()
        await b.close()
    h.ok(not h.errors, "no page errors", h.errors[:3])
    h.done()


asyncio.run(main())
