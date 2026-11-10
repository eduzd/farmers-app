"""Notifications page clean-up (web build in ./dist).

- One title only: the top bar says Notifications (Market notifications under the Marketplace bell); there is
  no second Notifications heading inside the page and no "N unread" line under it.
- No "Turn on push notifications" card, its "Get new updates and messages instantly" line or its Turn on button,
  even when the browser has not granted notification permission.
- All / Unread are one segmented pill with counts, and Mark all read sits on the same line at the right.
  The row starts right under the top bar (no gap where the heading and card were).
- Unread shows only unread rows; Mark all read clears this bell's unread ones and hides the button.
- English and Bangla, light and dark, 320 / 390 / 1280 wide: no sideways scroll, readable text in the row.

    python3 tests/check-notifications-page-web.py [shots_dir]
"""
import asyncio, sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T, ROOT
from playwright.async_api import async_playwright

h = H("notif-page")
h.start()
users = {v: h.signup(f"u{v}", f"Farmer {v}") for v in range(14)}
h.stop()

HOME = [("like", "Bob liked your post", "My rice field", {"postId": "p1"}),
        ("comment", "Bob commented on your post", "Nice field", {"postId": "p1", "commentId": "1"}),
        ("reminder", "Reminder: feed fish", "Pond 2", {"diaryId": "d1"})]
