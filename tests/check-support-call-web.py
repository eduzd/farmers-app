"""Support chat voice call + two-way messaging check on a throwaway local server (test accounts only).

1. Messaging: user sends text in Support -> admin's Support tab badge + thread shows it -> admin replies in the
   admin app -> user's Help unread dot -> user sees the reply.
2. Call user -> Support: user taps the phone in Support; the admin (sitting in the admin app) gets the incoming
   call screen named "Support call · <user>", accepts, both reach the connected state, then hang up.
3. Call back: admin opens the thread and taps the phone; the user's phone rings as "Farmers Support"; accept, connect, hang up.
4. Layout of both Support headers at 320/360/390 in English and Bangla: sideways overflow, page errors.

  python3 tests/check-support-call-web.py      (needs a web export in ./dist)
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6500 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = "/home/sprite/farmers-shots/support-call"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="sup-call-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="sup-call-secret-0123456789abcdef0123456789ab")
srv = None
passed, failed = 0, 0


def ok(cond, label, extra=""):
    global passed, failed
    if cond: passed += 1
    else: failed += 1
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{extra}]" if extra and not cond else ""), flush=True)


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/sup-call-server.log", "a"),
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
    errors = []

    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        actx = await b.new_context(viewport={"width": 360, "height": 780}, permissions=["microphone"])
        await actx.add_init_script(init_script(admin, "en"))
        apg = await actx.new_page()
        apg.on("pageerror", lambda e: errors.append("admin: " + str(e)[:200]))
        uctx = await b.new_context(viewport={"width": 360, "height": 780}, permissions=["microphone"])
        await uctx.add_init_script(init_script(ann, "en"))
        upg = await uctx.new_page()
        upg.on("pageerror", lambda e: errors.append("user: " + str(e)[:200]))
        for pg in (apg, upg):
            pg.on("dialog", lambda d: (errors.append("dialog: " + d.message[:120]), asyncio.ensure_future(d.dismiss())))

        # ---- 1. messaging both ways through the UI ----
        await upg.goto(BASE, wait_until="networkidle"); await upg.wait_for_timeout(2000)
        await upg.locator('[data-testid="help-button"]').first.click()
        ok(await wait_for(upg, '[data-testid="support-chat"]'), "user opens Support from the Help button")
        await upg.locator('[data-testid="support-input"]').fill("Hi admin, my order is late")
        await upg.locator('[data-testid="support-send"]').click(); await upg.wait_for_timeout(2000)
        ut = await text(upg)
        ok("Hi admin, my order is late" in ut and "Couldn't send" not in ut, "user's message shows as sent")

        await apg.goto(BASE + "/admin", wait_until="networkidle"); await apg.wait_for_timeout(2500)
        ok(await apg.locator('[data-testid="admin-app"]').count() == 1, "admin app opens")
        await apg.locator('[data-testid="admin-tab-support"]').click(); await apg.wait_for_timeout(2000)
        st_, threads = api("GET", "/api/admin/manage/support/threads", tok=admin["token"])
        tid = threads[0]["id"] if threads else None
        ok(bool(tid) and threads[0].get("adminUnread", 0) >= 1, "thread reaches admin with an unread count", str(threads)[:200])
        ok("Hi admin, my order is late" in await text(apg), "admin Support tab shows the message")
        await apg.locator(f'[data-testid="thread-{tid}"]').click()
        ok(await wait_for(apg, '[data-testid="support-call-button"]'), "admin thread has a voice call button")
        await apg.locator('[data-testid="support-input"]').fill("We are on it, Ann")
        await apg.locator('[data-testid="support-send"]').click(); await apg.wait_for_timeout(2000)
        ok("We are on it, Ann" in await text(apg), "admin reply shows in the thread")
        await apg.screenshot(path=f"{SHOTS}/admin-thread.png")
        await apg.locator('[data-testid="support-back"]').click(); await apg.wait_for_timeout(800)
        await apg.locator('[data-testid="admin-tab-home"]').click(); await apg.wait_for_timeout(800)

        await upg.wait_for_timeout(6000)  # Support polls for new messages
        ok("We are on it, Ann" in await text(upg), "user sees the admin's reply in Support")
        await upg.locator('[data-testid="support-back"]').click(); await upg.wait_for_timeout(1000)
        await upg.goto(BASE, wait_until="networkidle"); await upg.wait_for_timeout(2000)
        api("POST", f"/api/admin/manage/support/threads/{tid}/reply", {"body": "One more thing", "clientId": "x1"}, admin["token"])
        un = api("GET", "/api/support/unread", tok=ann["token"])[1]
        ok(un.get("unread") == 1 and un.get("adminsOnline") is True, "user unread count = 1 and admin shows online", str(un))
        await upg.reload(wait_until="networkidle"); await upg.wait_for_timeout(2500)
        ok(await upg.locator('[data-testid="help-unread"]').count() >= 1, "Help button shows the unread dot")
        await upg.locator('[data-testid="help-button"]').first.click(); await upg.wait_for_timeout(2500)
        ok(api("GET", "/api/support/unread", tok=ann["token"])[1].get("unread") == 0, "opening Support clears the user's unread count")

        # ---- 2. user calls Support ----
        tgt = api("GET", "/api/support/call-target", tok=ann["token"])
        ok(tgt[0] == 200 and tgt[1].get("adminId") == str(admin["user"]["id"]) and tgt[1].get("online"), "call target is the online admin", str(tgt))
        await upg.locator('[data-testid="support-call-button"]').click()
        ok(await wait_for(upg, '[data-testid="call-overlay"]', 10000), "user's call screen opens")
        ok("Farmers Support" in await text(upg, '[data-testid="call-overlay"]'), "user's call screen says Farmers Support")
        got = await wait_for(apg, '[data-testid="call-accept"]', 15000)
        ok(got, "admin gets the incoming call in the admin app")
        at = await text(apg, '[data-testid="call-overlay"]')
        ok("Support call" in at and "Ann Begum" in at, "admin's incoming call shows 'Support call · Ann Begum'", at[:120])
        await apg.screenshot(path=f"{SHOTS}/admin-incoming.png")
        if got:
            await apg.locator('[data-testid="call-accept"]').click()
            c1, s1 = await wait_status(apg, ["00:", "0:0"])
            c2, s2 = await wait_status(upg, ["00:", "0:0"])
            ok(c1 and c2, "both sides connected (call timer running)", f"admin={s1!r} user={s2!r}")
            await upg.screenshot(path=f"{SHOTS}/user-connected.png")
            await upg.locator('[data-testid="call-end"]').click(); await upg.wait_for_timeout(3000)
            ok(not await apg.locator('[data-testid="call-end"]').count() or not await apg.locator('[data-testid="call-end"]').first.is_visible(), "hang up ends the call on the admin side")
        await apg.wait_for_timeout(3000); await upg.wait_for_timeout(1000)

        # ---- 3. admin calls the user back ----
        await apg.locator('[data-testid="admin-tab-support"]').click(); await apg.wait_for_timeout(1500)
        await apg.locator(f'[data-testid="thread-{tid}"]').click(); await apg.wait_for_timeout(2000)
        await apg.locator('[data-testid="support-call-button"]').click()
        got = await wait_for(upg, '[data-testid="call-accept"]', 15000)
        ok(got, "user's phone rings when the admin calls back")
        ut = await text(upg, '[data-testid="call-overlay"]')
        ok("Farmers Support" in ut and "Admin Rahim" not in ut, "user sees the call as Farmers Support", ut[:120])
        if got:
            await upg.locator('[data-testid="call-accept"]').click()
            c1, s1 = await wait_status(apg, ["00:", "0:0"])
            c2, s2 = await wait_status(upg, ["00:", "0:0"])
            ok(c1 and c2, "call-back connected on both sides", f"admin={s1!r} user={s2!r}")
            await apg.locator('[data-testid="call-end"]').click(); await apg.wait_for_timeout(2500)
        await actx.close(); await uctx.close()

        # ---- 4. layout ----
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                for who, acc, url in (("user", ann, BASE), ("admin", admin, BASE + "/admin")):
                    ctx = await b.new_context(viewport={"width": w, "height": 740})
                    await ctx.add_init_script(init_script(acc, lang))
                    pg = await ctx.new_page(); errs = []
                    pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
                    await pg.goto(url, wait_until="networkidle"); await pg.wait_for_timeout(2000)
                    if who == "user":
                        await pg.locator('[data-testid="help-button"]').first.click()
                    else:
                        await pg.locator('[data-testid="admin-tab-support"]').click(); await pg.wait_for_timeout(1500)
                        await pg.locator(f'[data-testid="thread-{tid}"]').click()
                    await pg.wait_for_timeout(2500)
                    btn = pg.locator('[data-testid="support-call-button"]')
                    vis = await btn.count() and await btn.first.is_visible()
                    box = await btn.first.bounding_box() if vis else None
                    ov = await pg.evaluate(OVERFLOW_JS)
                    ok(bool(vis) and box and box["x"] + box["width"] <= w + 1 and not ov and not errs,
                       f"{who} Support header {lang} {w}: call button visible, no overflow, no errors", f"vis={vis} box={box} ov={ov} errs={errs}")
                    await pg.screenshot(path=f"{SHOTS}/{who}-{lang}-{w}.png")
                    await ctx.close()
        await b.close()
    ok(not [e for e in errors if not e.startswith("dialog")], "no page errors during the flows", "; ".join(errors)[:400])
    print(f"\n{passed} passed, {failed} failed")


try:
    asyncio.run(main())
finally:
    if srv: stop()
    sys.exit(1 if failed else 0)
