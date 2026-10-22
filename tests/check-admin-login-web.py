"""Admin web sign-in check on a throwaway local server (needs ./dist).

An admin who signs in through the real sign-in screen at /admin must land in the admin app (not
'Admins only'), also after a page reload. A normal user who signs in at /admin sees 'Admins only',
and the server refuses their token on /api/admin/manage/*.

  python3 tests/check-admin-login-web.py
"""
import asyncio, json, os, random, re, signal, subprocess, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6300 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
data_dir = tempfile.mkdtemp(prefix="admin-login-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="admin-login-secret-0123456789abcdef0123456789")
srv = None
PW = "Check-pass-123"


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/admin-login-server.log", "a"),
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
    time.sleep(3)


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
    st, j = api("POST", "/api/auth/signup", {"email": email, "password": PW, "name": name, "username": f"{tag}_{s}"})
    assert j and j.get("token"), (st, j)
    return {"email": email, "token": j["token"], "user": j["user"]}


async def ui_login(b, email, lang="en"):
    ctx = await b.new_context(viewport={"width": 360, "height": 780})
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
    await pg.add_init_script(f"localStorage.setItem('language', {json.dumps(lang)});")
    await pg.goto(BASE + "/admin", wait_until="networkidle")
    await pg.wait_for_timeout(2500)
    if await pg.get_by_text("Get started").count():
        await pg.get_by_text("Get started").first.click(); await pg.wait_for_timeout(2000)
    if await pg.get_by_text("Create account").count():
        await pg.get_by_text("Sign in", exact=True).last.click(); await pg.wait_for_timeout(2000)
    await pg.locator('input:visible:not([type="password"])').first.fill(email)
    await pg.locator('input[type="password"]:visible').first.fill(PW)
    await pg.get_by_role("button", name=re.compile("^Sign in$")).last.click()
    for _ in range(30):
        await pg.wait_for_timeout(500)
        if await pg.locator('[data-testid="admin-app"], [data-testid="admin-denied"]').count():
            break
    r = {"admin_app": await pg.locator('[data-testid="admin-app"]').count(),
         "denied": await pg.locator('[data-testid="admin-denied"]').count(), "url": pg.url[len(BASE):]}
    await pg.reload(wait_until="networkidle")
    await pg.wait_for_timeout(4000)
    r["after_reload_admin_app"] = await pg.locator('[data-testid="admin-app"]').count()
    r["after_reload_denied"] = await pg.locator('[data-testid="admin-denied"]').count()
    r["errors"] = errs
    await ctx.close()
    return r


async def main():
    rep = {}
    start()
    boss = signup("boss", "Admin Rahim")
    ann = signup("ann", "Ann Begum")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(boss["user"]["id"])], check=True)
    start()
    rep["normal_user_api"] = [api("GET", f"/api/admin/manage/{p}", tok=ann["token"])[0] for p in ["summary", "users", "orders", "support/threads", "categories"]]
    rep["normal_user_legacy_api"] = api("GET", "/api/admin/users", tok=ann["token"])[0]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        rep["admin_ui_login"] = await ui_login(b, boss["email"])
        rep["normal_ui_login"] = await ui_login(b, ann["email"])
        await b.close()
    print(json.dumps(rep, indent=1))


try:
    asyncio.run(main())
finally:
    stop()
