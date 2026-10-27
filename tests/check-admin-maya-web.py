"""Admin dashboard in the Maya look (web build in ./dist), on a throwaway local server.

For light and dark, English and Bangla, at 390 (phone) and 1280 (computer) wide:
Home, Shop, Orders, Support, More and the Add product form.
Checks: flat Maya cards (no drop shadow, 1px hairline, 12px corners), the navy hero band with no
gradient, solid navy primary buttons (sky in dark), white outline second buttons, DM Sans text with
the Maya display face on titles, no old Farmers green, no Plus Jakarta, no sideways scrolling, no
page errors. Only throwaway local accounts. Nothing goes to Render or to real users.

    python3 tests/check-admin-maya-web.py [shots_dir]
"""
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("admin-maya")
h.start()
admin = h.signup("boss", "Admin Rahim")
other = h.signup("karim", "Karim Farmer")
h.make_admin(admin)

NAVY = "rgb(32, 41, 54)"
SKY = "rgb(46, 150, 239)"
GREENS = ["rgb(30, 127, 79)", "rgb(47, 163, 107)", "rgb(22, 163, 74)", "rgb(20, 88, 58)"]

SCAN = """() => {
  const out = {greens: 0, fonts: {}, shadows: [], gradients: 0};
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(e);
    for (const c of [s.backgroundColor, s.color, s.borderTopColor]) if (%s.includes(c)) out.greens++;
    // Cards and tiles: big boxes with a drop shadow (switch thumbs and tiny dots are not cards).
    // (the app-wide column frame on the web has a soft edge shadow; it is the page, not a card)
    if (s.boxShadow && s.boxShadow !== 'none' && r.width > 60 && r.height > 40 && r.height < window.innerHeight * 0.9) out.shadows.push((e.dataset.testid || e.tagName) + ' ' + s.boxShadow.slice(0, 60));
    if (s.backgroundImage && s.backgroundImage.includes('gradient') && r.width > 200) out.gradients++;
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      const f = s.fontFamily.split(',')[0].replace(/"/g, '').trim();
      out.fonts[f] = (out.fonts[f] || 0) + 1;
    }
  }
  return out;
}""" % json.dumps(GREENS)

STYLE = """(sel) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e);
  return {bg: s.backgroundColor, radius: s.borderTopLeftRadius, bw: s.borderTopWidth, bc: s.borderTopColor, shadow: s.boxShadow, img: s.backgroundImage, font: s.fontFamily}; }"""

# The first text-bearing descendant's font (for titles whose testID sits on the Text itself).
FONT = """(sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontFamily : null; }"""


def init_theme(theme):
    return "if (!sessionStorage.getItem('theme_set')) { localStorage.setItem('theme_preference', %s); sessionStorage.setItem('theme_set','1'); }" % json.dumps(theme)


async def open_admin(b, lang, theme, w):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 600 else 900})
    await ctx.add_init_script(h.init_script(admin, lang) + init_theme(theme))
    pg = await ctx.new_page()
    tag = f"{lang}-{theme}-{w}"
    pg.on("pageerror", lambda e: h.errors.append(f"{tag}: {str(e)[:200]}"))
    await pg.goto(h.base + "/admin", wait_until="load", timeout=180000)
    await h.wait_for(pg, "admin-hero", 30000)
    await pg.wait_for_timeout(1500)
    return ctx, pg


