import os
"""Web check (throwaway local server, needs ./dist): tapping a notification opens where it came from.
English + Bangla, 360 wide (plus 320 / 390 for the comment scroll).

  python3 tests/check-notification-open-web.py [shots_dir]

- Comment notification -> that post, scrolled to that comment (the 12th of 15), highlighted.
- Like -> the post. New follower -> the follower's profile. Message -> that chat.
- Order update -> that order's page with its progress. Someone else's order -> "Not available".
- Warning -> the full message on its own page. Deleted post -> "This post was removed".
- Deleted comment -> its post with "This comment was removed".
- A push-style open (no markedRead) marks that one notification read and leaves the others unread.
No real pushes are sent (PUSH_DISABLED); orders and notices are added straight to the throwaway database.
"""
import asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.request, signal
from playwright.async_api import async_playwright

PORT = 6600 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/notif-open"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="notif-open-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="notif-open-secret-0123456789abcdef0123456789ab")
srv = None


def start():
    global srv
    srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/home/sprite/notif-open-server.log", "a"),
                           stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(180):
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


def api(method, path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return {"_status": e.code, "_body": e.read().decode()[:300]}


start()
s = str(int(time.time() * 1000))[-7:]
mk = lambda tag, name: api("POST", "/api/auth/signup", {"email": f"{tag}{s}@check.test", "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
ann, bob, cat = mk("ann", "Ann"), mk("bob", "Bob Ali"), mk("cat", "Cat")
A, B = ann["token"], bob["token"]
comm = api("GET", "/api/communities", token=A)
cid = (comm if isinstance(comm, list) else comm.get("communities", []))[0]["id"]
post = api("POST", "/api/posts", {"communityId": cid, "content": "My rice field this morning"}, A)
pid = post.get("id") or post["post"]["id"]
comments = [api("POST", f"/api/posts/{pid}/comments", {"body": f"Comment number {i}"}, B) for i in range(1, 16)]
target_cid = str(comments[11]["id"])
api("POST", f"/api/posts/{pid}/like", None, B)
api("POST", f"/api/follows/{ann['user']['id']}", None, B)
api("POST", f"/api/dm/{ann['user']['id']}/messages", {"content": "hello ann, about the rice"}, B)
post2 = api("POST", "/api/posts", {"communityId": cid, "content": "Second post to delete"}, A)
pid2 = post2.get("id") or post2["post"]["id"]
api("POST", f"/api/posts/{pid2}/comments", {"body": "Doomed comment"}, B)
doomed = api("POST", f"/api/posts/{pid}/comments", {"body": "Comment that gets deleted"}, B)
time.sleep(1)
notes = api("GET", "/api/me/notifications", token=A)
notes = notes.get("notifications", notes) if isinstance(notes, dict) else notes
find = lambda pred: next((n for n in notes if pred(n)), None)
n_c5 = find(lambda n: n["type"] == "comment" and n.get("body") == "Comment number 5")
c5_id = str(comments[4]["id"])
n_doomed_post = find(lambda n: n["type"] == "comment" and n.get("body") == "Doomed comment")
api("DELETE", f"/api/posts/{pid2}", None, A)
stop()

# Orders and notices go straight into the throwaway database (no test back door in the server).
items = json.dumps([{"productId": "p1", "name": "Rice seed 5kg", "price": 450, "quantity": 2}])
hist = json.dumps([{"status": "pending", "at": "2026-10-22T10:00:00Z"}, {"status": "confirmed", "at": "2026-10-22T11:00:00Z"}])
node = f"""
import {{ PGlite }} from "@electric-sql/pglite";
const pg = new PGlite({json.dumps(os.path.join(data_dir, 'pglite'))});
await pg.query("INSERT INTO shop_orders (id, user_id, seller_ids, status, total, item_count, data, history, address) VALUES ('ord-77', $1, $2, 'confirmed', 900, 2, $3, $4, $5)",
  [{json.dumps(ann['user']['id'])}, {json.dumps(bob['user']['id'])}, {json.dumps(items)}, {json.dumps(hist)}, JSON.stringify({{ fullName: "Ann", address: "Road 5", city: "Dhaka", phone: "01700000000" }})]);
await pg.query("INSERT INTO shop_orders (id, user_id, seller_ids, status) VALUES ('ord-88', $1, '', 'pending')", [{json.dumps(cat['user']['id'])}]);
const add = (id, type, title, body, data) => pg.query("INSERT INTO app_notifications (id, user_id, type, title, body, data) VALUES ($1, $2, $3, $4, $5, $6)", [id, {json.dumps(ann['user']['id'])}, type, title, body, JSON.stringify(data)]);
await add("n-ord-77", "order", "Order Confirmed", "Your order ord-77 is now Confirmed.", {{ orderId: "ord-77", role: "buyer", status: "confirmed" }});
await add("n-ord-88", "order", "Order Shipped", "Order ord-88 is on its way.", {{ orderId: "ord-88", role: "buyer" }});
await add("n-warn", "warning", "Warning from Farmers", "Please keep posts about farming. Selling fake seeds breaks the community rules.", {{}});
await pg.query("DELETE FROM post_comments WHERE id::text = $1", [{json.dumps(str(doomed['id']))}]);
await pg.close();
"""
open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".notif-open-seed.mjs"), "w").write(node)
subprocess.run(["node", ".notif-open-seed.mjs"], check=True, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.remove(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".notif-open-seed.mjs"))
start()
A = api("POST", "/api/auth/login", {"email": f"ann{s}@check.test", "password": "Check-pass-123"})["token"]
notes = api("GET", "/api/me/notifications", token=A)
notes = notes.get("notifications", notes) if isinstance(notes, dict) else notes
n_doomed = find(lambda n: n["type"] == "comment" and n.get("body") == "Comment that gets deleted")


def init_script(lang):
    u = dict(ann["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(A), json.dumps(json.dumps(u)), json.dumps(lang)))


results, fails = {}, []


def check(key, cond, label):
    results.setdefault(key, {})[label] = bool(cond)
    if not cond:
        fails.append(f"{key}: {label}")


T = {"en": {"removed": "This post was removed", "cgone": "This comment was removed", "na": "Not available on this account"},
     "bn": {"removed": "পোস্টটি সরানো হয়েছে", "cgone": "এই মন্তব্যটি আর নেই", "na": "এই অ্যাকাউন্টে দেখা যাবে না"}}


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang, widths in (("en", (320, 360, 390)), ("bn", (360,))):
            for w in widths:
                key = f"{lang}-{w}"
                ctx = await b.new_context(viewport={"width": w, "height": 780}, device_scale_factor=2)
                pg = await ctx.new_page()
                errors = []
                pg.on("pageerror", lambda e: errors.append(str(e)))
                await pg.add_init_script(init_script(lang))
                await pg.goto(BASE, wait_until="networkidle")
                await pg.wait_for_function("()=>window.__nav && window.__nav.isReady()", timeout=40000)

                async def open_list():
                    await pg.evaluate("()=>window.__nav.navigate('Notifications')")
                    await pg.wait_for_timeout(1500)

                async def tap(text):
                    await open_list()
                    # Only the visible row: other screens in the stack (home bell) can hold the same text, hidden.
                    row = pg.locator(f'text="{text}" >> visible=true').first
                    try:
                        await row.scroll_into_view_if_needed(timeout=8000)
                    except Exception:
                        await pg.screenshot(path=f"{SHOTS}/notif-list-fail-{key}.png")
                        print("LISTTEXT", (await pg.locator("body").inner_text())[:1500])
                        raise
                    await row.click()
                    await pg.wait_for_timeout(2500)

                async def route():
                    return await pg.evaluate("()=>{const r=window.__nav.getCurrentRoute(); return {name:r.name, params:r.params}}")

                # Comment 12 of 15: the post, scrolled to it, highlighted.
                await tap("Comment number 12")
                r = await route()
                check(key, r["name"] == "PostDetail" and r["params"].get("highlightCommentId") == target_cid, "comment -> PostDetail at that comment")
                hl = pg.locator('[data-testid="comment-highlighted"]')
                check(key, await hl.count() == 1 and "Comment number 12" in await hl.inner_text(), "that comment is highlighted")
                bb = await hl.bounding_box() if await hl.count() else None
                check(key, bb is not None and 0 <= bb["y"] <= 780 - 40, f"highlighted comment is on screen ({bb and int(bb['y'])})")
                await pg.screenshot(path=f"{SHOTS}/comment-{key}.png")
                if w != 360:
                    check(key, not errors, f"no page errors {errors[:2]}")
                    await ctx.close()
                    continue

                # Deleted comment: post opens with a note.
                await tap("Comment that gets deleted")
                r = await route()
                check(key, r["name"] == "PostDetail" and r["params"].get("commentMissing") is True, "deleted comment -> its post")
                note = pg.locator('[data-testid="comment-removed-note"]')
                check(key, await note.count() == 1 and T[lang]["cgone"] in await note.inner_text(), "'comment removed' note")
                await pg.screenshot(path=f"{SHOTS}/comment-gone-{key}.png")

                # Like -> post.
                await tap("Bob Ali liked your post")
                r = await route()
                check(key, r["name"] == "PostDetail" and r["params"]["post"]["id"] == pid, "like -> that post")

                # Follow -> profile.
                await tap("Bob Ali started following you")
                r = await route()
                check(key, r["name"] == "UserProfile" and r["params"]["user"]["id"] == bob["user"]["id"], "new follower -> Bob's profile")
                await pg.screenshot(path=f"{SHOTS}/follow-{key}.png")

                # Message -> chat.
                await tap("hello ann, about the rice")
                r = await route()
                check(key, r["name"] == "Chat" and r["params"]["conversationId"] == bob["user"]["id"], "message -> chat with Bob")

                # Order -> order page with progress.
                await tap("Your order ord-77 is now Confirmed.")
                r = await route()
                check(key, r["name"] == "OrderDetail" and r["params"]["orderId"] == "ord-77", "order -> OrderDetail ord-77")
                await pg.wait_for_timeout(1500)
                body = await pg.locator("body").inner_text()
                check(key, "Rice seed 5kg" in body or "ord-77" in body, "order page shows that order")
                await pg.screenshot(path=f"{SHOTS}/order-{key}.png")

                # Someone else's order.
                await tap("Order ord-88 is on its way.")
                r = await route()
                pr = pg.locator('[data-testid="notification-problem"] >> visible=true')
                check(key, r["name"] == "NotificationOpen" and await pr.count() == 1 and T[lang]["na"] in await pr.inner_text(), "someone else's order -> not available")
                await pg.screenshot(path=f"{SHOTS}/order-forbidden-{key}.png")

                # Warning -> full message.
                await tap("Warning from Farmers")
                nb = pg.locator('[data-testid="notification-notice-body"]')
                check(key, await nb.count() == 1 and "fake seeds" in await nb.inner_text(), "warning -> full message page")
                await pg.screenshot(path=f"{SHOTS}/warning-{key}.png")

                # Deleted post.
                await tap("Doomed comment")
                pr = pg.locator('[data-testid="notification-problem"] >> visible=true')
                check(key, await pr.count() == 1 and T[lang]["removed"] in await pr.inner_text(), "deleted post -> 'post removed'")
                await pg.screenshot(path=f"{SHOTS}/post-removed-{key}.png")

                check(key, not errors, f"no page errors {errors[:2]}")
                await ctx.close()

        # Push-style open (what a phone push tap does): marks only that one read, then opens it.
        ctx = await b.new_context(viewport={"width": 360, "height": 780})
        pg = await ctx.new_page()
        await pg.add_init_script(init_script("en"))
        await pg.goto(BASE, wait_until="networkidle")
        await pg.wait_for_function("()=>window.__nav && window.__nav.isReady()", timeout=40000)
        before = [n for n in (api("GET", "/api/me/notifications", token=A).get("notifications") or []) if not n.get("read")]
        await pg.evaluate("(id)=>window.__nav.navigate('NotificationOpen', {payload:{id, type:'comment', data:{postId:'x'}}})", n_c5["id"])
        await pg.wait_for_timeout(3000)
        r = await pg.evaluate("()=>{const r=window.__nav.getCurrentRoute(); return {name:r.name, params:r.params}}")
        check("push", r["name"] == "PostDetail" and r["params"].get("highlightCommentId") == c5_id, "push open -> server's destination (ignores the push's own postId)")
        allnow = api("GET", "/api/me/notifications", token=A).get("notifications") or []
        me = next(n for n in allnow if n["id"] == n_c5["id"])
        after = [n for n in allnow if not n.get("read")]
        check("push", bool(me.get("read")) and len(after) == len(before) - 1, f"push open marks just that one read ({len(before)} -> {len(after)})")
        await ctx.close()
        await b.close()


try:
    asyncio.run(main())
finally:
    stop()
for k, v in results.items():
    print(k, "OK" if all(v.values()) else "FAIL", {l: c for l, c in v.items() if not c} or "")
print("\n".join(fails) or "ALL PASS")
sys.exit(1 if fails else 0)
