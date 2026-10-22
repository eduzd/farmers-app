"""Error probe for the admin dashboard and the user<->admin Support chat on a throwaway local server.

Signs in an admin and a test user (local only), clicks through every admin tab, home shortcut, stat,
More item, shop section, a support thread and a user profile, and the user's Support chat (text, photo).
Records console errors, page errors and API responses >= 400 per step.

  python3 tests/probe-admin-errors.py [width] [lang]     (needs a web export in ./dist)
"""
import asyncio, base64, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6400 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
W = int(sys.argv[1]) if len(sys.argv) > 1 else 360
LANG = sys.argv[2] if len(sys.argv) > 2 else "en"
SHOTS = "/home/sprite/farmers-shots/probe"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="probe-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="probe-secret-0123456789abcdef0123456789abcd")
srv = None
PNG = base64.b64encode(open("assets/images/icon.png", "rb").read()).decode() if os.path.exists("assets/images/icon.png") else None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/probe-server.log", "a"),
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


class Rec:
    def __init__(self, pg):
        self.step = "load"; self.out = {}
        pg.on("console", lambda m: m.type == "error" and self.add("console", m.text[:300]))
        pg.on("pageerror", lambda e: self.add("pageerror", str(e)[:300]))
        pg.on("response", lambda r: (r.status >= 400 and "/api/" in r.url) and self.add("http", f"{r.status} {r.request.method} {r.url.replace(BASE, '')}"))

    def add(self, kind, text):
        self.out.setdefault(self.step, []).append(f"{kind}: {text}")


async def click(pg, rec, sel, step, wait=1500):
    rec.step = step
    loc = pg.locator(sel).first
    if not await loc.count():
        rec.add("missing", sel); return False
    try:
        await loc.click(timeout=5000)
    except Exception as e:
        rec.add("clickfail", f"{sel} {str(e)[:120]}"); return False
    await pg.wait_for_timeout(wait)
    return True


