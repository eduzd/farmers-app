"""Web check (throwaway local server, needs ./dist): Bepari calculator typing pause + Save / offline update / reload / reopen.

  python3 tests/check-bepari-save-web.py
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
data_dir = tempfile.mkdtemp(prefix="bepari-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="bepari-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/bepari-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)
results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra != "" else ""))

VALS = "() => [...document.querySelectorAll('input[placeholder=\"০\"]')].map(i => i.value)"
ACTIVE = "() => { const a = document.activeElement; return [...document.querySelectorAll('input[placeholder=\"০\"]')].indexOf(a); }"
NAME = "হিসাবের নাম (যেমন: রুই মাছ)"

async def count_saved(pg):
    loc = pg.locator("text=/সংরক্ষিত হিসাব \\(\\d+\\)/")
    if await loc.count() == 0:
        return 0
    t = await loc.first.text_content()
    return int(t.split("(")[1].split(")")[0])

async def open_bepari(pg):
    await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(3500)
    await pg.get_by_text("হিসাব", exact=True).first.click(); await pg.wait_for_timeout(1500)
    await pg.get_by_text("ব্যাপারী ক্যালকুলেটর").first.click(); await pg.wait_for_timeout(2000)

async def main():
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    s = str(int(time.time() * 1000))[-7:]
    req = urllib.request.Request(BASE + "/api/auth/signup", method="POST", headers={"Content-Type": "application/json"},
        data=json.dumps({"email": f"bp{s}@check.test", "password": "Check-pass-123", "name": "Bepari Test", "username": f"bp_{s}"}).encode())
    j = json.loads(urllib.request.urlopen(req, timeout=30).read())
    u = dict(j["user"]); u["onboardingComplete"] = True
    init = ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','bn');"
            % (json.dumps(j["token"]), json.dumps(json.dumps(u))))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.add_init_script(init)
        await open_bepari(pg)
        boxes = pg.locator('input[placeholder="০"]')
        await boxes.nth(0).click(); await pg.keyboard.type("12")
        await boxes.nth(1).click()
        for d in "150":
            await pg.keyboard.type(d); await pg.wait_for_timeout(1000)
        ok("cursor stays while typing pieces slowly", await pg.evaluate(ACTIVE) == 1)
        await pg.wait_for_timeout(1500)
        ok("still there 2.5 s after", await pg.evaluate(ACTIVE) == 1)
        await pg.wait_for_timeout(1500)
        ok("moves about 3 s after typing stops", await pg.evaluate(ACTIVE) == 2)
        await pg.get_by_placeholder(NAME).fill("রুই পরীক্ষা")
        btn = pg.get_by_text("সংরক্ষণ করুন", exact=True)
        if await btn.count() == 0:
            ok("save button present", False); await b.close(); return
        await btn.first.click(); await pg.wait_for_timeout(1000)
        ok("saved, one record", await count_saved(pg) == 1, await count_saved(pg))
        await pg.wait_for_timeout(2500)
        await ctx.set_offline(True)
        await boxes.nth(2).click(); await pg.keyboard.type("8")
        await boxes.nth(3).click(); await pg.keyboard.type("90")
        await pg.wait_for_timeout(400)
        await pg.get_by_text("আপডেট করুন", exact=True).first.click(); await pg.wait_for_timeout(1000)
        ok("offline update keeps one record", await count_saved(pg) == 1)
        await ctx.set_offline(False)
        await pg.wait_for_timeout(800)
        await open_bepari(pg)
        ok("after reload one record", await count_saved(pg) == 1)
        await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
        ok("+ clears", all(v == "" for v in await pg.evaluate(VALS)), await pg.evaluate(VALS))
        await pg.get_by_text("রুই পরীক্ষা").last.click(); await pg.wait_for_timeout(1200)
        v = await pg.evaluate(VALS)
        ok("reopen shows every row as saved", v[:4] == ["12", "150", "8", "90"], v)
        await boxes.nth(3).fill("95"); await pg.wait_for_timeout(400)
        await pg.get_by_text("আপডেট করুন", exact=True).first.click(); await pg.wait_for_timeout(1000)
        ok("edit after reopen keeps one record", await count_saved(pg) == 1)
        ok("no page errors", not errs, errs)
        await b.close()

try:
    asyncio.run(main())
finally:
    try: os.killpg(srv.pid, 15)
    except Exception: pass
fails = [n for n, c in results if not c]
print(f"check-bepari-save-web: {len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
