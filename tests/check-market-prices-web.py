"""Web check (throwaway local server, needs ./dist): admin posts market prices, people see the board.

- Admin (360 wide) opens More > Market prices, adds Rui fish for Dhaka through the form, sees the row.
- Yesterday's price (posted by API) makes today's show the drop. A Bogura price adds a second district.
- Farmer opens the Market prices board in English and Bangla at 320 and 390: real prices, trend, district
  chips, search, tapping opens the chart and the price alert button. Nothing runs off the screen.
  python3 tests/check-market-prices-web.py [shots_dir]
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from datetime import datetime, timedelta, timezone
from playwright.async_api import async_playwright
from webharness import H, T

h = H("market-prices")
today = (datetime.now(timezone.utc) + timedelta(hours=6)).date()
y = (today - timedelta(days=1)).isoformat()


async def main():
    h.start()
    admin, farmer = h.signup("boss", "Admin Rahim"), h.signup("farm", "Karim Mia")
    h.make_admin(admin)
    st, r = h.api("POST", "/api/admin/manage/market-prices", {"rows": [
        {"nameEn": "Rui fish", "nameBn": "রুই মাছ", "category": "fish", "unit": "kg", "district": "Dhaka", "min": 340, "max": 380, "date": y},
        {"nameEn": "Potato", "nameBn": "আলু", "category": "vegetables", "unit": "kg", "district": "Dhaka", "min": 40, "max": 45, "date": y},
        {"nameEn": "Broiler chicken", "nameBn": "ব্রয়লার মুরগি", "category": "poultry", "unit": "kg", "district": "Bogura", "min": 170, "max": 180}]}, admin["token"])
    h.ok(st == 201, "seed yesterday's Dhaka prices and today's Bogura price", r)

    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- admin adds today's Rui price through the form
        ctx, pg = await h.page(b, admin, "en", 360, path="/admin")
        h.ok(await h.wait_for(pg, "admin-app", 120000), "admin app opens")
        await pg.locator(T("admin-tab-more")).first.click()
        await pg.wait_for_timeout(800)
        h.ok(await h.wait_for(pg, "more-prices"), "More has a Market prices row")
        await pg.locator(T("more-prices")).first.click()
        h.ok(await h.wait_for(pg, "admin-market-prices"), "Market prices page opens")
        h.ok(await h.text(pg, "mp-day") == "Today", "defaults to today", await h.text(pg, "mp-day"))
        await pg.locator(T("mp-add")).first.click()
        h.ok(await h.wait_for(pg, "mp-form"), "add form opens")
        h.ok(await pg.locator(T("mp-suggest-rui-fish")).count() == 1, "quick pick shows Rui fish used before")
        await pg.locator(T("mp-suggest-rui-fish")).first.click()
        await pg.locator(T("mp-min")).first.fill("300")
        await pg.locator(T("mp-max")).first.fill("330")
        await pg.locator(T("mp-market")).first.fill("Karwan Bazar")
        await pg.screenshot(path=f"{h.shots}/admin-form-360.png", full_page=True)
        await pg.locator(T("mp-save")).first.click()
        h.ok(await h.wait_for(pg, "mp-row-rui-fish"), "Rui fish row shows after saving")
        row = await h.text(pg, "mp-row-rui-fish")
        h.ok(row and "৳300" in row and "330" in row and "Karwan Bazar" in row, "row has ৳300–330 and the market", row)
        h.ok(await h.no_overflow(pg), "admin page fits 360")
        await pg.screenshot(path=f"{h.shots}/admin-list-360.png", full_page=True)
        # copy yesterday to an empty day for Dhaka? Today already has a price; go to the day before yesterday and copy
        await pg.locator(T("mp-day-prev")).first.click(); await pg.wait_for_timeout(400)
        await pg.locator(T("mp-day-prev")).first.click(); await pg.wait_for_timeout(1200)
        h.ok(await h.wait_for(pg, "mp-copy"), "an empty day offers to copy the last day's prices")
        await ctx.close()
        st, r = h.api("GET", "/api/market-prices?district=Dhaka")
        rui = next((i for i in r["items"] if i["itemKey"] == "rui-fish"), None)
        h.ok(rui and rui["avg"] == 315 and rui["trend"] == "down", "the form's price reached the board (down from ৳360)", rui)

        # ---- farmer: the board
        for lang in ("en", "bn"):
            for w in (320, 390):
                tag = f"{lang}-{w}"
                ctx, pg = await h.page(b, farmer, lang, w)
                await pg.evaluate("()=>window.__nav.navigate('MarketPrices')")
                h.ok(await h.wait_for(pg, "price-item-rui-fish", 20000), f"{tag} board shows Rui fish")
                txt = await h.text(pg, "price-item-rui-fish")
                if lang == "en":
                    h.ok("Rui fish" in txt and "৳300–330" in txt and "−৳45" in txt, f"{tag} Rui shows ৳300–330 and −৳45", txt)
                else:
                    h.ok("রুই মাছ" in txt and "৳৩০০–৩৩০" in txt and "−৳৪৫" in txt and "কেজি" in txt, f"{tag} Rui shows Bangla digits ৳৩০০–৩৩০, −৳৪৫, কেজি", txt)
                h.ok(await pg.locator(T("market-district-Bogura")).count() == 1 and await pg.locator(T("market-district-Dhaka")).count() == 1, f"{tag} district chips for Bogura and Dhaka")
                await pg.locator(T("market-district-Bogura")).first.click(); await pg.wait_for_timeout(1500)
                h.ok(await pg.locator(T("price-item-broiler-chicken")).count() == 1 and await pg.locator(T("price-item-rui-fish")).count() == 0, f"{tag} Bogura chip shows only Bogura's price")
                await pg.locator(T("market-district-all")).first.click(); await pg.wait_for_timeout(1500)
                await pg.locator(T("market-search")).first.fill("আলু" if lang == "bn" else "pota"); await pg.wait_for_timeout(500)
                h.ok(await pg.locator(T("price-item-potato")).count() == 1 and await pg.locator(T("price-item-rui-fish")).count() == 0, f"{tag} search finds potato only")
                await pg.locator(T("market-search")).first.fill(""); await pg.wait_for_timeout(500)
                await pg.locator(T("price-item-rui-fish")).first.click()
                h.ok(await h.wait_for(pg, "price-history", 10000), f"{tag} tapping Rui opens its 2-day chart")
                h.ok(await pg.locator(T("price-alert-rui-fish")).count() == 1, f"{tag} price alert button shows")
                h.ok(await h.no_overflow(pg), f"{tag} nothing runs off the screen")
                await pg.screenshot(path=f"{h.shots}/board-{tag}.png", full_page=True)
                body = await pg.locator("body").inner_text()
                if lang == "en":
                    h.ok("Today's market prices" in body, f"{tag} English title")
                else:
                    h.ok("আজকের বাজার দর" in body and "Today's market" not in body, f"{tag} Bangla title, no English left")
                await ctx.close()
        await b.close()
    h.done()


try:
    asyncio.run(main())
except Exception as e:
    print("ERROR", repr(e)[:500])
    h.fails.append("exception")
    h.done()
