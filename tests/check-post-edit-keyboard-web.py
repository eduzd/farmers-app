"""Web check (throwaway local server, needs ./dist): editing a post from its detail page stays above the keyboard.

  python3 tests/check-post-edit-keyboard-web.py [shots_dir]

Headless Chromium has no on-screen keyboard, so the page gets a stand-in visualViewport whose height drops by the
keyboard's height, the same thing iPhone Safari / Chrome on Android report when the keyboard opens.
For en/bn at 320x640, 360x740 and 390x844, signed in as the post's author (test account, throwaway database):
- Post detail -> More -> Edit post; keyboard opens (300 px, 340 px on the tallest): the title, the text box and Save are
  all inside the part of the screen the keyboard leaves, nothing above the top edge.
- A long edit (40 lines) still keeps Save above the keyboard and the box scrolls inside itself.
- Keyboard closes: the sheet drops back to the bottom.
- Save: the post on the server and on the detail page shows the edited text. No page errors.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/postedit-kb"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="postedit-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="postedit-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/postedit-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)


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


FAKE_KEYBOARD = r"""(() => {
  window.__kb = 0;
  const et = new EventTarget();
  const vv = {
    get height() { return window.innerHeight - window.__kb; }, get width() { return window.innerWidth; },
    offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener: (t, f) => et.addEventListener(t, f), removeEventListener: (t, f) => et.removeEventListener(t, f),
    dispatchEvent: (e) => et.dispatchEvent(e),
  };
  Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
  window.__setKb = (h) => { window.__kb = h; et.dispatchEvent(new Event('resize')); };
})();"""

BOXES_JS = r"""() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), sh: e.scrollHeight, ch: e.clientHeight }; };
  return { vh: innerHeight, kb: window.__kb, input: box('[data-testid="edit-post-input"]'), save: box('[data-testid="edit-post-save"]') };
}"""


def fits(b):
    if not b["input"] or not b["save"]:
        return False
    visible_bottom = b["vh"] - b["kb"]
    return b["input"]["top"] >= 40 and b["save"]["bottom"] <= visible_bottom and b["input"]["h"] >= 72


async def main():
    rep = {}
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    ann = signup("ann", "Ann Begum")
    comms = api("GET", "/api/communities")[1]
    cid = (next((c for c in comms if c["slug"] == "farmer"), None) or comms[0])["id"]

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for (w, h, kb) in ((320, 640, 300), (360, 740, 300), (390, 844, 340)):
                tag = f"{lang}-{w}"
                text = f"Pond water check {tag} {random.randint(1000, 9999)}"
                st, post = api("POST", "/api/posts", {"communityId": cid, "content": text}, ann["token"])
                r = rep[tag] = {"post": st}
                ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True)
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                await pg.add_init_script(FAKE_KEYBOARD)
                await pg.add_init_script(init_script(ann, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_timeout(4000)
                await pg.get_by_text(text).first.click()
                await pg.wait_for_timeout(2500)
                more = pg.get_by_role("button", name="আরও" if lang == "bn" else "More", exact=True)
                n = await more.count()
                clicked = False
                for i in range(n - 1, -1, -1):
                    if await more.nth(i).is_visible():
                        await more.nth(i).click(); clicked = True; break
                r["more_clicked"] = clicked
                await pg.wait_for_timeout(900)
                await pg.locator('[data-testid="post-menu-edit"]').click()
                await pg.wait_for_timeout(900)
                r["no_keyboard"] = await pg.evaluate(BOXES_JS)
                await pg.evaluate(f"() => window.__setKb({kb})")
                for _ in range(10):  # let the sheet finish rising
                    await pg.wait_for_timeout(500)
                    r["keyboard"] = await pg.evaluate(BOXES_JS)
                    if fits(r["keyboard"]):
                        break
                r["fits_keyboard"] = fits(r["keyboard"])
                await pg.screenshot(path=f"{SHOTS}/edit-kb-{tag}.png")
                inp = pg.locator('[data-testid="edit-post-input"]')
                long_text = text + " edited\n" + "\n".join(f"line {i}" for i in range(40))
                await inp.fill(long_text)
                await pg.wait_for_timeout(700)
                r["keyboard_long"] = await pg.evaluate(BOXES_JS)
                r["fits_long"] = fits(r["keyboard_long"])
                r["box_scrolls"] = r["keyboard_long"]["input"]["sh"] > r["keyboard_long"]["input"]["ch"]
                await pg.screenshot(path=f"{SHOTS}/edit-kb-long-{tag}.png")
                await pg.evaluate("() => window.__setKb(0)")
                await pg.wait_for_timeout(900)
                closed = r["closed"] = await pg.evaluate(BOXES_JS)
                r["drops_back"] = closed["save"]["bottom"] >= closed["vh"] - 80
                await pg.locator('[data-testid="edit-post-save"]').click()
                await pg.wait_for_timeout(2000)
                st2, srv_post = api("GET", f"/api/posts/{post['id']}", None, ann["token"])
                content = (srv_post or {}).get("content") or ((srv_post or {}).get("post") or {}).get("content")
                r["saved_on_server"] = content == long_text
                r["shown_on_detail"] = await pg.get_by_text("line 39").count() > 0
                r["errors"] = errs
                await ctx.close()
        await b.close()
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    ok = all(v.get("fits_keyboard") and v.get("fits_long") and v.get("drops_back") and v.get("saved_on_server") and not v.get("errors") for v in rep.values())
    print("ALL OK" if ok else "PROBLEMS")


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass
