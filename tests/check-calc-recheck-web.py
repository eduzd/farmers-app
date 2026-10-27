"""Web check (throwaway local server, needs ./dist): the calculator flows the user asked for on 27 Oct.

  python3 tests/check-calc-recheck-web.py [shots_dir]

Signed in as a throwaway test account, phone size 390x844.
Bepari (Bangla):
- typing pieces slowly keeps the cursor in the box; it moves on only ~3 s after the last digit
- + saves the calculation (a note says so), clears the table, and the bookmark icon's slide-up list shows it
- the list sits above the bottom of the screen and is taller than its header (not collapsed)
- tapping the saved one opens it with every row; adding a row and pressing Update keeps ONE record
- after a reload the bookmark list still has it, it opens again, and + on an opened one does not duplicate
Arat (Bangla):
- the fish list opens from the left, right under the tapped fish box (not in the middle)
- + saves; the bookmark list shows it; tapping opens it; editing + Update keeps one record
Both in English: + saves and the bookmark list shows the record and opens it. No page errors.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6800 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/calc-recheck"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="calcrecheck-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="calcrecheck-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/calcrecheck-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)

results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra != "" else ""), flush=True)

BOX = 'input[placeholder="০"], input[placeholder="0"]'
VALS = "() => [...document.querySelectorAll('input[placeholder=\"০\"], input[placeholder=\"0\"]')].map(i => i.value)"
ACTIVE = "() => { const a = document.activeElement; return [...document.querySelectorAll('input[placeholder=\"০\"], input[placeholder=\"0\"]')].indexOf(a); }"


def signup(tag):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    req = urllib.request.Request(BASE + "/api/auth/signup", method="POST", headers={"Content-Type": "application/json"},
        data=json.dumps({"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": "Calc Test", "username": f"{tag}_{s}"}).encode())
    j = json.loads(urllib.request.urlopen(req, timeout=30).read())
    u = dict(j["user"]); u["onboardingComplete"] = True
    return j["token"], u


async def open_calc(pg, which, lang):
    await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(3500)
    if lang == "bn":
        await pg.get_by_text("হিসাব", exact=True).first.click()
    else:
        await pg.get_by_text(__import__("re").compile(r"^(Calculate|Calculator|Calc|Calculation|Accounts)$")).first.click()
    await pg.wait_for_timeout(1500)
    label = {("bepari", "bn"): "ব্যাপারী ক্যালকুলেটর", ("arat", "bn"): "আড়ত ক্যালকুলেটর",
             ("bepari", "en"): __import__("re").compile("Bepari calculator", 2), ("arat", "en"): __import__("re").compile("Arat calculator", 2)}[(which, lang)]
    await pg.get_by_text(label).first.click()
    await pg.wait_for_timeout(2000)


async def sheet_items(pg):
    return await pg.locator('[data-testid="calc-saved-item"]:visible').count()


async def open_sheet(pg, label):
    await pg.locator(f'[aria-label="{label}"]').first.click()
    await pg.wait_for_timeout(900)


async def new_context(b, lang, tag):
    token, u = signup(tag)
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.add_init_script("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','%s');"
                             % (json.dumps(token), json.dumps(json.dumps(u)), lang))
    return ctx, pg, errs


async def bepari_bn(b):
    ctx, pg, errs = await new_context(b, "bn", "bp")
    await open_calc(pg, "bepari", "bn")
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("12")
    await boxes.nth(1).click()
    for d in "150":
        await pg.keyboard.type(d); await pg.wait_for_timeout(1000)
    ok("Bepari: cursor stays while typing slowly", await pg.evaluate(ACTIVE) == 1)
    await pg.wait_for_timeout(1500)
    ok("Bepari: still there 2.5 s after the last digit", await pg.evaluate(ACTIVE) == 1)
    await pg.wait_for_timeout(1500)
    ok("Bepari: moves on ~3 s after typing stops", await pg.evaluate(ACTIVE) == 2)
    await boxes.nth(2).click(); await pg.keyboard.type("10")
    await boxes.nth(3).click(); await pg.keyboard.type("100")
    await pg.wait_for_timeout(300)
    await pg.get_by_placeholder("হিসাবের নাম (যেমন: রুই মাছ)").fill("রুই প্লাস")

    # + saves the current calculation and clears
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
    ok("Bepari: + shows the saved note", await pg.locator('[data-testid="calc-saved-notice"]').count() > 0)
    ok("Bepari: + clears the table", all(v == "" for v in await pg.evaluate(VALS)))
    await pg.screenshot(path=f"{SHOTS}/bepari-1-after-plus.png")

    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: bookmark list shows the saved calculation", await sheet_items(pg) == 1, await sheet_items(pg))
    box = await pg.locator('[data-testid="calc-saved-sheet"]').bounding_box()
    ok("Bepari: list slides up from the bottom and is not collapsed", box and box["height"] > 150 and abs(box["y"] + box["height"] - 844) < 4, box)
    await pg.screenshot(path=f"{SHOTS}/bepari-2-sheet.png")

    await pg.locator('[data-testid="calc-saved-item"]').first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok("Bepari: tapping it opens every row", v[:4] == ["12", "150", "10", "100"], v)
    ok("Bepari: list closed after opening", await pg.locator('[data-testid="calc-saved-sheet"]:visible').count() == 0)
    ok("Bepari: 'opened' note and Update button", await pg.locator('[data-testid="calc-saved-notice"]').count() > 0 and await pg.get_by_text("আপডেট করুন", exact=True).count() > 0)
    await pg.screenshot(path=f"{SHOTS}/bepari-3-opened.png")

    # keep calculating on the same entry: add a row, Update
    await boxes.nth(4).click(); await pg.keyboard.type("8")
    await boxes.nth(5).click(); await pg.keyboard.type("90")
    await pg.wait_for_timeout(300)
    await pg.get_by_text("আপডেট করুন", exact=True).first.click(); await pg.wait_for_timeout(1000)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: Update keeps one record", await sheet_items(pg) == 1, await sheet_items(pg))
    await pg.locator('[data-testid="calc-saved-backdrop"]').first.click(position={"x": 50, "y": 50}); await pg.wait_for_timeout(600)

    # reload, the list still has it and it opens with the new row
    await open_calc(pg, "bepari", "bn")
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: after reload still exactly one in the list", await sheet_items(pg) == 1, await sheet_items(pg))
    await pg.locator('[data-testid="calc-saved-item"]').first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok("Bepari: reopened after reload with the added row", v[:6] == ["12", "150", "10", "100", "8", "90"], v)
    # + on an opened record updates it rather than making a copy
    await boxes.nth(5).fill("95"); await pg.wait_for_timeout(300)
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: + on an opened one keeps one record", await sheet_items(pg) == 1, await sheet_items(pg))
    await pg.locator('[data-testid="calc-saved-item"]').first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok("Bepari: that change was saved", v[5:6] == ["95"], v)
    ok("Bepari: no page errors", not errs, errs)
    await ctx.close()


async def arat_bn(b):
    ctx, pg, errs = await new_context(b, "bn", "ar")
    await open_calc(pg, "arat", "bn")
    trig = pg.locator('[data-testid="arat-fish-trigger"]').first
    tb = await trig.bounding_box()
    await trig.click(); await pg.wait_for_timeout(700)
    mb = await pg.locator('[data-testid="arat-fish-menu"]').bounding_box()
    await pg.screenshot(path=f"{SHOTS}/arat-1-fish-menu.png")
    ok("Arat: fish list opens at the left, under the fish box", tb and mb and abs(mb["x"] - tb["x"]) < 6 and abs(mb["y"] - (tb["y"] + tb["height"])) < 12 and mb["x"] < 120, (tb, mb))
    await pg.get_by_text("রুই", exact=True).last.click(); await pg.wait_for_timeout(400)
    ok("Arat: picked fish shows in the box", (await trig.inner_text()).strip() == "রুই", await trig.inner_text())
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("120")
    await boxes.nth(1).click(); await pg.keyboard.type("25")
    await pg.wait_for_timeout(300)
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
    ok("Arat: + shows the saved note", await pg.locator('[data-testid="calc-saved-notice"]').count() > 0)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Arat: bookmark list shows the saved calculation", await sheet_items(pg) == 1, await sheet_items(pg))
    await pg.screenshot(path=f"{SHOTS}/arat-2-sheet.png")
    await pg.locator('[data-testid="calc-saved-item"]').first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok("Arat: tapping it opens the rows", v[:2] == ["120", "25"], v)
    await boxes.nth(2).click(); await pg.keyboard.type("100")
    await boxes.nth(3).click(); await pg.keyboard.type("10")
    await pg.wait_for_timeout(300)
    await pg.get_by_text("আপডেট করুন", exact=True).first.click(); await pg.wait_for_timeout(1000)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Arat: Update keeps one record", await sheet_items(pg) == 1, await sheet_items(pg))
    await pg.locator('[data-testid="calc-saved-item"]').first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok("Arat: the edit was saved to the same entry", v[:4] == ["120", "25", "100", "10"], v)
    ok("Arat: no page errors", not errs, errs)
    await ctx.close()


async def english(b, which):
    ctx, pg, errs = await new_context(b, "en", "en" + which[:2])
    await open_calc(pg, which, "en")
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("12")
    await boxes.nth(1).click(); await pg.keyboard.type("150")
    await pg.wait_for_timeout(300)
    await pg.locator('[aria-label="New calculation"]').first.click(); await pg.wait_for_timeout(1200)
    note = pg.locator('[data-testid="calc-saved-notice"]')
    ok(f"{which} EN: saved note in English", await note.count() > 0 and "bookmark" in (await note.inner_text()).lower(), await note.inner_text() if await note.count() else "")
    await open_sheet(pg, "Saved records")
    ok(f"{which} EN: list shows the record", await sheet_items(pg) == 1, await sheet_items(pg))
    await pg.screenshot(path=f"{SHOTS}/{which}-en-sheet.png")
    await pg.locator('[data-testid="calc-saved-item"]').first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok(f"{which} EN: tapping opens it", v[:2] == ["12", "150"], v)
    ok(f"{which} EN: no page errors", not errs, errs)
    await ctx.close()


async def main():
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for fn in (bepari_bn, arat_bn):
            try:
                await fn(b)
            except Exception as e:
                ok(f"{fn.__name__} ran to the end", False, str(e)[:300])
        for which in ("bepari", "arat"):
            try:
                await english(b, which)
            except Exception as e:
                ok(f"{which} EN ran to the end", False, str(e)[:300])
        await b.close()


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, 15)
    except Exception:
        pass
fails = [n for n, c in results if not c]
print(f"check-calc-recheck-web: {len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
