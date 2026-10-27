"""Web check (throwaway local server, needs ./dist): Arat calculator typing pause + Save / reopen / edit / offline.

  python3 tests/check-calc-save-web.py [shots_dir]

Signed in as a throwaway test account, Bangla, 390x844:
- Typing a weight "125" one digit per second keeps the cursor in that box; it moves to the next row only
  about 3 s after the last digit.
- Save adds the calculation to the saved list (count 1) and the button turns into Update.
- With the network off: adding a row and pressing Update keeps one record and shows the new total.
- After a full page reload: the saved list still has it; tapping it reopens every row as saved; another
  edit + Update still leaves exactly one record.
- History -> the record shows all rows; Edit opens it in the calculator.
- + (new calculation) clears the table; saving the new one makes record 2. No page errors.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6700 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/calc-save"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="calcsave-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="calcsave-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/calcsave-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)

results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra != "" else ""))


def api(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


ACTIVE_JS = "() => { const a = document.activeElement; const all = [...document.querySelectorAll('input[placeholder=\"০\"]')]; return {idx: all.indexOf(a), value: a && a.value, n: all.length}; }"


async def count_saved(pg):
    t = await pg.locator("text=/সংরক্ষিত হিসাব \\(\\d+\\)/").first.text_content()
    return int(t.split("(")[1].split(")")[0])


async def open_arat(pg):
    await pg.goto(BASE, wait_until="networkidle")
    await pg.wait_for_timeout(3500)
    await pg.get_by_text("হিসাব", exact=True).first.click()
    await pg.wait_for_timeout(1500)
    await pg.get_by_text("আড়ত ক্যালকুলেটর").first.click()
    await pg.wait_for_timeout(2000)


async def main():
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    s = str(int(time.time() * 1000))[-7:]
    j = api("POST", "/api/auth/signup", {"email": f"calc{s}@check.test", "password": "Check-pass-123", "name": "Calc Test", "username": f"calc_{s}"})
    u = dict(j["user"]); u["onboardingComplete"] = True
    init = ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','bn');"
            % (json.dumps(j["token"]), json.dumps(json.dumps(u))))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.add_init_script(init)
        await open_arat(pg)
        await pg.screenshot(path=f"{SHOTS}/1-open.png")
        boxes = pg.locator('input[placeholder="০"]')
        # row 1: rate 120, weight typed slowly "1", "2", "5"
        await boxes.nth(0).click(); await pg.keyboard.type("120")
        await boxes.nth(1).click()
        for d in "125":
            await pg.keyboard.type(d)
            await pg.wait_for_timeout(1000)
        a = await pg.evaluate(ACTIVE_JS)
        ok("cursor stays while typing 125 slowly", a["idx"] == 1 and a["value"] == "125", a)
        await pg.wait_for_timeout(1500)  # 2.5 s after the last digit
        a = await pg.evaluate(ACTIVE_JS)
        ok("still there 2.5 s after the last digit", a["idx"] == 1, a)
        await pg.wait_for_timeout(1500)  # 4 s after
        a = await pg.evaluate(ACTIVE_JS)
        ok("moves to next row about 3 s after typing stops", a["idx"] == 2 and a["value"] == "", a)

        await pg.get_by_placeholder("হিসাবের নাম (যেমন: আজকের বিক্রি)").fill("পরীক্ষা ১")
        await pg.get_by_text("সংরক্ষণ করুন", exact=True).first.click()
        await pg.wait_for_timeout(800)
        ok("save shows confirmation", await pg.get_by_text("সংরক্ষিত হয়েছে", exact=True).count() > 0)
        ok("one saved record", await count_saved(pg) == 1)
        await pg.wait_for_timeout(2500)
        ok("button now says Update", await pg.get_by_text("আপডেট করুন", exact=True).count() > 0)
        await pg.screenshot(path=f"{SHOTS}/2-saved.png")

        # offline edit: add row 2 (rate 100, weight 10) and update
        await ctx.set_offline(True)
        await boxes.nth(2).click(); await pg.keyboard.type("100")
        await boxes.nth(3).click(); await pg.keyboard.type("10")
        await pg.wait_for_timeout(500)
        await pg.get_by_text("আপডেট করুন", exact=True).first.click()
        await pg.wait_for_timeout(1000)
        ok("offline update confirmed", await pg.get_by_text("সংরক্ষিত হয়েছে", exact=True).count() > 0)
        ok("offline update kept one record", await count_saved(pg) == 1)
        await pg.screenshot(path=f"{SHOTS}/3-offline-update.png")
        await ctx.set_offline(False)

        # reload (like reopening the app); start a fresh table first so reopening is visible
        await pg.wait_for_timeout(800)
        await pg.reload(wait_until="networkidle")
        await pg.wait_for_timeout(3500)
        await pg.get_by_text("আড়ত ক্যালকুলেটর").first.click() if await pg.get_by_text("আড়ত ক্যালকুলেটর").count() else await open_arat(pg)
        await pg.wait_for_timeout(2500)
        if await pg.locator("text=/সংরক্ষিত হিসাব \\(\\d+\\)/").count() == 0:
            await open_arat(pg)
        ok("after reload still one saved record", await count_saved(pg) == 1)
        vals = await pg.evaluate("() => [...document.querySelectorAll('input[placeholder=\"০\"]')].map(i => i.value)")
        ok("draft after reload keeps the table", vals[:4] == ["120", "125", "100", "10"], vals)
        ok("draft after reload still edits the same record (Update)", await pg.get_by_text("আপডেট করুন", exact=True).count() > 0)

        # reopen the saved one from the list
        rec = pg.get_by_text("পরীক্ষা ১", exact=False)
        await rec.last.click()
        await pg.wait_for_timeout(1200)
        vals = await pg.evaluate("() => [...document.querySelectorAll('input[placeholder=\"০\"]')].map(i => i.value)")
        ok("tapping saved record reopens every row as saved", vals[:4] == ["120", "125", "100", "10"] and vals[4:] in (["", ""], []), vals)
        name = await pg.get_by_placeholder("হিসাবের নাম (যেমন: আজকের বিক্রি)").input_value()
        ok("name reopened", name == "পরীক্ষা ১", name)
        # edit again: change row 2 weight to 20, update
        await boxes.nth(3).fill("20")
        await pg.wait_for_timeout(400)
        await pg.get_by_text("আপডেট করুন", exact=True).first.click()
        await pg.wait_for_timeout(1000)
        ok("edit after reopen keeps one record", await count_saved(pg) == 1)
        await pg.screenshot(path=f"{SHOTS}/4-reopened-updated.png")

        # History -> detail -> Edit
        await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(3500)
        await pg.get_by_text("হিসাব", exact=True).first.click(); await pg.wait_for_timeout(1500)
        await pg.get_by_text("সব হিসাব দেখুন").first.click()
        await pg.wait_for_timeout(2000)
        await pg.get_by_text("পরীক্ষা ১").first.click()
        await pg.wait_for_timeout(2000)
        body = await pg.locator("body").inner_text()
        ok("detail lists the rows", "হিসাবের তালিকা" in body and ("125" in body or "১২৫" in body), body[:600].replace("\n", " | "))
        await pg.screenshot(path=f"{SHOTS}/5-detail.png", full_page=True)
        await pg.get_by_text("এডিট করুন", exact=True).first.click()
        await pg.wait_for_timeout(2000)
        vals = await pg.evaluate("() => [...document.querySelectorAll('input[placeholder=\\"০\\"]')].map(i => i.value)")
        ok("Edit from detail opens it in the calculator", vals[:4] == ["120", "125", "100", "20"], vals)
        ok("still Update mode after Edit", await pg.get_by_text("আপডেট করুন", exact=True).count() > 0)

        # + new calculation clears, keeps one record; saving the new one makes record 2
        await pg.locator('[aria-label="নতুন হিসাব"]').first.click()
        await pg.wait_for_timeout(1200)
        vals = await pg.evaluate("() => [...document.querySelectorAll('input[placeholder=\\"০\\"]')].map(i => i.value)")
        ok("+ clears the table", all(v == "" for v in vals), vals)
        ok("+ did not duplicate", await count_saved(pg) == 1)
        await boxes.nth(0).click(); await pg.keyboard.type("90")
        await boxes.nth(1).click(); await pg.keyboard.type("7")
        await pg.wait_for_timeout(400)
        await pg.get_by_text("সংরক্ষণ করুন", exact=True).first.click()
        await pg.wait_for_timeout(1000)
        ok("new calculation saved as record 2", await count_saved(pg) == 2)
        ok("no page errors", not errs, errs)
        await b.close()


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, 15)
    except Exception:
        pass
fails = [n for n, c in results if not c]
print(f"check-calc-save-web: {len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
