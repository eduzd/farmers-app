"""Profile options and Edit profile are full pages (web build in ./dist).

- Your own profile: the three-dot button opens the "Profile options" page (back arrow + standard title,
  every option grouped), not a bottom sheet. Rows navigate; back returns.
- "Edit profile" (profile button, options page row, Settings row) opens the full "Edit profile" page; Save
  updates the profile and returns.
- Other people's profiles keep their quick three-dot sheet (Share, Mute, Block, Report).
- English and Bangla, light and dark, phone (390) and computer (1280): page fills the screen, no sideways
  scroll, dark background in dark mode with readable text and no bright patches.

    python3 tests/check-profile-pages-web.py [shots_dir]
"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("profile-pages")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)
other = h.signup("karim", "Karim Fish")
_comms = h.api("GET", "/api/communities")[1]
_cid = (next((c for c in _comms if c["slug"] == "farmer"), None) or _comms[0])["id"]
h.api("POST", "/api/posts", {"communityId": _cid, "content": "Karim post about pond water"}, other["token"])

SCAN = r"""() => {
  const parse = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const blend = (top, bot) => { const a = top[3]; return [top[0]*a+bot[0]*(1-a), top[1]*a+bot[1]*(1-a), top[2]*a+bot[2]*(1-a), 1]; };
  const bgOf = (el) => { const chain = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 0.99) break; } }
    let col = [255,255,255,1]; for (let i = chain.length - 1; i >= 0; i--) col = blend(chain[i], col); return col; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const out = { low: [], bright: [], root: null };
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth)) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || +s.opacity < 0.2) continue;
    if (e.checkVisibility && !e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() && !/^[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\s]+$/u.test(n.textContent.trim()));
    if (own) { const fg = parse(s.color); if (fg) { const bg = bgOf(e); const cr = ratio(blend(fg, bg), bg);
      if (cr < 3) out.low.push(cr.toFixed(2) + ' ' + s.color + ' "' + e.textContent.trim().slice(0, 28) + '"'); } }
    const bgc = parse(s.backgroundColor);
    // The illustrated avatar faces keep their own colours (they are pictures, like photos).
    if (bgc && bgc[3] > 0.5 && r.width * r.height > 2400 && lum(bgc) > 0.45 && e.tagName !== 'IMG' && !e.closest('[data-testid=edit-profile-avatar-picker]'))
      out.bright.push('rgb(' + bgc.slice(0,3).join(',') + ') ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + ((e.innerText || '').trim().slice(0, 28) || e.dataset.testid || e.tagName) + '"');
  }
  out.root = bgOf(document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body).slice(0,3).map(Math.round);
  out.low = [...new Set(out.low)]; out.bright = [...new Set(out.bright)];
  return out;
}"""

# The header title: the biggest text in the top 72px that is not a button label.
TITLE = r"""(want) => {
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.top > 72 || r.bottom < 0) continue;
    if (e.checkVisibility && !e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() === want)) continue;
    const s = getComputedStyle(e);
    return {font: s.fontFamily.split(',')[0].replace(/"/g,'').trim(), size: s.fontSize, weight: s.fontWeight};
  }
  return null;
}"""

# A back arrow in the header (left side, top 64px).
BACK = r"""() => { const pages = [...document.querySelectorAll('[data-testid=profile-options-page],[data-testid=edit-profile-page],[data-testid=settings-edit-profile]')].filter(e => e.checkVisibility());
  const x0 = pages.length ? Math.min(...pages.map(e => e.getBoundingClientRect().left)) : 0;
  return [...document.querySelectorAll('[role=button],a,button')].some(e => { const r = e.getBoundingClientRect();
  if (!r.width || r.top > 64 || r.bottom < 4 || r.left > x0 + 70 || r.left < x0 - 40) return false;
  const at = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return at && (e === at || e.contains(at)); }); }"""

BACK_CLICK = r"""() => { const pages = [...document.querySelectorAll('[data-testid=profile-options-page],[data-testid=edit-profile-page],[data-testid=settings-edit-profile]')].filter(e => e.checkVisibility());
  const x0 = pages.length ? Math.min(...pages.map(e => e.getBoundingClientRect().left)) : 0;
  return [...document.querySelectorAll('[role=button],a,button')].filter(e => { const r = e.getBoundingClientRect();
  if (!r.width || r.top > 64 || r.bottom < 4 || r.left > x0 + 70 || r.left < x0 - 40) return false;
  const at = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return at && (e === at || e.contains(at)); }).pop(); }"""

OPT_TITLE = {"en": "Profile options", "bn": "প্রোফাইল অপশন"}
EDIT_TITLE = {"en": "Edit profile", "bn": "প্রোফাইল এডিট"}
SETTINGS_TITLE = {"en": "Settings", "bn": "সেটিংস"}
ROWS = ["profile-vendor-dashboard", "profile-seller-hub", "profile-my-listings", "profile-admin-dashboard", "profile-my-posts",
        "profile-saved-posts", "profile-my-orders", "profile-applications", "profile-rfq", "profile-badges", "profile-wallet",
        "profile-wishlist", "profile-delivery-tracking", "profile-address", "profile-community", "profile-options-edit",
        "profile-settings", "profile-logout-button"]
GROUPS = ["profile-options-selling", "profile-options-activity", "profile-options-shopping", "profile-options-app"]


async def open_app(b, lang, w, theme):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 600 else 820}, color_scheme=theme)
    await ctx.add_init_script("localStorage.setItem('theme_preference', %s);" % json.dumps(theme) + h.init_script(admin, lang))
    pg = await ctx.new_page()
    tag = f"{lang}-{theme}-{w}"
    pg.on("pageerror", lambda e: h.errors.append(f"{tag}: {str(e)[:200]}"))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(h.base + "/", wait_until="load", timeout=180000)
    await pg.wait_for_timeout(3000)
    return ctx, pg


async def to_profile(pg):
    await pg.locator('[role=tab][href="/Main/Profile"]').last.click()
    await pg.wait_for_timeout(1500)




async def back(pg):
    ok = await pg.evaluate("() => { const e = (" + BACK_CLICK + ")(); if (e) { e.click(); return true; } return false; }")
    await pg.wait_for_timeout(1500)
    return ok


async def click_vis(pg, tid):
    loc = pg.locator(T(tid))
    for i in range(await loc.count() - 1, -1, -1):
        if await loc.nth(i).is_visible():
            await loc.nth(i).click()
            return True
    return False


async def vis_loc(pg, tid):
    loc = pg.locator(T(tid))
    for i in range(await loc.count() - 1, -1, -1):
        if await loc.nth(i).is_visible():
            return loc.nth(i)
    return None


async def visible(pg, tid, ms=8000):
    for _ in range(max(1, ms // 250)):
        if await vis_loc(pg, tid):
            return True
        await pg.wait_for_timeout(250)
    return False


async def full_page(pg, tid):
    l = await vis_loc(pg, tid)
    box = await l.bounding_box() if l else None
    vw = await pg.evaluate("innerWidth")
    # On a computer screen the whole app sits in a centred 640px column, like every other page.
    want = min(vw, 640)
    return bool(box) and box["width"] >= want - 2 and box["y"] >= 40 and abs((box["x"] + box["width"] / 2) - vw / 2) < 4


async def look(pg, tag, theme):
    r = await pg.evaluate(SCAN)
    h.ok(await H.no_overflow(pg), f"{tag}: no sideways scroll")
    if theme == "dark":
        h.ok(sum(r["root"]) / 3 < 50, f"{tag}: dark page background", r["root"])
        h.ok(not r["low"], f"{tag}: all text readable", json.dumps(r["low"][:6], ensure_ascii=False))
        bright = [x for x in r["bright"] if "help-fab" not in x]
        h.ok(not bright, f"{tag}: no bright patches", json.dumps(bright[:6], ensure_ascii=False))
    else:
        h.ok(sum(r["root"]) / 3 > 200, f"{tag}: light page background", r["root"])
        h.ok(not r["low"], f"{tag}: all text readable", json.dumps(r["low"][:6], ensure_ascii=False))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        settings_title = {}
        for lang in ("en", "bn"):
            for theme in ("light", "dark"):
                for w in (390, 1280):
                    tag = f"{lang} {theme} {w}"
                    ctx, pg = await open_app(b, lang, w, theme)
                    await to_profile(pg)
                    # --- three-dot -> full Profile options page
                    await pg.locator(T("profile-more-button")).locator('[role=button]').last.click()
                    ok = await visible(pg, "profile-options-page")
                    h.ok(ok, f"{tag}: three-dot opens the Profile options page")
                    h.ok(await pg.locator(T("profile-options-sheet")).count() == 0, f"{tag}: no bottom sheet")
                    if ok:
                        h.ok(await full_page(pg, "profile-options-page"), f"{tag}: options page fills the screen under the title bar")
                        tt = await pg.evaluate(TITLE, OPT_TITLE[lang])
                        h.ok(bool(tt), f"{tag}: title '{OPT_TITLE[lang]}'", tt)
                        opt_tt = tt
                        h.ok(await pg.evaluate(BACK), f"{tag}: back arrow")
                        missing = [g for g in GROUPS if not await pg.locator(T(g)).count()]
                        h.ok(not missing, f"{tag}: four groups", missing)
                        missing = [r for r in ROWS if not await pg.locator(T(r)).count()]
                        h.ok(not missing, f"{tag}: every option is on the page ({len(ROWS)})", missing)
                        await pg.wait_for_timeout(600)
                        await pg.screenshot(path=f"{h.shots}/options-{lang}-{theme}-{w}.png", full_page=True)
                        await look(pg, f"{tag} options page", theme)
                        if w == 390 and theme == "light":
                            # saved posts expand in place
                            await click_vis(pg, "profile-saved-posts")
                            h.ok(await visible(pg, "profile-saved-list", 4000), f"{tag}: saved posts open in place")
                            # a row goes to its page, back returns to the options page
                            await click_vis(pg, "profile-my-orders")
                            await pg.wait_for_timeout(1500)
                            h.ok(not await vis_loc(pg, "profile-options-page"), f"{tag}: My orders row opens its page")
                            await back(pg)
                            h.ok(await visible(pg, "profile-options-page", 5000), f"{tag}: back returns to Profile options")
                            # Settings row
                            await click_vis(pg, "profile-settings")
                            h.ok(await visible(pg, "settings-edit-profile"), f"{tag}: Settings row opens Settings")
                            settings_title[lang] = await pg.evaluate(TITLE, SETTINGS_TITLE[lang])
                            h.ok(bool(opt_tt) and opt_tt == settings_title[lang], f"{tag}: options title styled like the Settings title", [opt_tt, settings_title[lang]])
                            # Settings -> Edit profile is the full page too
                            await click_vis(pg, "settings-edit-profile")
                            h.ok(await visible(pg, "edit-profile-page"), f"{tag}: Settings > Edit profile opens the Edit profile page")
                            await back(pg)
                            await back(pg)
                            # options page Edit profile row
                            if await visible(pg, "profile-options-edit", 4000):
                                await click_vis(pg, "profile-options-edit")
                                h.ok(await visible(pg, "edit-profile-page"), f"{tag}: options page Edit profile row opens the Edit profile page")
                                await back(pg)
                            # header back arrow returns to the profile
                            await back(pg)
                            h.ok(await visible(pg, "profile-edit-button", 5000), f"{tag}: back from options returns to the profile")
                        else:
                            await back(pg)
                    # --- Edit profile button -> full Edit profile page
                    if not await visible(pg, "profile-edit-button", 4000):
                        await to_profile(pg)
                    await click_vis(pg, "profile-edit-button")
                    ok = await visible(pg, "edit-profile-page")
                    h.ok(ok, f"{tag}: Edit profile opens the Edit profile page")
                    h.ok(await pg.locator('[role=dialog][aria-modal=true]').count() == 0, f"{tag}: Edit profile is not a popup")
                    if ok:
                        h.ok(await full_page(pg, "edit-profile-page"), f"{tag}: edit page fills the screen under the title bar")
                        tt = await pg.evaluate(TITLE, EDIT_TITLE[lang])
                        h.ok(bool(tt), f"{tag}: title '{EDIT_TITLE[lang]}'", tt)
                        h.ok(await pg.evaluate(BACK), f"{tag}: back arrow")
                        for tid in ("edit-profile-name", "edit-profile-username", "edit-profile-phone", "edit-profile-location",
                                    "edit-profile-bio", "edit-profile-category-fish", "edit-profile-upload", "edit-profile-choose-avatar"):
                            h.ok(await pg.locator(T(tid)).count() > 0, f"{tag}: edit page has {tid}")
                        sv = await (await vis_loc(pg, "save-profile")).bounding_box()
                        vh = await pg.evaluate("innerHeight")
                        h.ok(bool(sv) and sv["y"] + sv["height"] <= vh + 1, f"{tag}: Save button on screen", sv)
                        await click_vis(pg, "edit-profile-choose-avatar")
                        h.ok(await visible(pg, "edit-profile-avatar-picker", 3000), f"{tag}: avatar choices open")
                        await pg.wait_for_timeout(500)
                        await pg.screenshot(path=f"{h.shots}/edit-{lang}-{theme}-{w}.png", full_page=True)
                        await look(pg, f"{tag} edit page", theme)
                        if w == 390 and theme == "light":
                            new_name = "Rahim Uddin" if lang == "en" else "রহিম উদ্দিন"
                            await (await vis_loc(pg, "edit-profile-name")).fill(new_name)
                            await (await vis_loc(pg, "edit-profile-bio")).fill(f"Tilapia ponds in Mymensingh {lang}")
                            await click_vis(pg, "edit-profile-category-fish")
                            await click_vis(pg, "save-profile")
                            await pg.wait_for_timeout(3000)
                            h.ok(not await vis_loc(pg, "edit-profile-page"),
                                 f"{tag}: Save closes the edit page")
                            body = await pg.locator("body").inner_text()
                            h.ok(new_name in body, f"{tag}: profile shows the new name")
                            st, me = h.api("GET", "/api/me/profile", None, admin["token"])
                            h.ok(new_name in json.dumps(me, ensure_ascii=False), f"{tag}: name saved on the server", me)
                            st, ab = h.api("GET", "/api/me/about", None, admin["token"])
                            h.ok(f"Tilapia ponds in Mymensingh {lang}" == (ab or {}).get("bio"), f"{tag}: bio saved on the server", ab)
                    await ctx.close()
        # Options page title uses the same style as other back-arrow pages (Settings).
        # (checked from the light 390 pass)
        # --- someone else's profile keeps the quick sheet
        for lang in ("en", "bn"):
            ctx, pg = await open_app(b, lang, 390, "light")
            await pg.wait_for_timeout(2500)
            try:
                await pg.get_by_text("Karim post about pond water").first.wait_for(timeout=10000)
            except Exception:
                pass
            loc = pg.get_by_text("Karim Fish", exact=True)
            for i in range(await loc.count()):
                if await loc.nth(i).is_visible():
                    await loc.nth(i).click(); break
            await pg.wait_for_timeout(3000)
            has = await visible(pg, "user-profile-more", 5000)
            h.ok(has, f"{lang} other profile: three-dot button")
            if has:
                await pg.locator(T("user-profile-more")).locator('[role=button]').first.click()
                await pg.wait_for_timeout(1200)
                body = await pg.locator("body").inner_text()
                want = ["Report", "Block"] if lang == "en" else ["রিপোর্ট", "ব্লক"]
                h.ok(all(x in body for x in want), f"{lang} other profile: quick menu with Report and Block")
                h.ok(await pg.locator(T("profile-options-page")).count() == 0, f"{lang} other profile: does not open your options page")
                await pg.screenshot(path=f"{h.shots}/other-menu-{lang}.png")
            await ctx.close()
        await b.close()
    print("settings titles", settings_title)

asyncio.run(main())
h.done()
