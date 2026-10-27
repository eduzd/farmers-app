"""Web check (throwaway local server, needs ./dist): the other person's photo sits at the TOP of where their messages start.

  python3 tests/check-chat-avatar-top-web.py [shots_dir]

Test accounts only (Ann Begum, Cat Rahman on a throwaway database). Cat sends a run of messages (short + multi-line),
Ann answers, Cat sends a second run. For en/bn at 360 and en at 320 wide, in Ann's chat with Cat:
- one photo per run of Cat's messages, beside the FIRST (oldest) message of the run, not the last;
- the photo's top lines up with the top of that message bubble (within 3px), including a multi-line bubble;
- while the chat is open Cat sends one more message: it arrives, the photo stays beside the first message of the run
  (it does not move down to the new one), and the newest message is still in view (scrolling unchanged).
Also: no page errors, nothing running off the screen.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6700 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/chat-avatar-top"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="avatar-top-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="avatar-top-secret-0123456789abcdef0123456789ab")
srv = None

LONG1 = "My tomato leaves have yellow spots and the edges are curling. It started three days ago after the rain. What should I spray?"
LONG2 = "Also the fish pond water turned green this week and some fish are gasping at the top in the morning. Is it oxygen?"


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/avatar-top-web-server.log", "a"),
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


def init_script(acc, lang):
    u = dict(acc["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


OVERFLOW_JS = r"""() => {
  const vw = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll('div,span,img')) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= vw + 1) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1) { clipped = true; break; } } p = p.parentElement; }
    if (!clipped) out.push((el.innerText || el.tagName).slice(0, 40) + ' @' + Math.round(r.right));
  }
  return out.slice(0, 8);
}"""

# Each of Cat's visible messages, top to bottom on screen: its text, the bubble box, and the photo box if it has one.
LAYOUT_JS = r"""() => {
  const rows = [...document.querySelectorAll('[data-testid="dm-msg-theirs"]')];
  const out = [];
  for (const row of rows) {
    const av = row.querySelector('[data-testid="dm-msg-avatar"]');
    let bubble = null;
    for (const el of row.querySelectorAll('div')) {
      if (av && av.contains(el)) continue;
      const bg = getComputedStyle(el).backgroundColor;
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 20) continue;
      bubble = el; break;
    }
    if (!bubble) continue;
    const b = bubble.getBoundingClientRect();
    const a = av ? av.getBoundingClientRect() : null;
    out.push({ text: (bubble.innerText || '').trim().slice(0, 30), bTop: Math.round(b.top), bBottom: Math.round(b.bottom),
               bH: Math.round(b.height), aTop: a ? Math.round(a.top) : null, aBottom: a ? Math.round(a.bottom) : null,
               tl: getComputedStyle(bubble).borderTopLeftRadius, bl: getComputedStyle(bubble).borderBottomLeftRadius });
  }
  out.sort((x, y) => x.bTop - y.bTop);
  return out;
}"""


def judge(layout, first_texts, other_texts):
    """Photos only beside the given run-starting messages, each lined up with its bubble's top."""
    with_av = [m for m in layout if m["aTop"] is not None]
    starts = [m["text"] for m in with_av]
    ok_starts = len(with_av) == len(first_texts) and all(any(m["text"].startswith(t[:20]) for m in with_av) for t in first_texts)
    no_av_on_others = all(m["aTop"] is None for m in layout if any(m["text"].startswith(t[:20]) for t in other_texts))
    aligned = all(abs(m["aTop"] - m["bTop"]) <= 3 for m in with_av)
    return {"photo_beside": starts, "photos_on_run_starts": ok_starts, "no_photo_on_later_messages": no_av_on_others,
            "photo_top_matches_bubble_top": aligned}


async def main():
    rep = {}
    start()
    try:
        ann = signup("ann", "Ann Begum")
        cat = signup("cat", "Cat Rahman")
        A, C = ann["user"]["id"], cat["user"]["id"]
        seq = [(cat, A, "Hi Ann"), (cat, A, LONG1), (ann, C, "Hello Cat, send me a photo"), (cat, A, "One more thing"), (cat, A, LONG2)]
        for i, (who, to, text) in enumerate(seq):
            st, _ = api("POST", f"/api/dm/{to}/messages", {"content": text, "clientId": f"seedtop{i:02d}x"}, who["token"])
            assert st in (200, 201), st
            time.sleep(0.05)

        async with async_playwright() as p:
            br = await p.chromium.launch()
            for n, (lang, w) in enumerate([("en", 360), ("bn", 360), ("en", 320)]):
                key = f"{lang}-{w}"
                r = {}
                errs = []
                ctx = await br.new_context(viewport={"width": w, "height": 780})
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(ann, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.locator('[data-testid="tab-chats"]').first.wait_for(timeout=30000)
                await pg.locator('[data-testid="tab-chats"]').first.click()
                row = pg.get_by_role("button", name="Cat Rahman").first
                await row.wait_for(timeout=15000)
                await row.click()
                await pg.wait_for_selector('[data-testid="dm-input"]', timeout=15000)
                await pg.locator('[data-testid="dm-msg-theirs"]').filter(has_text="Is it oxygen").last.wait_for(timeout=15000)
                await pg.wait_for_timeout(1200)
                lay = await pg.evaluate(LAYOUT_JS)
                r["layout"] = lay
                r["multiline_bubble"] = any(m["bH"] > 50 for m in lay)
                r.update(judge(lay, ["Hi Ann", "One more thing"], [LONG1, LONG2]))
                await pg.screenshot(path=f"{SHOTS}/{key}-1-chat.png")

                # a new message from Cat while the chat is open
                live = f"New message number {n + 1} just now"
                api("POST", f"/api/dm/{A}/messages", {"content": live, "clientId": f"livetop{n:02d}x"}, cat["token"])
                arrived = pg.locator('[data-testid="dm-msg-theirs"]').filter(has_text=live).last
                try:
                    await arrived.wait_for(state="visible", timeout=20000)
                    r["live_arrived"] = True
                except Exception:
                    r["live_arrived"] = False
                await pg.wait_for_timeout(1200)
                r["live_in_view"] = await arrived.is_visible() and await arrived.evaluate(
                    "el => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight; }")
                lay2 = await pg.evaluate(LAYOUT_JS)
                r["after_live"] = judge(lay2, ["Hi Ann", "One more thing"], [LONG1, LONG2, live])
                await pg.screenshot(path=f"{SHOTS}/{key}-2-after-new-message.png")
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
        a = r["after_live"]
        ok = ok and r["photos_on_run_starts"] and r["no_photo_on_later_messages"] and r["photo_top_matches_bubble_top"] \
            and r["multiline_bubble"] and r["live_arrived"] and r["live_in_view"] and a["photos_on_run_starts"] \
            and a["no_photo_on_later_messages"] and a["photo_top_matches_bubble_top"] and not r["page_errors"] and not r["overflow"]
    print("RESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


asyncio.run(main())
