"""Admin Home notification bell, on a throwaway local server (test accounts only, nothing reaches production).

- A user's Support message gives each admin a notification; the bell badge on the admin Home header counts it,
  and goes up when more arrive while the dashboard is open (no reload).
- Another user's account never sees admin notifications; one admin reading doesn't clear the other's.
- Bell -> Notifications list -> tap -> the right Support conversation; opening it clears that conversation's
  notifications (also when opened from the Support tab); Mark all read clears the badge.
- Offline -> message arrives -> back online: the badge catches up.
- Layout: en 360/390, bn 320, dark 360: header fits, no sideways overflow, no page errors.

  python3 tests/check-admin-bell-web.py      (needs a web export in ./dist)
"""
import asyncio, json, os, random, signal, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = "/home/sprite/farmers-shots/admin-bell"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="admin-bell-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="admin-bell-secret-0123456789abcdef0123456789")
srv = None
passed, failed = 0, 0


def ok(cond, label, extra=""):
    global passed, failed
    if cond: passed += 1
    else: failed += 1
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{extra}]" if extra and not cond else ""), flush=True)


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/admin-bell-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(180):
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
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    email = f"{tag}{s}@check.test"
    st, j = api("POST", "/api/auth/signup", {"email": email, "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
    assert j and j.get("token"), (st, j)
    return {"email": email, "token": j["token"], "user": j["user"]}


def login(acc):
    st, j = api("POST", "/api/auth/login", {"email": acc["email"], "password": "Check-pass-123"})
    acc["token"], acc["user"] = j["token"], j["user"]


def count(acc):
    return api("GET", "/api/me/notifications/unread-count", tok=acc["token"])[1].get("unread")


def init_script(acc, lang, dark=False):
    u = dict(acc["user"]); u["language"] = lang
    s = ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
         % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))
    return s


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

T = lambda t: f'[data-testid="{t}"]'


async def text(pg, sel="body"):
    return await pg.evaluate("(s) => (document.querySelector(s) || {}).innerText || ''", sel)


async def wait_for(pg, sel, ms=15000):
    try:
        await pg.locator(sel).first.wait_for(state="visible", timeout=ms); return True
    except Exception:
        return False


async def badge(pg):
    loc = pg.locator(T("header-bell-badge"))
    if not await loc.count(): return ""
    return (await loc.first.inner_text()).strip()


async def wait_badge(pg, want, ms=30000):
    end = time.time() + ms / 1000
    b = None
    while time.time() < end:
        b = await badge(pg)
        if b == want: return True, b
        await pg.wait_for_timeout(500)
    return False, b