MARKET = [("order", "Order Confirmed", "Your order ord-77 is now Confirmed.", {"orderId": "ord-77", "role": "buyer"})]
READ = [("follow", "Old follower", "Someone followed you", {})]
seed = {"ids": [u["id"] for u in users.values()], "unread": HOME + MARKET, "read": READ}
subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const pg = new PGlite(process.argv[1]); const s = JSON.parse(process.argv[2]); let i = 0;
  for (const uid of s.ids) {
    for (const [type, title, body, data] of s.unread) await pg.query("INSERT INTO app_notifications (id, user_id, type, title, body, data, created_at) VALUES ($1,$2,$3,$4,$5,$6, now() - ($7 || ' minutes')::interval)", ['n' + (++i), uid, type, title, body, JSON.stringify(data), String(i)]);
    for (const [type, title, body, data] of s.read) await pg.query("INSERT INTO app_notifications (id, user_id, type, title, body, data, read_at, created_at) VALUES ($1,$2,$3,$4,$5,$6, now(), now() - interval '3 hours')", ['n' + (++i), uid, type, title, body, JSON.stringify(data)]);
  }
  await pg.close();
})();
""", os.path.join(h.data_dir, "pglite"), json.dumps(seed)], check=True, cwd=ROOT)
h.start()
for u in users.values():
    h.login(u)

TXT = {
    "en": {"title": "Notifications", "market": "Market notifications", "all": "All", "unread": "Unread", "mark": "Mark all read",
           "banned": ["Turn on push notifications", "Get new updates and messages instantly", "Turn on", "Push notifications are on"]},
    "bn": {"title": "নোটিফিকেশন", "market": "মার্কেট নোটিফিকেশন", "all": "সব", "unread": "অপঠিত", "mark": "সব পঠিত",
           "banned": ["পুশ নোটিফিকেশন সক্রিয় করুন", "নতুন আপডেট ও বার্তা সাথে সাথে পান", "সক্রিয় করুন", "অপঠিত বার্তা"]},
}

GEOM = """() => {
  const box = (sel) => { const e = [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.left, y: r.top, r: r.right, b: r.bottom, cy: (r.top + r.bottom) / 2, bg: getComputedStyle(e).backgroundColor}; };
  return { row: box('[data-testid="notif-filter-row"]'), all: box('[data-testid="notif-filter-all"]'), unread: box('[data-testid="notif-filter-unread"]'),
           mark: box('[data-testid="notif-mark-all"]'), w: innerWidth };
}"""

# Every visible text whose content is exactly the given string (the top bar title, an in-page heading...).
EXACT = """(t) => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity < 0.1) return false;
  return [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() === t); }).map(e => Math.round(e.getBoundingClientRect().top))"""

# Contrast of the texts inside the filter row against what they sit on.
CONTRAST = r"""() => {
  const parse = (c) => { const m = c && c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const blend = (top, bot) => { const a = top[3]; return [top[0]*a+bot[0]*(1-a), top[1]*a+bot[1]*(1-a), top[2]*a+bot[2]*(1-a), 1]; };
  const bgOf = (el) => { const chain = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 0.99) break; } }
    let col = [255,255,255,1]; for (let i = chain.length - 1; i >= 0; i--) col = blend(chain[i], col); return col; };
  const row = document.querySelector('[data-testid="notif-filter-row"]'); if (!row) return null;
  const out = [];
  for (const e of row.querySelectorAll('*')) { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const fg = parse(getComputedStyle(e).color), bg = bgOf(e); const x = lum(fg), y = lum(bg);
    out.push({t: e.textContent.trim(), ratio: +(((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2))}); }
  return out;
}"""


async def open_list(b, acc, lang, w, theme, scope="home"):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 600 else 820}, color_scheme=theme)
    await ctx.add_init_script("localStorage.setItem('theme_preference', %s);" % json.dumps(theme) + h.init_script(acc, lang))
    pg = await ctx.new_page()
    tag = f"{lang}-{theme}-{w}-{scope}"
    pg.on("pageerror", lambda e: h.errors.append(f"{tag}: {str(e)[:200]}"))
    await pg.goto(h.base + "/", wait_until="load", timeout=180000)
    await pg.wait_for_timeout(3500)
    await pg.evaluate("(s) => window.__nav.navigate('Notifications', { scope: s })", scope)
    await h.wait_for(pg, "notif-filter-row", 15000)
    await pg.wait_for_timeout(2500)
    return ctx, pg


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        n = 0
        for lang in ("en", "bn"):
            for theme in ("light", "dark"):
                for w in (320, 390, 1280):
                    tag = f"{lang} {theme} {w}"
                    acc = users[n]; n += 1
                    st, c = h.api("GET", "/api/me/notifications/unread-count", None, acc["token"])
                    home_unread = c.get("home") if c else None
                    ctx, pg = await open_list(b, acc, lang, w, theme)
                    X = TXT[lang]
                    await pg.screenshot(path=f"{h.shots}/{lang}-{theme}-{w}.png")
                    tops = await pg.evaluate(EXACT, X["title"])
                    h.ok(len(tops) == 1 and tops[0] < 70, f"{tag}: '{X['title']}' shows once, in the top bar", tops)
                    for s in X["banned"]:
                        h.ok(await pg.get_by_text(s, exact=False).count() == 0 if s not in ("Turn on", "সক্রিয় করুন") else len(await pg.evaluate(EXACT, s)) == 0,
                             f"{tag}: no '{s}'")
                    g = await pg.evaluate(GEOM)
                    ok = g["all"] and g["unread"] and g["mark"]
                    h.ok(ok, f"{tag}: All, Unread and Mark all read are on the page", g)
                    if ok:
                        h.ok(abs(g["all"]["cy"] - g["mark"]["cy"]) <= 4 and abs(g["unread"]["cy"] - g["mark"]["cy"]) <= 4,
                             f"{tag}: Mark all read is on the same line as All / Unread", g)
                        h.ok(g["mark"]["x"] >= g["unread"]["r"] + 4 and g["row"]["r"] - g["mark"]["r"] <= 24 and g["all"]["x"] - g["row"]["x"] <= 30,
                             f"{tag}: All / Unread on the left, Mark all read at the right edge, no overlap", g)
                        h.ok(g["row"]["y"] <= 80, f"{tag}: the row starts right under the top bar (no empty space)", g["row"])
                    all_t = await h.text(pg, "notif-filter-all") or ""
                    un_t = await h.text(pg, "notif-filter-unread") or ""
                    h.ok(X["all"] in all_t and "4" in all_t, f"{tag}: All pill shows its count (4)", all_t)
                    h.ok(X["unread"] in un_t and str(home_unread) in un_t, f"{tag}: Unread pill shows {home_unread}", un_t)
                    h.ok(X["mark"] in (await h.text(pg, "notif-mark-all") or ""), f"{tag}: Mark all read label")
                    con = await pg.evaluate(CONTRAST) or []
                    low = [x for x in con if x["ratio"] < 3]
                    h.ok(con and not low, f"{tag}: row texts readable (contrast 3:1 or more)", low or con)
                    if theme == "dark":
                        bg = await pg.evaluate("() => getComputedStyle(document.querySelector('[data-testid=\"notif-filter-row\"]').parentElement).backgroundColor")
                        h.ok(bg in ("rgb(11, 17, 25)", "rgba(0, 0, 0, 0)") or bg.startswith("rgb(1") or bg.startswith("rgb(2"), f"{tag}: dark page behind the row", bg)
                    h.ok(await h.no_overflow(pg), f"{tag}: no sideways scroll")
                    for t in ("Bob liked your post", "Reminder: feed fish", "Old follower"):
                        h.ok(await pg.get_by_text(t, exact=True).count() > 0, f"{tag}: list shows '{t}'")
                    if w == 390:
                        await pg.locator(T("notif-filter-unread")).first.click()
                        await pg.wait_for_timeout(1200)
                        h.ok(await pg.get_by_text("Old follower", exact=True).count() == 0 and await pg.get_by_text("Bob liked your post", exact=True).count() > 0,
                             f"{tag}: Unread shows only unread rows")
                        sel = await pg.locator(T("notif-filter-unread")).first.get_attribute("aria-selected")
                        h.ok(sel == "true", f"{tag}: Unread is the selected tab", sel)
                        await pg.screenshot(path=f"{h.shots}/{lang}-{theme}-{w}-unread.png")
                        await pg.locator(T("notif-filter-all")).first.click()
                        await pg.wait_for_timeout(800)
                        if lang == "en":
                            await pg.locator(T("notif-mark-all")).first.click()
                            await pg.wait_for_timeout(2500)
                            st, c = h.api("GET", "/api/me/notifications/unread-count", None, acc["token"])
                            h.ok(c and c["home"] == 0 and c["market"] == 1, f"{tag}: Mark all read clears Home's unread, leaves the Market one", c)
                            h.ok(await pg.locator(T("notif-mark-all")).count() == 0, f"{tag}: Mark all read button goes away")
                            un_t = await h.text(pg, "notif-filter-unread") or ""
                            h.ok("0" in un_t, f"{tag}: Unread pill shows 0", un_t)
                            h.ok(await pg.get_by_text("Bob liked your post", exact=True).count() > 0, f"{tag}: rows stay in All after Mark all read")
                            await pg.screenshot(path=f"{h.shots}/{lang}-{theme}-{w}-allread.png")
                    await ctx.close()
            # Marketplace bell: its own top bar title, still once, same clean row.
            acc = users[12 if lang == "en" else 13]
            ctx, pg = await open_list(b, acc, lang, 390, "light", scope="market")
            X = TXT[lang]
            tops = await pg.evaluate(EXACT, X["market"])
            h.ok(len(tops) == 1 and tops[0] < 70, f"{lang} market: '{X['market']}' shows once, in the top bar", tops)
            h.ok(len(await pg.evaluate(EXACT, X["title"])) == 0, f"{lang} market: no extra plain Notifications heading")
            h.ok(await pg.get_by_text("Order Confirmed", exact=True).count() > 0 and await pg.get_by_text("Bob liked your post", exact=True).count() == 0,
                 f"{lang} market: still only marketplace notifications")
            h.ok(await pg.get_by_text(X["banned"][0], exact=False).count() == 0, f"{lang} market: no push card")
            await pg.screenshot(path=f"{h.shots}/{lang}-market-390.png")
            await ctx.close()
        await b.close()


asyncio.run(main())
h.done()
