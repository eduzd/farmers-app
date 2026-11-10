"""Web check (throwaway local server, needs ./dist): Feed Making Calculator.

  python3 tests/check-feed-mix-web.py [shots_dir]

Bangla and English, phone 390x844 and computer 1280x900, light and dark:
- Calculate home shows the Feed Making Calculator card beside Arat / Bepari, and it opens.
- Ingredient dropdown: DORB from the list fills protein 15; a typed custom ingredient is used; search works.
- Rows: 600 kg DORB @ 32, 300 kg mustard cake @ 55 (35 %), 100 kg custom @ 140 (protein 55 typed).
  Milling 250 per 100 kg, loss 2 %, bag 25 kg -> total 1,000 kg, ingredient cost 49,700, milling 2,500,
  total 52,200, loss 20 kg, usable 980 kg, 39.2 bags, cost/bag 1,331.63, protein 25.0 %.
- Basis 0 does not crash and shows the warning. Large numbers (12,500.75 kg) work.
- AI check with no AI key shows the friendly message.
- Save -> 1 record; offline edit + Update -> still 1 record; reload; reopen from bookmark list shows the rows;
  delete -> 0 records. PDF prints the calculation document with rows and totals. No page errors.
"""
import asyncio, json, os, random, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 7300 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/feed-mix"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="feedmix-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", GOOGLE_API_KEY="", GEMINI_API_KEY="", OPENAI_API_KEY="", OPENROUTER_API_KEY="",
           JWT_SECRET="feedmix-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/feedmix-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)

results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  {str(extra)[:300]}" if (extra != "" and not cond) else ""), flush=True)

T = lambda tid: f'[data-testid="{tid}"]'
STUB = """
(() => {
  window.print = function () {
    try { const top = window.top; top.__printed = top.__printed || [];
      top.__printed.push({ text: document.body ? document.body.innerText : '', inFrame: window !== top }); } catch (e) {}
  };
})();
"""

def signup(tag):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    req = urllib.request.Request(BASE + "/api/auth/signup", method="POST", headers={"Content-Type": "application/json"},
        data=json.dumps({"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": "Feed Test", "username": f"{tag}_{s}"}).encode())
    j = json.loads(urllib.request.urlopen(req, timeout=30).read())
    u = dict(j["user"]); u["onboardingComplete"] = True
    return j["token"], u


def bn(s):
    return s.translate(str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯"))


def norm(s):
    s = (s or "").translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))
    return re.sub(r"\s+", " ", s)


async def text(pg, tid):
    loc = pg.locator(T(tid) + ":visible")
    return norm(await loc.first.inner_text()) if await loc.count() else None


async def saved_count(pg):
    return await pg.locator(T("calc-saved-item") + ":visible").count()


async def open_feed(pg, lang):
    await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(3500)
    if lang == "bn":
        await pg.get_by_text("হিসাব", exact=True).first.click()
    else:
        await pg.get_by_text(re.compile(r"^(Calculate|Calculator|Calc|Calculation|Accounts)$")).first.click()
    await pg.wait_for_timeout(1800)
    home = await pg.evaluate("()=>document.body.innerText")
    card = "খাদ্য তৈরির ক্যালকুলেটর" if lang == "bn" else "Feed Making Calculator"
    arat = "আড়ত ক্যালকুলেটর" if lang == "bn" else "Arat Calculator"
    ok(f"[{lang}] calculate home has the card next to Arat", card.lower() in home.lower() and arat.lower() in home.lower())
    await pg.get_by_text(re.compile("^" + card + "$", re.I)).first.click()
    await pg.wait_for_timeout(2500)


async def pick(pg, row, query, option_text=None, custom=False):
    await pg.locator(T("feedmix-ingredient-trigger") + ":visible").nth(row).click()
    await pg.wait_for_timeout(600)
    await pg.locator(T("feedmix-ingredient-search") + ":visible").fill(query)
    await pg.wait_for_timeout(400)
    if custom:
        await pg.locator(T("feedmix-ingredient-custom") + ":visible").click()
    else:
        await pg.locator(T("feedmix-ingredient-option") + ":visible").filter(has_text=option_text or query).first.click()
    await pg.wait_for_timeout(500)


async def fill_row(pg, row, kg, price, protein=None):
    if protein is not None:
        await pg.locator(T("feedmix-protein-input") + ":visible").nth(row).fill(protein)
    await pg.locator(T("feedmix-kg") + ":visible").nth(row).fill(kg)
    await pg.locator(T("feedmix-price") + ":visible").nth(row).fill(price)
    await pg.wait_for_timeout(300)


