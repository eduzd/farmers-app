"""Main app dark mode check on the web build (./dist), English and Bangla, phone width.

For every reachable main-app screen in dark mode it looks for:
  - text whose colour is too close to the colour behind it (contrast below 3:1),
  - bright patches (light surfaces larger than a chip) that glare in dark mode,
  - a page background that is not dark.
It also checks light mode stays exactly as before on a few screens (root background).

    python3 tests/check-dark-mode-web.py [shots_dir]   (STRICT=0 to only report)
"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

STRICT = os.environ.get("STRICT", "1") == "1"
ONLY = os.environ.get("ONLY")
LANGS = os.environ.get("LANGS", "en,bn").split(",")

h = H("dark-mode")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)
h.login(admin)
seller = h.signup("seller", "Karim Seller")
_st, SHOP = h.api("POST", "/api/admin/manage/stores", {"name": "Padma Fish Feed", "owner": seller["email"]}, admin["token"])
assert _st == 201, (_st, SHOP)
_st, PROD = h.api("POST", "/api/admin/manage/products", {"storeId": SHOP["id"], "category": "vegetables", "name": "Fresh tomatoes", "price": 80,
                  "quantity": 40, "unit": "kg"}, admin["token"])
assert _st == 201, (_st, PROD)
h.api("POST", "/api/posts", {"content": "Pond water turned green this morning, what should I do?"}, seller["token"])
SLUG, PID = SHOP["slug"], PROD["id"]

PAGES = [
    ("community", "/", [("tab", 0)], True),
    ("connect", "/", [("tab", 1)], True),
    ("voice-rooms", "/", [("tab", 1), ("tid", "connect-voice-rooms-open")], True),
    ("market", "/", [("tab", 2)], True),
    ("market-notifications", "/", [("tab", 2), ("tid", "market-bell")], True),
    ("chats", "/", [("tab", 3)], True),
    ("profile", "/", [("tab", 4)], True),
    ("settings", "/", [("tab", 4), ("text", ["Settings", "সেটিংস"])], True),
    ("my-orders", "/", [("tab", 4), ("text", ["My Orders", "আমার অর্ডার"])], True),
    ("my-posts", "/", [("tab", 4), ("text", ["My Posts", "আমার পোস্ট"])], True),
    ("seller-hub", "/", [("tab", 4), ("tid", "profile-seller-hub")], True),
    ("calculate", "/", [("text", ["Calculate", "হিসাব"])], True),
    ("bepari", "/", [("text", ["Calculate", "হিসাব"]), ("text", ["Bepari calculator", "ব্যাপারী ক্যালকুলেটর"])], True),
    ("arat", "/", [("text", ["Calculate", "হিসাব"]), ("text", ["Arat calculator", "আড়ত ক্যালকুলেটর"])], True),
    ("signed-out-start", "/", [], False),
    ("shop-page", "/shop/{slug}", [], True),
    ("product-page", "/product/{pid}", [], True),
    ("cart", "/product/{pid}", [("tid", "product-add-to-cart"), ("tid", "product-cart-badge")], True),
    ("checkout", "/product/{pid}", [("tid", "product-add-to-cart"), ("tid", "product-cart-badge"), ("text", ["Checkout", "চেকআউট"])], True),
    ("guest-shops", "/", [("tid", "button-shop-no-account")], False),
    ("home-notifications", "/", [("tab", 0), ("label", "Notifications")], True),
    ("tools", "/", [("text", ["Tools", "\u099f\u09c1\u09b2\u09b8"])], True),
    ("services", "/", [("text", ["Services", "\u09b8\u09c7\u09ac\u09be"])], True),
    ("weather", "/", [("text", ["Weather", "\u0986\u09ac\u09b9\u09be\u0993\u09af\u09bc\u09be"])], True),
    ("more-tools", "/", [("text", ["More tools", "\u0986\u09b0\u0993 \u099f\u09c1\u09b2\u09b8"])], True),
    ("all-tools", "/", [("text", ["All tools", "\u09b8\u09ac \u099f\u09c1\u09b2\u09b8"])], True),
    ("create-post", "/", [("text", ["Create post", "\u09aa\u09cb\u09b8\u09cd\u099f \u0995\u09b0\u09c1\u09a8"])], True),
    ("connect-filter", "/", [("tab", 1), ("tid", "connect-filter-button")], True),
    ("support-chat", "/", [("tab", 1), ("tid", "connect-help-fab")], True),
    ("welfare", "/", [("text", ["Welfare Association", "Welfare Association"])], True),
    ("events", "/", [("text", ["Events calendar", "Events calendar"])], True),
]
if ONLY:
    PAGES = [p for p in PAGES if p[0] in ONLY.split(",")]

SCAN = r"""() => {
  const parse = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const blend = (top, bot) => { const a = top[3]; return [top[0]*a+bot[0]*(1-a), top[1]*a+bot[1]*(1-a), top[2]*a+bot[2]*(1-a), 1]; };
  // effective background: stack of ancestor backgrounds, starting from the root colour
  const bgOf = (el) => { const chain = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 0.99) break; } }
    let col = [255,255,255,1]; for (let i = chain.length - 1; i >= 0; i--) col = blend(chain[i], col); return col; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const hasImgBg = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage && s.backgroundImage !== 'none') return true; } return false; };
  const out = { low: [], soft: [], bright: [], root: null };
  const vis = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth;  // whole scrolled content, not just the first screen
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (!vis(r)) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || +s.opacity < 0.2) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fg = parse(s.color); if (!fg) continue;
      const bg = bgOf(e);
      const fgb = blend(fg, bg);
      const cr = ratio(fgb, bg);
      const big = parseFloat(s.fontSize) >= 18 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
      if (cr >= 3 && cr < (big ? 3 : 4.5) && !hasImgBg(e)) out.soft.push(cr.toFixed(2) + ' ' + s.fontSize + ' ' + s.color + ' on rgb(' + bg.slice(0,3).map(Math.round).join(',') + ') "' + e.textContent.trim().slice(0, 28) + '"');
      if (cr < 3 && !hasImgBg(e)) out.low.push(cr.toFixed(2) + ' ' + s.color + ' on rgb(' + bg.slice(0,3).map(Math.round).join(',') + ') "' + e.textContent.trim().slice(0, 28) + '"');
    }
    const bgc = parse(s.backgroundColor);
    if (bgc && bgc[3] > 0.5 && r.width * r.height > 2400 && lum(bgc) > 0.45 && e.tagName !== 'IMG') {
      out.bright.push('rgb(' + bgc.slice(0,3).join(',') + ') ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + ((e.innerText || '').trim().slice(0, 28) || e.dataset.testid || e.tagName) + '"');
    }
  }
  out.root = bgOf(document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body).slice(0,3).map(Math.round);
  out.low = [...new Set(out.low)]; out.soft = [...new Set(out.soft)]; out.bright = [...new Set(out.bright)];
  return out;
}"""


def init_theme(theme):
    return "localStorage.setItem('theme_preference', %s);" % json.dumps(theme)


async def step(pg, s, lang):
    kind = s[0]
    if kind == "tab":
        await pg.locator('[role="tab"]').nth(s[1]).click()
    elif kind == "tid":
        await pg.locator(T(s[1])).first.click(timeout=8000)
    elif kind == "label":
        loc = pg.get_by_label(s[1])
        if not await loc.count():
            loc = pg.get_by_label("\u09a8\u09cb\u099f\u09bf\u09ab\u09bf\u0995\u09c7\u09b6\u09a8")
        await loc.first.click(timeout=8000)
    elif kind == "text":
        en, bn = s[1]
        want = bn if lang == "bn" else en
        loc = pg.get_by_text(want, exact=True)
        if not await loc.count():
            loc = pg.get_by_text(en, exact=True)
        if not await loc.count():
            loc = pg.get_by_text(want)
        await loc.first.click(timeout=8000)
    await pg.wait_for_timeout(2000)


async def open_page(b, acc, lang, path, theme):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark" if theme == "dark" else "light")
    await ctx.add_init_script(init_theme(theme) + (h.init_script(acc, lang) if acc else "localStorage.setItem('language', %s);" % json.dumps(lang)))
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: h.errors.append(f"{lang}-{theme}: {str(e)[:200]}"))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(h.base + path, wait_until="load", timeout=180000)
    await pg.wait_for_timeout(3500)
    return ctx, pg


async def main():
    report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in LANGS:
            for name, path, steps, logged in PAGES:
                ctx, pg = await open_page(b, admin if logged else None, lang, path.format(slug=SLUG, pid=PID), "dark")
                reached = True
                try:
                    for s in steps:
                        await step(pg, s, lang)
                except Exception as e:
                    reached = False
                    print("UNREACHED", lang, name, str(e)[:120])
                    try:
                        print("   PAGE:", (await pg.evaluate("document.body.innerText"))[:900].replace("\n", " | "))
                    except Exception:
                        pass
                await pg.screenshot(path=f"{h.shots}/dark-{lang}-{name}.png")
                r = await pg.evaluate(SCAN)
                report[f"{lang}-{name}"] = r
                root_dark = sum(r["root"]) / 3 < 50
                if STRICT:
                    h.ok(reached, f"{lang} {name}: reached")
                    h.ok(root_dark, f"{lang} {name}: dark page background", r["root"])
                    h.ok(not r["low"], f"{lang} {name}: all text readable (contrast >= 3)", json.dumps(r["low"][:8], ensure_ascii=False))
                    h.ok(not r["bright"], f"{lang} {name}: no bright patches", json.dumps(r["bright"][:8], ensure_ascii=False))
                else:
                    print(f"== {lang} {name} reached={reached} root={r['root']} low={len(r['low'])} bright={len(r['bright'])}")
                    for x in r["low"][:15]:
                        print("   LOW   ", x)
                    for x in r["soft"][:10]:
                        print("   SOFT  ", x)
                    for x in r["bright"][:10]:
                        print("   BRIGHT", x)
                await ctx.close()
        # light mode: page background stays the Maya pale blue / white
        for name, path, steps in [("community", "/", [("tab", 0)]), ("market", "/", [("tab", 2)])]:
            ctx, pg = await open_page(b, admin, "en", path, "light")
            for s in steps:
                await step(pg, s, "en")
            await pg.screenshot(path=f"{h.shots}/light-en-{name}.png")
            r = await pg.evaluate(SCAN)
            h.ok(sum(r["root"]) / 3 > 200, f"light en {name}: light page background unchanged", r["root"])
            await ctx.close()
        await b.close()
    json.dump(report, open(f"{h.shots}/report.json", "w"), ensure_ascii=False, indent=1)

asyncio.run(main())
h.done()
