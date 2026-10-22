"""Live, read-only check of this round on Render: admin dashboard errors (signs in as admin@farmers.app through the real
sign-in screen, opens every tab, More item and a user profile; does not open support threads, so nothing is marked read)
and the guest Support page (call button, sign-in prompt). Changes no data."""
import asyncio, json, os, re, urllib.request
from playwright.async_api import async_playwright

BASE = "https://farmers-2ybg.onrender.com"
cred = open(os.path.expanduser("~/.secrets/farmers-render-admin.txt")).read()
EMAIL = re.search(r"email:\s*(\S+)", cred).group(1) if re.search(r"email:\s*(\S+)", cred) else "admin@farmers.app"
PW = re.search(r"password:\s*(\S+)", cred).group(1)
SHOTS = "/home/sprite/farmers-shots/support-live"
os.makedirs(SHOTS, exist_ok=True)
OVERFLOW_JS = r"""() => { const vw = innerWidth; let n = 0; for (const el of document.querySelectorAll('div,span')) { const r = el.getBoundingClientRect(); if (!r.width || r.right <= vw + 1) continue; let p = el.parentElement, c = false; while (p && p !== document.body) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' && p.getBoundingClientRect().right <= vw + 1) { c = true; break; } p = p.parentElement; } if (!c) n++; } return n; }"""


def status(path):
    try:
        return urllib.request.urlopen(BASE + path, timeout=60).status
    except urllib.error.HTTPError as e:
        return e.code


async def main():
    out = {"health": urllib.request.urlopen(BASE + "/api/health", timeout=60).read().decode(), "call_target_no_auth": status("/api/support/call-target")}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # admin dashboard
        for lang, w in (("en", 360),):
            ctx = await b.new_context(viewport={"width": w, "height": 760})
            pg = await ctx.new_page(); errs, http = [], []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text[:160]))
            pg.on("response", lambda resp: (resp.status >= 400 and "/api/" in resp.url) and http.append(f"{resp.status} {resp.url.replace(BASE, '')}"))
            await pg.goto(BASE + "/admin", wait_until="networkidle"); await pg.wait_for_timeout(2500)
            if not await pg.locator('input[type="password"]:visible').count():
                await pg.get_by_text("Log in", exact=True).first.click(); await pg.wait_for_timeout(2500)
            await pg.locator('input:visible:not([type="password"])').first.fill(EMAIL)
            await pg.locator('input[type="password"]:visible').first.fill(PW)
            await pg.locator('[role=button]').filter(has_text=re.compile(r"^\s*Sign in\s*$")).last.click()
            for _ in range(40):
                await pg.wait_for_timeout(500)
                if await pg.locator('[data-testid="admin-app"], [data-testid="admin-denied"]').count():
                    break
            if lang == "bn":
                await pg.evaluate("()=>{for(const k of Object.keys(localStorage)){if(/lang/i.test(k)){localStorage.setItem(k, localStorage.getItem(k).replace(/\"en\"/g,'\"bn\"').replace(/^en$/,'bn'))}}}")
                await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(3000)
            r = {"admin_app": await pg.locator('[data-testid="admin-app"]').count(), "steps": {}}
            tok = await pg.evaluate("() => localStorage.getItem('auth_token')")

            async def step(name, sel, wait=2000):
                n0 = len(errs) + len(http)
                l = pg.locator(sel)
                if not await l.count():
                    r["steps"][name] = "missing"; return False
                await l.first.click(); await pg.wait_for_timeout(wait)
                r["steps"][name] = "ok" if len(errs) + len(http) == n0 and await pg.locator('[data-testid="admin-tabbar"]').count() else (errs + http)[n0:][:3] or "no tab bar"
                return True

            async def back():
                for s in ('[data-testid="admin-back"]', '[data-testid="more-back"]', '[data-testid="classic-back"]'):
                    l = pg.locator(s)
                    if await l.count() and await l.first.is_visible():
                        await l.first.click(); await pg.wait_for_timeout(900); return
            for t in ("home", "shop", "orders", "support", "more"):
                await step(f"tab-{t}", f'[data-testid="admin-tab-{t}"]')
            for k in ("users", "moderation", "notify", "delivery", "posts", "content", "analytics", "settings", "logs"):
                await pg.locator('[data-testid="admin-tab-more"]').click(); await pg.wait_for_timeout(900)
                if await step(f"more-{k}", f'[data-testid="more-{k}"]', 2500):
                    await back()
            await pg.locator('[data-testid="admin-tab-more"]').click(); await pg.wait_for_timeout(900)
            await step("users-list", '[data-testid="more-users"]', 2500)
            uid = await pg.evaluate("() => { const e = [...document.querySelectorAll('[data-testid]')].find(x => /^user-[0-9a-f]{8}-/.test(x.dataset.testid)); return e ? e.dataset.testid : null }")
            if uid:
                await step("user-profile", f'[data-testid="{uid}"]', 3000)
                await pg.screenshot(path=f"{SHOTS}/admin-user-profile-{lang}-{w}.png")
                r["profile_id"] = uid
                r["profile_open"] = await pg.locator('[data-testid="user-detail"]').count()
                r["profile_text"] = (await pg.evaluate("() => document.body.innerText"))[:200].replace("\n", " | ")
            if tok:
                r["admins_online_seen_by_server"] = await pg.evaluate("async (t) => (await (await fetch('/api/support/unread', {headers: {Authorization: 'Bearer ' + t}})).json())", tok)
            r["overflow"] = await pg.evaluate(OVERFLOW_JS)
            if tok:
                r["call_target"] = await pg.evaluate("async (t) => { const x = await fetch('/api/support/call-target', {headers: {Authorization: 'Bearer ' + t}}); return [x.status, Object.keys(await x.json())] }", tok)
            # user-side Support page in the main app, same signed-in session (read only: GET thread, no send, no call tap)
            await pg.goto(BASE + "/", wait_until="networkidle"); await pg.wait_for_timeout(3500)
            hb = pg.locator('[data-testid="help-button"]')
            r["help_button"] = await hb.count()
            if r["help_button"]:
                await hb.first.click(); await pg.wait_for_timeout(3000)
            r["support_chat"] = await pg.locator('[data-testid="support-chat"]').count()
            cb = pg.locator('[data-testid="support-call-button"]')
            box = await cb.first.bounding_box() if await cb.count() else None
            r["support_call_button_in_view"] = bool(box and box["x"] + box["width"] <= w + 1)
            r["support_overflow"] = await pg.evaluate(OVERFLOW_JS)
            r["support_text"] = (await pg.evaluate("() => document.body.innerText"))[:140].replace("\n", " | ")
            await pg.screenshot(path=f"{SHOTS}/support-{lang}-{w}.png")
            r["errors"], r["http"] = errs[:6], http[:6]
            out[f"admin-{lang}-{w}"] = r
            await ctx.close()
        await b.close()
    print(json.dumps(out, indent=1, ensure_ascii=False))

asyncio.run(main())
