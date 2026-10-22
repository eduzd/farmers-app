"""Web check (throwaway local server, needs ./dist): Support chat looks/works like Messages, live green/gray dots,
Help unread count, Connect filter icon, Profile header pencil + share, Home plus button.

  python3 tests/check-support-chat-web.py [shots_dir]

API: text / photo / voice to Support, media only for the owner or an admin, admin replies -> unread count,
presence/query returns "known" accounts (gray dot) vs sample ids (no dot).
UI at 320/360/390, English + Bangla, signed in as Ann:
- Home: Help (?) shows the unread count; plus FAB. Tapping Help opens the Support chat directly.
- Support: title Support/সাপোর্ট, plus + mic like Messages, quick messages; tapping one sends it; gallery photo
  sends; unread goes to 0; header dot gray while no admin online, green after the admin is online.
- Connect: filter icon in the title bar opens the filter sheet. Cat (real expert, offline) has a gray dot.
- Profile: pencil + share in the title bar, no Edit-profile button under the name.
"""
import asyncio, base64, io, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
from PIL import Image

PORT = 6400 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/support"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="support-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="support-web-secret-0123456789abcdef0123456789")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/support-web-server.log", "a"),
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
    for _ in range(40):
        try:
            urllib.request.urlopen(BASE + "/api/market/categories", timeout=1); time.sleep(0.25)
        except Exception:
            break
    time.sleep(1)


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


def raw(path, tok):
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {tok}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.headers.get("Content-Type"), len(r.read())
    except urllib.error.HTTPError as e:
        return e.code, None, 0


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
DOT_JS = r"""(sel) => { const box = document.querySelector(sel); if (!box) return null;
  const d = box.querySelector('[data-testid=online-dot],[data-testid=offline-dot]'); if (!d) return 'none';
  return d.getAttribute('data-testid') + ' ' + getComputedStyle(d).backgroundColor; }"""


def jpeg_b64(color=(40, 140, 60), size=(320, 240)):
    buf = io.BytesIO(); Image.new("RGB", size, color).save(buf, "JPEG"); return base64.b64encode(buf.getvalue()).decode()


async def main():
    rep = {}
    start()
    admin = signup("boss", "Admin Rahim")
    ann = signup("ann", "Ann Begum")
    cat = signup("cat", "Cat Rahman")
    stop()
    subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [process.argv[2]]); await pg.close(); })();
