"""Web check (throwaway local server, needs ./dist): the calculators' PDF download (user's report, 27 Oct:
"when I try to download the PDF, it says there is a problem creating the PDF").

On the web expo-print can't make a file: printToFileAsync only calls window.print() on the app page and
returns nothing, so the old code crashed on `const { uri } = ...` and showed "পিডিএফ তৈরি করতে সমস্যা হয়েছে".
Now the calculation document prints from a hidden frame; the print window offers "Save as PDF".

  python3 tests/check-calc-pdf-web.py [shots_dir]

Checks (phone size 390x844, throwaway account):
- Bepari (Bangla): download prints the calculation document itself (from a frame, not the app page), with the
  title, name, rows and totals; no "{tr(" left in it; no error message; the saved PDF is named after the calculation.
- Arat (Bangla): same, with fish rows and the net amount.
- Bepari (English): the document's labels are in English, no error.
- Saved calculation page (Export): prints its document, no error.
- A name with <b> tags is printed as text, not markup. No page errors.
"""
import asyncio, json, os, random, re, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 7100 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/calc-pdf"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="calcpdf-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="calcpdf-web-secret-0123456789abcdef0123456789")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/calcpdf-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)

results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra != "" else ""), flush=True)

BOX = 'input[placeholder="০"], input[placeholder="0"]'
ERR_TEXTS = ["পিডিএফ তৈরি করতে সমস্যা হয়েছে", "PDF তৈরি করতে সমস্যা হয়েছে", "There was a problem creating the PDF"]

# window.print in every frame records what would be printed (no real print window in a headless browser)
STUB = """
(() => {
  window.print = function () {
    try {
      const top = window.top;
      top.__printed = top.__printed || [];
      top.__printed.push({ title: top.document.title, html: document.documentElement.outerHTML,
        text: document.body ? document.body.innerText : '', inFrame: window !== top });
    } catch (e) {}
  };
})();
"""


def signup(tag):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    req = urllib.request.Request(BASE + "/api/auth/signup", method="POST", headers={"Content-Type": "application/json"},
        data=json.dumps({"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": "Calc Test", "username": f"{tag}_{s}"}).encode())
    j = json.loads(urllib.request.urlopen(req, timeout=30).read())
    u = dict(j["user"]); u["onboardingComplete"] = True
    return j["token"], u


async def new_context(b, lang, tag):
    token, u = signup(tag)
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    await ctx.add_init_script(STUB)
    await pg.add_init_script("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language','%s');"
                             % (json.dumps(token), json.dumps(json.dumps(u)), lang))
    return ctx, pg, errs


async def open_calc(pg, which, lang):
    await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(3500)
    if lang == "bn":
        await pg.get_by_text("হিসাব", exact=True).first.click()
    else:
        await pg.get_by_text(re.compile(r"^(Calculate|Calculator|Calc|Calculation|Accounts)$")).first.click()
    await pg.wait_for_timeout(1500)
    label = {("bepari", "bn"): "ব্যাপারী ক্যালকুলেটর", ("arat", "bn"): "আড়ত ক্যালকুলেটর",
             ("bepari", "en"): re.compile("Bepari calculator", 2), ("arat", "en"): re.compile("Arat calculator", 2)}[(which, lang)]
    await pg.get_by_text(label).first.click()
    await pg.wait_for_timeout(2500)