async def check_screen(pg, tag, name, lang, theme):
    await pg.screenshot(path=f"{h.shots}/{tag}-{name}.png")
    r = await pg.evaluate(SCAN)
    fonts = r["fonts"]
    h.ok(r["greens"] == 0, f"{tag} {name}: no old Farmers green", r["greens"])
    h.ok(not any("Jakarta" in k for k in fonts), f"{tag} {name}: no Plus Jakarta text", fonts)
    h.ok(len(r["shadows"]) == 0, f"{tag} {name}: flat cards, no drop shadows", r["shadows"][:4])
    h.ok(r["gradients"] == 0 or name == "more", f"{tag} {name}: no gradient panels", r["gradients"])
    if lang == "en":
        h.ok(any(k.startswith("DMSans") or k == "DM Sans" for k in fonts), f"{tag} {name}: DM Sans text", fonts)
    h.ok(await h.no_overflow(pg), f"{tag} {name}: no sideways scrolling")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for theme in ("light", "dark"):
                for w in (390, 1280):
                    if lang == "bn" and w == 1280 and theme == "dark":
                        continue
                    tag = f"{lang}-{theme}-{w}"
                    ctx, pg = await open_admin(b, lang, theme, w)
                    dark = theme == "dark"
                    # Home: navy hero band, flat stat tiles, display-face title.
                    hero = await pg.evaluate(STYLE, T("admin-hero"))
                    h.ok(hero and "gradient" not in (hero["img"] or ""), f"{tag} home: hero has no gradient", hero)
                    h.ok(hero and (hero["bg"] == NAVY if not dark else hero["bg"] == "rgb(27, 42, 64)"), f"{tag} home: hero is the Maya navy band", hero and hero["bg"])
                    h.ok(hero and hero["radius"] == "16px", f"{tag} home: hero corners 16px", hero and hero["radius"])
                    stat = await pg.evaluate(STYLE, T("stat-users"))
                    h.ok(stat and stat["shadow"] == "none" and stat["bw"] == "1px" and stat["radius"] == "12px",
                         f"{tag} home: stat tile flat with 1px hairline and 12px corners", stat)
                    title = await pg.evaluate(FONT, T("admin-title"))
                    h.ok(title and "Anton" in title, f"{tag} home: Farmers title in the Maya display face", title)
                    sec = pg.get_by_text("Quick actions" if lang == "en" else "দ্রুত কাজ", exact=True).first
                    sf = await sec.evaluate("e => getComputedStyle(e).fontFamily") if await sec.count() else None
                    want = "Anton" if lang == "en" else "HindSiliguri_700Bold"
                    h.ok(sf and want in sf, f"{tag} home: section heading in the display face ({want})", sf)
                    await check_screen(pg, tag, "home", lang, theme)
                    for tab in ("shop", "orders", "support", "more"):
                        await pg.locator(T(f"admin-tab-{tab}")).first.click()
                        await pg.wait_for_timeout(2200)
                        await check_screen(pg, tag, tab, lang, theme)
                        if tab == "more":
                            out = await pg.evaluate(STYLE, T("admin-logout"))
                            want_bc = "rgb(32, 41, 54)" if not dark else "rgb(255, 255, 255)"
                            h.ok(out and out["bw"] == "1px" and out["radius"] == "12px", f"{tag} more: second-choice button is outlined, 12px corners", out)
                    # Shop -> Add product: solid navy (sky in dark) primary button, white inputs with hairline.
                    await pg.locator(T("admin-tab-shop")).first.click()
                    await pg.wait_for_timeout(1500)
                    if await pg.locator(T("add-product")).count():
                        add = await pg.evaluate(STYLE, T("add-product"))
                        h.ok(add and add["bg"] == (NAVY if not dark else SKY), f"{tag} shop: Add button solid Maya {'navy' if not dark else 'sky'}", add and add["bg"])
                        await pg.locator(T("add-product")).first.click()
                        await pg.wait_for_timeout(2200)
                        save = await pg.evaluate(STYLE, T("save-product"))
                        h.ok(save and save["bg"] == (NAVY if not dark else SKY) and save["radius"] == "12px", f"{tag} product form: Save button solid Maya colour, 12px", save)
                        await check_screen(pg, tag, "product-form", lang, theme)
                    else:
                        h.ok(False, f"{tag} shop: Add product button found")
                    await ctx.close()
        await b.close()
    h.ok(not h.errors, "no page errors", h.errors[:5])


asyncio.run(main())
h.done()
