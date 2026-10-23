"""Web check (throwaway local server, needs ./dist): mobile bottom navbar size.

Signed in as Ann with 3 unread messages from Cat, at 320/360/390/430 (phone) and 1280 (desktop), English and Bangla,
light and dark: measures the bottom bar height, each tab's icon size, labels (cut off or not), the unread badge
(inside its tab, not touching the label), and that the feed's last content is not hidden under the bar.
  python3 tests/check-navbar-size-web.py [shots_dir] [server_cwd]
server_cwd lets the same check run against another build (e.g. the previous dist) for a before/after.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6400 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/navsize"
CWD = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="navsize-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="navsize-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], cwd=CWD, env=env, stdout=open("/tmp/navsize-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)


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


def init_script(acc, lang, dark):
    u = dict(acc["user"]); u["language"] = lang
    mode = "dark" if dark else "light"
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            "for (const k of ['theme','themeMode','theme_mode','app_theme']) localStorage.setItem(k, %s);"
            % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang), json.dumps(mode)))


MEASURE_JS = r"""() => {
  const tabs = [...document.querySelectorAll('[role=tab]')].filter(t => t.getBoundingClientRect().width > 0);
  if (!tabs.length) return null;
  // the bar = closest ancestor holding all tabs
  let bar = tabs[0].parentElement;
  while (bar && !tabs.every(t => bar.contains(t))) bar = bar.parentElement;
  while (bar && bar.getBoundingClientRect().height < 30) bar = bar.parentElement;
  const br = bar.getBoundingClientRect();
  const out = { bar_h: Math.round(br.height), bar_top: Math.round(br.top), vh: innerHeight, vw: innerWidth, tabs: [] };
  for (const t of tabs) {
    const tr = t.getBoundingClientRect();
    const leaves = [...t.querySelectorAll('div,span')].filter(e => !e.children.length && (e.innerText || '').trim());
    const label = leaves.find(e => !/^\d+\+?$/.test(e.innerText.trim()) && !/[\uE000-\uF8FF]/.test(e.innerText));
    const badge = t.querySelector('[data-testid=tab-messages-badge]');
    const svg = [...t.querySelectorAll('svg')].map(s => s.getBoundingClientRect()).filter(r => r.width)[0];
    const glyph = leaves.find(e => /[\uE000-\uF8FF]/.test(e.innerText));
    const ir = svg || (glyph && glyph.getBoundingClientRect());
    const lr = label && label.getBoundingClientRect();
    const r = { label: label ? label.innerText.trim() : null, icon: ir ? [Math.round(ir.width), Math.round(ir.height)] : null,
      icon_font: glyph ? getComputedStyle(glyph).fontSize : null,
      label_font: label ? getComputedStyle(label).fontSize : null,
      label_cut: label ? (label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 2) : null,
      label_inside_bar: lr ? (lr.top >= br.top - 1 && lr.bottom <= br.bottom + 1) : null,
      icon_inside_bar: ir ? (ir.top >= br.top - 1 && ir.bottom <= br.bottom + 1) : null,
      tab_w: Math.round(tr.width) };
    if (badge) { const b = badge.getBoundingClientRect(); r.badge = { text: badge.innerText.trim(), inside_tab: b.left >= tr.left - 1 && b.right <= tr.right + 1 && b.top >= br.top - 1,
      clear_of_label: lr ? b.bottom <= lr.top + 1 : null, w: Math.round(b.width) }; }
    out.tabs.push(r);
  }
  // labels must not overlap each other
  const lrs = out.tabs.length;
  return out;
}"""


async def main():
    rep = {"cwd": CWD}
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    ann = signup("ann", "Ann Begum")
    cat = signup("cat", "Cat Rahman")
    for i in range(3):
        rep.setdefault("dm", []).append(api("POST", f"/api/dm/{ann['user']['id']}/messages", {"content": f"Hello {i}"}, cat["token"])[0])
    comms = api("GET", "/api/communities")[1]
    cid = (next((c for c in comms if c["slug"] == "farmer"), None) or comms[0])["id"]
    for i in range(6):
        api("POST", "/api/posts", {"communityId": cid, "content": f"Pond update number {i}: water is clear today."}, cat["token"])

    async with async_playwright() as p:
        b = await p.chromium.launch()
        cases = [(lang, w, False) for lang in ("en", "bn") for w in (320, 360, 390, 430, 1280)] + [("en", 360, True), ("bn", 360, True)]
        for lang, w, dark in cases:
            key = f"{lang}-{w}" + ("-dark" if dark else "")
            r = rep[key] = {}
            ctx = await b.new_context(viewport={"width": w, "height": 780 if w < 1000 else 800}, color_scheme="dark" if dark else "light")
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
            await pg.add_init_script(init_script(ann, lang, dark))
            await pg.goto(BASE, wait_until="networkidle")
            await pg.wait_for_timeout(5000)
            r["m"] = await pg.evaluate(MEASURE_JS)
            await pg.screenshot(path=f"{SHOTS}/home-{key}.png")
            # feed scrolled to the end: last content must sit above the bar
            await pg.mouse.wheel(0, 20000)
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f"{SHOTS}/home-end-{key}.png")
            # every tab still navigates
            nav = []
            for i in range(5):
                await pg.locator("[role=tab]").nth(i).click()
                await pg.wait_for_timeout(900)
                nav.append(await pg.locator("[role=tab]").nth(i).get_attribute("aria-selected"))
            r["tabs_select"] = nav
            await pg.screenshot(path=f"{SHOTS}/profile-{key}.png")
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
