"""Web check (throwaway local server, needs ./dist): one shared chat icon + Connect online dots.

At 320/360/390 in English and Bangla, signed in as Ann (farmer) while Cat (fish expert) is online:
- Connect: Cat's card has the avatar online dot and "Active now"; the message button is icon-only (no text)
  and draws the shared ChatIcon; no sideways overflow, no cut text on cards.
- Home feed: the post's comment button draws the ChatIcon. Post detail: the comment icon is the ChatIcon.
- Chats tab icon is the same ChatIcon. Counts Feather message glyphs left on screen (should be 0).
  python3 tests/check-chat-icon-web.py [shots_dir]
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6300 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/chaticon"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="chaticon-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="chaticon-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/chaticon-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)
CHAT_PATH = "M8.5 8.3h7M8.5 11.7h4"  # the two text lines inside ChatIcon


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
CUT_JS = r"""(sel) => { const out = [];
  for (const box of document.querySelectorAll(sel)) for (const el of box.querySelectorAll('div,span')) {
    if (el.children.length || !el.innerText) continue; if (el.scrollWidth > el.clientWidth + 1) out.push(el.innerText.slice(0, 30)); }
  return out; }"""
# ChatIcons visible on screen, and Feather message-circle/square glyphs (Feather on web = font glyph U+E8E6/U+E8E8 range).
ICONS_JS = r"""(p) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
  const chat = [...document.querySelectorAll('svg path')].filter(x => x.getAttribute('d') === p && vis(x)).length;
  let feather = 0;
  for (const el of document.querySelectorAll('div,span')) {
    if (el.children.length) continue; const ff = getComputedStyle(el).fontFamily || '';
    if (/feather/i.test(ff) && /[\uE8E6\uE8E7\uE8E8\uE8E9]/.test(el.textContent || '') && vis(el)) feather++;
  }
  return { chat, feather };
}"""


async def main():
    rep = {}
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    ann = signup("ann", "Ann Begum")
    cat = signup("cat", "Cat Rahman")
    api("PUT", "/api/me/profile", {"role": "expert"}, cat["token"])
    rep["expert_profile"] = api("PUT", "/api/me/expert-profile", {"field": "fish", "title": "Fisheries officer", "about": "Fish disease and water quality"}, cat["token"])[0]
    comms = api("GET", "/api/communities")[1]
    cid = (next((c for c in comms if c["slug"] == "farmer"), None) or comms[0])["id"]
    st, post = api("POST", "/api/posts", {"communityId": cid, "content": "My pond fish are gasping at dawn, any advice?"}, cat["token"])
    rep["post"] = st
    api("POST", f"/api/posts/{post['id']}/comments", {"content": "Try aeration early morning"}, ann["token"])

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                api("POST", "/api/presence/beat", {"state": "active"}, cat["token"])  # Cat has the app open
                r = rep[f"{lang}-{w}"] = {}
                ctx = await b.new_context(viewport={"width": w, "height": 760})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(init_script(ann, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(4000)
                # Home feed: comment button
                await pg.get_by_text("My pond fish are gasping").first.scroll_into_view_if_needed()
                await pg.wait_for_timeout(600)
                r["home_icons"] = await pg.evaluate(ICONS_JS, CHAT_PATH)
                tab = pg.locator('[role=tab]').nth(3)
                r["chats_tab_chaticon"] = await tab.locator(f'svg path[d="{CHAT_PATH}"]').count()
                r["overflow_home"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/home-{lang}-{w}.png")
                # Post detail
                await pg.get_by_text("My pond fish are gasping").first.click()
                await pg.wait_for_timeout(2500)
                r["detail_icons"] = await pg.evaluate(ICONS_JS, CHAT_PATH)
                r["overflow_detail"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/post-{lang}-{w}.png")
                # Connect
                await pg.evaluate("()=>window.__nav.navigate('Main',{screen:'Connect'})")
                await pg.wait_for_timeout(3500)
                card = pg.locator('[data-testid="connect-card"]').filter(has_text="Cat Rahman")
                r["cat_card"] = await card.count()
                if r["cat_card"]:
                    await card.first.scroll_into_view_if_needed()
                    r["online_dot"] = await card.first.locator('[data-testid="online-dot"]').count()
                    r["active_now"] = await card.first.locator('[data-testid="connect-active-now"]').inner_text() if await card.first.locator('[data-testid="connect-active-now"]').count() else None
                    btn = card.first.locator('[data-testid="connect-message"]')
                    r["msg_btn_text"] = (await btn.inner_text()).strip()
                    r["msg_btn_chaticon"] = await btn.locator(f'svg path[d="{CHAT_PATH}"]').count()
                    bb = await btn.bounding_box()
                    r["msg_btn_box"] = [round(bb["x"]), round(bb["width"]), round(bb["height"])]
                    r["card_cut"] = await pg.evaluate(CUT_JS, '[data-testid="connect-card"]')
                r["connect_icons"] = await pg.evaluate(ICONS_JS, CHAT_PATH)
                r["overflow_connect"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/connect-{lang}-{w}.png")
                if r.get("cat_card") and w == 360:
                    await card.first.locator('[data-testid="connect-message"]').click()
                    await pg.wait_for_timeout(2500)
                    r["msg_opens_chat_with_cat"] = await pg.get_by_text("Cat Rahman").count() > 0
                    await pg.screenshot(path=f"{SHOTS}/connect-chat-{lang}.png")
                r["errors"] = errs
                await ctx.close()
        await b.close()
    print(json.dumps(rep, ensure_ascii=False, indent=1))


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass
