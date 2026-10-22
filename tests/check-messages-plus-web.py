"""Web check (throwaway local server, needs ./dist): Messages has a plus in the title bar, top right, that opens Find people.

  python3 tests/check-messages-plus-web.py [shots_dir]

Test account only, on a throwaway database. For en/bn at 320, 360 and 1280 wide:
- the "New message" button sits in the title bar on the right (testID messages-new-button) and draws a plus;
- there is no second "New message" button left next to the All/Unread/Online filters;
- tapping it opens the Find people screen (the search box there);
- no page errors, nothing running off the screen.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6700 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/messages-plus"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="msgplus-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="msgplus-web-secret-0123456789abcdef0123456789ab")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/msgplus-web-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)


def api(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, json.loads(r.read() or b"null")


OVERFLOW_JS = r"""() => {
  const vw = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll('div,span,img')) {
    const r = el.getBoundingClientRect();
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    // Skip items inside sideways-scrolling rows (carousels) and screens of other tabs that are not shown.
    let a = el.parentElement, skip = false;
    while (a) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) || cs.display === 'none' || cs.visibility === 'hidden') { skip = true; break; } a = a.parentElement; }
    if (skip) continue;
    if (r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 150 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') out.push((el.innerText || el.tagName).slice(0, 40));
  }
  return out.slice(0, 5);
}"""


async def run():
    for _ in range(150):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); break
        except Exception:
            time.sleep(1)
    else:
        raise SystemExit("server did not start")
    s = str(int(time.time() * 1000))[-7:]
    _, j = api("POST", "/api/auth/signup", {"email": f"ann{s}@check.test", "password": "Check-pass-123", "name": "Ann Begum", "username": f"ann_{s}"})
    tok, user = j["token"], j["user"]
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (320, 360, 1280):
                h = 800 if w > 400 else 720
                ctx = await b.new_context(viewport={"width": w, "height": h})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                u = dict(user); u["language"] = lang
                await pg.add_init_script("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
                                         % (json.dumps(tok), json.dumps(json.dumps(u)), json.dumps(lang)))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.locator('[data-testid="tab-chats"]').first.wait_for(timeout=40000)
                await pg.locator('[data-testid="tab-chats"]').first.click()
                btn = pg.locator('[data-testid="messages-new-button"]:visible').first
                await btn.wait_for(timeout=20000)
                await pg.wait_for_timeout(600)
                tag = f"{lang}-{w}"
                await pg.screenshot(path=f"{SHOTS}/messages-{tag}.png")
                box = await btn.bounding_box()
                label = "নতুন বার্তা" if lang == "bn" else "New message"
                n_labelled = await pg.locator(f'[aria-label="{label}"]:visible').count()
                inner_label = await btn.locator(f'[aria-label="{label}"]').count()
                # Feather glyphs: plus = U+F1C0, the old pencil (edit-3) = U+F161.
                glyph = (await btn.inner_text()).strip()
                over = await pg.evaluate(OVERFLOW_JS)
                # Same right edge as the other title-bar buttons (Connect's filter), so it lines up on wide screens too.
                await pg.get_by_role("tab").nth(1).click()
                ref = pg.locator('[data-testid="connect-filter-button"]:visible').first
                await ref.wait_for(timeout=20000)
                rbox = await ref.bounding_box()
                await pg.locator('[data-testid="tab-chats"]').first.click()
                await btn.wait_for(timeout=20000)
                await pg.wait_for_timeout(400)
                if not box or box["y"] > 80 or abs((box["x"] + box["width"]) - (rbox["x"] + rbox["width"])) > 2 or box["x"] + box["width"] > w:
                    fails.append(f"{tag}: button not in title bar top right: {box} (Connect filter {rbox})")
                if inner_label != 1 or n_labelled != 1:
                    fails.append(f"{tag}: expected exactly one '{label}' button, found {n_labelled} (inside header {inner_label})")
                if glyph != "\uf1c0":
                    fails.append(f"{tag}: icon text {glyph!r}")
                if over:
                    fails.append(f"{tag}: off screen {over}")
                await btn.click()
                inp = pg.locator('input:visible')
                await pg.wait_for_timeout(1500)
                url = pg.url
                await pg.screenshot(path=f"{SHOTS}/find-people-{tag}.png")
                ph = [await inp.nth(i).get_attribute("placeholder") for i in range(await inp.count())]
                if not any(x and ("খুঁজুন" in x or "earch" in x) for x in ph):
                    fails.append(f"{tag}: Find people did not open (url {url}, inputs {ph})")
                if errs:
                    fails.append(f"{tag}: page errors {errs[:2]}")
                print(tag, "box", box and {k: round(v) for k, v in box.items()}, "glyph", hex(ord(glyph[0])) if glyph else None, "->", url, ph)
                await ctx.close()
        await b.close()
    return fails


try:
    fails = asyncio.run(run())
finally:
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass
print("FAIL\n" + "\n".join(fails) if fails else "PASS")
sys.exit(1 if fails else 0)
