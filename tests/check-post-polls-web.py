"""Web check (throwaway local server, needs ./dist): polls in the community feed, English + Bangla,
320/360/390 wide.

  python3 tests/check-post-polls-web.py [shots_dir]

- The new-post page has a "Create poll" button. It opens a poll editor with a question (title),
  options A and B, "Add option" up to 6 and a remove button past 2. Post stays off until the poll
  is complete.
- The poll shows in the feed with its title and radio buttons (role=radio). Picking one and
  tapping Vote shows the results: % and the vote count for each option, the total, and your vote.
- Votes from other people show after a reload; tapping another option moves your vote.
- The post page shows the same poll with the comment box, and a comment can be posted.
- No page errors and nothing wider than the screen.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/post-polls"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="polls-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="polls-web-secret-0123456789abcdef0123456789ab")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/polls-web-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)
for _ in range(120):
    try:
        urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("server did not start")


def api(method, path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


def signup(tag):
    s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
    return api("POST", "/api/auth/signup", {"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": tag.title(), "username": f"{tag}_{s}"})


T = {
    "en": {"fab": "Create post", "create": "Create poll", "q": "Which fish feed is better?", "opts": ["Mega feed", "Quality feed", "ACI feed"],
           "vote": "Vote", "total1": "1 vote total", "total3": "3 votes total", "pill": "Poll", "add": "Add option", "change": "Tap another option",
           "letters": ["A.", "B.", "C."], "comment": "Quality feed is good for tilapia"},
    "bn": {"fab": "পোস্ট করুন", "create": "জরিপ তৈরি করুন", "q": "কোন মাছের খাবার ভালো?", "opts": ["মেগা ফিড", "কোয়ালিটি ফিড", "এসিআই ফিড"],
           "vote": "ভোট দিন", "total1": "মোট ১ ভোট", "total3": "মোট ৩ ভোট", "pill": "জরিপ", "add": "অপশন যোগ করুন", "change": "অন্য অপশনে চাপ",
           "letters": ["ক.", "খ.", "গ."], "comment": "তেলাপিয়ার জন্য কোয়ালিটি ফিড ভালো"},
}
results = {}
fails = []


def check(key, cond, label):
    results.setdefault(key, {})[label] = bool(cond)
    if not cond:
        fails.append(f"{key}: {label}")


def init_script(user, lang):
    u = dict(user["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(user["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        only = os.environ.get("ONLY")
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                if only and only != f"{lang}-{w}":
                    continue
                key = f"{lang}-{w}"
                L = T[lang]
                ann, bob, cat = signup("ann"), signup("bob"), signup("cat")
                ctx = await b.new_context(viewport={"width": w, "height": 820}, device_scale_factor=2)
                pg = await ctx.new_page()
                errors = []
                pg.on("pageerror", lambda e: errors.append(str(e)))
                await pg.add_init_script(init_script(ann, lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_function("()=>window.__nav && window.__nav.isReady()", timeout=30000)
                await pg.wait_for_timeout(1500)

                # Open the new-post page and switch to a poll
                await pg.get_by_role("button", name=L["fab"], exact=True).last.click()
                await pg.wait_for_timeout(700)
                btn = pg.get_by_test_id("create-poll-button")
                check(key, await btn.is_visible(), "new-post page shows Create poll")
                check(key, L["create"] in (await btn.inner_text()), "Create poll button text")
                submit = pg.get_by_test_id("new-post-submit")
                await btn.click()
                await pg.wait_for_timeout(400)
                check(key, await pg.get_by_test_id("poll-editor").is_visible(), "poll editor opens")
                check(key, await pg.get_by_test_id("poll-option-input-0").is_visible() and await pg.get_by_test_id("poll-option-input-1").is_visible(), "starts with 2 options")
                dis0 = await submit.get_attribute("aria-disabled")
                check(key, dis0 == "true", "Post is off while the poll is empty")
                await pg.get_by_test_id("poll-question-input").fill(L["q"])
                await pg.get_by_test_id("poll-option-input-0").fill(L["opts"][0])
                await pg.get_by_test_id("poll-option-input-1").fill(L["opts"][1])
                await pg.get_by_test_id("poll-add-option").click()
                await pg.get_by_test_id("poll-option-input-2").fill(L["opts"][2])
                for _ in range(3):
                    await pg.get_by_test_id("poll-add-option").click()
                check(key, await pg.get_by_test_id("poll-option-input-5").is_visible() and await pg.get_by_test_id("poll-add-option").count() == 0, "up to 6 options, then Add option hides")
                # remove the 3 empty extra options again (remove last one each time)
                for i in (5, 4, 3):
                    row = pg.get_by_test_id(f"poll-option-input-{i}").locator("xpath=..")
                    await row.get_by_role("button").click()
                check(key, await pg.get_by_test_id("poll-option-input-3").count() == 0, "extra options can be removed")
                await pg.wait_for_timeout(200)
                ed_w = await pg.evaluate("()=>document.documentElement.scrollWidth")
                check(key, ed_w <= w, f"editor fits the screen ({ed_w}px)")
                await pg.screenshot(path=f"{SHOTS}/{key}-1-editor.png")
                check(key, (await submit.get_attribute("aria-disabled")) != "true", "Post turns on when the poll is complete")
                await submit.click()
                await pg.wait_for_timeout(2500)

                # Poll in the feed
                poll = pg.get_by_test_id("post-poll").first
                check(key, await poll.is_visible(), "poll shows in the feed")
                txt = await poll.inner_text()
                check(key, L["q"] in txt and L["pill"] in txt, "feed poll shows the title and Poll label")
                check(key, all(l in txt for l in L["letters"]) and all(o in txt for o in L["opts"]), "options lettered A/B/C")
                radios = poll.get_by_role("radio")
                check(key, await radios.count() == 3, "three radio buttons")
                await pg.screenshot(path=f"{SHOTS}/{key}-2-feed.png")
                vote = pg.get_by_test_id("post-poll-vote").first
                check(key, (await vote.get_attribute("aria-disabled")) == "true", "Vote is off until an option is picked")
                await pg.get_by_test_id("post-poll-option-b").first.click()
                await pg.wait_for_timeout(300)
                ac = await pg.get_by_test_id("post-poll-option-b").first.evaluate("e=>e.getAttribute('aria-checked')+'/'+e.getAttribute('role')")
                check(key, ac.startswith("true"), f"picked option is checked ({ac})")
                await vote.click()
                await pg.wait_for_timeout(1500)
                txt = await poll.inner_text()
                check(key, L["total1"] in txt and "100%" in txt.replace("১০০", "100"), "results show after voting (1 vote, 100%)")
                check(key, L["change"] in txt, "says you can change your vote")
                await pg.screenshot(path=f"{SHOTS}/{key}-3-voted.png")

                # Others vote; counts after reload
                comm = api("GET", "/api/communities")
                comm = comm if isinstance(comm, list) else comm.get("communities", [])
                feed = []
                for c in comm:
                    feed = api("GET", f"/api/posts?communityId={c['id']}", token=ann["token"])
                    if any(x.get("poll") for x in feed):
                        break
                pid = next(x["id"] for x in feed if x.get("poll") and x["poll"]["question"] == L["q"])
                api("POST", f"/api/posts/{pid}/poll/vote", {"optionId": "a"}, bob["token"])
                api("POST", f"/api/posts/{pid}/poll/vote", {"optionId": "b"}, cat["token"])
                await pg.reload(wait_until="networkidle")
                await pg.wait_for_timeout(2500)
                poll = pg.get_by_test_id("post-poll").first
                txt = await poll.inner_text()
                cnt_b = await pg.get_by_test_id("post-poll-count-b").first.inner_text()
                cnt_a = await pg.get_by_test_id("post-poll-count-a").first.inner_text()
                check(key, L["total3"] in txt, "3 votes total after others vote")
                check(key, cnt_b.startswith("2" if lang == "en" else "২") and cnt_a.startswith("1" if lang == "en" else "১"), f"per-option counts A={cnt_a} B={cnt_b}")
                # Change vote to C
                await pg.get_by_test_id("post-poll-option-c").first.click()
                await pg.wait_for_timeout(1500)
                cnt_b = await pg.get_by_test_id("post-poll-count-b").first.inner_text()
                cnt_c = await pg.get_by_test_id("post-poll-count-c").first.inner_text()
                check(key, cnt_b.startswith("1" if lang == "en" else "১") and cnt_c.startswith("1" if lang == "en" else "১") and L["total3"] in (await poll.inner_text()),
                      "tapping C moves the vote (B 1, C 1, total still 3)")
                fw = await pg.evaluate("()=>document.documentElement.scrollWidth")
                check(key, fw <= w, f"feed fits the screen ({fw}px)")
                await pg.screenshot(path=f"{SHOTS}/{key}-4-changed.png")
                server_poll = api("GET", f"/api/posts/{pid}", token=ann["token"])["poll"]
                check(key, server_poll["myVote"] == "c" and [o["votes"] for o in server_poll["options"]] == [1, 1, 1], "server has the moved vote")

                # Post page: same poll + comments
                await pg.get_by_test_id("post-poll-question").first.click()
                await pg.wait_for_timeout(800)
                route = await pg.evaluate("()=>window.__nav.getCurrentRoute()?.name")
                check(key, route != "PostDetail", f"tapping inside the poll doesn't open the post ({route})")
                if route == "PostDetail":
                    await pg.evaluate("()=>window.__nav.goBack()")
                    await pg.wait_for_timeout(1200)
                cbtn = pg.get_by_role("button", name=("Comment" if lang == "en" else "মন্তব্য"), exact=True)
                if not await cbtn.count():
                    print("DEBUG route", await pg.evaluate("()=>window.__nav.getCurrentRoute()?.name"))
                    print("DEBUG buttons", await pg.evaluate("()=>[...document.querySelectorAll('[role=button]')].map(e=>e.getAttribute('aria-label')||e.innerText.slice(0,20)).join(' | ')"))
                    await pg.screenshot(path=f"{SHOTS}/{key}-debug.png")
                await cbtn.first.click()
                await pg.wait_for_timeout(1800)
                on_detail = await pg.evaluate("()=>window.__nav.getCurrentRoute()?.name")
                check(key, on_detail == "PostDetail", f"tapping the post opens the post page ({on_detail})")
                dpoll = pg.get_by_test_id("post-poll").last
                dtxt = await dpoll.inner_text() if await dpoll.count() else ""
                check(key, L["q"] in dtxt and L["total3"] in dtxt, "post page shows the poll with counts")
                box = pg.locator("textarea:visible, input[type=text]:visible").last
                await box.fill(L["comment"], timeout=8000)
                await pg.wait_for_timeout(300)
                await pg.get_by_test_id("comment-send").click()
                await pg.wait_for_timeout(1500)
                comments = api("GET", f"/api/posts/{pid}/comments")
                check(key, any(c.get("body") == L["comment"] or c.get("content") == L["comment"] for c in comments), "a comment can be posted on the poll")
                dw = await pg.evaluate("()=>document.documentElement.scrollWidth")
                check(key, dw <= w, f"post page fits the screen ({dw}px)")
                await pg.screenshot(path=f"{SHOTS}/{key}-5-detail.png")
                check(key, not errors, f"no page errors {errors[:2]}")
                await ctx.close()
        await b.close()


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, 15)
    except Exception:
        srv.terminate()

for k, v in results.items():
    print(k, "PASS" if all(v.values()) else "FAIL", sum(v.values()), "/", len(v))
for f in fails:
    print("FAIL ", f)
print("\nRESULT:", "PASS" if not fails else f"{len(fails)} failed")
sys.exit(1 if fails else 0)