async def main():
    start()
    admin = signup("boss", "Admin Rahim")
    admin2 = signup("boss2", "Admin Karim")
    ann = signup("ann", "Ann Begum")
    bob = signup("bob", "Bob Mia")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1 OR id = $2', [process.argv[2], process.argv[3]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"]), str(admin2["user"]["id"])], check=True)
    start()
    login(admin); login(admin2)
    errors = []

    # ---- API: delivery and scoping ----
    ok(count(admin) == 0 and count(admin2) == 0 and count(bob) == 0, "everyone starts at 0")
    st, r = api("POST", "/api/support/messages", {"body": "Hello Support, my fish are sick", "clientId": "b1"}, ann["token"])
    ok(st == 201, "Ann sends a Support message", str(r)[:120])
    ok(count(admin) == 1 and count(admin2) == 1, "both admins get one notification", f"{count(admin)} {count(admin2)}")
    ok(count(bob) == 0 and count(ann) == 0, "other users get nothing")
    n1 = api("GET", "/api/me/notifications", tok=admin["token"])[1]["notifications"]
    n2 = api("GET", "/api/me/notifications", tok=admin2["token"])[1]["notifications"]
    ok(len(n1) == 1 and n1[0]["type"] == "support" and n1[0]["data"].get("supportThreadId"), "admin's notification is a Support one with the conversation id", str(n1)[:200])
    ok(not ({x["id"] for x in n1} & {x["id"] for x in n2}), "each admin has their own notification rows")
    tid = n1[0]["data"]["supportThreadId"]
    # bob can't clear admin's rows with their ids or the thread id
    api("POST", "/api/me/notifications/read", {"ids": [n1[0]["id"]]}, bob["token"])
    api("POST", "/api/me/notifications/read", {"supportThreadId": tid}, bob["token"])
    ok(count(admin) == 1, "another user can't mark an admin's notification read")

    async with async_playwright() as p:
        b = await p.chromium.launch()
        actx = await b.new_context(viewport={"width": 360, "height": 780})
        await actx.add_init_script(init_script(admin, "en"))
        apg = await actx.new_page()
        apg.on("pageerror", lambda e: errors.append("admin: " + str(e)[:200]))
        apg.on("dialog", lambda d: (errors.append("dialog: " + d.message[:120]), asyncio.ensure_future(d.dismiss())))

        await apg.goto(BASE + "/admin", wait_until="load", timeout=180000); await apg.wait_for_timeout(2500)
        ok(await wait_for(apg, T("admin-app"), 120000), "admin app opens")
        ok(await wait_for(apg, T("header-bell"), 120000), "bell is on the admin Home header")
        g, v = await wait_badge(apg, "1", 15000)
        ok(g, "bell badge shows 1", v)
        lbl = await apg.locator(T("header-bell")).first.get_attribute("aria-label")
        ok(lbl and "1 unread" in lbl, "bell has a screen-reader label with the count", str(lbl))
        await apg.screenshot(path=f"{SHOTS}/home-bell-1.png")

        # live increment while open (no reload)
        api("POST", "/api/support/messages", {"body": "Second message, please call me", "clientId": "b2"}, ann["token"])
        g, v = await wait_badge(apg, "2", 30000)
        ok(g, "badge goes to 2 by itself when another Support message arrives", v)

        # bell opens the list
        await apg.locator(T("header-bell")).first.click()
        ok(await wait_for(apg, T("admin-notifications")), "bell opens Notifications")
        await apg.wait_for_timeout(1200)
        body = await text(apg)
        ok("Notifications" in body and "New Support message from Ann Begum" in body and "Second message, please call me" in body, "list shows the Support messages", body[:300])
        ok(await apg.locator(T("header-bell")).count() == 0, "no bell inside the list screen")
        await apg.screenshot(path=f"{SHOTS}/list-en-360.png")
        ov = await apg.evaluate(OVERFLOW_JS)
        ok(not ov, "list: no sideways overflow at 360", str(ov))

        # tap -> the right conversation, and that conversation's notifications are read
        await apg.locator('[data-testid^="notif-n-"]').first.click()
        ok(await wait_for(apg, T("support-input")), "tapping opens the Support conversation")
        await apg.wait_for_timeout(1500)
        ok("Second message, please call me" in await text(apg), "it's Ann's conversation")
        await apg.wait_for_timeout(1000)
        ok(count(admin) == 0, "opening the conversation clears both of its notifications", str(count(admin)))
        ok(count(admin2) == 2, "the other admin's notifications stay unread", str(count(admin2)))
        await apg.locator(T("support-back")).click(); await apg.wait_for_timeout(800)
        await apg.locator(T("admin-back")).first.click(); await apg.wait_for_timeout(1200)
        g, v = await wait_badge(apg, "", 8000)
        ok(g, "bell badge is gone after reading", v)

        # Mark all read
        api("POST", "/api/support/messages", {"body": "Third", "clientId": "b3"}, bob["token"])
        api("POST", "/api/support/messages", {"body": "Fourth", "clientId": "b4"}, ann["token"])
        g, v = await wait_badge(apg, "2", 30000)
        ok(g, "two new messages from two users -> badge 2", v)
        await apg.locator(T("header-bell")).first.click(); await apg.wait_for_timeout(1500)
        ok("Bob Mia" in await text(apg), "list shows Bob's message too")
        await apg.locator(T("notif-filter")).get_by_text("Unread").first.click(); await apg.wait_for_timeout(500)
        ok(await apg.locator(T("notif-unread-dot")).count() == 2, "Unread filter shows the 2 unread")
        await apg.locator(T("notif-read-all")).click(); await apg.wait_for_timeout(1500)
        ok(count(admin) == 0, "Mark all read clears them on the server")
        ok("all caught up" in await text(apg), "Unread filter shows the caught-up message")
        await apg.locator(T("admin-back")).first.click(); await apg.wait_for_timeout(800)
        ok((await badge(apg)) == "", "badge cleared after Mark all read")

        # opening from the Support tab also clears (admin2 via API thread open + UI for admin)
        api("POST", "/api/support/messages", {"body": "Fifth from Ann", "clientId": "b5"}, ann["token"])
        g, v = await wait_badge(apg, "1", 30000)
        ok(g, "badge 1 again", v)
        await apg.locator(T("admin-tab-support")).click(); await apg.wait_for_timeout(1500)
        await apg.locator(T(f"thread-{tid}")).click()
        await wait_for(apg, T("support-input")); await apg.wait_for_timeout(2000)
        ok(count(admin) == 0, "opening the conversation from the Support tab clears its notification")
        await apg.locator(T("support-back")).click(); await apg.wait_for_timeout(600)
        await apg.locator(T("admin-tab-home")).click(); await apg.wait_for_timeout(1200)
        ok((await badge(apg)) == "", "badge clear back on Home")

        # reconnect catch-up
        await actx.set_offline(True)
        api("POST", "/api/support/messages", {"body": "Sent while admin offline", "clientId": "b6"}, bob["token"])
        await apg.wait_for_timeout(3000)
        await actx.set_offline(False)
        g, v = await wait_badge(apg, "1", 35000)
        ok(g, "after coming back online the badge catches up", v)

        # bell only on Home tab
        await apg.locator(T("admin-tab-orders")).click(); await apg.wait_for_timeout(800)
        ok(await apg.locator(T("header-bell")).count() == 0, "bell is only on the Home header")
        await apg.locator(T("admin-tab-home")).click(); await apg.wait_for_timeout(800)

        # layouts
        for (w, lang, dark) in [(390, "en", False), (320, "bn", False), (360, "en", True)]:
            ctx = await b.new_context(viewport={"width": w, "height": 760})
            await ctx.add_init_script(init_script(admin, lang, dark))
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(f"{w}{lang}: " + str(e)[:200]))
            await pg.goto(BASE + "/admin", wait_until="load", timeout=180000); await pg.wait_for_timeout(2500)
            tag = f"{lang}-{w}{'-dark' if dark else ''}"
            if dark:
                await pg.locator(T("header-theme")).first.click(); await pg.wait_for_timeout(1000)
            ok(await wait_for(pg, T("header-bell"), 120000), f"{tag}: bell visible")
            bb = await pg.locator(T("header-bell")).first.bounding_box()
            ok(bb and bb["x"] + bb["width"] <= w + 1, f"{tag}: bell inside the screen", str(bb))
            ov = await pg.evaluate(OVERFLOW_JS)
            ok(not ov, f"{tag}: Home no sideways overflow", str(ov))
            await pg.screenshot(path=f"{SHOTS}/home-{tag}.png")
            await pg.locator(T("header-bell")).first.click(); await pg.wait_for_timeout(1500)
            body = await text(pg)
            if lang == "bn":
                ok("নোটিফিকেশন" in body and "সাপোর্টে মেসেজ পাঠিয়েছেন" in body, f"{tag}: list in Bangla", body[:200])
            ov = await pg.evaluate(OVERFLOW_JS)
            ok(not ov, f"{tag}: list no sideways overflow", str(ov))
            await pg.screenshot(path=f"{SHOTS}/list-{tag}.png")
            await ctx.close()

        ok(not errors, "no page errors or dialogs", "; ".join(errors[:5]))
        await b.close()
    stop()
    print(f"\n{passed} passed, {failed} failed")


try:
    asyncio.run(main())
finally:
    stop()
