"""Web check (throwaway local server, needs ./dist): tapping the other person's photo in a chat opens THEIR profile.

  python3 tests/check-chat-avatar-web.py [shots_dir]

Test accounts only (Ann Begum, Cat Rahman on a throwaway database). For en/bn at 360 and en at 320 wide:
- Ann opens her chat with Cat, taps Cat's small photo beside Cat's message -> Cat's profile opens (Cat's name,
  Followers/Following), and Back returns to the same conversation (message box and Cat's message still there).
- Tapping Cat's photo/name in the chat header opens the same profile, and Back returns to the chat.
- The contact endpoint gives the public bits the profile uses (userId, name, username, avatar, verified).
Also: no page errors, nothing running off the screen.
"""
import asyncio, json, os, random, re, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/chat-avatar"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="avatar-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="avatar-web-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/avatar-web-server.log", "a"),
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


async def open_dm(pg, name):
    await pg.goto(BASE, wait_until="networkidle")
    await pg.locator('[data-testid="tab-chats"]').first.wait_for(timeout=30000)
    await pg.locator('[data-testid="tab-chats"]').first.click()
    row = pg.get_by_role("button", name=name).first
    await row.wait_for(timeout=15000)
    await row.click()
    await pg.wait_for_selector('[data-testid="dm-input"]', timeout=15000)
    await pg.locator('[data-testid="dm-msg-theirs"]').first.wait_for(timeout=15000)
    await pg.wait_for_timeout(1200)


async def profile_shown(pg, name, lang):
    label = "ফলোয়ার্স" if lang == "bn" else "Followers"
    try:
        await pg.get_by_text(label, exact=True).last.wait_for(state="visible", timeout=10000)
        await pg.wait_for_timeout(600)
    except Exception:
        return False
    # the profile's own name line (h3), visible on top of the stack
    names = pg.get_by_text(name, exact=True)
    n = await names.count()
    for i in range(n):
        if await names.nth(i).is_visible():
            return True
    return False


async def go_back(pg):
    """The header's back arrow (react-navigation), else the browser's back."""
    for sel in ['[aria-label="Back"]', '[aria-label*="back" i]', '[data-testid="header-back"]']:
        loc = pg.locator(sel)
        for i in range(await loc.count()):
            if await loc.nth(i).is_visible():
                await loc.nth(i).click(); await pg.wait_for_timeout(1200); return "header back"
    await pg.go_back(); await pg.wait_for_timeout(1200); return "browser back"


async def back_in_chat(pg):
    try:
        await pg.locator('[data-testid="dm-input"]').last.wait_for(state="visible", timeout=10000)
        return await pg.locator('[data-testid="dm-msg-theirs"]').filter(has_text="Hi Ann").last.is_visible()
    except Exception:
        return False


async def main():
    rep = {}
    start()
    try:
        ann = signup("ann", "Ann Begum")
        cat = signup("cat", "Cat Rahman")
        api("POST", f"/api/dm/{ann['user']['id']}/messages", {"content": "Hi Ann", "clientId": "seedavatar01"}, cat["token"])
        st, contact = api("GET", f"/api/dm/{cat['user']['id']}/contact", tok=ann["token"])
        rep["contact"] = {"status": st, "body": contact}
        st404, _ = api("GET", "/api/dm/no-such-person-xyz/contact", tok=ann["token"])
        rep["contact_missing_status"] = st404

        async with async_playwright() as p:
            br = await p.chromium.launch()
            for lang, w in [("en", 360), ("bn", 360), ("en", 320)]:
                key = f"{lang}-{w}"
                r = {}
                errs = []
                ctx = await br.new_context(viewport={"width": w, "height": 780})
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(ann, lang))
                await open_dm(pg, "Cat Rahman")
                av = pg.locator('[data-testid="dm-msg-avatar"]')
                r["msg_avatars"] = await av.count()
                r["msg_avatar_label"] = await av.first.get_attribute("aria-label") if r["msg_avatars"] else None
                await pg.screenshot(path=f"{SHOTS}/{key}-1-chat.png")
                await av.last.click()
                r["msg_avatar_opens_profile"] = await profile_shown(pg, "Cat Rahman", lang)
                r["profile_overflow"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/{key}-2-profile-from-message.png")
                r["back_via"] = await go_back(pg)
                r["back_returns_to_chat"] = await back_in_chat(pg)
                await pg.screenshot(path=f"{SHOTS}/{key}-3-back-in-chat.png")
                hdr = pg.locator('[data-testid="chat-header-profile"]').last
                r["header_label"] = await hdr.get_attribute("aria-label")
                await hdr.click()
                r["header_opens_profile"] = await profile_shown(pg, "Cat Rahman", lang)
                await pg.screenshot(path=f"{SHOTS}/{key}-4-profile-from-header.png")
                await go_back(pg)
                r["header_back_returns_to_chat"] = await back_in_chat(pg)
                r["chat_overflow"] = await pg.evaluate(OVERFLOW_JS)
                r["page_errors"] = errs
                rep[key] = r
                await ctx.close()
            await br.close()
    finally:
        stop()
    print(json.dumps(rep, indent=1, ensure_ascii=False))
    ok = rep["contact"]["status"] == 200 and rep["contact"]["body"].get("userId") == cat["user"]["id"] and "verified" in rep["contact"]["body"]
    ok = ok and rep["contact_missing_status"] == 404
    for k, r in rep.items():
        if not isinstance(r, dict) or "msg_avatars" not in r:
            continue
        ok = ok and r["msg_avatars"] > 0 and r["msg_avatar_opens_profile"] and r["back_returns_to_chat"] and r["header_opens_profile"] \
            and r["header_back_returns_to_chat"] and not r["page_errors"] and not r["chat_overflow"] and not r["profile_overflow"]
    print("RESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


asyncio.run(main())
