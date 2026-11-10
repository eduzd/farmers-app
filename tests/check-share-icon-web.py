"""Share icon check on the web build (./dist), on a throwaway local server with fake accounts.

Every share button draws the one solid share icon the user picked (three filled dots, bold links), the old thin
Feather share / upload arrow is gone from them, and tapping still shares (navigator.share is stubbed and recorded).
Covers own profile, someone else's profile menu, the community feed, a post, a shop, a product, and the
polls / daily tips / government schemes pages. English and Bangla, light and dark, phone and computer.

    python3 tests/check-share-icon-web.py [shots_dir]
"""
import asyncio, json, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from webharness import H, T  # noqa: E402
from playwright.async_api import async_playwright

h = H("share-icon")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)
seller = h.signup("seller", "Karim Seller")
st, SHOP = h.api("POST", "/api/admin/manage/stores", {"name": "Padma Fish Feed", "owner": seller["email"]}, admin["token"])
assert st == 201, (st, SHOP)
st, PROD = h.api("POST", "/api/admin/manage/products", {"storeId": SHOP["id"], "category": "vegetables", "name": "Fresh tomatoes",
                 "price": 80, "quantity": 40, "unit": "kg"}, admin["token"])
assert st == 201, (st, PROD)
comms = h.api("GET", "/api/communities")[1]
cid = (next((c for c in comms if c.get("slug") == "farmer"), None) or comms[0])["id"]
st, POST = h.api("POST", "/api/posts", {"communityId": cid, "content": "Pond water turned green this morning"}, seller["token"])
print("seed post", st)

STUB = ("window.__shares = []; try { Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shares.push(d); } }); } catch (e) {}"
        " try { navigator.clipboard.writeText = async (t) => { window.__shares.push({ clip: t }); }; } catch (e) {}")

COUNT_JS = open(os.path.join(os.path.dirname(__file__), "share-icon-count.js")).read()


async def count(pg, sel=None):
    return await pg.evaluate(COUNT_JS, sel)


async def shares(pg):
    return await pg.evaluate("() => window.__shares || []")


async def open_pg(b, acc, lang, w, theme, path="/"):
    ctx = await b.new_context(viewport={"width": w, "height": 860}, color_scheme=theme)
    await ctx.add_init_script(h.init_script(acc, lang) + "localStorage.setItem('theme_preference', %s);" % json.dumps(theme) + STUB)
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: h.errors.append(f"{lang}-{w}-{theme}: {str(e)[:200]}"))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(h.base + path, wait_until="load", timeout=180000)
    await pg.wait_for_timeout(3500)
    return ctx, pg


