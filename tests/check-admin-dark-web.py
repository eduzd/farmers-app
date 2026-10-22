"""Admin dark mode + hold-to-reply + product sell-as form, on a throwaway local server (needs ./dist web export).

For light and dark, English and Bangla at 360 wide (and 320 for dark): Home, More (Appearance card),
Add product form (In packs + By litre), Support chat with the hold menu and the reply bar.
Also: the moon button on Home switches to dark and the choice survives a reload.
Only throwaway local accounts get messages. Nothing goes to Render or to real users.

  python3 tests/check-admin-dark-web.py [shots_dir]
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6300 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/admin-dark"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="admin-dark-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="admin-dark-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/admin-dark-server.log", "a"),
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


def init_script(acc, lang, theme):
    u = dict(acc["user"]); u["language"] = lang
    s = ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
         % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))
    if theme:
        s += "if (!sessionStorage.getItem('theme_set')) { localStorage.setItem('theme_preference', %s); sessionStorage.setItem('theme_set','1'); }" % json.dumps(theme)
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

# Background brightness of the admin root (0 dark .. 255 light).
BG_JS = r"""() => { const el = document.querySelector('[data-testid="admin-app"]'); if (!el) return -1;
  const m = getComputedStyle(el).backgroundColor.match(/\d+/g); return m ? Math.round((+m[0] + +m[1] + +m[2]) / 3) : -1; }"""

# Text drawn with almost the same brightness as the admin background = unreadable. Counts leaf texts.
LOWCON_JS = r"""() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return { L: 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]), a: m.length > 3 ? +m[3] : 1 }; };
  const bgOf = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; const l = lum(c); if (l && l.a > 0.5) return l.L; el = el.parentElement; } return null; };
  const out = [];
  for (const el of document.querySelectorAll('div,span')) {
    if (el.children.length || !el.innerText || !el.innerText.trim()) continue;
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const fg = lum(getComputedStyle(el).color); const bg = bgOf(el); if (!fg || bg === null) continue;
    const ratio = (Math.max(fg.L, bg) + 0.05) / (Math.min(fg.L, bg) + 0.05);
    if (ratio < 3) out.push(el.innerText.slice(0, 30) + ' ' + ratio.toFixed(2));
  }
  return out.slice(0, 10);
}"""


async def main():
    rep = {}
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
    # throwaway local conversation to look at
    api("POST", "/api/support/messages", {"body": "My order hasn't arrived yet", "clientId": "d1"}, ann["token"])
    _, threads = api("GET", "/api/admin/manage/support/threads", tok=admin["token"])
    tid = threads[0]["id"]

    async with async_playwright() as p:
        br = await p.chromium.launch()
        # ---- toggle + persistence ----
        ctx = await br.new_context(viewport={"width": 360, "height": 760})
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        await pg.add_init_script(init_script(admin, "en", "light"))
        await pg.goto(BASE + "/admin", wait_until="networkidle")
        await pg.wait_for_selector('[data-testid="admin-tab-home"]', timeout=30000)
        await pg.wait_for_timeout(800)
        t = rep["toggle"] = {"bg_before": await pg.evaluate(BG_JS)}
        await pg.click('[data-testid="header-theme"]')
        await pg.wait_for_timeout(700)
        t["bg_after"] = await pg.evaluate(BG_JS)
        t["saved"] = await pg.evaluate("() => localStorage.getItem('theme_preference')")
        await pg.reload(wait_until="networkidle")
        await pg.wait_for_selector('[data-testid="admin-tab-home"]', timeout=30000)
        await pg.wait_for_timeout(800)
        t["bg_after_reload"] = await pg.evaluate(BG_JS)
        t["errors"] = errs
        await ctx.close()

        sent_reply = False
        for theme, lang, w in [("light", "en", 360), ("light", "bn", 360), ("dark", "en", 360), ("dark", "bn", 360), ("dark", "en", 320), ("dark", "bn", 320)]:
            key = f"{theme}-{lang}-{w}"
            r = rep[key] = {}
            ctx = await br.new_context(viewport={"width": w, "height": 780})
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:120]))
            await pg.add_init_script(init_script(admin, lang, theme))
            await pg.goto(BASE + "/admin", wait_until="networkidle")
            await pg.wait_for_selector('[data-testid="admin-tab-home"]', timeout=30000)
            await pg.wait_for_timeout(900)
            r["bg"] = await pg.evaluate(BG_JS)
            r["home_icon_svg"] = await pg.evaluate("() => !!document.querySelector('[data-testid=\"admin-tab-home\"] svg')")
            r["home_overflow"] = await pg.evaluate(OVERFLOW_JS)
            r["home_lowcon"] = await pg.evaluate(LOWCON_JS)
            await pg.screenshot(path=f"{SHOTS}/home-{key}.png")
            # More -> Appearance
            await pg.click('[data-testid="admin-tab-more"]')
            await pg.wait_for_selector('[data-testid="theme-card"]', timeout=15000)
            await pg.wait_for_timeout(400)
            r["theme_selected"] = await pg.evaluate("(k) => document.querySelector(`[data-testid=\"theme-${k}\"]`)?.getAttribute('aria-checked') || document.querySelector(`[data-testid=\"theme-${k}\"]`)?.getAttribute('aria-selected')", theme)
            r["more_lowcon"] = await pg.evaluate(LOWCON_JS)
            await pg.screenshot(path=f"{SHOTS}/more-{key}.png")
            # Add product form: In packs, then By litre
            await pg.click('[data-testid="admin-tab-shop"]')
            await pg.wait_for_selector('[data-testid="add-product"]', timeout=15000)
            await pg.click('[data-testid="add-product"]')
            await pg.wait_for_selector('[data-testid="pf-sell-as"]', timeout=15000)
            await pg.click('[data-testid="sell-pack"]')
            await pg.wait_for_selector('[data-testid="pf-pack-size"]', timeout=5000)
            await pg.fill('[data-testid="pf-pack-size"] input, input[data-testid="pf-pack-size"]', "5") if await pg.query_selector('[data-testid="pf-pack-size"] input, input[data-testid="pf-pack-size"]') else None
            await pg.click('[data-testid="pf-pack-unit-litre"]')
            await pg.fill('[data-testid="pf-price"] input, input[data-testid="pf-price"]', "950") if await pg.query_selector('[data-testid="pf-price"] input, input[data-testid="pf-price"]') else None
            await pg.wait_for_timeout(300)
            r["pack_preview"] = (await pg.inner_text('[data-testid="pf-preview"]')).replace("\n", " | ")
            await pg.locator('[data-testid="pf-sell-as"]').scroll_into_view_if_needed()
            await pg.screenshot(path=f"{SHOTS}/product-pack-{key}.png")
            await pg.click('[data-testid="sell-volume"]')
            await pg.wait_for_timeout(300)
            r["litre_units"] = [await pg.is_visible('[data-testid="pf-unit-litre"]'), await pg.is_visible('[data-testid="pf-unit-ml"]')]
            r["litre_preview"] = (await pg.inner_text('[data-testid="pf-preview"]')).replace("\n", " | ")
            r["form_overflow"] = await pg.evaluate(OVERFLOW_JS)
            r["form_lowcon"] = await pg.evaluate(LOWCON_JS)
            await pg.screenshot(path=f"{SHOTS}/product-litre-{key}.png", full_page=True)
            # Support chat: hold a message -> menu -> Reply -> reply bar
            await pg.goto(BASE + "/admin", wait_until="networkidle")
            await pg.wait_for_selector('[data-testid="admin-tab-support"]', timeout=30000)
            await pg.click('[data-testid="admin-tab-support"]')
            await pg.wait_for_selector(f'[data-testid="thread-{tid}"]', timeout=15000)
            await pg.click(f'[data-testid="thread-{tid}"]')
            await pg.wait_for_selector('[data-testid="support-msg-hold"]', timeout=15000)
            await pg.wait_for_timeout(600)
            box = await pg.locator('[data-testid="support-msg-hold"]').first.bounding_box()
            await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 3)
            await pg.mouse.down(); await pg.wait_for_timeout(900); await pg.mouse.up()
            r["hold_menu"] = await pg.is_visible('[data-testid="support-msg-menu"]')
            r["menu_lowcon"] = await pg.evaluate(LOWCON_JS)
            await pg.screenshot(path=f"{SHOTS}/chat-menu-{key}.png")
            if r["hold_menu"]:
                await pg.click('[data-testid="support-menu-reply"]')
                await pg.wait_for_timeout(400)
                r["reply_bar"] = (await pg.inner_text('[data-testid="support-reply-bar"]')).replace("\n", " | ") if await pg.is_visible('[data-testid="support-reply-bar"]') else None
                if not sent_reply:
                    # local throwaway account only
                    await pg.fill('textarea, input[type="text"]', "Checking on it now")
                    await pg.click('[data-testid="support-send"]')
                    await pg.wait_for_timeout(1500)
                    sent_reply = True
                r["quote_shown"] = await pg.is_visible('[data-testid="support-msg-quote"]')
                r["chat_lowcon"] = await pg.evaluate(LOWCON_JS)
                r["chat_overflow"] = await pg.evaluate(OVERFLOW_JS)
                await pg.screenshot(path=f"{SHOTS}/chat-reply-{key}.png")
            r["errors"] = errs
            await ctx.close()
        await br.close()
    _, mine = api("GET", "/api/support/thread", tok=ann["token"])
    rep["user_sees_quote"] = any((m.get("replyTo") or {}).get("text", "").startswith("My order") for m in mine["messages"])
    stop()
    print(json.dumps(rep, ensure_ascii=False, indent=1))


asyncio.run(main())
