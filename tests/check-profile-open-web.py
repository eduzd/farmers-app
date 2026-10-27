"""Web check (throwaway local server, needs ./dist): tapping a person opens THEIR profile, and it shows THEIR photo.

  python3 tests/check-profile-open-web.py [shots_dir]

Test accounts only on a throwaway database: Ann Begum (viewer), Cat Rahman (uploaded photo, expert, 2 posts),
Dan Mia (no photo, follows Cat, comments on Cat's post).
API: GET /api/users/:id/profile gives the public card with the photo, never email/phone; unknown id -> 404.
For en/bn at 360 and en at 1280 wide:
- Home feed: tap Cat's name on her post -> Cat's profile, her photo shown large, her real posts listed.
- Cat's profile -> Followers -> tap Dan -> Dan's profile, no photo (initials), "no posts yet".
- Cat's post page: tap Dan's name on his comment -> Dan's profile.
- Tap Ann's own name on her post -> her own Profile tab (no Follow button), her post on its Posts tab.
- Chat with Cat: the header shows Cat's photo; tapping it opens Cat's profile with her photo.
- Connect: tap Cat's card -> Cat's profile with her photo.
Also: no page errors, nothing running off the screen.
"""
import asyncio, base64, struct, sys, zlib
from playwright.async_api import async_playwright
from webharness import H, T

h = H("profile-open")


def png(w=64, hgt=64, rgb=(30, 90, 200)):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(hgt))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, hgt, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


IMG_JS = """([uid, min]) => [...document.images].filter(i => {
  if (!i.src.includes('/api/avatars/' + encodeURIComponent(uid))) return false;
  const r = i.getBoundingClientRect(); if (r.width < min || r.bottom <= 0 || r.top >= innerHeight) return false;
  let e = i; while (e) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; e = e.parentElement; }
  return i.complete && i.naturalWidth > 0;
}).length"""


async def visible_text(pg, tid):
    loc = pg.locator(T(tid))
    for i in range(await loc.count() - 1, -1, -1):
        if await loc.nth(i).is_visible():
            return (await loc.nth(i).inner_text()).strip()
    return None


