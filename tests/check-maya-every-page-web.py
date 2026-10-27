"""Walk every reachable screen of the web build (./dist) in English and Bangla and check the Maya look:
no old Farmers greens, no other stray green/teal, DM Sans text, Maya colours present, nothing wider than the screen.

    python3 tests/check-maya-every-page-web.py [shots_dir]
"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("maya-every")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)
h.login(admin)
seller = h.signup("seller", "Karim Seller")
# A shop and a product, so the product page, the shop page, cart and checkout have something to show.
_st, SHOP = h.api("POST", "/api/admin/manage/stores", {"name": "Padma Fish Feed", "owner": seller["email"]}, admin["token"])
assert _st == 201, (_st, SHOP)
_st, PROD = h.api("POST", "/api/admin/manage/products", {"storeId": SHOP["id"], "category": "vegetables", "name": "Fresh tomatoes", "price": 80,
                  "quantity": 40, "unit": "kg"}, admin["token"])
assert _st == 201, (_st, PROD)
SLUG, PID = SHOP["slug"], PROD["id"]

# (name, path, steps, logged_in). Steps: ("tab", i) | ("tid", testID) | ("text", [en, bn]) | ("back",)
PAGES = [
    ("community", "/", [("tab", 0)], True),
    ("connect", "/", [("tab", 1)], True),
    ("voice-rooms", "/", [("tab", 1), ("tid", "connect-voice-rooms-open")], True),
    ("voice-room-new", "/", [("tab", 1), ("tid", "connect-voice-room-create")], True),
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
    ("admin-home", "/admin", [], True),
    ("admin-shop", "/admin", [("tid", "admin-tab-shop")], True),
    ("admin-orders", "/admin", [("tid", "admin-tab-orders")], True),
    ("admin-support", "/admin", [("tid", "admin-tab-support")], True),
    ("admin-more", "/admin", [("tid", "admin-tab-more")], True),
    ("admin-notifications", "/admin", [("tid", "header-bell")], True),
    ("admin-official-accounts", "/admin", [("tid", "admin-tab-more"), ("text", ["Official accounts", "অফিসিয়াল অ্যাকাউন্ট"])], True),
    ("admin-voice-rooms", "/admin", [("tid", "admin-tab-more"), ("text", ["Voice rooms", "ভয়েস রুম"])], True),
    ("admin-carousel-ads", "/admin", [("tid", "shortcut-ads")], True),
    # Marketplace pages that need a product
    ("shop-page", "/shop/{slug}", [], True),
    ("product-page", "/product/{pid}", [], True),
    ("cart", "/product/{pid}", [("tid", "product-add-to-cart"), ("tid", "product-cart-badge")], True),
    ("checkout", "/product/{pid}", [("tid", "product-add-to-cart"), ("tid", "product-cart-badge"), ("text", ["Checkout", "চেকআউট"])], True),
    ("guest-shops", "/", [("tid", "button-shop-no-account")], False),
    ("guest-product", "/product/{pid}", [], False),
    # Every other admin page
    ("admin-shop-shops", "/admin", [("tid", "admin-tab-shop"), ("tid", "shop-section-shops")], True),
    ("admin-shop-categories", "/admin", [("tid", "admin-tab-shop"), ("tid", "shop-section-categories")], True),
    ("admin-add-product", "/admin", [("tid", "shortcut-add-product")], True),
    ("admin-official-message", "/admin", [("tid", "shortcut-official")], True),
    ("admin-restricted", "/admin", [("tid", "shortcut-restricted")], True),
    ("admin-open-shop", "/admin", [("tid", "shortcut-open-shop")], True),
    ("admin-notify", "/admin", [("tid", "shortcut-notify")], True),
    ("admin-search", "/admin", [("tid", "shortcut-search")], True),
    ("admin-delivery", "/admin", [("tid", "admin-tab-more"), ("tid", "more-delivery")], True),
    ("admin-payments", "/admin", [("tid", "admin-tab-more"), ("tid", "more-payments")], True),
    ("admin-market-prices", "/admin", [("tid", "admin-tab-more"), ("tid", "more-prices")], True),
    ("admin-posts-reports", "/admin", [("tid", "admin-tab-more"), ("tid", "more-posts")], True),
    ("admin-content", "/admin", [("tid", "admin-tab-more"), ("tid", "more-content")], True),
    ("admin-analytics", "/admin", [("tid", "admin-tab-more"), ("tid", "more-analytics")], True),
    ("admin-app-settings", "/admin", [("tid", "admin-tab-more"), ("tid", "more-settings")], True),
    ("admin-activity-log", "/admin", [("tid", "admin-tab-more"), ("tid", "more-logs")], True),
]

SCAN = """() => {
  const OLD = ['rgb(30, 127, 79)','rgb(47, 163, 107)','rgb(22, 163, 74)','rgb(20, 88, 58)','rgb(34, 197, 94)','rgb(21, 128, 61)','rgb(16, 185, 129)'];
  const MAYA_GREEN = ['rgb(0, 187, 119)','rgb(0, 135, 90)','rgb(34, 209, 147)','rgb(176, 255, 226)','rgb(216, 255, 242)','rgb(0, 204, 88)'];
  const hue = (c) => { const m = c.match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?/); if (!m) return null;
    if (m[4] !== undefined && +m[4] < 0.15) return null;
    let [r,g,b] = [m[1]/255,m[2]/255,m[3]/255]; const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
    if (!mx || d/mx < 0.3) return null; let h = mx===r ? ((g-b)/d)%6 : mx===g ? (b-r)/d+2 : (r-g)/d+4; h*=60; if (h<0) h+=360; return h; };
  const out = {old: [], stray: [], fonts: {}, sky: 0, pink: 0, navy: 0, wide: document.documentElement.scrollWidth > innerWidth + 1};
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(e);
    const label = ((e.innerText||'').trim().slice(0,30) || e.getAttribute('aria-label') || e.dataset.testid || e.tagName);
    for (const c of [s.backgroundColor, s.color, s.borderTopColor]) {
      const base = c.replace(/rgba\\((\\d+), (\\d+), (\\d+), [\\d.]+\\)/, 'rgb($1, $2, $3)');
      if (OLD.includes(base)) out.old.push(base + ' ' + label);
      else { const h = hue(c); if (h !== null && h >= 75 && h <= 175 && !MAYA_GREEN.includes(base)) out.stray.push(base + ' ' + label); }
      if (['rgb(46, 150, 239)','rgb(57, 177, 254)','rgb(227, 244, 255)','rgb(243, 250, 255)','rgb(31, 134, 219)'].includes(base)) out.sky++;
      if (base === 'rgb(255, 75, 183)' || base === 'rgb(255, 213, 238)') out.pink++;
      if (base === 'rgb(32, 41, 54)') out.navy++;
    }
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      const f = s.fontFamily.split(',')[0].replace(/"/g, '').trim();
      out.fonts[f] = (out.fonts[f] || 0) + 1;
    }
  }
  out.old = [...new Set(out.old)].slice(0, 6); out.stray = [...new Set(out.stray)].slice(0, 6);
  return out;
}"""


async def step(pg, s, lang):
    kind = s[0]
    if kind == "tab":
        await pg.locator('[role="tab"]').nth(s[1]).click()
    elif kind == "tid":
        await pg.locator(T(s[1])).first.click(timeout=8000)
    elif kind == "text":
        en, bn = s[1]
        want = bn if lang == "bn" else en
        loc = pg.get_by_text(want, exact=True)
        if not await loc.count():
            loc = pg.get_by_text(en, exact=True)
        if not await loc.count():
            loc = pg.get_by_text(want)
        await loc.first.click(timeout=8000)
    await pg.wait_for_timeout(2200)


async def main():
    rows = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for name, path, steps, logged in PAGES:
                ctx, pg = await h.page(b, admin if logged else None, lang, 390, path=path.format(slug=SLUG, pid=PID), h=844)
                await pg.wait_for_timeout(2500)
                reached = True
                try:
                    for s in steps:
                        await step(pg, s, lang)
                except Exception as e:
                    reached = False
                    print("UNREACHED", lang, name, str(e)[:120])
                await pg.screenshot(path=f"{h.shots}/{lang}-{name}.png")
                r = await pg.evaluate(SCAN)
                f = r["fonts"]
                jak = sum(v for k, v in f.items() if "Jakarta" in k)
                dm = sum(v for k, v in f.items() if k.startswith("DMSans") or k == "DM Sans" or k.startswith("Anton"))
                h.ok(reached, f"{lang} {name}: screen reached")
                h.ok(not r["old"], f"{lang} {name}: no old Farmers green", json.dumps(r["old"], ensure_ascii=False))
                h.ok(not r["stray"], f"{lang} {name}: no other stray green/teal", json.dumps(r["stray"], ensure_ascii=False))
                h.ok(jak == 0, f"{lang} {name}: no Plus Jakarta text", str(f))
                h.ok(r["sky"] + r["navy"] > 0, f"{lang} {name}: Maya colours in use", str({k: r[k] for k in ('sky','pink','navy')}))
                if lang == "en":
                    h.ok(dm > 0, f"en {name}: DM Sans text", str(f))
                h.ok(not r["wide"], f"{lang} {name}: nothing wider than the phone screen")
                rows.append((lang, name, reached, r["sky"], r["pink"], r["navy"]))
                await ctx.close()
        await b.close()
    for row in rows:
        print("ROW", *row)

asyncio.run(main())
h.done()
