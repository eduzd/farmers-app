"""Profile tabs fit (no overlap / no cut-off labels), Achievements is a badge grid with no overlapping
tiles, and the Market page has no 'Recently viewed' row. English + Bangla, phone and computer widths."""
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from webharness import H, T
from playwright.async_api import async_playwright

MEASURE = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const rect = e => { const r = e.getBoundingClientRect(); return {x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; };
  const bar = [...document.querySelectorAll('[data-testid=profile-tabs]')].filter(vis).pop();
  const tabs = bar ? [...bar.querySelectorAll('[data-testid^=profile-tab-]')].filter(vis).map(t => {
    const txt = [...t.querySelectorAll('div')].filter(d => d.childElementCount === 0 && d.textContent.trim());
    const cut = txt.some(d => d.scrollWidth > d.clientWidth + 1);
    return {...rect(t), key: t.dataset.testid, cut, text: t.innerText.replace(/\s+/g, ' ')};
  }) : [];
  const grid = [...document.querySelectorAll('[data-testid=achievements-grid]')].filter(vis).pop();
  const tiles = grid ? [...grid.children].filter(vis).map(t => ({...rect(t), id: t.dataset.testid, over: t.scrollHeight > t.clientHeight + 2})) : [];
  return {bar: bar ? rect(bar) : null, tabs, grid: grid ? rect(grid) : null, tiles, vw: window.innerWidth};
}"""

def overlaps(a, b):
    return min(a['r'], b['r']) - max(a['x'], b['x']) > 1 and min(a['b'], b['b']) - max(a['y'], b['y']) > 1

async def main():
    h = H("profgrid")
    h.start()
    try:
        me = h.signup("grid", "Grid Tester")
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for lang in ["en", "bn"]:
                for w in [320, 360, 390, 1280]:
                    tag = f"{lang}-{w}"
                    ctx, pg = await h.page(b, me, lang, w)
                    # Market: Recently viewed is gone even when the device remembers viewed products.
                    await pg.evaluate("""() => localStorage.setItem('recently_viewed_v1', JSON.stringify([{id:'p1',name:'Test Tomato',price:50,unit:'kg'}]))""")
                    await pg.reload(wait_until="load"); await pg.wait_for_timeout(3000)
                    await pg.locator('[role=tab][href="/Main/Market"]').last.click()
                    await pg.wait_for_timeout(2500)
                    body = await pg.evaluate("() => document.body.innerText")
                    h.ok(await h.wait_for(pg, "market-bell", 8000), f"{tag} market page opens")
                    h.ok("Recently viewed" not in body and "সম্প্রতি দেখা" not in body and "Test Tomato" not in body, f"{tag} no Recently viewed row on Market")
                    if w == 390:
                        await pg.screenshot(path=f"{h.shots}/market-{tag}.png")
                    # Profile
                    await pg.locator('[role=tab][href="/Main/Profile"]').last.click()
                    await pg.wait_for_timeout(2500)
                    m = await pg.evaluate(MEASURE)
                    keys = [t['key'] for t in m['tabs']]
                    h.ok(keys == ["profile-tab-posts", "profile-tab-reviews", "profile-tab-about", "profile-tab-achievements"], f"{tag} four tabs in order", keys)
                    bad = [(a['key'], c['key']) for i, a in enumerate(m['tabs']) for c in m['tabs'][i+1:] if overlaps(a, c)]
                    h.ok(not bad, f"{tag} tabs do not overlap", bad)
                    if m['bar']:
                        inside = all(t['x'] >= m['bar']['x'] - 1 and t['r'] <= m['bar']['r'] + 1 for t in m['tabs'])
                        h.ok(inside, f"{tag} tabs stay inside the bar", m['tabs'])
                    loc = pg.locator(T("profile-tab-achievements"))
                    for i in range(await loc.count() - 1, -1, -1):
                        if await loc.nth(i).is_visible():
                            await loc.nth(i).click(); break
                    await pg.wait_for_timeout(1500)
                    m = await pg.evaluate(MEASURE)
                    cut = [t['text'] for t in m['tabs'] if t['cut']]
                    h.ok(not cut, f"{tag} no tab label cut off (Achievements open)", cut)
                    bad = [(a['key'], c['key']) for i, a in enumerate(m['tabs']) for c in m['tabs'][i+1:] if overlaps(a, c)]
                    h.ok(not bad, f"{tag} tabs do not overlap (Achievements open)", bad)
                    tiles = m['tiles']
                    h.ok(len(tiles) == 9, f"{tag} nine badge tiles in the grid", len(tiles))
                    ov = [(a['id'], c['id']) for i, a in enumerate(tiles) for c in tiles[i+1:] if overlaps(a, c)]
                    h.ok(not ov, f"{tag} badge tiles do not overlap", ov)
                    rows = sorted(set(round(t['y']) for t in tiles))
                    cols = max((sum(1 for t in tiles if round(t['y']) == y) for y in rows), default=0)
                    want = 3 if w >= 1280 else 2
                    h.ok(cols == want, f"{tag} grid has {want} columns", cols)
                    h.ok(all(t['x'] >= -1 and t['r'] <= m['vw'] + 1 for t in tiles), f"{tag} tiles fit the screen")
                    h.ok(not [t['id'] for t in tiles if t['over']], f"{tag} tile content fits inside each tile", [t['id'] for t in tiles if t['over']])
                    h.ok(await h.no_overflow(pg), f"{tag} no sideways scrolling")
                    earned = await pg.locator(T("achievement-first-post-earned")).count()
                    prog = await pg.locator(T("achievement-followers-10-progress")).count() + await pg.locator('[data-testid$=-progress]').count()
                    h.ok(earned == 0 and prog > 0, f"{tag} new account shows progress, not earned", (earned, prog))
                    if w in (360, 1280):
                        await pg.screenshot(path=f"{h.shots}/achv-{tag}.png", full_page=True)
                    await ctx.close()
            await b.close()
    finally:
        h.stop()
    h.done()

asyncio.run(main())
