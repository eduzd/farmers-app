"""Admin Support thread header check on a throwaway local server (test accounts only, no calls placed).

The admin's Support conversation header shows only the user's name and a plain "Online" / "Offline" (Bangla
"অনলাইন" / "অফলাইন"), with no extra "they'll see it in Support" text; there is no separate profile (person) icon,
only the call button on the right; tapping the avatar/name opens the user's profile. Checked with the user signed
out of the app (Offline) and with the user's app open (Online), English + Bangla at 320/360/390.

  python3 tests/check-admin-support-presence-web.py      (needs a web export in ./dist)
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = "/home/sprite/farmers-shots/support-presence"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="sup-presence-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="sup-pres-secret-0123456789abcdef0123456789ab")
srv = None
passed, failed = 0, 0


def ok(cond, label, extra=""):
    global passed, failed
    if cond: passed += 1
    else: failed += 1
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{extra}]" if extra and not cond else ""), flush=True)


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/sup-presence-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); return
        except Exception:
            time.sleep(1)
    raise SystemExit("server did not start")


def stop():
    try: os.killpg(srv.pid, signal.SIGTERM)
    except Exception: pass
    time.sleep(2)


def api(method, path, body=None, tok=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


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


async def text(pg, sel="body"):
    return await pg.evaluate("(s) => (document.querySelector(s) || {}).innerText || ''", sel)


async def wait_for(pg, sel, ms=15000):
    try:
        await pg.locator(sel).first.wait_for(state="visible", timeout=ms); return True
    except Exception:
        return False


async def wait_status(pg, words, ms=20000):
    end = time.time() + ms / 1000
    last = ""
    while time.time() < end:
        last = await text(pg, '[data-testid="call-status"]')
        if any(w in last for w in words): return True, last
        await pg.wait_for_timeout(400)
    return False, last




HEADER_JS = r"""() => {
  const h = document.querySelector('[data-testid="support-chat"]');
  if (!h) return null;
  const hr = h.getBoundingClientRect();
  // Every pressable/icon button in the header row besides back and the avatar/name block.
  const btns = [...h.querySelectorAll('[role="button"],button')].filter(b => {
    const id = b.getAttribute('data-testid') || '';
    return id !== 'support-back' && id !== 'support-header-user' && !b.closest('[data-testid="support-header-user"]');
  }).map(b => b.getAttribute('data-testid') || b.getAttribute('aria-label') || 'button');
  return { text: h.innerText, buttons: btns, height: Math.round(hr.height) };
}"""


async def open_thread(pg, tid):
    await pg.goto(BASE + "/admin", wait_until="networkidle"); await pg.wait_for_timeout(2000)
    await pg.locator('[data-testid="admin-tab-support"]').click(); await pg.wait_for_timeout(1500)
    await pg.locator(f'[data-testid="thread-{tid}"]').click()
    return await wait_for(pg, '[data-testid="support-chat"]')


async def status_is(pg, want, ms=15000):
    end = time.time() + ms / 1000
    last = None
    while time.time() < end:
        last = (await text(pg, '[data-testid="support-status"]')).strip()
        if last == want: return True, last
        await pg.wait_for_timeout(500)
    return False, last


async def main():
    start()
    admin = signup("boss", "Admin Rahim")
    ann = signup("ann", "Ann Begum")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"])], check=True)
    start()
    st, j = api("POST", "/api/auth/login", {"email": admin["email"], "password": "Check-pass-123"})
    admin["token"], admin["user"] = j["token"], j["user"]
    st, _ = api("POST", "/api/support/messages", {"body": "Hi admin, my order is late", "clientId": "p1"}, ann["token"])
    ok(st in (200, 201), "user's Support message saved", str(st))
    api("POST", "/api/presence/beat", {"state": "away"}, ann["token"])
    st_, threads = api("GET", "/api/admin/manage/support/threads", tok=admin["token"])
    tid = threads[0]["id"] if threads else None
    ok(bool(tid), "admin sees the thread", str(threads)[:200])
    words = {"en": ("Online", "Offline"), "bn": ("অনলাইন", "অফলাইন")}
    old = ("see it in Support", "সাপোর্টে দেখতে পাবেন", "we'll reply here", "আমরা এখানে উত্তর দেব")

    async with async_playwright() as p:
        b = await p.chromium.launch()
        combos = [(l, int(x)) for l, x in (c.split(":") for c in os.environ.get("COMBOS", "").split(",") if c)] or \
            [(l, w) for l in ("en", "bn") for w in (320, 360, 390)]
        for lang, w in combos:
            if True:
                ctx = await b.new_context(viewport={"width": w, "height": 740})
                await ctx.add_init_script(init_script(admin, lang))
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
                pg.on("dialog", lambda d: (errs.append("dialog: " + d.message[:120]), asyncio.ensure_future(d.dismiss())))
                tag = f"{lang} {w}"
                ok(await open_thread(pg, tid), f"{tag}: admin Support thread opens")
                api("POST", "/api/presence/beat", {"state": "away"}, ann["token"])
                await pg.wait_for_timeout(5500)
                good, last = await status_is(pg, words[lang][1])
                h = await pg.evaluate(HEADER_JS)
                ok(good, f"{tag}: status reads just '{words[lang][1]}' while the user is away", repr(last))
                ok(h and not any(o in h["text"] for o in old), f"{tag}: no extra 'see it in Support' text in the header", h and h["text"])
                ok(h and h["buttons"] == ["support-call-button"], f"{tag}: only the call icon on the right (no person icon)", h and str(h["buttons"]))
                ok(await pg.locator('[data-testid="thread-user"]').count() == 0, f"{tag}: profile icon removed")
                ov = await pg.evaluate(OVERFLOW_JS)
                ok(not ov, f"{tag}: header/page fits the screen", str(ov))
                await pg.screenshot(path=f"{SHOTS}/admin-offline-{lang}-{w}.png")
                api("POST", "/api/presence/beat", {"state": "active"}, ann["token"])
                good, last = await status_is(pg, words[lang][0], 12000)
                ok(good, f"{tag}: status switches to '{words[lang][0]}' when the user opens the app", repr(last))
                dot = await pg.locator('[data-testid="support-header-user"] [data-testid="online-dot"]').count()
                ok(dot >= 1, f"{tag}: green dot on the header avatar while online")
                await pg.screenshot(path=f"{SHOTS}/admin-online-{lang}-{w}.png")
                # Tap the avatar/name -> user's profile opens.
                await pg.locator('[data-testid="support-header-user"]').click(); await pg.wait_for_timeout(2500)
                body = await text(pg)
                ok(await pg.locator('[data-testid="support-chat"]').count() == 0 and "Ann Begum" in body,
                   f"{tag}: tapping the avatar opens the user's profile", body[:120])
                await pg.screenshot(path=f"{SHOTS}/admin-profile-{lang}-{w}.png")
                ok(not errs, f"{tag}: no page errors or pop-ups", "; ".join(errs))
                await ctx.close()
        await b.close()
    print(f"\n{passed} passed, {failed} failed")


try:
    asyncio.run(main())
finally:
    if srv: stop()
    sys.exit(1 if failed else 0)
