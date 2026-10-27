"""Screen check: in an official chat the account's round icon lines up with the TOP of each message, not the bottom
(a long, multi-line message included). English 360 and Bangla 320. Run after `npx expo export -p web --output-dir dist`."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("official-avatar-top")
h.start()
admin = h.signup("boss", "Admin Rahim")
ann = h.signup("ann", "Ann Begum")
h.make_admin(admin)
h.api("POST", "/api/admin/manage/official", {"title": "Welcome", "body": "Welcome to Farmers", "target": "all"}, admin["token"])
h.api("POST", "/api/admin/manage/official", {"title": "Weather", "target": "all", "body":
      "Heavy rain is expected in Dhaka, Mymensingh and Sylhet from tomorrow night until Friday. Cover seedbeds, clear drains "
      "around ponds and move feed and fertiliser bags off the floor."}, admin["token"])

MEASURE = """els => els.map(e => { const a = e.children[0].getBoundingClientRect(); const b = e.children[e.children.length-1].getBoundingClientRect();
  return { aTop: Math.round(a.top), aH: Math.round(a.height), bTop: Math.round(b.top), bH: Math.round(b.height),
           tl: getComputedStyle(e.children[e.children.length-1]).borderTopLeftRadius }; })"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang, w in (("en", 360), ("bn", 320)):
            ctx, pg = await h.page(b, ann, lang, w, "/")
            await pg.locator(T("tab-chats")).first.wait_for(timeout=60000)
            await pg.locator(T("tab-chats")).first.click()
            h.ok(await h.wait_for(pg, "chat-official-farmers-official", 20000), f"[{lang} {w}] Farmers Official chat listed")
            await pg.locator(T("chat-official-farmers-official")).first.click()
            h.ok(await h.wait_for(pg, "official-chat"), f"[{lang}] official chat opens")
            await pg.wait_for_timeout(1500)
            rows = await pg.locator('[data-testid^="official-msg-"]').evaluate_all(MEASURE)
            h.ok(len(rows) == 2, f"[{lang} {w}] both messages shown", rows)
            h.ok(any(r["bH"] > 80 for r in rows), f"[{lang} {w}] one message is multi-line", rows)
            h.ok(rows and all(abs(r["aTop"] - r["bTop"]) <= 2 for r in rows), f"[{lang} {w}] icon lines up with the top of each message", rows)
            await pg.screenshot(path=f"{h.shots}/official-chat-{lang}-{w}.png")
            h.ok(await h.no_overflow(pg), f"[{lang} {w}] official chat fits the screen")
            await ctx.close()
        await b.close()


try:
    asyncio.run(main())
except Exception as e:
    h.ok(False, "test crashed", repr(e)[:300])
h.done()