async def back(pg):
    for sel in ('[data-testid="admin-back"]', '[data-testid="support-back"]', '[data-testid="more-back"]', '[data-testid="classic-back"]'):
        l = pg.locator(sel)
        if await l.count() and await l.first.is_visible():
            await l.first.click(); await pg.wait_for_timeout(700); return True
    return False


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
    rep = {"api": {}}
    rep["api"]["user_text"] = api("POST", "/api/support/messages", {"body": "Hello, my order is late", "clientId": "c1"}, ann["token"])[0]
    if PNG:
        rep["api"]["user_photo"] = api("POST", "/api/support/photo", {"image": PNG, "mime": "image/png", "width": 64, "height": 64, "clientId": "c2"}, ann["token"])[0]
    m4a = base64.b64encode(b"\x00\x00\x00\x18ftypM4A \x00\x00\x02\x00M4A isomiso2" + os.urandom(600)).decode()
    rep["api"]["user_voice"] = api("POST", "/api/support/voice", {"audio": m4a, "mime": "audio/mp4", "durationMs": 2400, "clientId": "c3"}, ann["token"])[0]
    rep["api"]["user_voice_retry_same_id"] = api("POST", "/api/support/voice", {"audio": m4a, "mime": "audio/mp4", "durationMs": 2400, "clientId": "c3"}, ann["token"])[0]
    st, threads = api("GET", "/api/admin/manage/support/threads", tok=admin["token"])
    rep["api"]["threads"] = (st, len(threads) if isinstance(threads, list) else threads)
    tid = threads[0]["id"] if isinstance(threads, list) and threads else None
    if tid:
        rep["api"]["admin_reply"] = api("POST", f"/api/admin/manage/support/threads/{tid}/reply", {"body": "We are checking", "clientId": "a1"}, admin["token"])[0]
        rep["api"]["user_unread"] = api("GET", "/api/support/unread", tok=ann["token"])[1]

    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        # ---------- admin ----------
        ctx = await b.new_context(viewport={"width": W, "height": 780})
        await ctx.add_init_script(init_script(admin, LANG))
        pg = await ctx.new_page(); rec = Rec(pg)
        await pg.goto(BASE + "/admin", wait_until="networkidle"); await pg.wait_for_timeout(2500)
        rec.step = "admin-home"
        rep["admin_app"] = await pg.locator('[data-testid="admin-app"]').count()
        await pg.screenshot(path=f"{SHOTS}/admin-home-{W}-{LANG}.png")
        for s in ("stat-users", "stat-products", "stat-shops", "stat-support", "stat-reports", "hero-pending"):
            await click(pg, rec, f'[data-testid="admin-tab-home"]', "tab-home", 800)
            await click(pg, rec, f'[data-testid="{s}"]', s); await back(pg)
        await click(pg, rec, '[data-testid="admin-tab-home"]', "tab-home", 800)
        shortcuts = await pg.eval_on_selector_all('[data-testid^="shortcut-"]', "els => els.map(e => e.dataset.testid)")
        for s in shortcuts:
            await click(pg, rec, '[data-testid="admin-tab-home"]', "tab-home", 800)
            await click(pg, rec, f'[data-testid="{s}"]', s); await pg.screenshot(path=f"{SHOTS}/{s}-{W}-{LANG}.png"); await back(pg)
        await click(pg, rec, '[data-testid="admin-tab-shop"]', "tab-shop")
        for sec in await pg.eval_on_selector_all('[data-testid^="shop-section-"]', "els => els.map(e => e.dataset.testid)"):
            await click(pg, rec, f'[data-testid="{sec}"]', sec)
        await click(pg, rec, '[data-testid="admin-tab-orders"]', "tab-orders")
        await click(pg, rec, '[data-testid="admin-tab-support"]', "tab-support")
        if tid:
            await click(pg, rec, f'[data-testid="thread-{tid}"]', "thread", 2500)
            await pg.screenshot(path=f"{SHOTS}/thread-{W}-{LANG}.png")
            rep["thread_text"] = (await pg.evaluate("() => document.body.innerText"))[-600:]
            inp = pg.locator('[data-testid="support-input"]')
            if await inp.count():
                rec.step = "thread-send"
                await inp.first.fill("Admin UI reply")
                await pg.locator('[data-testid="support-send"]').first.click(); await pg.wait_for_timeout(2500)
                rep["admin_ui_reply_shown"] = "Admin UI reply" in await pg.evaluate("() => document.body.innerText")
            await click(pg, rec, '[data-testid="thread-user"]', "thread-user", 2500)
            await pg.screenshot(path=f"{SHOTS}/user-detail-{W}-{LANG}.png")
            await back(pg); await back(pg)
        await click(pg, rec, '[data-testid="admin-tab-more"]', "tab-more")
        for k in ("users", "moderation", "notify", "delivery", "posts", "content", "analytics", "settings", "logs"):
            await click(pg, rec, '[data-testid="admin-tab-more"]', "tab-more", 800)
            if await click(pg, rec, f'[data-testid="more-{k}"]', f"more-{k}", 2000):
                await pg.screenshot(path=f"{SHOTS}/more-{k}-{W}-{LANG}.png")
                if not await back(pg):
                    rec.add("noback", k)
        await click(pg, rec, '[data-testid="admin-tab-more"]', "tab-more", 800)
        await click(pg, rec, '[data-testid="more-users"]', "users-list", 2000)
        await click(pg, rec, f'[data-testid="user-{ann["user"]["id"]}"]', "user-detail", 2500)
        rep["admin_errors"] = rec.out
        await ctx.close()

        # ---------- user Support chat ----------
        ctx = await b.new_context(viewport={"width": W, "height": 780}, permissions=["microphone"])
        await ctx.add_init_script(init_script(ann, LANG))
        pg = await ctx.new_page(); rec = Rec(pg)
        await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(2500)
        rep["help_unread"] = await pg.locator('[data-testid="help-unread"]').count()
        await click(pg, rec, '[data-testid="help-button"]', "open-support", 2500)
        rep["support_open"] = await pg.locator('[data-testid="support-chat"]').count()
        await pg.screenshot(path=f"{SHOTS}/user-support-{W}-{LANG}.png")
        txt = await pg.evaluate("() => document.body.innerText")
        rep["user_sees_admin_reply"] = "We are checking" in txt
        rec.step = "user-send"
        inp = pg.locator('[data-testid="support-input"]')
        if await inp.count():
            await inp.first.fill("Typed from the UI")
            await pg.locator('[data-testid="support-send"]').first.click(); await pg.wait_for_timeout(2500)
            rep["user_ui_sent_shown"] = "Typed from the UI" in await pg.evaluate("() => document.body.innerText")
        quick = pg.locator('[data-testid^="support-quick-"]')
        rep["quick_count"] = await quick.count()
        if await quick.count():
            rec.step = "user-quick"
            await quick.first.click(); await pg.wait_for_timeout(2500)
        rep["user_errors"] = rec.out
        await ctx.close()
        await b.close()
    st, msgs = api("GET", f"/api/admin/manage/support/threads/{tid}", tok=admin["token"]) if tid else (0, None)
    rep["server_messages"] = [(m.get("fromAdmin"), m.get("kind"), m.get("body")[:40]) for m in (msgs or {}).get("messages", [])] if isinstance(msgs, dict) else msgs
    stop()
    print(json.dumps(rep, indent=1, ensure_ascii=False))


try:
    asyncio.run(main())
finally:
    if srv: stop()
