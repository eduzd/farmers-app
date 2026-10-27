"""Web check (throwaway local server, needs ./dist): deleting saved calculations, and no saved list on
the calculator's main page (user's ask, 27 Oct).

  python3 tests/check-calc-delete-web.py [shots_dir]

Signed in as a throwaway test account, phone size 390x844.
Bepari (Bangla):
- after saving with +, the main page shows no saved-records list (only the bookmark icon's slide-up list has them)
- each row in the slide-up list has a red trash button; it opens the slide-up "delete?" sheet
- Cancel keeps it; Delete removes exactly that one, from the list and from the server copy
- deleting while offline hides it at once; back online the server copy is deleted too, and it never comes back
- deleting the calculation that is open on screen clears the screen (no Update), and a new save works
- plus saves and clears, tapping opens, Update keeps one entry, 3 s typing pause still work
Arat (Bangla): main page has no list; delete from the list works.
Both in English: the sheet reads "Delete this calculation?" with Cancel / Delete, and delete works. No page errors.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6900 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/calc-delete"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="calcdelete-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="calcdelete-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/calcdelete-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)

results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra != "" else ""), flush=True)

BOX = 'input[placeholder="০"], input[placeholder="0"]'
VALS = "() => [...document.querySelectorAll('input[placeholder=\"০\"], input[placeholder=\"0\"]')].map(i => i.value)"
ACTIVE = "() => { const a = document.activeElement; return [...document.querySelectorAll('input[placeholder=\"০\"], input[placeholder=\"0\"]')].indexOf(a); }"
ITEM = '[data-testid="calc-saved-item"]:visible'
TRASH = '[data-testid="calc-saved-delete"]:visible'
SHEET = '[data-testid="calc-delete-sheet"]:visible'


def signup(tag):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    req = urllib.request.Request(BASE + "/api/auth/signup", method="POST", headers={"Content-Type": "application/json"},
        data=json.dumps({"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": "Calc Test", "username": f"{tag}_{s}"}).encode())
    j = json.loads(urllib.request.urlopen(req, timeout=30).read())
    u = dict(j["user"]); u["onboardingComplete"] = True
    return j["token"], u


def server_names(token):
    req = urllib.request.Request(BASE + "/api/calc-records", headers={"Authorization": f"Bearer {token}"})
    j = json.loads(urllib.request.urlopen(req, timeout=20).read())
    rows = j if isinstance(j, list) else (j.get("records") or j.get("data") or [])
    out = []
    for r in rows:
        inp = r.get("inputsJson") or r.get("inputs_json") or r.get("inputs") or {}
        if isinstance(inp, str):
            try:
                inp = json.loads(inp)
            except Exception:
                inp = {}
        out.append((inp or {}).get("name") or r.get("title") or "")
    return sorted(out)


async def wait_server(token, want, secs=20):
    got = None
    for _ in range(secs * 2):
        got = server_names(token)
        if got == sorted(want):
            return True, got
        await asyncio.sleep(0.5)
    return False, got


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
    await pg.wait_for_timeout(2500)


async def open_sheet(pg, label):
    await pg.locator(f'[aria-label="{label}"]').first.click()
    await pg.wait_for_timeout(900)


async def close_sheet(pg):
    await pg.locator('[data-testid="calc-saved-backdrop"]').first.click(position={"x": 50, "y": 50}); await pg.wait_for_timeout(600)


async def item_names(pg):
    return [(await t.inner_text()).split("\n")[0].strip() for t in await pg.locator(ITEM).all()]


async def new_context(b, lang, tag):
    token, u = signup(tag)
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await pg.add_init_script("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','%s');"
                             % (json.dumps(token), json.dumps(json.dumps(u)), lang))
    return ctx, pg, errs, token


async def save_bepari(pg, name, w, p, plus_label):
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type(w)
    await boxes.nth(1).click(); await pg.keyboard.type(p)
    await pg.wait_for_timeout(300)
    await pg.locator('input[placeholder*="("]').first.fill(name)
    await pg.locator(f'[aria-label="{plus_label}"]').first.click(); await pg.wait_for_timeout(1200)


async def delete_named(pg, name, confirm_text):
    rows = pg.locator(ITEM)
    n = await rows.count()
    for i in range(n):
        if (await rows.nth(i).inner_text()).split("\n")[0].strip() == name:
            await pg.locator(TRASH).nth(i).click(); await pg.wait_for_timeout(800)
            if confirm_text:
                await pg.locator(SHEET).get_by_text(confirm_text, exact=True).first.click(); await pg.wait_for_timeout(1500)
            return True
    return False


async def bepari_bn(b):
    ctx, pg, errs, token = await new_context(b, "bn", "bd")
    await open_calc(pg, "bepari", "bn")
    boxes = pg.locator(BOX)
    # typing pause still there
    await boxes.nth(0).click(); await pg.keyboard.type("12")
    await boxes.nth(1).click()
    for d in "150":
        await pg.keyboard.type(d); await pg.wait_for_timeout(1000)
    await pg.wait_for_timeout(1500)
    ok("Bepari: cursor still waits after typing", await pg.evaluate(ACTIVE) == 1)
    await pg.wait_for_timeout(1700)
    ok("Bepari: and moves on after ~3 s", await pg.evaluate(ACTIVE) == 2)
    await pg.locator('input[placeholder*="("]').first.fill("কাতলা ক")
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
    ok("Bepari: + saves and clears", all(v == "" for v in await pg.evaluate(VALS)))
    await save_bepari(pg, "রুই খ", "10", "100", "নতুন হিসাব")
    await save_bepari(pg, "মৃগেল গ", "5", "80", "নতুন হিসাব")

    # main page: no saved list
    shown = [n for n in ("কাতলা ক", "রুই খ", "মৃগেল গ") if await pg.get_by_text(n, exact=True).locator("visible=true").count() > 0]
    ok("Bepari: main page shows no saved calculation names", not shown, shown)
    ok("Bepari: main page has no saved-record rows", await pg.locator(ITEM).count() == 0)
    await pg.screenshot(path=f"{SHOTS}/bepari-1-main-no-list.png", full_page=True)

    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: the slide-up list has all three", sorted(await item_names(pg)) == sorted(["কাতলা ক", "রুই খ", "মৃগেল গ"]), await item_names(pg))
    ok("Bepari: every row has a trash button", await pg.locator(TRASH).count() == 3)
    # delete the third one: the delete also sends the other two up to the server
    await delete_named(pg, "মৃগেল গ", None)
    sheet = pg.locator(SHEET)
    ok("Bepari: trash opens the slide-up delete sheet", await sheet.count() > 0 and "হিসাব মুছবেন?" in await sheet.inner_text(),
       (await sheet.inner_text())[:200] if await sheet.count() else "")
    ok("Bepari: the sheet names the calculation", await sheet.count() > 0 and "মৃগেল গ" in await sheet.inner_text())
    await pg.screenshot(path=f"{SHOTS}/bepari-2-delete-sheet.png")
    await sheet.get_by_text("বাতিল", exact=True).first.click(); await pg.wait_for_timeout(900)
    ok("Bepari: Cancel keeps it", len(await item_names(pg)) == 3, await item_names(pg))
    await delete_named(pg, "মৃগেল গ", "মুছুন")
    ok("Bepari: Delete removes exactly that one", sorted(await item_names(pg)) == sorted(["কাতলা ক", "রুই খ"]), await item_names(pg))
    ok("Bepari: delete sheet closed", await pg.locator(SHEET).count() == 0)
    await pg.screenshot(path=f"{SHOTS}/bepari-3-after-delete.png")
    good, got = await wait_server(token, ["কাতলা ক", "রুই খ"])
    ok("Bepari: server has the two kept ones, not the deleted one", good, got)

    # delete one that is already on the server
    await delete_named(pg, "কাতলা ক", "মুছুন")
    ok("Bepari: deleted from the list", await item_names(pg) == ["রুই খ"], await item_names(pg))
    good, got = await wait_server(token, ["রুই খ"])
    ok("Bepari: and its server copy is gone", good, got)
    await close_sheet(pg)

    # reload: still gone
    await open_calc(pg, "bepari", "bn")
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: after reload only the kept one is listed", await item_names(pg) == ["রুই খ"], await item_names(pg))

    # offline delete
    await ctx.set_offline(True)
    await pg.evaluate("window.dispatchEvent(new Event('offline'))")
    await delete_named(pg, "রুই খ", "মুছুন")
    ok("Bepari: offline delete hides it at once", await item_names(pg) == [], await item_names(pg))
    await pg.wait_for_timeout(1500)
    ok("Bepari: server copy still there while offline", server_names(token) == ["রুই খ"], server_names(token))
    await ctx.set_offline(False)
    await pg.evaluate("window.dispatchEvent(new Event('online'))")
    good, got = await wait_server(token, [], secs=25)
    ok("Bepari: back online, the server copy is deleted too", good, got)
    await close_sheet(pg)
    await open_calc(pg, "bepari", "bn")
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: it doesn't come back after reload", await item_names(pg) == [], await item_names(pg))
    await close_sheet(pg)

    # delete the one open on screen
    await save_bepari(pg, "পাঙাস ঘ", "7", "60", "নতুন হিসাব")
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    await pg.locator(ITEM).first.click(); await pg.wait_for_timeout(1200)
    v = await pg.evaluate(VALS)
    ok("Bepari: tapping a saved one opens it", v[:2] == ["7", "60"], v)
    await boxes.nth(2).click(); await pg.keyboard.type("3")
    await boxes.nth(3).click(); await pg.keyboard.type("50")
    await pg.wait_for_timeout(300)
    await pg.get_by_text("আপডেট করুন", exact=True).first.click(); await pg.wait_for_timeout(1000)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: Update keeps one entry", await item_names(pg) == ["পাঙাস ঘ"], await item_names(pg))
    await delete_named(pg, "পাঙাস ঘ", "মুছুন")
    ok("Bepari: deleted the open one", await item_names(pg) == [])
    await close_sheet(pg)
    ok("Bepari: screen cleared after deleting the open one", all(x == "" for x in await pg.evaluate(VALS)), await pg.evaluate(VALS))
    ok("Bepari: no Update button left", await pg.get_by_text("আপডেট করুন", exact=True).count() == 0)
    await save_bepari(pg, "নতুন ঙ", "4", "40", "নতুন হিসাব")
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Bepari: a new save after that works", await item_names(pg) == ["নতুন ঙ"], await item_names(pg))
    await close_sheet(pg)
    ok("Bepari: no page errors", not errs, errs)
    await ctx.close()


async def arat_bn(b):
    ctx, pg, errs, token = await new_context(b, "bn", "ad")
    await open_calc(pg, "arat", "bn")
    trig = pg.locator('[data-testid="arat-fish-trigger"]').first
    tb = await trig.bounding_box()
    await trig.click(); await pg.wait_for_timeout(700)
    mb = await pg.locator('[data-testid="arat-fish-menu"]').bounding_box()
    ok("Arat: fish list still opens at the left, under the fish box", tb and mb and abs(mb["x"] - tb["x"]) < 6 and abs(mb["y"] - (tb["y"] + tb["height"])) < 12, (tb, mb))
    await pg.get_by_text("রুই", exact=True).last.click(); await pg.wait_for_timeout(400)
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("120")
    await boxes.nth(1).click(); await pg.keyboard.type("25")
    await pg.wait_for_timeout(300)
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1200)
    ok("Arat: + clears", all(v == "" for v in await pg.evaluate(VALS)))
    ok("Arat: main page has no saved-record rows", await pg.locator(ITEM).count() == 0)
    await pg.screenshot(path=f"{SHOTS}/arat-1-main-no-list.png", full_page=True)
    await open_sheet(pg, "সংরক্ষিত হিসাব")
    ok("Arat: list has the saved one", await pg.locator(ITEM).count() == 1)
    await pg.locator(TRASH).first.click(); await pg.wait_for_timeout(800)
    sheet = pg.locator(SHEET)
    ok("Arat: delete sheet opens", await sheet.count() > 0 and "হিসাব মুছবেন?" in await sheet.inner_text())
    await pg.screenshot(path=f"{SHOTS}/arat-2-delete-sheet.png")
    await sheet.get_by_text("মুছুন", exact=True).first.click(); await pg.wait_for_timeout(1500)
    ok("Arat: deleted", await pg.locator(ITEM).count() == 0)
    ok("Arat: no page errors", not errs, errs)
    await ctx.close()


async def english(b, which):
    ctx, pg, errs, token = await new_context(b, "en", "e" + which[:2])
    await open_calc(pg, which, "en")
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("12")
    await boxes.nth(1).click(); await pg.keyboard.type("150")
    await pg.wait_for_timeout(300)
    await pg.locator('[aria-label="New calculation"]').first.click(); await pg.wait_for_timeout(1200)
    ok(f"{which} EN: main page has no saved-record rows", await pg.locator(ITEM).count() == 0)
    await open_sheet(pg, "Saved records")
    ok(f"{which} EN: list shows the record", await pg.locator(ITEM).count() == 1)
    ok(f"{which} EN: trash button labelled", await pg.locator('[aria-label="Delete calculation"]:visible').count() == 1)
    await pg.locator(TRASH).first.click(); await pg.wait_for_timeout(800)
    sheet = pg.locator(SHEET)
    txt = await sheet.inner_text() if await sheet.count() else ""
    ok(f"{which} EN: sheet in English", "Delete this calculation?" in txt and "Cancel" in txt and "Delete" in txt and "for good" in txt, txt[:200])
    await pg.screenshot(path=f"{SHOTS}/{which}-en-delete-sheet.png")
    await sheet.get_by_text("Delete", exact=True).first.click(); await pg.wait_for_timeout(1500)
    ok(f"{which} EN: deleted", await pg.locator(ITEM).count() == 0)
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
print(f"check-calc-delete-web: {len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