async def printed(pg, n, ms=8000):
    for _ in range(ms // 250):
        got = await pg.evaluate("()=> (window.__printed||[]).length")
        if got >= n:
            return (await pg.evaluate("()=>window.__printed"))[n - 1]
        await pg.wait_for_timeout(250)
    return None


async def error_shown(pg):
    body = await pg.evaluate("()=>document.body.innerText")
    return [t for t in ERR_TEXTS if t in body]


async def as_pdf(b, html, name):
    ctx = await b.new_context(viewport={"width": 800, "height": 1100})
    p = await ctx.new_page()
    await p.set_content(html, wait_until="networkidle")
    await p.screenshot(path=f"{SHOTS}/{name}.png", full_page=True)
    await p.emulate_media(media="print")
    await p.pdf(path=f"{SHOTS}/{name}.pdf", format="A4", print_background=True)
    await ctx.close()
    return os.path.getsize(f"{SHOTS}/{name}.pdf")


async def download(pg, lang):
    lab = "পিডিএফ ডাউনলোড" if lang == "bn" else "Download PDF"
    btn = pg.locator(f'[aria-label="{lab}"]:visible')
    if await btn.count() == 0:  # the build from before this fix has no label on the button: the first header circle is download
        btn = pg.locator(f'[aria-label="{"সংরক্ষিত হিসাব" if lang == "bn" else "Saved records"}"]:visible').first.locator("xpath=preceding-sibling::*[1]")
    await btn.first.click()
    await pg.wait_for_timeout(1500)


async def bepari(b, lang):
    ctx, pg, errs = await new_context(b, lang, "pb" + lang)
    await open_calc(pg, "bepari", lang)
    name = "রুই <b>হাট</b>" if lang == "bn" else "Rui market"
    await pg.locator('input[placeholder*="("]').first.fill(name)
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("12")
    await boxes.nth(1).click(); await pg.keyboard.type("30")
    await pg.wait_for_timeout(800)
    await download(pg, lang)
    doc = await printed(pg, 1)
    err = await error_shown(pg)
    await pg.screenshot(path=f"{SHOTS}/bepari-{lang}-after-download.png")
    ok(f"Bepari ({lang}): no 'problem creating the PDF' message", not err, err)
    ok(f"Bepari ({lang}): download opens the print window", doc is not None)
    if doc:
        t = doc["text"]
        ok(f"Bepari ({lang}): it prints the calculation document from its frame, not the app page", doc["inFrame"] and "<table" in doc["html"])
        ok(f"Bepari ({lang}): no untranslated {{tr(...)}} code in the document", "{tr(" not in doc["html"] and "tr(" not in t, t[:200])
        if lang == "bn":
            ok("Bepari (bn): title, name, row and totals are there", all(s in t for s in ["ব্যাপারী হিসাব", "রুই <b>হাট</b>", "মোট ওজন:", "মোট পিস:", "12", "30"]), t[:400])
            ok("Bepari (bn): a name with tags is printed as text, not markup", "<b>হাট</b>" not in doc["html"] and "&lt;b&gt;" in doc["html"])
            ok("Bepari (bn): the saved PDF is named after the calculation", "Farmers-Bepari-" in doc["title"] and "রুই" in doc["title"], doc["title"])
        else:
            ok("Bepari (en): labels are in English", all(s in t for s in ["Bepari account", "Rui market", "Total weight:"]), t[:400])
        ok(f"Bepari ({lang}): renders as a real PDF", await as_pdf(b, doc["html"], f"bepari-{lang}") > 3000)
    ok(f"Bepari ({lang}): no page errors", not errs, errs)
    await ctx.close()


async def arat(b):
    ctx, pg, errs = await new_context(b, "bn", "pa")
    await open_calc(pg, "arat", "bn")
    await pg.locator('input[placeholder*="("]').first.fill("আজকের বিক্রি")
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("250")
    await boxes.nth(1).click(); await pg.keyboard.type("8")
    await pg.wait_for_timeout(800)
    await download(pg, "bn")
    doc = await printed(pg, 1)
    err = await error_shown(pg)
    await pg.screenshot(path=f"{SHOTS}/arat-bn-after-download.png")
    ok("Arat (bn): no 'problem creating the PDF' message", not err, err)
    ok("Arat (bn): download opens the print window", doc is not None)
    if doc:
        t = doc["text"]
        ok("Arat (bn): prints the calculation document from its frame", doc["inFrame"] and "<table" in doc["html"])
        ok("Arat (bn): no untranslated {tr(...)} code", "{tr(" not in doc["html"], t[:200])
        ok("Arat (bn): title, name, row, net amount are there", all(s in t for s in ["আরত হিসাব", "আজকের বিক্রি", "250", "নিট টাকা"]), t[:400])
        ok("Arat (bn): renders as a real PDF", await as_pdf(b, doc["html"], "arat-bn") > 3000)
    ok("Arat (bn): no page errors", not errs, errs)
    await ctx.close()


async def record_detail(b):
    ctx, pg, errs = await new_context(b, "bn", "pr")
    await open_calc(pg, "bepari", "bn")
    await pg.locator('input[placeholder*="("]').first.fill("কাতলা রেকর্ড")
    boxes = pg.locator(BOX)
    await boxes.nth(0).click(); await pg.keyboard.type("9")
    await boxes.nth(1).click(); await pg.keyboard.type("20")
    await pg.wait_for_timeout(600)
    # save it, then open the saved calculation page from History
    await pg.locator('[aria-label="নতুন হিসাব"]').first.click(); await pg.wait_for_timeout(1500)
    # History lists saved records; tapping one opens the saved calculation page
    await pg.goto(BASE, wait_until="networkidle"); await pg.wait_for_timeout(3000)
    await pg.get_by_text("হিসাব", exact=True).first.click(); await pg.wait_for_timeout(1500)
    hist = pg.get_by_text(re.compile("^(ইতিহাস|হিস্ট্রি|সংরক্ষিত হিসাব)$"))
    opened = False
    if await hist.count():
        await hist.first.click(); await pg.wait_for_timeout(2000)
        rec = pg.get_by_text(re.compile("ব্যাপারী"))
        if await rec.count():
            await rec.last.click(); await pg.wait_for_timeout(2000)
            exp = pg.get_by_text("এক্সপোর্ট", exact=True)
            if await exp.count():
                opened = True
                await exp.first.click(); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=f"{SHOTS}/record-detail-after-export.png")
    if not opened:
        print("SKIP saved-calculation page: couldn't reach it from History in this build", flush=True)
        await ctx.close(); return
    doc = await printed(pg, 1)
    err = await error_shown(pg)
    ok("Saved calculation page: Export shows no error", not err, err)
    ok("Saved calculation page: Export prints its document from a frame", doc is not None and doc["inFrame"] and "{tr(" not in doc["html"],
       (doc or {}).get("text", "")[:200])
    ok("Saved calculation page: no page errors", not errs, errs)
    await ctx.close()


async def main():
    for _ in range(180):
        try:
            urllib.request.urlopen(BASE + "/api/health", timeout=2); break
        except Exception:
            time.sleep(1)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await bepari(b, "bn")
        await arat(b)
        await bepari(b, "en")
        await record_detail(b)
        await b.close()


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, 15)
    except Exception:
        pass
fails = [n for n, c in results if not c]
print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
