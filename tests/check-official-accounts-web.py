"""Screen check: official accounts. Admin creates a Safety account (Bangla + English), sends from it with the
Send from switcher, and the user sees both official chats (verified tick) in Chats and opens the Safety one.
Run after `npx expo export -p web --output-dir dist`."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("official-accounts")
h.start()
admin = h.signup("boss", "Admin Rahim")
ann = h.signup("ann", "Ann Begum")
h.make_admin(admin)
# Something from Farmers Official first, so the user has two official chats.
h.api("POST", "/api/admin/manage/official", {"title": "Welcome", "body": "Welcome to Farmers", "target": "all"}, admin["token"])


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- admin: create Safety, then send from it ----
        ctx, pg = await h.page(b, admin, "en", 360, "/admin")
        h.ok(await h.wait_for(pg, "admin-app", 120000), "admin app opens")
        await pg.locator(T("admin-tab-more")).first.click(); await pg.wait_for_timeout(800)
        h.ok(await h.wait_for(pg, "more-officialAccounts"), "More has Official accounts")
        await pg.locator(T("more-officialAccounts")).first.click()
        h.ok(await h.wait_for(pg, "admin-official-accounts"), "Official accounts page opens")
        h.ok(await h.wait_for(pg, "oa-farmers-official"), "Farmers Official is listed")
        await pg.locator(T("oa-new")).click()
        await pg.locator(T("oa-name-en")).fill("Farmers Safety")
        await pg.locator(T("oa-name-bn")).fill("ফার্মার্স সেফটি")
        await pg.locator(T("oa-about-en")).fill("Flood and disease alerts")
        await pg.locator(T("oa-icon-shield")).click()
        await pg.locator(T("oa-color-DC2626")).click()
        await pg.screenshot(path=f"{h.shots}/admin-create-360.png", full_page=True)
        h.ok(await h.no_overflow(pg), "create form fits a 360px phone")
        await pg.locator(T("oa-save")).click(); await pg.wait_for_timeout(1500)
        st, accs = h.api("GET", "/api/admin/manage/official-accounts", None, admin["token"])
        safety = next((a for a in accs or [] if a["nameEn"] == "Farmers Safety"), None)
        h.ok(safety and safety["icon"] == "shield" and safety["color"] == "#DC2626" and safety["nameBn"] == "ফার্মার্স সেফটি", "Safety account saved from the form", accs)
        h.ok(await h.wait_for(pg, f"oa-{safety['id']}"), "Safety shows in the list")
        await pg.locator(T(f"oa-send-{safety['id']}")).click()
        h.ok(await h.wait_for(pg, "admin-official"), "Send message opens Official message")
        await pg.wait_for_timeout(1200)
        h.ok((await h.text(pg, "official-from-name")) == "Farmers Safety", "Send from is set to Safety", await h.text(pg, "official-from-name"))
        await pg.locator(T("official-from-farmers-official")).click(); await pg.wait_for_timeout(300)
        h.ok((await h.text(pg, "official-from-name")) == "Farmers Official", "switcher changes the sender to Farmers Official")
        await pg.locator(T(f"official-from-{safety['id']}")).click(); await pg.wait_for_timeout(300)
        await pg.locator(T("official-title")).fill("Flood warning")
        await pg.locator(T("official-body")).fill("Move feed to higher ground tonight")
        send_label = (await pg.locator(T("official-send")).first.inner_text()).strip()
        h.ok("Farmers Safety" in send_label, "button says Send as Farmers Safety", send_label)
        await pg.screenshot(path=f"{h.shots}/admin-send-360.png", full_page=True)
        await pg.locator(T("official-send")).click()
        h.ok(await h.sheet_ok(pg), "Send to everyone asks in the confirmation sheet")
        await pg.wait_for_timeout(2000)
        res = await h.text(pg, "official-result")
        h.ok(res and "Farmers Safety" in res, "sent from Safety", res)
        h.ok(await h.no_overflow(pg), "official message page fits a 360px phone")
        await ctx.close()

        # ---- user: Chats shows both official chats; open Safety (English 360, Bangla 320) ----
        for lang, w in (("en", 360), ("bn", 320)):
            ctx, pg = await h.page(b, ann, lang, w, "/")
            await pg.locator(T("tab-chats")).first.wait_for(timeout=60000)
            await pg.locator(T("tab-chats")).first.click()
            ok_s = await h.wait_for(pg, f"chat-official-{safety['id']}", 20000)
            h.ok(ok_s and await h.wait_for(pg, "chat-official-farmers-official", 5000), f"[{lang} {w}] Chats shows Farmers Official and Safety")
            row = (await pg.locator(T(f"chat-official-{safety['id']}")).first.inner_text()) if ok_s else ""
            want = "ফার্মার্স সেফটি" if lang == "bn" else "Farmers Safety"
            h.ok(want in row and "Flood warning" in row, f"[{lang}] Safety row shows its name and last message", row)
            await pg.screenshot(path=f"{h.shots}/chats-{lang}-{w}.png")
            h.ok(await h.no_overflow(pg), f"[{lang} {w}] Chats fits the screen")
            if ok_s:
                await pg.locator(T(f"chat-official-{safety['id']}")).first.click()
            h.ok(await h.wait_for(pg, "official-chat"), f"[{lang}] Safety chat opens")
            await pg.wait_for_timeout(1500)
            body = await pg.locator(T("official-chat")).first.inner_text()
            h.ok("Move feed to higher ground tonight" in body and "Welcome to Farmers" not in body, f"[{lang}] Safety chat has only Safety's message")
            ro = await h.text(pg, "official-readonly") or ""
            h.ok(("শুধু" in ro) if lang == "bn" else ("Only Farmers Safety can send" in ro), f"[{lang}] chat says only the account can send", ro)
            await pg.screenshot(path=f"{h.shots}/safety-chat-{lang}-{w}.png")
            h.ok(await h.no_overflow(pg), f"[{lang} {w}] Safety chat fits the screen")
            await ctx.close()
        await b.close()


try:
    asyncio.run(main())
except Exception as e:
    h.ok(False, "test crashed", repr(e)[:300])
h.done()
