"""Web check (throwaway local server, needs ./dist): the chat header's three-dot menu slides up from the bottom like the
three-dot menu on a feed post.

  python3 tests/check-chat-options-sheet-web.py [shots_dir]

Test accounts only (Ann Begum, Cat Rahman on a throwaway database). For en/bn at 360 and 320 wide, and en at 1280:
- Ann opens her chat with Cat, taps the three dots: the sheet shows all six options, its bottom edge sits on the bottom
  of the screen and it spans the app column (not a small box in the middle).
- It opened with a slide (the sheet starts lower and moves up), tapping the dark area closes it, and View Profile opens
  Cat's profile.
- For comparison the feed post's three-dot sheet is measured the same way.
Also: no page errors, nothing running off the screen.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/chat-sheet"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="chatsheet-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="chatsheet-web-secret-0123456789abcdef0123456789")
srv = None

LABELS = {
    "en": ["View Profile", "Search in Conversation", "Mute Notifications", "Report", "Block", "Delete Chat"],
    "bn": ["প্রোফাইল দেখুন", "কথোপকথনে খুঁজুন", "নোটিফিকেশন বন্ধ করুন", "রিপোর্ট", "ব্লক", "চ্যাট মুছুন"],
}


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/chatsheet-web-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(180):
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
    st, j = api("POST", "/api/auth/signup", {"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
    assert j and j.get("token"), (st, j)
    return {"token": j["token"], "user": j["user"]}


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


def rect(b):
    return {k: round(v) for k, v in b.items()} if b else None


async def open_dm(pg, name):
    await pg.goto(BASE, wait_until="networkidle")
    await pg.locator('[data-testid="tab-chats"]').first.wait_for(timeout=40000)
    await pg.locator('[data-testid="tab-chats"]').first.click()
    row = pg.get_by_role("button", name=name).first
    await row.wait_for(timeout=15000)
    await row.click()
    await pg.wait_for_selector('[data-testid="dm-input"]', timeout=15000)
    await pg.wait_for_timeout(1200)


async def sheet_metrics(pg, sheet_sel, open_fn, r, tag, w, h):
    """Open a sheet, sample its top while it animates, then measure where it ends up."""
    await open_fn()
    tops = []
    for _ in range(12):
        b = await pg.locator(sheet_sel).first.bounding_box() if await pg.locator(sheet_sel).count() else None
        if b:
            tops.append(round(b["y"]))
        await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(700)
    b = await pg.locator(sheet_sel).first.bounding_box()
    r[f"{tag}_rect"] = rect(b)
    r[f"{tag}_tops"] = tops
    r[f"{tag}_at_bottom"] = bool(b) and abs((b["y"] + b["height"]) - h) <= 2
    r[f"{tag}_slid_up"] = len(tops) >= 2 and tops[0] > tops[-1] + 20
    return b


async def main():
    rep = {}
    start()
    ann = signup("ann", "Ann Begum")
    cat = signup("cat", "Cat Rahman")
    api("POST", f"/api/dm/{ann['user']['id']}/messages", {"content": "Hi Ann", "clientId": "seedseeddm1"}, cat["token"])
    rep["post_seed"] = api("POST", "/api/posts", {"content": "Fresh rui fish available this week"}, cat["token"])[0]

    async with async_playwright() as p:
        br = await p.chromium.launch()
        for lang, w in [("en", 360), ("bn", 360), ("en", 320), ("bn", 320), ("en", 1280)]:
            h = 780
            key = f"{lang}-{w}"
            r = {}
            errs = []
            ctx = await br.new_context(viewport={"width": w, "height": h})
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            await pg.add_init_script(init_script(ann, lang))
            try:
                await open_dm(pg, "Cat Rahman")
                b = await sheet_metrics(pg, '[data-testid="chat-options-sheet"]',
                                        lambda: pg.click('[data-testid="dm-options-button"]'), r, "chat", w, h)
                texts = await pg.locator('[data-testid="chat-options-sheet"]').inner_text()
                r["labels_ok"] = all(t in texts for t in LABELS[lang])
                r["overflow"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/chat-sheet-{key}.png")
                # tap the dark area above the sheet -> closes
                await pg.mouse.click(w / 2, 60)
                await pg.wait_for_timeout(900)
                r["backdrop_closes"] = await pg.locator('[data-testid="chat-options-sheet"]').count() == 0 or not await pg.locator('[data-testid="chat-options-sheet"]').is_visible()
                # open again -> View Profile
                await pg.click('[data-testid="dm-options-button"]')
                await pg.wait_for_timeout(900)
                await pg.click('[data-testid="chat-menu-profile"]')
                await pg.wait_for_timeout(2000)
                r["profile_opened"] = await pg.locator('[data-testid="dm-input"]').count() == 0 or not await pg.locator('[data-testid="dm-input"]').is_visible()
                r["profile_has_name"] = await pg.get_by_text("Cat Rahman").count() > 0
                r["sheet_gone_after_profile"] = await pg.locator('[data-testid="chat-options-sheet"]').count() == 0
                await pg.screenshot(path=f"{SHOTS}/after-profile-{key}.png")
                # reference: the feed post's sheet
                await pg.goto(BASE, wait_until="networkidle")
                more = pg.get_by_role("button", name="More" if lang == "en" else "আরও")
                try:
                    await more.first.wait_for(timeout=15000)
                    pb = await sheet_metrics(pg, '[data-testid^="post-menu-"] >> xpath=..', lambda: more.first.click(), r, "post", w, h)
                    await pg.screenshot(path=f"{SHOTS}/post-sheet-{key}.png")
                    if b and pb:
                        r["same_width_as_post"] = abs(b["width"] - pb["width"]) <= 2 and abs(b["x"] - pb["x"]) <= 2
                except Exception as e:
                    r["post_ref"] = f"not measured: {str(e)[:80]}"
            except Exception as e:
                r["error"] = str(e)[:300]
                await pg.screenshot(path=f"{SHOTS}/error-{key}.png")
            r["page_errors"] = errs[:5]
            rep[key] = r
            await ctx.close()
        await br.close()
    stop()
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    must = ["chat_at_bottom", "chat_slid_up", "labels_ok", "backdrop_closes", "profile_opened", "sheet_gone_after_profile"]
    bad = [(k, m) for k, r in rep.items() if isinstance(r, dict) and "-" in k for m in must if not r.get(m)]
    bad += [(k, "overflow/page errors") for k, r in rep.items() if isinstance(r, dict) and (r.get("overflow") or r.get("page_errors") or r.get("error"))]
    print("FAIL" if bad else "PASS", bad)


asyncio.run(main())
