"""Maya look across the whole app (web build in ./dist): colours, DM Sans, Market header and rows.

    python3 tests/check-maya-whole-app-web.py [shots_dir]
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("maya-whole")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)

GREENS = ["rgb(30, 127, 79)", "rgb(47, 163, 107)", "rgb(22, 163, 74)", "rgb(20, 88, 58)"]

PAGES = [
    ("home", "/"),
    ("community", "/community"),
    ("connect", "/connect"),
    ("market", "/market"),
    ("chats", "/messages"),
    ("profile", "/profile"),
    ("calculate", "/calculate"),
    ("admin", "/admin"),
]

SCAN = """() => {
  const out = {greens: 0, fonts: {}, sky: 0, pink: 0, navy: 0};
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(e);
    for (const c of [s.backgroundColor, s.color, s.borderTopColor]) {
      if (%s.includes(c)) out.greens++;
      if (c === 'rgb(46, 150, 239)' || c === 'rgb(57, 177, 254)' || c === 'rgb(227, 244, 255)') out.sky++;
      if (c === 'rgb(255, 75, 183)' || c === 'rgb(255, 213, 238)') out.pink++;
      if (c === 'rgb(32, 41, 54)') out.navy++;
    }
    if (e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      const f = s.fontFamily.split(',')[0].replace(/"/g, '').trim();
      out.fonts[f] = (out.fonts[f] || 0) + 1;
    }
  }
  return out;
}""" % GREENS


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for name, path in PAGES:
                pg = await h.page(b, admin, lang, 390, path=path, h=844)
                await pg.wait_for_timeout(4500)
                await pg.screenshot(path=f"{h.shots}/{lang}-{name}.png")
                r = await pg.evaluate(SCAN)
                fonts = r["fonts"]
                jak = sum(v for k, v in fonts.items() if "Jakarta" in k)
                h.ok(r["greens"] == 0, f"{lang} {name}: no old Farmers green", str(r["greens"]))
                h.ok(jak == 0, f"{lang} {name}: no Plus Jakarta text", str(fonts))
                h.ok(r["sky"] > 0, f"{lang} {name}: Maya sky blue in use", str(r))
                if lang == "en":
                    dm = sum(v for k, v in fonts.items() if k.startswith("DMSans") or k == "DM Sans" or k.startswith("Anton"))
                    h.ok(dm > 0, f"en {name}: DM Sans / Maya heading text", str(fonts))
                if name == "market":
                    body = await pg.inner_text("body")
                    for gone in ("Flash sale", "Flash Sale", "Auction", "Bulk", "Compare", "Newest", "Nearby", "Price: Low", "Price: High"):
                        h.ok(gone not in body, f"{lang} market: '{gone}' row removed")
                    h.ok(await pg.locator(T("market-bell")).count() > 0, f"{lang} market: bell icon in header")
                    h.ok(await pg.locator(T("market-sell")).count() == 0, f"{lang} market: no Sell button")
                await pg.close()
        await b.close()

asyncio.run(main())
h.done()