""", os.path.join(data_dir, "pglite"), str(admin["user"]["id"])], check=True)
    start()
    st, j = api("POST", "/api/auth/login", {"email": admin["email"], "password": "Check-pass-123"})
    admin["token"], admin["user"] = j["token"], j["user"]
    api("PUT", "/api/me/profile", {"role": "expert"}, cat["token"])
    api("PUT", "/api/me/expert-profile", {"field": "fish", "title": "Fisheries officer", "about": "Fish disease"}, cat["token"])

    # ---------- API ----------
    a = rep["api"] = {}
    a["text"] = api("POST", "/api/support/messages", {"body": "Hello, I need help", "clientId": "c-text-1"}, ann["token"])[0]
    a["text_dup"] = api("POST", "/api/support/messages", {"body": "Hello, I need help", "clientId": "c-text-1"}, ann["token"])[0]
    st, ph = api("POST", "/api/support/photo", {"image": jpeg_b64(), "mime": "image/jpeg", "width": 320, "height": 240, "clientId": "c-ph-1"}, ann["token"])
    a["photo"] = [st, ph and ph["message"]["kind"], ph and ph["message"]["mediaId"][:3]]
    a["photo_bad"] = api("POST", "/api/support/photo", {"image": base64.b64encode(b"x" * 500).decode(), "mime": "image/jpeg"}, ann["token"])[0]
    st, vo = api("POST", "/api/support/voice", {"audio": base64.b64encode(os.urandom(4000)).decode(), "mime": "audio/webm", "durationMs": 3200, "clientId": "c-vo-1"}, ann["token"])
    a["voice"] = [st, vo and vo["message"]["kind"], vo and vo["message"]["durationMs"]]
    mid = ph["message"]["mediaId"]
    a["media_owner"] = raw(f"/api/support/media/{mid}", ann["token"])
    a["media_other"] = raw(f"/api/support/media/{mid}", cat["token"])[0]
    a["media_admin"] = raw(f"/api/support/media/{mid}", admin["token"])[0]
    st, threads = api("GET", "/api/admin/manage/support/threads?status=&q=", tok=admin["token"])
    tid = next(t["id"] for t in threads if t["userId"] == ann["user"]["id"])
    st, th = api("GET", f"/api/admin/manage/support/threads/{tid}", tok=admin["token"])
    a["admin_sees_kinds"] = [m.get("kind") for m in th["messages"]]
    api("POST", f"/api/admin/manage/support/threads/{tid}/reply", {"body": "Hi Ann, we're here. What happened?"}, admin["token"])
    api("POST", f"/api/admin/manage/support/threads/{tid}/reply", {"body": "You can send a photo too."}, admin["token"])
    a["unread_after_2_replies"] = api("GET", "/api/support/unread", tok=ann["token"])[1]
    a["presence_query"] = api("POST", "/api/presence/query", {"ids": [cat["user"]["id"], admin["user"]["id"], "sample-person-1"]}, ann["token"])[1]

    # ---------- UI ----------
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                r = rep[f"{lang}-{w}"] = {}
                # fresh unread replies each round so the count is visible on Home
                api("POST", f"/api/admin/manage/support/threads/{tid}/reply", {"body": f"Reply for {lang}-{w}"}, admin["token"])
                ctx = await b.new_context(viewport={"width": w, "height": 760})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(ann, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(4500)
                hb = pg.locator('[data-testid="help-button"]').first
                r["help_button"] = await hb.count()
                r["help_unread"] = (await pg.locator('[data-testid="help-unread"]').first.inner_text()).strip() if await pg.locator('[data-testid="help-unread"]').count() else None
                r["overflow_home"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/home-{lang}-{w}.png")
                # Help -> Support chat directly
                await hb.click()
                await pg.wait_for_timeout(3000)
                r["support_open"] = await pg.locator('[data-testid="support-chat"]').count()
                r["title"] = (await pg.locator('[data-testid="support-title"]').inner_text()).strip()
                r["status"] = (await pg.locator('[data-testid="support-status"]').inner_text()).strip()
                r["header_dot"] = await pg.evaluate(DOT_JS, '[data-testid="support-chat"]')
                r["plus"] = await pg.locator('[data-testid="support-plus"]').count()
                r["mic"] = await pg.locator('[data-testid="support-mic"]').count()
                r["quick"] = await pg.locator('[data-testid^="support-quick-"]').count()
                r["admin_msgs"] = await pg.locator('[data-testid="support-msg-admin"]').count()
                r["my_msgs"] = await pg.locator('[data-testid="support-msg-me"]').count()
                r["overflow_support"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/support-{lang}-{w}.png")
                r["unread_after_open"] = api("GET", "/api/support/unread", tok=ann["token"])[1]["unread"]
                if w == 360:
                    before = r["my_msgs"]
                    chip = pg.locator('[data-testid="support-quick-1"]')
                    r["chip_text"] = (await chip.inner_text()).strip()
                    await chip.click()
                    await pg.wait_for_timeout(2500)
                    r["my_msgs_after_chip"] = await pg.locator('[data-testid="support-msg-me"]').count()
                    srv_msgs = api("GET", "/api/support/thread", tok=ann["token"])[1]["messages"]
                    r["chip_on_server"] = any(m["body"] == r["chip_text"] for m in srv_msgs)
                    # typed message
                    await pg.locator('[data-testid="support-input"]').fill(f"Typed {lang}")
                    await pg.locator('[data-testid="support-send"]').click()
                    await pg.wait_for_timeout(2000)
                    r["typed_on_server"] = any(m["body"] == f"Typed {lang}" for m in api("GET", "/api/support/thread", tok=ann["token"])[1]["messages"])
                    # photo via plus -> Gallery
                    await pg.locator('[data-testid="support-plus"]').click()
                    await pg.wait_for_timeout(800)
                    r["gallery_option"] = await pg.locator('[data-testid="support-gallery"]').count()
                    tmpimg = os.path.join(data_dir, f"pick-{lang}.jpg")
                    Image.new("RGB", (800, 600), (200, 120, 30)).save(tmpimg, "JPEG")
                    try:
                        async with pg.expect_file_chooser(timeout=8000) as fc:
                            await pg.locator('[data-testid="support-gallery"]').click()
                        await (await fc.value).set_files(tmpimg)
                        await pg.wait_for_timeout(4000)
                        srv_msgs = api("GET", "/api/support/thread", tok=ann["token"])[1]["messages"]
                        r["photo_images_on_server"] = sum(1 for m in srv_msgs if m.get("kind") == "image")
                        r["photo_img_in_ui"] = await pg.locator('[data-testid="support-msg-me"] img').count()
                    except Exception as e:
                        r["photo_err"] = str(e)[:160]
                    await pg.screenshot(path=f"{SHOTS}/support-sent-{lang}-{w}.png")
                    # admin comes online -> header dot turns green
                    api("POST", "/api/presence/beat", {"state": "active"}, admin["token"])
                    await pg.wait_for_timeout(6500)
                    r["status_admin_online"] = (await pg.locator('[data-testid="support-status"]').inner_text()).strip()
                    r["header_dot_admin_online"] = await pg.evaluate(DOT_JS, '[data-testid="support-chat"]')
                    await pg.screenshot(path=f"{SHOTS}/support-online-{lang}-{w}.png")
                    api("POST", "/api/presence/beat", {"state": "background"}, admin["token"])
                # Connect: filter icon + Cat's gray dot
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Connect'})")
                await pg.wait_for_timeout(3500)
                r["filter_btn"] = await pg.locator('[data-testid="connect-filter-button"]').count()
                card = pg.locator('[data-testid="connect-card"]').filter(has_text="Cat Rahman")
                if await card.count():
                    r["cat_dot"] = await card.first.evaluate("(el)=>{const d=el.querySelector('[data-testid=online-dot],[data-testid=offline-dot]');return d?d.getAttribute('data-testid'):'none'}")
                r["overflow_connect"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/connect-{lang}-{w}.png")
                if r["filter_btn"]:
                    await pg.locator('[data-testid="connect-filter-button"]').first.click()
                    await pg.wait_for_timeout(900)
                    r["filter_sheet"] = await pg.locator('[data-testid="connect-filter-sheet"]').count()
                    await pg.screenshot(path=f"{SHOTS}/connect-filter-{lang}-{w}.png")
                    await pg.locator('[data-testid="connect-filter-online"]').click()
                    await pg.locator('[data-testid="connect-filter-done"]').click()
                    await pg.wait_for_timeout(800)
                    r["cards_online_only"] = await pg.locator('[data-testid="connect-card"]').count()
                # Profile header icons
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Profile'})")
                await pg.wait_for_timeout(3000)
                r["profile_edit_btn"] = await pg.locator('[data-testid="profile-edit-button"]').count()
                eb = await pg.locator('[data-testid="profile-edit-button"]').first.bounding_box() if r["profile_edit_btn"] else None
                r["profile_edit_y"] = round(eb["y"]) if eb else None
                r["overflow_profile"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/profile-{lang}-{w}.png")
                r["errors"] = errs
                await ctx.close()
        await b.close()
    stop()
    print(json.dumps(rep, ensure_ascii=False, indent=1))


try:
    asyncio.run(main())
finally:
    stop()