async def run(b, lang, w, h, dark):
    tag = f"[{lang} {w} {'dark' if dark else 'light'}]"
    token, u = signup("fm" + lang)
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=w < 600, has_touch=w < 600,
                              color_scheme="dark" if dark else "light")
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await ctx.add_init_script(STUB)
    theme = "dark" if dark else "light"
    await pg.add_init_script("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','%s'); localStorage.setItem('theme_preference','%s'); localStorage.setItem('theme_preference_json',JSON.stringify('%s'));"
                             % (json.dumps(token), json.dumps(json.dumps(u)), lang, theme, theme))
    await open_feed(pg, lang)
    ok(f"{tag} screen opens with one row", await pg.locator(T("feedmix-row") + ":visible").count() == 1)

    # row 1: DORB from the list -> protein 15
    await pick(pg, 0, "DORB", None)
    p1 = await pg.locator(T("feedmix-protein-input") + ":visible").nth(0).input_value()
    ok(f"{tag} DORB from the list fills protein 15", p1 == "15", p1)
    await fill_row(pg, 0, "600", "32")
    ok(f"{tag} new row appears after kg + price", await pg.locator(T("feedmix-row") + ":visible").count() == 2)
    rt = await text(pg, "feedmix-row-total")
    ok(f"{tag} row total 19,200", rt and "19,200" in rt, rt)
    # row 2: mustard oil cake via search
    await pick(pg, 1, "Mustard" if lang == "en" else "সরিষা", "Mustard oil cake" if lang == "en" else "সরিষা")
    p2 = await pg.locator(T("feedmix-protein-input") + ":visible").nth(1).input_value()
    ok(f"{tag} mustard oil cake fills protein 35", p2 == "35", p2)
    await fill_row(pg, 1, "300", "55")
    # row 3: custom typed ingredient
    await pick(pg, 2, "Shutki guro mix", custom=True)
    trig = norm(await pg.locator(T("feedmix-ingredient-trigger") + ":visible").nth(2).inner_text())
    ok(f"{tag} custom ingredient is used", "Shutki guro mix" in trig, trig)
    await fill_row(pg, 2, "100", "140", protein="55")

    await pg.locator(T("feedmix-milling-charge") + ":visible").fill("250")
    await pg.locator(T("feedmix-milling-basis") + ":visible").fill("100")
    await pg.locator(T("feedmix-loss") + ":visible").fill("2")
    await pg.locator(T("feedmix-bag") + ":visible").fill("25")
    await pg.wait_for_timeout(600)
    want = {"total-kg": "1,000", "ingredient-cost": "49,700", "milling-cost": "2,500", "total-cost": "52,200",
            "loss-kg": "20", "usable-kg": "980", "bags": "39.2", "cost-bag": "1,331.63", "cost-kg": "53.27", "protein": "25"}
    for k, v in want.items():
        got = await text(pg, f"feedmix-out-{k}")
        ok(f"{tag} {k} = {v}", got and v in got, got)
    await pg.screenshot(path=f"{SHOTS}/{lang}-{w}-{theme}-1-filled.png", full_page=True)
    await pg.locator(T("feedmix-breakdown") + ":visible").scroll_into_view_if_needed()
    await pg.screenshot(path=f"{SHOTS}/{lang}-{w}-{theme}-1b-breakdown.png")
    ok(f"{tag} no sideways overflow", await pg.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1"))

    if w < 600 and not dark:
        # zero basis is safe and warned
        await pg.locator(T("feedmix-milling-basis") + ":visible").fill("0")
        await pg.wait_for_timeout(500)
        body = await pg.evaluate("()=>document.body.innerText")
        mc = await text(pg, "feedmix-out-milling-cost")
        ok(f"{tag} basis 0: milling 0 and warning shown", mc and re.sub(r"[^0-9.]", "", mc).strip(".") in ("0", "0.00") and ("cannot be 0" in body or "০ হতে পারে না" in body), mc)
        await pg.locator(T("feedmix-milling-basis") + ":visible").fill("100")
        # AI check with no key -> friendly message
        await pg.locator(T("feedmix-feedtype-chip") + ":visible").first.click()
        await pg.locator(T("feedmix-ai-check") + ":visible").click()
        try:
            await pg.locator(T("feedmix-ai-error") + ":visible").wait_for(timeout=20000)
        except Exception:
            pass
        msg = await text(pg, "feedmix-ai-error")
        ok(f"{tag} AI check without key shows friendly message", msg and ("isn't set up" in msg or "চালু হয়নি" in msg), msg)
        await pg.screenshot(path=f"{SHOTS}/{lang}-{w}-{theme}-2-ai.png", full_page=True)

    # save
    await pg.locator(T("feedmix-name") + ":visible").fill("Batch 1")
    await pg.locator(T("feedmix-save") + ":visible").click()
    await pg.wait_for_timeout(1200)
    save_lab = "সংরক্ষিত হিসাব" if lang == "bn" else "Saved calculations"
    await pg.locator(f'[aria-label="{save_lab}"]:visible').first.click()
    await pg.wait_for_timeout(900)
    ok(f"{tag} saved list has 1 record", await saved_count(pg) == 1, await saved_count(pg))
    await pg.locator(T("calc-saved-backdrop")).first.click(position={"x": 10, "y": 10})
    await pg.wait_for_timeout(700)

    if w < 600 and not dark:
        # offline edit + update keeps one record
        await ctx.set_offline(True)
        await fill_row(pg, 3, "12,500.75", "38.5")
        await pg.wait_for_timeout(500)
        tk = await text(pg, "feedmix-out-total-kg")
        ok(f"{tag} large kg 12,500.75 adds up (13,500.75)", tk and "13,500.75" in tk, tk)
        await pg.locator(T("feedmix-save") + ":visible").click()
        await pg.wait_for_timeout(1200)
        await ctx.set_offline(False)
        await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(3500)
        # after reload the draft is back on screen (same record), open the list
        if not await pg.locator(T("feedmix-row") + ":visible").count():
            await open_feed(pg, lang)
        await pg.locator(f'[aria-label="{save_lab}"]:visible').first.click()
        await pg.wait_for_timeout(900)
        ok(f"{tag} offline Update + reload: still exactly 1 record", await saved_count(pg) == 1, await saved_count(pg))
        item = norm(await pg.locator(T("calc-saved-item") + ":visible").first.inner_text())
        ok(f"{tag} saved record shows the updated weight", "13,500.75" in item, item)
        # new calculation, then reopen the saved one
        await pg.locator(T("calc-saved-backdrop")).first.click(position={"x": 10, "y": 10})
        await pg.wait_for_timeout(500)
        new_lab = "নতুন হিসাব" if lang == "bn" else "New calculation"
        await pg.locator(f'[aria-label="{new_lab}"]:visible').first.click()
        await pg.wait_for_timeout(1200)
        ok(f"{tag} + clears the screen", await pg.locator(T("feedmix-row") + ":visible").count() == 1)
        await pg.locator(f'[aria-label="{save_lab}"]:visible').first.click()
        await pg.wait_for_timeout(900)
        await pg.locator(T("calc-saved-item") + ":visible").first.click()
        await pg.wait_for_timeout(1200)
        n = await pg.locator(T("feedmix-row") + ":visible").count()
        names = norm(" | ".join([await x.inner_text() for x in await pg.locator(T("feedmix-ingredient-trigger") + ":visible").all()]))
        ok(f"{tag} reopened record has its 4 rows (+1 empty)", n == 5 and "Shutki guro mix" in names, (n, names))
        upd = "আপডেট করুন" if lang == "bn" else "Update"
        ok(f"{tag} button says Update", await pg.get_by_text(upd, exact=True).count() > 0)
        # PDF
        pdf_lab = "পিডিএফ ডাউনলোড" if lang == "bn" else "Download PDF"
        await pg.locator(f'[aria-label="{pdf_lab}"]:visible').first.click()
        doc = None
        for _ in range(40):
            got = await pg.evaluate("()=>window.__printed||[]")
            if got:
                doc = got[-1]; break
            await pg.wait_for_timeout(250)
        dt = norm(doc["text"]) if doc else ""
        ok(f"{tag} PDF prints the calculation", doc and doc["inFrame"] and "Shutki guro mix" in dt and "13,500.75" in dt and "Batch 1" in dt, dt[:300])
        title = "খাদ্য তৈরির হিসাব" if lang == "bn" else "Feed making calculation"
        ok(f"{tag} PDF in the right language", title in dt, dt[:120])
        # delete
        await pg.locator(f'[aria-label="{save_lab}"]:visible').first.click()
        await pg.wait_for_timeout(800)
        await pg.locator(T("calc-saved-delete") + ":visible").first.click()
        await pg.wait_for_timeout(700)
        await pg.locator(T("confirm-sheet-ok") + ":visible").first.click()
        await pg.wait_for_timeout(1200)
        ok(f"{tag} delete leaves 0 records", await saved_count(pg) == 0, await saved_count(pg))
        ok(f"{tag} deleting the open record clears the screen", await pg.locator(T("feedmix-row") + ":visible").count() == 1)

    ok(f"{tag} no page errors", not errs, errs[:3])
    await ctx.close()


async def main():
    for _ in range(150):
        try:
            urllib.request.urlopen(BASE + "/api/communities", timeout=2); break
        except Exception:
            time.sleep(1)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang, w, h, dark in [("en", 390, 844, False), ("bn", 390, 844, False), ("en", 1280, 900, True), ("bn", 390, 844, True)]:
            try:
                await run(b, lang, w, h, dark)
            except Exception as e:
                ok(f"[{lang} {w} {dark}] run finished without crashing", False, repr(e)[:300])
        await b.close()

try:
    asyncio.run(main())
finally:
    os.killpg(srv.pid, 15)
p_ = sum(1 for _, c in results if c)
print(f"\n{p_} passed, {len(results) - p_} failed")
sys.exit(0 if p_ == len(results) else 1)
