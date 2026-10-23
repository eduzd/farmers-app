"""Screen check: the confirmation bottom sheet. On Official message with To: Everyone, Send opens the Farmers sheet
(slides up from the bottom, shows sender/recipients/preview). Cancel, the backdrop and Escape send nothing; Send
sends once even when tapped twice. Checked in English 360px, Bangla 320px and desktop 1280px.
Run after `npx expo export -p web --output-dir dist`."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("confirm-sheet")
h.start()
admin = h.signup("boss", "Admin Rahim")
ann = h.signup("ann", "Ann Begum")
h.make_admin(admin)


def sent_count():
    st, rows = h.api("GET", "/api/admin/manage/official", None, admin["token"])
    if isinstance(rows, dict):
        rows = rows.get("messages") or rows.get("items") or []
    return len(rows or [])


async def open_official(pg):
    h.ok(await h.wait_for(pg, "admin-app", 120000), "admin app opens")
    await pg.locator(T("admin-tab-more")).first.click(); await pg.wait_for_timeout(800)
    await pg.locator(T("more-officialAccounts")).first.click()
    h.ok(await h.wait_for(pg, "admin-official-accounts"), "Official accounts opens")
    await pg.locator(T("oa-send-farmers-official")).first.click()
    h.ok(await h.wait_for(pg, "admin-official"), "Official message opens")
    await pg.wait_for_timeout(800)


async def sheet_geometry(pg):
    return await pg.evaluate("""()=>{const ok=document.querySelector('[data-testid="confirm-sheet-ok"]');
      if(!ok) return null; let el=ok; while(el && !(el.getAttribute('role')==='dialog')) el=el.parentElement;
      const r=(el||ok).getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,vh:innerHeight,vw:innerWidth};}""")


async def run(b, lang, w, hgt=800):
    tag = f"{lang}-{w}"
    ctx, pg = await h.page(b, admin, lang, w, "/admin", hgt)
    await open_official(pg)
    await pg.locator(T("official-title")).fill("Weather update" if lang == "en" else "আবহাওয়া আপডেট")
    await pg.locator(T("official-body")).fill("Heavy rain expected tonight in Dhaka. Keep feed and fertiliser dry." if lang == "en" else "আজ রাতে ঢাকায় ভারী বৃষ্টি হতে পারে। খাদ্য ও সার শুকনো রাখুন।")
    before = sent_count()

    # 1) Cancel button
    await pg.locator(T("official-send")).click()
    h.ok(await h.wait_for(pg, "confirm-sheet-ok", 5000), f"{tag}: Send opens the confirmation sheet")
    await pg.wait_for_timeout(60)
    mid = await sheet_geometry(pg)
    await pg.wait_for_timeout(900)
    g = await sheet_geometry(pg)
    h.ok(g and abs(g["bottom"] - g["vh"]) <= 30 and g["top"] > g["vh"] * 0.2, f"{tag}: sheet sits at the bottom of the screen", g)
    h.ok(mid and g and mid["top"] > g["top"] + 5, f"{tag}: sheet slides up from below", (mid, g))
    h.ok(g and g["left"] >= -1 and g["right"] <= g["vw"] + 1, f"{tag}: sheet fits the width", g)
    body = await pg.locator(T("confirm-sheet")).first.inner_text()
    want = ["Send to everyone?", "Farmers Official", "Heavy rain"] if lang == "en" else ["সবাইকে পাঠাবেন?", "ফার্মার্স অফিসিয়াল", "ভারী বৃষ্টি"]
    h.ok(all(x in body for x in want), f"{tag}: sheet shows title, sender and message preview", body[:300])
    await pg.screenshot(path=f"{h.shots}/sheet-{tag}.png")
    h.ok(await h.no_overflow(pg), f"{tag}: no sideways scroll with the sheet open")
    await pg.locator(T("confirm-sheet-cancel")).click(); await pg.wait_for_timeout(700)
    h.ok(await pg.locator(T("confirm-sheet-ok")).count() == 0, f"{tag}: Cancel closes the sheet")
    h.ok(sent_count() == before, f"{tag}: Cancel sends nothing")

    # 2) Escape
    await pg.locator(T("official-send")).click(); await pg.wait_for_timeout(700)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(700)
    h.ok(await pg.locator(T("confirm-sheet-ok")).count() == 0 and sent_count() == before, f"{tag}: Escape closes and sends nothing")

    # 3) Backdrop tap (top of the screen)
    await pg.locator(T("official-send")).click(); await pg.wait_for_timeout(700)
    await pg.mouse.click(w // 2, 20); await pg.wait_for_timeout(700)
    h.ok(await pg.locator(T("confirm-sheet-ok")).count() == 0 and sent_count() == before, f"{tag}: tapping outside closes and sends nothing")

    # 4) Confirm, double-tapped
    await pg.locator(T("official-send")).click(); await pg.wait_for_timeout(700)
    ok = pg.locator(T("confirm-sheet-ok")).first
    await ok.click()
    try:
        await ok.click(timeout=300)
    except Exception:
        pass
    await pg.wait_for_timeout(2500)
    h.ok(sent_count() == before + 1, f"{tag}: Send sends exactly once", (before, sent_count()))
    h.ok(await h.wait_for(pg, "official-result", 5000), f"{tag}: sent confirmation shows")
    await ctx.close()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await run(b, "en", 360)
        await run(b, "bn", 320, 640)
        await run(b, "en", 1280, 800)
        await b.close()


asyncio.run(main())
h.done()