async def tap_new_icon(pg, nth=0):
    """Clicks the nth visible new share icon with the mouse (its button gets the press)."""
    box = await pg.evaluate("""(nth) => {
      const s = [...document.querySelectorAll('svg')].filter(s => { const cs = [...s.querySelectorAll('circle')];
        const r = s.getBoundingClientRect(); return r.width > 0 && cs.length === 3 && cs.every(c => c.getAttribute('r') === '3.4'); })[nth];
      if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }""", nth)
    if box:
        await pg.mouse.click(box[0], box[1])
    return bool(box)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (390, 1280):
                for theme in ("light", "dark"):
                    tag = f"{lang}-{w}-{theme}"

                    def shot(n):
                        return os.path.join(h.shots, f"{tag}-{n}.png")

                    # 1. own profile: Share profile button
                    ctx, pg = await open_pg(b, admin, lang, w, theme)
                    await pg.locator('[role="tab"]').nth(4).click()
                    ok = await h.wait_for(pg, "profile-share-button")
                    h.ok(ok, f"{tag} own profile: Share profile button shows")
                    c = await count(pg, T("profile-share-button"))
                    h.ok(c.get("n") == 1 and c.get("filled") and c.get("old") == 0, f"{tag} own profile: button has the new solid share icon, not the old one", c)
                    label = (await pg.locator(T("profile-share-button")).first.inner_text()).strip()
                    h.ok(label == ("Share profile" if lang == "en" else "শেয়ার"), f"{tag} own profile: label unchanged", label)
                    await pg.locator(T("profile-share-button")).first.scroll_into_view_if_needed()
                    await pg.screenshot(path=shot("1-own-profile"))
                    await pg.locator(T("profile-share-button")).first.click()
                    await pg.wait_for_timeout(900)
                    s = await shares(pg)
                    h.ok(len(s) == 1 and admin["user"]["name"] in json.dumps(s) and s[0].get("url", "").startswith("http"), f"{tag} own profile: tapping still shares the profile (name + app link, as before)", s)
                    await ctx.close()

                    # 2. someone else's profile: ... menu > Share profile
                    ctx, pg = await open_pg(b, admin, lang, w, theme)
                    su = seller["user"]
                    await pg.evaluate("(u) => window.__nav.navigate('UserProfile', { user: u })",
                                      {"id": su["id"], "name": su["name"], "initials": "KS", "followers": 0, "following": 0, "posts": 0})
                    await pg.wait_for_timeout(2500)
                    await pg.locator(T("user-profile-more")).first.click()
                    ok = await h.wait_for(pg, "visitor-menu-share", 5000)
                    h.ok(ok, f"{tag} other profile: menu has Share profile")
                    if ok:
                        await pg.wait_for_timeout(500)
                        c = await count(pg, T("visitor-menu-share"))
                        h.ok(c.get("n") == 1 and c.get("old") == 0, f"{tag} other profile: Share profile row has the new icon", c)
                        await pg.screenshot(path=shot("2-other-profile-menu"))
                        await pg.locator(T("visitor-menu-share")).first.click()
                        await pg.wait_for_timeout(900)
                        s = await shares(pg)
                        h.ok(len(s) == 1 and seller["user"]["name"] in json.dumps(s) and s[0].get("url", "").startswith("http"), f"{tag} other profile: tapping still shares their profile (name + app link, as before)", s)
                    await ctx.close()

                    # 3. community feed + 4. post page
                    ctx, pg = await open_pg(b, admin, lang, w, theme)
                    await pg.locator('[role="tab"]').nth(0).click()
                    await pg.wait_for_timeout(2500)
                    c = await count(pg)
                    h.ok(c.get("n", 0) >= 1 and c.get("old") == 0, f"{tag} feed: post share button has the new icon, no old arrow", c)
                    await pg.screenshot(path=shot("3-feed"))
                    if c.get("n"):
                        await tap_new_icon(pg)
                        await pg.wait_for_timeout(900)
                        s = await shares(pg)
                        h.ok(len(s) >= 1 and "Pond water" in json.dumps(s, ensure_ascii=False), f"{tag} feed: tapping still shares the post", s)
                    if True:
                        await pg.get_by_text("Pond water turned green this morning").first.click()
                        await pg.wait_for_timeout(2500)
                        await pg.evaluate("() => { window.__shares = []; }")
                        c = await count(pg)
                        h.ok(c.get("n", 0) >= 1 and c.get("old") == 0, f"{tag} post page: share button has the new icon", c)
                        await pg.screenshot(path=shot("4-post"))
                        if c.get("n"):
                            await tap_new_icon(pg, c["n"] - 1)
                            await pg.wait_for_timeout(900)
                            s = await shares(pg)
                            h.ok(len(s) >= 1 and "Pond water" in json.dumps(s, ensure_ascii=False), f"{tag} post page: tapping still shares the post", s)
                    await ctx.close()

                    # 5. shop, 6. product
                    for nm, path, sel in (("5-shop", f"/shop/{SHOP['slug']}", T("shop-share")), ("6-product", f"/product/{PROD['id']}", None)):
                        ctx, pg = await open_pg(b, admin, lang, w, theme, path)
                        await pg.wait_for_timeout(1500)
                        c = await count(pg, sel)
                        h.ok(c.get("n") == 1 and c.get("old") == 0, f"{tag} {nm[2:]}: share button has the new icon", c)
                        await pg.screenshot(path=shot(nm))
                        if c.get("n"):
                            if sel:
                                await pg.locator(sel).first.click()
                            else:
                                await tap_new_icon(pg)
                            await pg.wait_for_timeout(900)
                            s = await shares(pg)
                            want = f"/shop/{SHOP['slug']}" if sel else f"/product/{PROD['id']}"
                            h.ok(len(s) == 1 and want in json.dumps(s), f"{tag} {nm[2:]}: tapping still shares its link", s)
                        await ctx.close()

                    # 7. other pages with share buttons (phone + light only; same icon code)
                    if w == 390 and theme == "light":
                        ctx, pg = await open_pg(b, admin, lang, w, theme)
                        for route in ("DailyTips", "GovernmentSchemes", "Polls"):
                            await pg.evaluate(f"() => window.__nav.navigate('{route}')")
                            await pg.wait_for_timeout(2500)
                            c = await count(pg)
                            await pg.screenshot(path=shot(f"7-{route}"))
                            h.ok(c.get("old") == 0, f"{tag} {route}: no old share icon", c)
                            print(f"      {route}: new share icons on screen = {c.get('n')}")
                        await ctx.close()
        await b.close()
    h.ok(not h.errors, "no page errors", h.errors[:5])
    h.stop()
    print(f"\n{h.passes} passed, {len(h.fails)} failed")
    for f in h.fails:
        print("  FAIL:", f)
    sys.exit(1 if h.fails else 0)


asyncio.run(main())
