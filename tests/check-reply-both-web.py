"""Web check (throwaway local server, needs ./dist): a reply (hold a message -> Reply) shows its quote on BOTH screens.

  python3 tests/check-reply-both-web.py [shots_dir]

Test accounts only (Admin Rahim, Ann Begum, Cat Rahman on a throwaway database). For en/bn at 360 and 320 wide:
- Support: the admin holds Ann's message in the admin app -> Reply -> sends; the quote shows in the admin app AND in
  Ann's Support chat (named "You" for Ann). Ann holds the admin's message -> Reply -> sends; the quote shows for Ann
  AND in the admin app.
- Person to person: Ann holds Cat's message in Chats -> Reply -> sends; Cat sees the quote ("You", her own words).
  Cat holds Ann's message -> Reply -> sends; Ann sees the quote.
Also: no page errors, nothing running off the screen.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6500 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/reply"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="reply-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="reply-web-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/reply-web-server.log", "a"),
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


async def hold(pg, loc):
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    await pg.mouse.down(); await pg.wait_for_timeout(900); await pg.mouse.up()
    await pg.wait_for_timeout(400)


async def wait_text(pg, sel, text, timeout=12000):
    """Wait until an element matching sel contains text; returns its inner text or None."""
    loc = pg.locator(sel).filter(has_text=text)
    try:
        await loc.first.wait_for(state="visible", timeout=timeout)
        return (await loc.first.inner_text()).replace("\n", " | ")
    except Exception:
        return None


async def page_for(br, acc, lang, w, errs):
    ctx = await br.new_context(viewport={"width": w, "height": 780})
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    await pg.add_init_script(init_script(acc, lang))
    return ctx, pg


async def open_admin_thread(pg, tid):
    await pg.goto(BASE + "/admin", wait_until="networkidle")
    await pg.wait_for_selector('[data-testid="admin-tab-support"]', timeout=30000)
    await pg.click('[data-testid="admin-tab-support"]')
    await pg.wait_for_selector(f'[data-testid="thread-{tid}"]', timeout=15000)
    await pg.click(f'[data-testid="thread-{tid}"]')
    await pg.wait_for_selector('[data-testid="support-msg-hold"]', timeout=15000)
    await pg.wait_for_timeout(800)


async def open_user_support(pg):
    await pg.goto(BASE, wait_until="networkidle")
    await pg.locator('[data-testid="help-button"]').first.wait_for(timeout=30000)
    await pg.locator('[data-testid="help-button"]').first.click()
    await pg.wait_for_selector('[data-testid="support-chat"]', timeout=15000)
    await pg.wait_for_timeout(1200)


async def open_dm(pg, name):
    await pg.goto(BASE, wait_until="networkidle")
    await pg.locator('[data-testid="tab-chats"]').first.wait_for(timeout=30000)
    await pg.locator('[data-testid="tab-chats"]').first.click()
    row = pg.get_by_role("button", name=name).first
    await row.wait_for(timeout=15000)
    await row.click()
    await pg.wait_for_selector('[data-testid="dm-input"]', timeout=15000)
    await pg.wait_for_timeout(1500)


async def support_reply(pg, hold_text, body, r, tag):
    """In a Support chat: hold the message with hold_text -> Reply -> send body."""
    m = pg.locator('[data-testid="support-msg-hold"]').filter(has_text=hold_text).last
    await m.wait_for(timeout=12000)
    await hold(pg, m)
    r[f"{tag}_menu"] = await pg.locator('[data-testid="support-menu-reply"]').count() > 0
    if not r[f"{tag}_menu"]:
        return
    await pg.click('[data-testid="support-menu-reply"]')
    await pg.wait_for_timeout(400)
    bar = pg.locator('[data-testid="support-reply-bar"]')
    r[f"{tag}_bar"] = (await bar.inner_text()).replace("\n", " | ") if await bar.count() else None
    await pg.locator('[data-testid="support-input"]').fill(body)
    await pg.locator('[data-testid="support-send"]').click()
    await pg.wait_for_timeout(1500)


async def dm_reply(pg, hold_text, body, r, tag):
    m = pg.locator('[data-testid="dm-msg-theirs"]').filter(has_text=hold_text).last
    await m.wait_for(timeout=12000)
    await hold(pg, m)
    r[f"{tag}_menu"] = await pg.locator('[data-testid="dm-menu-reply"]').count() > 0
    if not r[f"{tag}_menu"]:
        return
    await pg.click('[data-testid="dm-menu-reply"]')
    await pg.wait_for_timeout(400)
    bar = pg.locator('[data-testid="dm-reply-bar"]')
    r[f"{tag}_bar"] = (await bar.inner_text()).replace("\n", " | ") if await bar.count() else None
    await pg.locator('[data-testid="dm-input"]').fill(body)
    await pg.locator('[data-testid="dm-send"]').click()
    await pg.wait_for_timeout(1500)


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
    api("POST", "/api/support/messages", {"body": "Hello support", "clientId": "seedseed01"}, ann["token"])
    _, th = api("GET", "/api/admin/manage/support/threads", tok=admin["token"])
    rows = th.get("data") if isinstance(th, dict) else th
    tid = rows[0]["id"]
    api("POST", f"/api/dm/{ann['user']['id']}/messages", {"content": "Hi Ann", "clientId": "seedseeddm1"}, cat["token"])

    async with async_playwright() as p:
        br = await p.chromium.launch()
        for lang, w in [("en", 360), ("bn", 360), ("en", 320), ("bn", 320)]:
            key = f"{lang}-{w}"
            r = rep[key] = {}
            errs = []
            # ---------- Support: admin replies to Ann's message ----------
            api("POST", "/api/support/messages", {"body": f"Order late {key}", "clientId": f"sup{lang}{w}xx"}, ann["token"])
            actx, apg = await page_for(br, admin, lang, w, errs)
            await open_admin_thread(apg, tid)
            await support_reply(apg, f"Order late {key}", f"On the way {key}", r, "admin")
            r["admin_sees_own_quote"] = await wait_text(apg, '[data-testid="support-msg-quote"]', f"Order late {key}")
            r["admin_overflow"] = await apg.evaluate(OVERFLOW_JS)
            await apg.screenshot(path=f"{SHOTS}/support-admin-sent-{key}.png")
            # Ann sees the quote, then replies to the admin's message
            uctx, upg = await page_for(br, ann, lang, w, errs)
            await open_user_support(upg)
            r["ann_sees_admin_quote"] = await wait_text(upg, '[data-testid="support-msg-quote"]', f"Order late {key}")
            await support_reply(upg, f"On the way {key}", f"Thanks {key}", r, "ann")
            r["ann_sees_own_quote"] = await wait_text(upg, '[data-testid="support-msg-quote"]', f"On the way {key}")
            r["ann_overflow"] = await upg.evaluate(OVERFLOW_JS)
            await upg.screenshot(path=f"{SHOTS}/support-user-{key}.png")
            # the admin sees Ann's quote (reload the thread)
            await open_admin_thread(apg, tid)
            r["admin_sees_ann_quote"] = await wait_text(apg, '[data-testid="support-msg-quote"]', f"On the way {key}")
            await apg.screenshot(path=f"{SHOTS}/support-admin-got-{key}.png")
            await actx.close(); await uctx.close()

            # ---------- Person to person: Ann <-> Cat ----------
            api("POST", f"/api/dm/{ann['user']['id']}/messages", {"content": f"Fish ready {key}", "clientId": f"dm{lang}{w}catxx"}, cat["token"])
            uctx, upg = await page_for(br, ann, lang, w, errs)
            await open_dm(upg, "Cat Rahman")
            await dm_reply(upg, f"Fish ready {key}", f"Send 5 kg {key}", r, "dm_ann")
            r["dm_ann_sees_own_quote"] = await wait_text(upg, '[data-testid="dm-reply-quote"]', f"Fish ready {key}")
            r["dm_ann_overflow"] = await upg.evaluate(OVERFLOW_JS)
            await upg.screenshot(path=f"{SHOTS}/dm-ann-sent-{key}.png")
            cctx, cpg = await page_for(br, cat, lang, w, errs)
            await open_dm(cpg, "Ann Begum")
            r["dm_cat_sees_quote"] = await wait_text(cpg, '[data-testid="dm-reply-quote"]', f"Fish ready {key}")
            await dm_reply(cpg, f"Send 5 kg {key}", f"Packed {key}", r, "dm_cat")
            r["dm_cat_sees_own_quote"] = await wait_text(cpg, '[data-testid="dm-reply-quote"]', f"Send 5 kg {key}")
            r["dm_cat_overflow"] = await cpg.evaluate(OVERFLOW_JS)
            await cpg.screenshot(path=f"{SHOTS}/dm-cat-{key}.png")
            # Ann's open chat picks Cat's reply up (poll / live socket) with the quote
            r["dm_ann_sees_cat_quote"] = await wait_text(upg, '[data-testid="dm-reply-quote"]', f"Send 5 kg {key}", timeout=15000)
            await upg.screenshot(path=f"{SHOTS}/dm-ann-got-{key}.png")
            await uctx.close(); await cctx.close()
            r["errors"] = errs
        await br.close()
    stop()
    keys = ["admin_sees_own_quote", "ann_sees_admin_quote", "ann_sees_own_quote", "admin_sees_ann_quote",
            "dm_ann_sees_own_quote", "dm_cat_sees_quote", "dm_cat_sees_own_quote", "dm_ann_sees_cat_quote"]
    rep["all_quotes_shown"] = all(rep[k].get(x) for k in rep if "-" in k for x in keys)
    rep["no_errors"] = all(not rep[k].get("errors") for k in rep if "-" in k)
    rep["no_overflow"] = all(not rep[k].get(o) for k in rep if "-" in k for o in ["admin_overflow", "ann_overflow", "dm_ann_overflow", "dm_cat_overflow"])
    print(json.dumps(rep, ensure_ascii=False, indent=1))


try:
    asyncio.run(main())
finally:
    if srv:
        stop()
