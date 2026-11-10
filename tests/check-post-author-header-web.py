"""Web check (throwaway local server, needs ./dist): on a long post, scrolling down swaps the header title "Post"
for the author's FULL name (it used to show only the first two letters, cut to the width of "Post").

  python3 tests/check-post-author-header-web.py [shots_dir]

For short, long, very long and Bangla names; en/bn; 320, 360, 390 and 1280 wide; light and dark:
- open the post from the feed; before scrolling the header says Post/পোস্ট and the name is hidden;
- scroll down: the name layer is fully shown, its text is the whole name, nothing is cut off
  (no ellipsis: text fits its box), it stays right of the back arrow and inside the screen / app column;
- scroll back up: Post comes back. No page errors.
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T  # noqa: E402

h = H("postauthor")
NAMES = {
    "short": "Ann Begum",
    "long": "Mohammad Abdur Rahman Chowdhury",
    "verylong": "Sheikh Mohammad Abdullah Al Mamun Chowdhury Talukder",
    "bangla": "মোহাম্মদ আব্দুর রহমান চৌধুরী",
}

MEASURE = r"""() => {
  const layers = [...document.querySelectorAll('[data-testid="post-header-author-name"]')];
  const layer = layers.find(l => l.getBoundingClientRect().width > 0) || layers[0];
  if (!layer) return null;
  const t = layer.firstElementChild || layer;
  const r = t.getBoundingClientRect(); const lr = layer.getBoundingClientRect();
  const box = layer.parentElement.getBoundingClientRect();
  const titleLayer = layer.parentElement.children[1];
  const col = document.querySelector('#root') ? document.querySelector('#root').firstElementChild.getBoundingClientRect() : {left: 0, right: innerWidth};
  return {
    text: t.innerText, opacity: +getComputedStyle(layer).opacity, titleOpacity: +getComputedStyle(titleLayer).opacity,
    titleText: titleLayer.innerText,
    sw: t.scrollWidth, cw: t.clientWidth, sh: t.scrollHeight, ch: t.clientHeight,
    left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
    boxLeft: Math.round(box.left), boxRight: Math.round(box.right), boxTop: Math.round(box.top), boxBottom: Math.round(box.bottom),
    layerTop: Math.round(lr.top), layerBottom: Math.round(lr.bottom),
    fontSize: getComputedStyle(t).fontSize, colRight: Math.round(Math.min(innerWidth, col.right)),
  };
}"""

SCROLL = r"""(y) => {
  const els = [...document.querySelectorAll('div')].filter(e => {
    const s = getComputedStyle(e); const r = e.getBoundingClientRect();
    return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 50 && r.width > 0 && r.height > 200;
  });
  els.sort((a, b) => b.scrollHeight - a.scrollHeight);
  const el = els[0]; if (!el) return -1;
  el.scrollTop = y; el.dispatchEvent(new Event('scroll'));
  return el.scrollTop;
}"""


async def main():
    h.start()
    comms = h.api("GET", "/api/communities")[1]
    cid = (next((c for c in comms if c["slug"] == "farmer"), None) or comms[0])["id"]
    accs = {k: h.signup("pa" + k[:4], n) for k, n in NAMES.items()}
    viewer = h.signup("viewer", "Viewer Karim")
    body = "\n".join(f"Pond diary line {i}: water clear, fish feeding well, aerator on for two hours." for i in range(70))
    posts = {}
    for k, a in accs.items():
        st, p = h.api("POST", "/api/posts", {"communityId": cid, "content": f"Long post by {k} {a['id'][-4:]}\n" + body}, a["token"])
        h.ok(st in (200, 201), f"create long post {k}", (st, p))
        posts[k] = f"Long post by {k} {a['id'][-4:]}"

    async with async_playwright() as p:
        b = await p.chromium.launch()
        cases = []
        for k in NAMES:
            for lang in ("en", "bn"):
                for w in (320, 360, 390, 1280):
                    theme = "dark" if (w in (360, 1280)) else "light"
                    cases.append((k, lang, w, theme))
        for (k, lang, w, theme) in cases:
            tag = f"{k}-{lang}-{w}-{theme}"
            ctx = await b.new_context(viewport={"width": w, "height": 780 if w < 1000 else 860}, is_mobile=w < 1000, has_touch=w < 1000)
            await ctx.add_init_script("localStorage.setItem('theme_preference', %s);" % json.dumps(theme) + h.init_script(viewer, lang))
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, tag=tag: h.errors.append(f"{tag}: {str(e)[:200]}"))
            await pg.goto(h.base, wait_until="load", timeout=180000)
            await pg.wait_for_timeout(3500)
            try:
                await pg.get_by_text(posts[k]).first.click(timeout=20000)
            except Exception as e:
                h.ok(False, f"{tag}: open post from feed", e)
                await ctx.close()
                continue
            await pg.wait_for_timeout(2200)
            before = await pg.evaluate(MEASURE)
            h.ok(before is not None and before["opacity"] < 0.05 and before["titleOpacity"] > 0.95
                 and before["titleText"].strip() in ("Post", "পোস্ট"), f"{tag}: before scrolling the header says Post", before)
            await pg.evaluate(SCROLL, 1400)
            await pg.wait_for_timeout(900)
            m = await pg.evaluate(MEASURE)
            await pg.screenshot(path=f"{h.shots}/{tag}.png", clip={"x": 0, "y": 0, "width": w, "height": 120})
            name = NAMES[k]
            ok_shown = m and m["opacity"] > 0.95 and m["titleOpacity"] < 0.05
            h.ok(bool(ok_shown), f"{tag}: after scrolling the author name replaces Post", m)
            h.ok(m and m["text"].replace("\n", " ").strip() == name, f"{tag}: header text is the full name", m and m["text"])
            h.ok(m and m["sw"] <= m["cw"] + 1 and m["sh"] <= m["ch"] + 2, f"{tag}: name is not cut off (no ellipsis)", m)
            h.ok(m and m["boxRight"] <= m["colRight"] and m["boxLeft"] >= 36 and m["right"] <= m["boxRight"] + 1,
                 f"{tag}: name stays inside the header, right of the back arrow", m)
            h.ok(m and m["top"] >= m["boxTop"] - 2 and m["bottom"] <= m["boxBottom"] + 2, f"{tag}: name fits the header height", m)
            await pg.evaluate(SCROLL, 0)
            await pg.wait_for_timeout(900)
            back = await pg.evaluate(MEASURE)
            h.ok(back and back["opacity"] < 0.05 and back["titleOpacity"] > 0.95, f"{tag}: scrolling back up shows Post again", back)
            await ctx.close()
        await b.close()
    h.done()


asyncio.run(main())
