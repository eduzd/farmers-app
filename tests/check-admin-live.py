"""Read-only live check of the admin web app on Render: real UI sign-in at /admin, every tab at
320/360/390 in English and Bangla, page errors, sideways overflow, opening a support thread (main-app chat
Opens no support thread (that would mark it read). Changes no data.

  python3 tests/check-admin-live.py [shots_dir]
"""
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright

BASE = "https://farmers-2ybg.onrender.com"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/admin-live"
os.makedirs(SHOTS, exist_ok=True)
cred = open(os.path.expanduser("~/.secrets/farmers-render-admin.txt")).read()
EMAIL = re.search(r"email:\s*(\S+)", cred).group(1)
PW = re.search(r"password:\s*(\S+)", cred).group(1)
OVERFLOW_JS = "()=>document.documentElement.scrollWidth - window.innerWidth"


async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                key = f"{lang}-{w}"; print("start", key, flush=True)
                ctx = await b.new_context(viewport={"width": w, "height": 760})
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
                await pg.goto(BASE + "/admin", wait_until="networkidle")
                await pg.wait_for_timeout(2500)
                if not await pg.locator('input[type="password"]:visible').count():
                    await pg.get_by_text("Log in", exact=True).first.click(); await pg.wait_for_timeout(2500)
                await pg.locator('input:visible:not([type="password"])').first.fill(EMAIL)
                await pg.locator('input[type="password"]:visible').first.fill(PW)
                await pg.screenshot(path=f"{SHOTS}/{key}-login.png")
                await pg.locator('[role=button]').filter(has_text=re.compile(r"^\s*Sign in\s*$")).last.click()
                for _ in range(40):
                    await pg.wait_for_timeout(500)
                    if await pg.locator('[data-testid="admin-app"], [data-testid="admin-denied"]').count():
                        break
                r = {"admin_app": await pg.locator('[data-testid="admin-app"]').count(), "tabs": {}}
                if lang == "bn":
                    await pg.evaluate("()=>{try{for(const k of Object.keys(localStorage)){if(/lang/i.test(k)){localStorage.setItem(k, localStorage.getItem(k).replace(/\"en\"/g,'\"bn\"').replace(/^en$/,'bn'))}}}catch(e){}}")
                    await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(3000)
                    r["admin_app_after_lang"] = await pg.locator('[data-testid="admin-app"]').count()
                for t in ("home", "shop", "orders", "support", "more"):
                    tab = pg.locator(f'[data-testid="admin-tab-{t}"]')
                    if not await tab.count():
                        r["tabs"][t] = "missing"; continue
                    await tab.click(); await pg.wait_for_timeout(1500)
                    r["tabs"][t] = {"overflow_px": await pg.evaluate(OVERFLOW_JS), "title": (await pg.locator('[data-testid="admin-title"]').first.inner_text()) if await pg.locator('[data-testid="admin-title"]').count() else None}
                    await pg.screenshot(path=f"{SHOTS}/{key}-{t}.png")
                r["tabbar_text"] = (await pg.locator('[data-testid="admin-tabbar"]').inner_text()).replace("\n", " | ") if await pg.locator('[data-testid="admin-tabbar"]').count() else None
                r["errors"] = errs
                out[key] = r
                await ctx.close()
        await b.close()
    print(json.dumps(out, indent=1, ensure_ascii=False))

asyncio.run(main())
