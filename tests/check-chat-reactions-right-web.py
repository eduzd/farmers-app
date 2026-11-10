"""Web check (throwaway local server, needs ./dist): reactions on chat messages sit on the RIGHT of the bubble.

  python3 tests/check-chat-reactions-right-web.py [shots_dir]

Test accounts only (Ann Begum, Cat Rahman on a throwaway database). Messages from both people, short and multi-line,
with one reaction, two different reactions (one from each person) and a super reaction. In Ann's chat with Cat, for
en/bn, light/dark, at 320/360/390 wide and 1280 (computer):
- every reaction pill's right edge is near the bubble's right edge (within 4-16px inside it, or past it when the pill is
  wider than a short bubble), on Cat's messages AND Ann's, so none sits on the left any more;
- the pill overlaps the bubble's bottom edge (hangs off the corner), and does not cover the next message, the time or
  the other person's photo;
- the pill shows every emoji, nothing runs off the screen, and the bubbles stay on their own side (Cat left, Ann right);
- a reaction Cat adds while the chat is open arrives live and also lands on the right.
Also: no page errors.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/chat-reactions-right"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="react-right-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="react-right-secret-0123456789abcdef0123456789ab")
srv = None

LONG_C = "My tomato leaves have yellow spots and the edges are curling. It started three days ago after the rain. What should I spray?"
LONG_A = "Use a copper fungicide in the evening and remove the worst leaves first. Send me a photo tomorrow so I can check again."
BN_C = "পুকুরের পানি সবুজ হয়ে গেছে, মাছ সকালে উপরে ভাসছে। কী করব?"


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/react-right-web-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); return
        except Exception:
            time.sleep(1)
    raise SystemExit("server did not start")


def stop():
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass


def api(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except Exception:
            return e.code, None


def signup(tag, name):
    s = str(int(time.time() * 1000))[-7:]
    email = f"{tag}{s}@check.test"
    st, j = api("POST", "/api/auth/signup", {"email": email, "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
    assert j and j.get("token"), (st, j)
    return {"email": email, "token": j["token"], "user": j["user"]}


def init_script(acc, lang, dark):
    u = dict(acc["user"]); u["language"] = lang
    mode = "dark" if dark else "light"
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            "localStorage.setItem('theme_preference', %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang), json.dumps(mode)))


OVERFLOW_JS = r"""() => {
  const vw = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll('div,span,img')) {
    const r = el.getBoundingClientRect();
    if (!r.width || (r.right <= vw + 1 && r.left >= -1)) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1 && pr.left >= -1) { clipped = true; break; } } p = p.parentElement; }
    if (!clipped) out.push((el.innerText || el.tagName).slice(0, 40) + ' @' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  return out.slice(0, 8);
}"""

# Every message row with reactions: which side it is, its bubble box, the reaction pill box, its emojis, the photo box.
LAYOUT_JS = r"""() => {
  const out = [];
  const rows = [...document.querySelectorAll('[data-testid="dm-msg-theirs"],[data-testid="dm-msg-mine"]')];
  const allBoxes = rows.map(r => r.getBoundingClientRect());
  rows.forEach((row, idx) => {
    const pill = row.querySelector('[data-testid="dm-msg-reactions"]');
    const av = row.querySelector('[data-testid="dm-msg-avatar"]');
    let bubble = null;
    for (const el of row.querySelectorAll('div')) {
      if ((av && av.contains(el)) || (pill && (pill === el || pill.contains(el) || el.contains(pill)))) continue;
      const bg = getComputedStyle(el).backgroundColor;
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) continue;
      bubble = el; break;
    }
    if (!bubble) return;
    const b = bubble.getBoundingClientRect();
    const rec = { side: row.getAttribute('data-testid') === 'dm-msg-mine' ? 'mine' : 'theirs',
      text: (bubble.innerText || '').trim().slice(0, 24), bL: Math.round(b.left), bR: Math.round(b.right), bT: Math.round(b.top), bB: Math.round(b.bottom) };
    if (av) { const a = av.getBoundingClientRect(); rec.aR = Math.round(a.right); rec.aB = Math.round(a.bottom); rec.aT = Math.round(a.top); }
    if (pill) {
      const p = pill.getBoundingClientRect();
      rec.pL = Math.round(p.left); rec.pR = Math.round(p.right); rec.pT = Math.round(p.top); rec.pB = Math.round(p.bottom);
      rec.emojis = (pill.innerText || '').replace(/\s/g, '');
      // what is drawn at the pill's centre: the pill itself, not something on top of it
      rec.pillOnTop = true;  // filled in by COVER_JS
      // the next message (row below) and this row's time line must start below the pill
      const footer = [...row.querySelectorAll('div')].find(el => /^(\d{1,2}:\d{2}|Seen|Sent|দেখা|পাঠানো)/.test((el.innerText||'').trim()) && el.getBoundingClientRect().top > b.bottom - 2 && !pill.contains(el));
      rec.footerTop = footer ? Math.round(footer.getBoundingClientRect().top) : null;
      let below = null;
      for (let j = 0; j < allBoxes.length; j++) { if (j === idx) continue; const o = allBoxes[j]; if (o.top >= b.bottom - 1 && (below === null || o.top < below)) below = o.top; }
      rec.nextTop = below === null ? null : Math.round(below);
    }
    out.push(rec);
  });
  out.sort((x, y) => x.bT - y.bT);
  return out;
}"""


# Scroll each pill to the middle of the chat and see what is drawn at its centre: the pill, not something on top of it.
COVER_JS = r"""async () => {
  const out = [];
  for (const pill of document.querySelectorAll('[data-testid="dm-msg-reactions"]')) {
    pill.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 150));
    const p = pill.getBoundingClientRect();
    const hit = document.elementFromPoint((p.left + p.right) / 2, (p.top + p.bottom) / 2);
    const row = pill.closest('[data-testid^="dm-msg-"]');
    out.push({ emojis: (pill.innerText || '').replace(/\s/g, ''), onTop: !!hit && (pill === hit || pill.contains(hit)),
               hit: hit ? (hit.innerText || hit.tagName).slice(0, 30) : null, row: row ? (row.innerText || '').slice(0, 20) : null });
  }
  return out;
}"""


def judge(lay, vw):
    with_p = [m for m in lay if "pL" in m]
    probs = []
    for m in with_p:
        bw = m["bR"] - m["bL"]; pw = m["pR"] - m["pL"]
        gap_right = m["bR"] - m["pR"]  # how far the pill's right edge is inside the bubble's right edge
        if pw <= bw - 18:
            if not (2 <= gap_right <= 16): probs.append(f"{m['text']}: pill not at right (gap {gap_right})")
        else:  # pill wider than a short bubble: it must still reach the bubble's right side
            if m["pR"] < m["bR"] - 16: probs.append(f"{m['text']}: wide pill not reaching right ({m['pR']} vs {m['bR']})")
        # pill on the right half of the bubble (its centre right of the bubble's centre), never hugging the left
        if pw < bw * 0.8 and (m["pL"] + m["pR"]) / 2 <= (m["bL"] + m["bR"]) / 2:
            probs.append(f"{m['text']}: pill on left half")
        if not (m["pT"] < m["bB"] < m["pB"]): probs.append(f"{m['text']}: pill not over bubble's bottom edge")
        if not m["pillOnTop"]: probs.append(f"{m['text']}: pill covered")
        if m.get("footerTop") is not None and m["footerTop"] < m["pB"] - 1: probs.append(f"{m['text']}: pill over time line")
        if m.get("nextTop") is not None and m["nextTop"] < m["pB"] - 1: probs.append(f"{m['text']}: pill over next message")
        if m.get("aR") is not None and m["pL"] < m["aR"] and m["pT"] < m["aB"]: probs.append(f"{m['text']}: pill over photo")
        if m["pL"] < 0 or m["pR"] > vw: probs.append(f"{m['text']}: pill off screen")
    sides_ok = all((m["side"] == "theirs" and m["bL"] < vw / 2) or (m["side"] == "mine" and m["bR"] > vw / 2) for m in lay)
    if not sides_ok: probs.append("bubble on wrong side")
    return probs


async def main():
    rep = {}
    start()
    try:
        ann = signup("ann", "Ann Begum")
        cat = signup("cat", "Cat Rahman")
        A, C = ann["user"]["id"], cat["user"]["id"]
        seq = [(cat, A, "Ok"), (cat, A, LONG_C), (ann, C, "Hi"), (ann, C, LONG_A), (cat, A, BN_C), (cat, A, "Thanks a lot!"),
               (ann, C, "Good luck")]
        ids = []
        for i, (who, to, text) in enumerate(seq):
            st, j = api("POST", f"/api/dm/{to}/messages", {"content": text, "clientId": f"seedrx{i:02d}xx"}, who["token"])
            assert st in (200, 201) and j and j.get("id"), (st, j)
            ids.append(str(j["id"]))
            time.sleep(0.05)
        # (message index, who reacts, emoji, super)
        reacts = [(0, ann, "❤️", False), (0, cat, "😂", False),   # short bubble from Cat, two reactions (wider than "Ok")
                  (1, ann, "👍", False),                           # long multi-line from Cat
                  (2, cat, "😮", False), (2, ann, "❤️", False),   # short bubble from Ann, two reactions
                  (3, cat, "❤️", True),                            # long from Ann, super reaction
                  (4, ann, "😢", True), (4, cat, "👍", False)]     # Bangla from Cat, super + second
        for mi, who, emo, sup in reacts:
            st, _ = api("PUT", f"/api/dm/messages/{ids[mi]}/reaction", {"emoji": emo, "super": sup}, who["token"])
            assert st == 200, st

        combos = [("en", False, 360, 780), ("bn", False, 360, 780), ("en", True, 360, 780), ("bn", True, 390, 844),
                  ("en", False, 320, 640), ("bn", False, 320, 640), ("en", True, 1280, 860), ("bn", False, 1280, 860)]
        live_emojis = ["😡", "😮", "😂", "😢", "😡", "😮", "😂", "😢"]
        async with async_playwright() as p:
            br = await p.chromium.launch()
            for n, (lang, dark, w, h) in enumerate(combos):
                key = f"{lang}-{'dark' if dark else 'light'}-{w}"
                r = {}
                errs = []
                ctx = await br.new_context(viewport={"width": w, "height": h}, color_scheme="dark" if dark else "light")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(ann, lang, dark))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.locator('[data-testid="tab-chats"]').first.wait_for(timeout=30000)
                await pg.locator('[data-testid="tab-chats"]').first.click()
                row = pg.get_by_role("button", name="Cat Rahman").first
                await row.wait_for(timeout=15000)
                await row.click()
                await pg.wait_for_selector('[data-testid="dm-input"]', timeout=15000)
                await pg.locator('[data-testid="dm-msg-reactions"]').nth(4).wait_for(timeout=20000)
                await pg.wait_for_timeout(1200)
                r["dark_bg"] = await pg.evaluate("() => getComputedStyle(document.querySelector('[data-testid=\"dm-input\"]').closest('div')).color")
                lay = await pg.evaluate(LAYOUT_JS)
                r["pills"] = [{k: m[k] for k in ("side", "text", "bL", "bR", "pL", "pR", "emojis")} for m in lay if "pL" in m]
                r["pill_count"] = len(r["pills"])
                want = {"Ok": 2, "Hi": 2}
                r["emoji_counts_ok"] = all(len([c for c in m["emojis"] if ord(c) > 0x2000 and ord(c) not in (0xFE0F, 0x200D)]) >= want.get(m["text"], 1) for m in r["pills"])
                r["both_sides"] = {m["side"] for m in r["pills"]} == {"mine", "theirs"}
                r["problems"] = judge(lay, w)
                cov = await pg.evaluate(COVER_JS)
                r["covered"] = [c for c in cov if not c["onTop"]]
                await pg.locator('[data-testid="dm-msg-mine"]').filter(has_text="Good luck").last.scroll_into_view_if_needed()
                await pg.wait_for_timeout(500)
                await pg.screenshot(path=f"{SHOTS}/{key}-1-chat.png")

                # Cat reacts to Ann's last message while the chat is open: arrives live, on the right
                emo = live_emojis[n]
                api("PUT", f"/api/dm/messages/{ids[6]}/reaction", {"emoji": emo, "super": False}, cat["token"])
                live = pg.locator('[data-testid="dm-msg-mine"]').filter(has_text="Good luck").locator('[data-testid="dm-msg-reactions"]')
                try:
                    await live.filter(has_text=emo).first.wait_for(state="visible", timeout=20000)
                    r["live_arrived"] = True
                except Exception:
                    r["live_arrived"] = False
                await pg.wait_for_timeout(800)
                lay2 = await pg.evaluate(LAYOUT_JS)
                r["problems_after_live"] = judge(lay2, w)
                r["live_on_right"] = any(m["text"].startswith("Good luck") and "pL" in m and m["pR"] >= m["bR"] - 16 for m in lay2)
                await pg.screenshot(path=f"{SHOTS}/{key}-2-live-reaction.png")
                r["overflow"] = await pg.evaluate(OVERFLOW_JS)
                r["page_errors"] = errs
                rep[key] = r
                await ctx.close()
            await br.close()
    finally:
        stop()
    print(json.dumps(rep, indent=1, ensure_ascii=False))
    ok = True
    for k, r in rep.items():
        good = (r["pill_count"] >= 5 and r["emoji_counts_ok"] and r["both_sides"] and not r["problems"] and not r["covered"] and r["live_arrived"]
                and r["live_on_right"] and not r["problems_after_live"] and not r["overflow"] and not r["page_errors"])
        print(k, "PASS" if good else "FAIL")
        ok = ok and good
    print("RESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


asyncio.run(main())