async def wait_profile(pg, name, ms=15000):
    for _ in range(ms // 300):
        if await visible_text(pg, "user-profile-screen") is not None and await visible_text(pg, "profile-hero-name") == name:
            await pg.wait_for_timeout(1500)  # the server card and posts
            return True
        await pg.wait_for_timeout(300)
    return False


async def click_visible_text(pg, text):
    loc = pg.get_by_text(text, exact=True)
    for i in range(await loc.count()):
        if await loc.nth(i).is_visible():
            await loc.nth(i).click()
            return True
    return False


async def tap_tab(pg, labels):
    for lab in labels:
        loc = pg.get_by_role("tab", name=lab)
        if await loc.count():
            await loc.first.click(); await pg.wait_for_timeout(1500); return True
        loc = pg.get_by_role("button", name=lab)
        if await loc.count():
            await loc.first.click(); await pg.wait_for_timeout(1500); return True
    return False


async def main():
    h.start()
    ann = h.signup("ann", "Ann Begum")
    cat = h.signup("cat", "Cat Rahman")
    dan = h.signup("dan", "Dan Mia")
    st, j = h.api("POST", "/api/me/avatar", {"imageBase64": "data:image/png;base64," + base64.b64encode(png()).decode()}, cat["token"])
    h.ok(st == 200 and "/api/avatars/" in (j or {}).get("avatar", ""), "Cat's photo uploaded", (st, j))
    h.api("PUT", "/api/me/profile", {"role": "expert"}, cat["token"])
    h.api("PUT", "/api/me/expert-profile", {"field": "fish", "title": "Fisheries officer", "about": "Fish disease and water quality"}, cat["token"])
    comms = h.api("GET", "/api/communities")[1]
    cid = (next((c for c in comms if c["slug"] == "farmer"), None) or comms[0])["id"]
    _, p1 = h.api("POST", "/api/posts", {"communityId": cid, "content": "Cat first post about pond aeration"}, cat["token"])
    _, p2 = h.api("POST", "/api/posts", {"communityId": cid, "content": "Cat second post about fish feed"}, cat["token"])
    h.api("POST", "/api/posts", {"communityId": cid, "content": "Ann post about rice seedlings"}, ann["token"])
    st, cm = h.api("POST", f"/api/posts/{p2['id']}/comments", {"body": "Dan says thanks for the tip"}, dan["token"])
    h.ok(st == 201, "Dan's comment added", (st, cm))
    h.api("POST", f"/api/follows/{cat['id']}", {}, dan["token"])
    h.api("POST", f"/api/dm/{ann['id']}/messages", {"content": "Hi Ann from Cat", "clientId": "seedprofile01"}, cat["token"])

    # API: the public card
    st, card = h.api("GET", f"/api/users/{cat['id']}/profile", tok=ann["token"])
    h.ok(st == 200 and card.get("name") == "Cat Rahman" and "/api/avatars/" in (card.get("avatar") or ""), "API: Cat's card has her name and photo", (st, card))
    h.ok(card and not any(k in card for k in ("email", "phone", "password", "passwordHash")), "API: no email, phone or password in the card", card)
    h.ok(card and card.get("profileRole") == "expert", "API: role comes through (expert)", card)
    st, card_guest = h.api("GET", f"/api/users/{cat['id']}/profile")
    h.ok(st == 200 and card_guest.get("avatar"), "API: card readable signed out too (like the feed)", (st, card_guest))
    st, dcard = h.api("GET", f"/api/users/{dan['id']}/profile", tok=ann["token"])
    h.ok(st == 200 and not dcard.get("avatar"), "API: Dan (no photo) has no avatar", (st, dcard))
    st, _ = h.api("GET", "/api/users/no-such-person-xyz/profile", tok=ann["token"])
    h.ok(st == 404, "API: unknown person -> 404", st)

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang, w in [("en", 360), ("bn", 360), ("en", 1280)]:
            k = f"{lang}-{w}"
            ctx, pg = await h.page(b, ann, lang, w, h=820)
            try:
                # 1. Home feed -> Cat's name
                try:
                    await pg.get_by_text("Cat second post about fish feed").first.wait_for(timeout=20000)
                except Exception:
                    pass
                await pg.screenshot(path=f"{h.shots}/{k}-0-feed.png")
                h.ok(await click_visible_text(pg, "Cat Rahman"), f"{k}: Cat's name on her post is on the feed")
                h.ok(await wait_profile(pg, "Cat Rahman"), f"{k}: feed -> Cat's profile opens")
                h.ok(await pg.evaluate(IMG_JS, [cat["id"], 56]) >= 1, f"{k}: Cat's photo shows large on her profile")
                h.ok(await pg.get_by_text("Cat first post about pond aeration").last.is_visible(), f"{k}: her real posts are listed")
                h.ok(await visible_text(pg, "user-follow") is not None, f"{k}: Follow button on someone else's profile")
                h.ok(await h.no_overflow(pg), f"{k}: profile fits the screen")
                await pg.screenshot(path=f"{h.shots}/{k}-1-cat-profile.png", full_page=True)

                # 2. Followers -> Dan
                loc = pg.locator(T("profile-hero-followers"))
                for i in range(await loc.count() - 1, -1, -1):
                    if await loc.nth(i).is_visible():
                        await loc.nth(i).click(); break
                await pg.wait_for_timeout(2500)
                h.ok(await click_visible_text(pg, "Dan Mia"), f"{k}: Dan is in Cat's followers")
                h.ok(await wait_profile(pg, "Dan Mia"), f"{k}: followers -> Dan's profile opens")
                h.ok(await pg.evaluate(IMG_JS, [dan["id"], 1]) == 0 and await pg.get_by_text("DM", exact=True).last.is_visible(),
                     f"{k}: Dan has no photo, so his initials show")
                h.ok(await visible_text(pg, "user-posts-empty") is not None, f"{k}: Dan has no posts, and it says so")
                await pg.screenshot(path=f"{h.shots}/{k}-2-dan-profile.png")

                # 3. Post page -> commenter Dan
                await pg.goto(h.base, wait_until="load"); await pg.wait_for_timeout(3500)
                await pg.get_by_text("Cat second post about fish feed").first.click()
                await pg.wait_for_timeout(2500)
                try:
                    await pg.get_by_text("Dan says thanks for the tip").last.wait_for(timeout=10000)
                except Exception:
                    pass
                h.ok(await click_visible_text(pg, "Dan Mia"), f"{k}: Dan's name on his comment")
                h.ok(await wait_profile(pg, "Dan Mia"), f"{k}: comment -> Dan's profile opens")

                # 4. Own name -> own Profile tab
                await pg.goto(h.base, wait_until="load"); await pg.wait_for_timeout(3500)
                h.ok(await click_visible_text(pg, "Ann Begum"), f"{k}: Ann's own post is on the feed")
                await pg.wait_for_timeout(2500)
                own = await visible_text(pg, "profile-stat-followers")
                h.ok(own is not None and await visible_text(pg, "user-follow") is None, f"{k}: own name -> own Profile tab, no Follow button")
                h.ok(await pg.get_by_text("Ann post about rice seedlings").last.is_visible(), f"{k}: own Posts tab shows her own post")
                await pg.screenshot(path=f"{h.shots}/{k}-3-own.png")

                # 5. Chat header photo -> Cat's profile
                await pg.goto(h.base, wait_until="load"); await pg.wait_for_timeout(3500)
                await pg.locator(T("tab-chats")).first.click(); await pg.wait_for_timeout(2000)
                await pg.get_by_role("button", name="Cat Rahman").first.click()
                await pg.locator(T("dm-input")).first.wait_for(timeout=15000)
                await pg.wait_for_timeout(2500)
                h.ok(await pg.evaluate(IMG_JS, [cat["id"], 30]) >= 1, f"{k}: chat shows Cat's photo (header/message)")
                await pg.screenshot(path=f"{h.shots}/{k}-4-chat.png")
                await pg.locator(T("chat-header-profile")).last.click()
                h.ok(await wait_profile(pg, "Cat Rahman") and await pg.evaluate(IMG_JS, [cat["id"], 56]) >= 1, f"{k}: chat -> Cat's profile with her photo")

                # 6. Connect card -> Cat's profile
                await pg.goto(h.base, wait_until="load"); await pg.wait_for_timeout(3500)
                await tap_tab(pg, ["Connect", "কানেক্ট", "যোগাযোগ"])
                try:
                    await pg.locator(T("connect-card")).first.wait_for(timeout=15000)
                    await pg.locator(T("connect-card")).filter(has_text="Cat Rahman").first.click()
                    h.ok(await wait_profile(pg, "Cat Rahman") and await pg.evaluate(IMG_JS, [cat["id"], 56]) >= 1, f"{k}: Connect -> Cat's profile with her photo")
                except Exception as e:
                    h.ok(False, f"{k}: Connect -> Cat's profile with her photo", e)
                await pg.screenshot(path=f"{h.shots}/{k}-5-connect-profile.png")
            except Exception as e:
                h.ok(False, f"{k}: run", e)
                await pg.screenshot(path=f"{h.shots}/{k}-error.png")
            await ctx.close()
        await b.close()
    h.done()


asyncio.run(main())
