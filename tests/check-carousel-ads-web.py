"""Screen check: admin carousel ads on Home and Connect (throwaway local server, needs ./dist).
- No ads: the built-in cards show (Welfare/Summit/Events on Home, Advertise/Vet/Fish on Connect).
- Admin adds 7 Home + 5 Connect + 2 Everywhere ads: Home shows all 9, Connect all 7, in order, no built-ins,
  Bangla text in Bangla, dots for up to 8 cards and a "1 / 9" counter above that, nothing overflows.
- Taps open what the admin chose: a category ad opens Market on that category, a product ad opens the product link,
  a support ad opens the Help chat; an ad that opens nothing is not a button.
Run after `npx expo export -p web --output-dir dist`."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("carousel-ads")
h.start()
admin = h.signup("boss", "Admin Rahim")
ann = h.signup("ann", "Ann Begum")
h.make_admin(admin)

CARDS_JS = "(p)=>[...document.querySelectorAll(`[data-testid^='${p}']`)].map(e=>e.getAttribute('data-testid').slice(p.length))"
ROUTE_JS = "()=>{const r=window.__nav.getCurrentRoute();return r?{name:r.name,params:r.params||null}:null}"


async def cards(pg, prefix):
    return await pg.evaluate(CARDS_JS, prefix)


async def go(pg, screen):
    await pg.evaluate(f"()=>window.__nav.navigate('Main',{{screen:'{screen}'}})")
    await pg.wait_for_timeout(2500)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- no ads yet: built-in cards ----
        ctx, pg = await h.page(b, ann, "en", 360)
        h.ok(await h.wait_for(pg, "home-carousel", 60000), "Home carousel shows")
        c = await cards(pg, "home-carousel-card-")
        h.ok(c == ["welfare", "summit", "events"], "no ads: Home shows its 3 built-in cards", c)
        await go(pg, "Connect")
        h.ok(await h.wait_for(pg, "connect-carousel"), "Connect carousel shows")
        c = await cards(pg, "connect-carousel-card-")
        h.ok(c == ["advertise", "vet", "fish"], "no ads: Connect shows its 3 built-in cards", c)
        await ctx.close()

        # ---- admin adds ads ----
        ids = {"home": [], "connect": [], "all": []}
        for i in range(1, 8):
            st, a = h.api("POST", "/api/admin/manage/ads", {"titleEn": f"Home sale {i}", "titleBn": f"হোম অফার {i}", "subtitleEn": f"Deal number {i}",
                          "subtitleBn": f"অফার {i}", "ctaEn": "Shop now", "ctaBn": "কিনুন", "placement": "home",
                          "linkType": "category" if i == 1 else "product", "linkTarget": "Fish" if i == 1 else f"prod-{i}",
                          "color1": "#2563EB", "color2": "#7C3AED"}, admin["token"])
            ids["home"].append(a["id"])
        for i in range(1, 6):
            st, a = h.api("POST", "/api/admin/manage/ads", {"titleEn": f"Connect promo {i}", "titleBn": f"কানেক্ট প্রোমো {i}", "subtitleEn": "Talk to us",
                          "placement": "connect", "linkType": "support" if i == 1 else "none", "ctaEn": "Chat" if i == 1 else ""}, admin["token"])
            ids["connect"].append(a["id"])
        for i in range(1, 3):
            st, a = h.api("POST", "/api/admin/manage/ads", {"titleEn": f"Everywhere {i}", "placement": "all", "linkType": "url", "linkTarget": "https://example.com"}, admin["token"])
            ids["all"].append(a["id"])
        # a hidden one must not show
        st, hid = h.api("POST", "/api/admin/manage/ads", {"titleEn": "Hidden home ad", "placement": "home", "active": False}, admin["token"])

        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                tag = f"{lang}-{w}"
                ctx, pg = await h.page(b, ann, lang, w)
                h.ok(await h.wait_for(pg, "home-carousel", 60000), f"{tag}: Home carousel shows")
                await pg.wait_for_timeout(1000)
                c = await cards(pg, "home-carousel-card-")
                h.ok(c == ids["home"] + ids["all"], f"{tag}: Home shows all 9 admin ads in order, no built-ins, no hidden ad", c)
                counter = await h.text(pg, "home-carousel-dots")
                h.ok(counter == "1 / 9", f"{tag}: 9 cards -> compact '1 / 9' counter instead of dots", counter)
                first = await h.text(pg, f"home-carousel-card-{ids['home'][0]}")
                want = "হোম অফার 1" if lang == "bn" else "Home sale 1"
                h.ok(first and want in first and (("কিনুন" if lang == "bn" else "Shop now") in first), f"{tag}: first Home card text in the app language", first)
                h.ok(await h.no_overflow(pg), f"{tag}: Home fits the screen")
                if w == 360:
                    await pg.screenshot(path=f"{h.shots}/home-{tag}.png")
                await go(pg, "Connect")
                await pg.wait_for_timeout(1000)
                c = await cards(pg, "connect-carousel-card-")
                h.ok(c == ids["connect"] + ids["all"], f"{tag}: Connect shows all 7 admin ads in order", c)
                dots = await pg.evaluate("()=>document.querySelector(\"[data-testid='connect-carousel-dots']\")?.children.length||0")
                h.ok(dots == 7, f"{tag}: Connect shows 7 dots", dots)
                h.ok(await h.no_overflow(pg), f"{tag}: Connect fits the screen")
                if w == 360:
                    await pg.screenshot(path=f"{h.shots}/connect-{tag}.png")
                await ctx.close()

        # ---- auto-slide and taps ----
        ctx, pg = await h.page(b, ann, "en", 360)
        await h.wait_for(pg, "home-carousel", 60000)
        await pg.wait_for_timeout(9500)
        counter = await h.text(pg, "home-carousel-dots")
        h.ok(bool(counter) and counter != "1 / 9" and counter.endswith(" / 9"), "Home carousel moves on by itself", counter)
        # category ad -> Market on Fish
        await pg.evaluate("(id)=>document.querySelector(`[data-testid='home-carousel-card-${id}']`).click()", ids["home"][0])
        await pg.wait_for_timeout(2500)
        r = await pg.evaluate(ROUTE_JS)
        h.ok(r and r["name"] == "Market" and (r["params"] or {}).get("category") == "Fish", "category ad opens Market with its category", r)
        await pg.screenshot(path=f"{h.shots}/market-from-ad-en-360.png")
        await go(pg, "Community")
        await pg.evaluate("(id)=>document.querySelector(`[data-testid='home-carousel-card-${id}']`).click()", ids["home"][1])
        await pg.wait_for_timeout(2500)
        r = await pg.evaluate(ROUTE_JS)
        h.ok(r and r["name"] in ("ProductLink", "ProductDetail") , "product ad opens the product link", r)
        await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Connect'})")
        await pg.wait_for_timeout(2500)
        role = await pg.evaluate("(id)=>document.querySelector(`[data-testid='connect-carousel-card-${id}']`)?.getAttribute('role')", ids["connect"][1])
        h.ok(role != "button", "an ad that opens nothing is not a button", role)
        await pg.evaluate("(id)=>document.querySelector(`[data-testid='connect-carousel-card-${id}']`).click()", ids["connect"][0])
        await pg.wait_for_timeout(2500)
        r = await pg.evaluate(ROUTE_JS)
        h.ok(r and r["name"] == "SupportChat", "support ad opens the Help chat", r)
        await ctx.close()

        # ---- admin deletes down to one ad on Connect: no dots, no stale cards ----
        for i in ids["connect"][1:] + ids["all"]:
            h.api("DELETE", f"/api/admin/manage/ads/{i}", None, admin["token"])
        ctx, pg = await h.page(b, ann, "en", 360)
        await go(pg, "Connect")
        c = await cards(pg, "connect-carousel-card-")
        h.ok(c == ids["connect"][:1], "one ad left: Connect shows just that one", c)
        dots = await pg.evaluate("()=>!!document.querySelector(\"[data-testid='connect-carousel-dots']\")")
        h.ok(not dots, "one card: no dots")
        await ctx.close()
        await b.close()


asyncio.run(main())
h.done()
