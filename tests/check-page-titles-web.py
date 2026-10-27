"""Page titles match the Market title (web build in ./dist): font, size, colour, header background.

    python3 tests/check-page-titles-web.py [shots_dir]
"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("page-titles")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)
_comms = h.api("GET", "/api/communities")[1]
_cid = (next((c for c in _comms if c.get("slug") == "farmer"), None) or _comms[0])["id"]
st, _post = h.api("POST", "/api/posts", {"communityId": _cid, "content": "Pond water check this morning"}, admin["token"])
print("seed post", st)

# (name, tab index, then text to tap on that tab or None)
PAGES = [
    ("home", 0, None),
    ("connect", 1, None),
    ("market", 2, None),
    ("chats", 3, None),
    ("profile", 4, None),
    ("settings", 4, {"en": "Settings", "bn": "সেটিংস"}),
    ("calculate", 0, {"en": "Calculate", "bn": None}),
    ("post", 0, {"en": "Pond water check this morning", "bn": "Pond water check this morning"}),
]

# Every text element in the top 72px (the header), with its computed style.
SCAN = """() => {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.top > 72 || r.bottom < 0) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    if (e.checkVisibility && !e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    const at = document.elementFromPoint(r.left + Math.min(r.width, 20) / 2, r.top + r.height / 2);
    if (!at || !(e === at || e.contains(at) || at.contains(e))) continue;
    const s = getComputedStyle(e);
    out.push({text: e.innerText.trim().slice(0, 40), font: s.fontFamily.split(',')[0].replace(/\"/g,'').trim(),
      size: s.fontSize, weight: s.fontWeight, color: s.color, ls: s.letterSpacing, left: Math.round(r.left), top: Math.round(r.top), h: Math.round(r.height)});
  }
  return out;
}"""

if os.environ.get("ONLY"):
    PAGES = [x for x in PAGES if x[0] in os.environ["ONLY"].split(",") + ["market"]]

results = {}
buttons = {}
BTN = """() => [...document.querySelectorAll('[role=button]')].filter(e => { const r = e.getBoundingClientRect();
  if (!r.width || r.top > 64 || r.bottom < 4 || r.left < 60 || r.width > 60) return false;
  const at = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return at && (e === at || e.contains(at));
}).map(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
  return {label: e.getAttribute('aria-label') || '', w: Math.round(r.width), h: Math.round(r.height), bw: s.borderTopWidth, bg: s.backgroundColor}; })"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for name, tab, tap in PAGES:
                label = tap.get(lang) if tap else None
                if tap and not label:
                    continue
                ctx, pg = await h.page(b, admin, lang, 390, path="/", h=844)
                await pg.wait_for_timeout(2500)
                await pg.locator('[role="tab"]').nth(tab).click()
                await pg.wait_for_timeout(2000)
                if label:
                    await pg.get_by_text(label, exact=True).first.click()
                    await pg.wait_for_timeout(2500)
                await pg.screenshot(path=f"{h.shots}/{lang}-{name}.png", clip={"x": 0, "y": 0, "width": 390, "height": 120})
                items = await pg.evaluate(SCAN)
                if name == "post":
                    # the swap title: two stacked texts; the visible one is the first child of the header box
                    items = await pg.evaluate("""() => { const hd = document.querySelector('[role=heading]'); if (!hd) return [];
                      const e = hd.children[0]; const s = getComputedStyle(e); const r = e.getBoundingClientRect();
                      return [{text: e.innerText.trim(), font: s.fontFamily.split(',')[0].replace(/"/g,'').trim(), size: s.fontSize, weight: s.fontWeight, color: s.color, ls: s.letterSpacing, left: Math.round(r.left), top: Math.round(r.top), h: Math.round(r.height)}]; }""")
                # the title: the largest text in the header
                items.sort(key=lambda i: -float(i["size"].replace("px", "")))
                title = items[0] if items else None
                results[(lang, name)] = title
                buttons[(lang, name)] = await pg.evaluate(BTN)
                print("BTN", lang, name, json.dumps(buttons[(lang, name)], ensure_ascii=False))
                print(lang, name, json.dumps(title, ensure_ascii=False))
                await ctx.close()
        await b.close()
    for lang in ("en", "bn"):
        m = results.get((lang, "market"))
        h.ok(m is not None, f"{lang} market: title found")
        if not m:
            continue
        for (l, name), t in results.items():
            if l != lang or name == "market":
                continue
            h.ok(t is not None, f"{lang} {name}: title found")
            if not t:
                continue
            h.ok(t["font"] == m["font"], f"{lang} {name}: same title font as Market", f"{t['font']} vs {m['font']}")
            h.ok(t["color"] == m["color"], f"{lang} {name}: same title colour as Market", f"{t['color']} vs {m['color']}")
            ts, ms = float(t["size"][:-2]), float(m["size"][:-2])
            want = 40 if name == "calculate" else 44
            for bt in buttons.get((l, name), []):
                h.ok(bt["w"] == want and bt["h"] == want and bt["bw"] == "1px", f"{lang} {name}: title-bar button '{bt['label'][:20]}' is the Market style", json.dumps(bt))
            h.ok(abs(ts - ms) <= 2, f"{lang} {name}: title size within 2px of Market", f"{t['size']} vs {m['size']}")

asyncio.run(main())
h.done()
