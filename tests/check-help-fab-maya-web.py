"""Floating Help button on Connect looks like maya.net's "Need help?" button and still opens the Support chat.

  python3 tests/check-help-fab-maya-web.py [shots_dir]

Reference (measured on https://maya.net/ 2026-10-27): mint #D8FFF2 square, 14px corners, 1px white border,
shadow 0 8px 16px rgba(0,0,0,.06), black-outline headset; 50x50 / 24px icon / 24px in on phones,
90x90 on Maya's desktop, but the Farmers web app is a 640px phone column, so it keeps the phone size; icon only.
Checks en + bn, light + dark, 320 / 360 / 390 / 1366: size, colour, corners, border, headset icon, no text,
inside the screen, above the bottom bar, not covering the last expert card when scrolled, unread count badge,
tap opens the Support chat. Runs on a throwaway local server with its own database.
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

FAB_JS = """(tid) => {
  const e = document.querySelector(`[data-testid="${tid}"]`); if (!e) return null;
  const s = getComputedStyle(e); const r = e.getBoundingClientRect();
  const svg = e.querySelector('svg'); const sr = svg ? svg.getBoundingClientRect() : null;
  const paths = svg ? [...svg.querySelectorAll('path')].map(p => [p.getAttribute('fill'), p.getAttribute('stroke')]) : [];
  let fr = e.parentElement; while (fr && fr.getBoundingClientRect().width < Math.min(innerWidth, 640) - 1) fr = fr.parentElement;
  const frameRight = fr ? fr.getBoundingClientRect().right : innerWidth;
  const badge = e.querySelector('[data-testid$="-unread"]');
  // bottom bar: the lowest fixed/absolute element wider than half the screen in the bottom 140px
  let barTop = null;
  for (const el of document.querySelectorAll('[role="tablist"], [data-testid^="tab-"]')) {
    let n = el; for (let i = 0; i < 6 && n; i++) { const rr = n.getBoundingClientRect(); if (rr.width > innerWidth * 0.6) { barTop = barTop === null ? rr.top : Math.min(barTop, rr.top); break; } n = n.parentElement; }
  }
  return { x: r.x, y: r.y, w: r.width, h: r.height, right: frameRight - r.right, bottom: innerHeight - r.bottom,
    bg: s.backgroundColor, radius: s.borderTopLeftRadius, bw: s.borderTopWidth, bc: s.borderTopColor, shadow: s.boxShadow,
    svg: sr ? [sr.width, sr.height] : null, paths, text: (e.innerText || '').replace(/\\d+/g, '').trim(),
    badge: badge ? (badge.innerText || '').trim() : null, barTop, vw: innerWidth, vh: innerHeight };
}"""


async def main():
    h = H("helpfab")
    h.start()
    ann = h.signup("ann", "Ann Begum")
    boss = h.signup("boss", "Admin Rahim")
    h.make_admin(boss)
    h.login(ann)
    st, _ = h.api("POST", "/api/support/messages", {"body": "Hello, I need help", "clientId": "hf-1"}, ann["token"])
    h.ok(st in (200, 201), "user can write to Support", st)
    st, threads = h.api("GET", "/api/admin/manage/support/threads?status=&q=", tok=boss["token"])
    tid = (threads.get("threads") if isinstance(threads, dict) else threads)[0]["id"]

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ("light", "dark"):
            for lang in ("en", "bn"):
                for w in (320, 360, 390, 1366):
                    tag = f"{scheme}-{lang}-{w}"
                    h.api("POST", f"/api/admin/manage/support/threads/{tid}/reply", {"body": f"Reply {tag}"}, boss["token"])
                    ctx = await b.new_context(viewport={"width": w, "height": 760 if w < 1000 else 900}, color_scheme=scheme)
                    await ctx.add_init_script(h.init_script(ann, lang))
                    pg = await ctx.new_page()
                    pg.on("pageerror", lambda e, tag=tag: h.errors.append(f"{tag}: {str(e)[:200]}"))
                    await pg.goto(h.base + "/", wait_until="load", timeout=180000)
                    await pg.wait_for_timeout(3500)
                    await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Connect'})")
                    found = await h.wait_for(pg, "connect-help-fab", 15000)
                    h.ok(found, f"{tag}: Help button on Connect")
                    if not found:
                        await pg.screenshot(path=f"{h.shots}/missing-{tag}.png"); await ctx.close(); continue
                    await pg.wait_for_timeout(1500)
                    f = await pg.evaluate(FAB_JS, "connect-help-fab")
                    box, icon, inset = 50, 24, 24
                    h.ok(abs(f["w"] - box) < 1.5 and abs(f["h"] - box) < 1.5, f"{tag}: {box}x{box} like Maya", (f["w"], f["h"]))
                    h.ok(f["bg"] == "rgb(216, 255, 242)", f"{tag}: Maya mint background", f["bg"])
                    h.ok(f["radius"] == "14px", f"{tag}: 14px corners", f["radius"])
                    h.ok(f["bw"] == "1px" and f["bc"] == "rgb(255, 255, 255)", f"{tag}: 1px white border", (f["bw"], f["bc"]))
                    h.ok("0.06" in (f["shadow"] or ""), f"{tag}: soft Maya shadow", f["shadow"])
                    h.ok(f["svg"] and abs(f["svg"][0] - icon) < 1.5, f"{tag}: {icon}px headset", f["svg"])
                    h.ok(len(f["paths"]) == 4 and f["paths"][0] == ["#D8FFF2", "#000000"], f"{tag}: headset is Maya's (mint cups, black outline)", f["paths"])
                    h.ok(f["text"] == "", f"{tag}: icon only, no label", f["text"])
                    h.ok(abs(f["right"] - inset) < 1.5, f"{tag}: {inset}px from the right edge of the app", f["right"])
                    h.ok(f["x"] >= 0 and f["y"] >= 0 and f["right"] >= 0 and f["bottom"] >= 0, f"{tag}: fully on screen", f)
                    h.ok(f["barTop"] is None or f["y"] + f["h"] <= f["barTop"] - 8, f"{tag}: sits above the bottom bar", (f["y"] + f["h"], f["barTop"]))
                    h.ok(bool(f["badge"]), f"{tag}: unread reply count shows on it", f["badge"])
                    h.ok(await h.no_overflow(pg), f"{tag}: no sideways scroll")
                    await pg.screenshot(path=f"{h.shots}/connect-{tag}.png")
                    await pg.locator(T("connect-help-fab")).first.click()
                    h.ok(await h.wait_for(pg, "support-chat", 10000), f"{tag}: tap opens the Support chat")
                    await ctx.close()
        await b.close()
    h.done()


asyncio.run(main())
