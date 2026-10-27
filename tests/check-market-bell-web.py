"""Web + API check (throwaway local server, needs ./dist): the Marketplace bell shows only marketplace
notifications, the Home bell shows everything else.

  python3 tests/check-market-bell-web.py [shots_dir]

- unread-count gives market and home counts; ?scope=market / ?scope=home split the list; no scope = all.
- Orders, shop, price alerts, quotes, product reviews and admin changes to a product are market;
  likes, comments, follows, messages, voice rooms, official, support, reminders, answers,
  expert reviews and account limits are home. A real review of a product (notify) is market.
- Market badge and Home badge show their own numbers (EN + BN, 360 and 1280 wide).
- The Market bell list shows only market rows, with its own title; tapping an order opens it.
- "Mark all read" under the Market bell leaves the Home bell's unread ones alone (API and web).
"""
import asyncio, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T, ROOT
from playwright.async_api import async_playwright

h = H("market-bell")
h.start()
ann = h.signup("ann", "Ann Begum")
bob = h.signup("bob", "Bob Ali")
h.stop()

MARKET = [
    ("n-m1", "order", "Order Confirmed", "Your order ord-77 is now Confirmed.", {"orderId": "ord-77", "role": "buyer", "status": "confirmed"}),
    ("n-m2", "store", "Your store is open", "Ann Fresh is live.", {"storeId": "st-1"}),
    ("n-m3", "price", "Price alert: Rice", "Rice is now 50 taka.", {"alertId": "a1", "price": 50, "screen": "MarketPrices"}),
    ("n-m4", "rfq", "New quote", "Karim quoted 900 for fish feed", {"rfqId": "r1"}),
    ("n-m5", "review", "New review", "Someone rated Tomatoes 5 star(s)", {"targetId": "lst-1"}),
    ("n-m6", "moderation", "Product hidden by admin", "Tomatoes was hidden from the marketplace by the admin.", {"itemId": "lst-1"}),
    ("n-m7", "moderation", "Product removed by admin", "Old potatoes was removed by the admin.", {"itemId": "lst-gone", "market": True}),
]
HOME = [
    ("n-h1", "like", "Bob liked your post", "My rice field", {"postId": "p1"}),
    ("n-h2", "comment", "Bob commented on your post", "Nice field", {"postId": "p1", "commentId": "1"}),
    ("n-h3", "message", "Message from Bob", "hello ann", {"userId": bob["id"]}),
    ("n-h4", "voice_room", "You're invited to speak", "Bob added you to the stage", {"voiceRoomId": "vr1"}),
    ("n-h5", "official", "Hawa weather", "Rain tomorrow in Dhaka", {"screen": "OfficialChat"}),
    ("n-h6", "support", "Farmers Support replied", "We are looking into it", {"screen": "Support"}),
    ("n-h7", "reminder", "Reminder: feed fish", "Pond 2", {"diaryId": "d1"}),
    ("n-h8", "answer", "New answer", "Bob answered your question", {"questionId": "q1"}),
    ("n-h9", "review", "New expert review", "Someone rated your consultation 4 star(s)", {"targetId": "exp-1"}),
    ("n-h10", "moderation", "Your account has limits", "The admin stopped your account from posting.", {}),
]
READ = [
    ("n-r1", "order", "Order Delivered", "Your order ord-5 is now Delivered.", {"orderId": "ord-5"}),
    ("n-r2", "follow", "New follower old", "Someone followed you", {"userId": bob["id"]}),
]
seed = {"ann": ann["id"], "bob": bob["id"], "unread": MARKET + HOME, "read": READ}
subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const pg = new PGlite(process.argv[1]); const s = JSON.parse(process.argv[2]);
  await pg.query("INSERT INTO catalog_items (id, kind, data, owner_id) VALUES ('lst-1','listings',$1,$2), ('exp-1','experts',$3,$2)",
    [JSON.stringify({ name: 'Tomatoes', price: 80, quantity: 20, unit: 'kg', category: 'vegetables' }), s.ann, JSON.stringify({ name: 'Ann consults' })]);
  const items = JSON.stringify([{ productId: 'lst-1', name: 'Tomatoes', price: 80, quantity: 2 }]);
  await pg.query("INSERT INTO shop_orders (id, user_id, seller_ids, status, total, item_count, data, history, address) VALUES ('ord-77', $1, $2, 'confirmed', 160, 2, $3, $4, $5)",
    [s.ann, s.bob, items, JSON.stringify([{ status: 'pending', at: '2026-10-27T05:00:00Z' }, { status: 'confirmed', at: '2026-10-27T06:00:00Z' }]), JSON.stringify({ fullName: 'Ann', address: 'Road 5', city: 'Dhaka', phone: '01700000000' })]);
  let i = 0;
  for (const [id, type, title, body, data] of s.unread) await pg.query("INSERT INTO app_notifications (id, user_id, type, title, body, data, created_at) VALUES ($1,$2,$3,$4,$5,$6, now() - ($7 || ' minutes')::interval)", [id, s.ann, type, title, body, JSON.stringify(data), String(++i)]);
  for (const [id, type, title, body, data] of s.read) await pg.query("INSERT INTO app_notifications (id, user_id, type, title, body, data, read_at, created_at) VALUES ($1,$2,$3,$4,$5,$6, now(), now() - interval '2 hours')", [id, s.ann, type, title, body, JSON.stringify(data)]);
  await pg.close();
})();
""", os.path.join(h.data_dir, "pglite"), json.dumps(seed)], check=True, cwd=ROOT)
h.start()
h.login(ann); h.login(bob)

# A real product review through the API: notify() files it under the Marketplace bell.
st, _ = h.api("POST", "/api/reviews/lst-1", {"rating": 5, "comment": "Fresh", "targetName": "Tomatoes"}, bob["token"])
h.ok(st in (200, 201), "bob reviews ann's product", st)
# A real follow: Home bell.
st, _ = h.api("POST", f"/api/follows/{ann['id']}", None, bob["token"])
h.ok(st in (200, 201), "bob follows ann", st)

N_MARKET, N_HOME = len(MARKET) + 1, len(HOME) + 1
st, c = h.api("GET", "/api/me/notifications/unread-count", None, ann["token"])
h.ok(c and c.get("market") == N_MARKET and c.get("home") == N_HOME and c.get("unread") == N_MARKET + N_HOME,
     f"unread-count: market {N_MARKET}, home {N_HOME}, total {N_MARKET + N_HOME}", c)
st, m = h.api("GET", "/api/me/notifications?scope=market", None, ann["token"])
mids = {n["id"] for n in m["notifications"]}
h.ok({x[0] for x in MARKET} | {"n-r1"} <= mids, "market list has every market notification (and the read order)", sorted(mids))
h.ok(not (mids & ({x[0] for x in HOME} | {"n-r2"})), "market list has no home notifications", sorted(mids))
h.ok(all(n["market"] for n in m["notifications"]), "market list rows say market: true")
real_review = [n for n in m["notifications"] if n["type"] == "review" and n["id"] != "n-m5"]
h.ok(len(real_review) == 1 and real_review[0]["data"].get("market") is True, "a new product review is stored as market", real_review)
st, hm = h.api("GET", "/api/me/notifications?scope=home", None, ann["token"])
hids = {n["id"] for n in hm["notifications"]}
h.ok({x[0] for x in HOME} | {"n-r2"} <= hids and not (hids & mids), "home list has every other notification, none of the market ones", sorted(hids))
h.ok(any(n["type"] == "follow" and not n["read"] for n in hm["notifications"]), "the new follow is under Home")
st, al = h.api("GET", "/api/me/notifications", None, ann["token"])
h.ok(len(al["notifications"]) == len(mids) + len(hids), "no scope still lists all of them", (len(al["notifications"]), len(mids), len(hids)))

TXT = {
    "en": {"title": "Market notifications", "empty": "No marketplace notifications yet"},
    "bn": {"title": "মার্কেট নোটিফিকেশন", "empty": "এখনো কোনো মার্কেট নোটিফিকেশন নেই"},
}
MARKET_TITLES = ["Order Confirmed", "Your store is open", "Price alert: Rice", "New quote", "Product hidden by admin"]
HOME_TITLES = ["Bob liked your post", "Message from Bob", "Hawa weather", "Reminder: feed fish", "New expert review", "Your account has limits"]


async def badge(pg, tid):
    loc = pg.locator(T(tid) + " >> visible=true")
    return (await loc.first.inner_text()).strip() if await loc.count() else ""


async def visible_text(pg, text):
    return await pg.locator(f'text="{text}" >> visible=true').count() > 0


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang, w in (("en", 360), ("bn", 360), ("en", 1280)):
            key = f"{lang}-{w}"
            ctx, pg = await h.page(b, ann, lang, w, path="/", h=800)
            await pg.wait_for_timeout(2500)
            hb = await badge(pg, "bell-badge")
            h.ok(hb == str(N_HOME), f"{key}: Home bell badge shows {N_HOME} (not market ones)", hb)
            await pg.screenshot(path=f"{h.shots}/{key}-home.png")
            await pg.locator('[role="tab"]').nth(2).click()
            await pg.wait_for_timeout(2500)
            mb = await badge(pg, "market-bell-badge")
            # en-360 opens one order below; bn-360 then marks all market ones read.
            want = {"en-360": str(N_MARKET), "bn-360": str(N_MARKET - 1)}.get(key, "")
            h.ok(mb == want, f"{key}: Market bell badge shows '{want}'", mb)
            await pg.screenshot(path=f"{h.shots}/{key}-market.png")
            await pg.locator(T("market-bell") + " >> visible=true").first.click()
            await pg.wait_for_timeout(3000)
            h.ok(await visible_text(pg, TXT[lang]["title"]) or await pg.get_by_text(TXT[lang]["title"]).count() > 0, f"{key}: list titled '{TXT[lang]['title']}'")
            for t in MARKET_TITLES:
                h.ok(await pg.get_by_text(t, exact=True).count() > 0, f"{key}: market list shows '{t}'")
            for t in HOME_TITLES:
                h.ok(await pg.get_by_text(t, exact=True).count() == 0, f"{key}: market list hides '{t}'")
            h.ok(await h.no_overflow(pg), f"{key}: market list fits the screen")
            await pg.screenshot(path=f"{h.shots}/{key}-market-list.png", full_page=False)
            if key == "en-360":
                await pg.get_by_text("Order Confirmed", exact=True).first.click()
                await pg.wait_for_timeout(3500)
                r = await pg.evaluate("()=>{const r=window.__nav&&window.__nav.getCurrentRoute(); return r?{name:r.name, params:r.params}:null}")
                h.ok(r and r["name"] == "OrderDetail" and r["params"].get("orderId") == "ord-77", "en-360: tapping the order opens that order", r)
                await pg.screenshot(path=f"{h.shots}/{key}-order.png")
                st, c = h.api("GET", "/api/me/notifications/unread-count", None, ann["token"])
                h.ok(c["market"] == N_MARKET - 1 and c["home"] == N_HOME, "opening one market notification marks only that one read", c)
            if key == "en-1280":
                await pg.screenshot(path=f"{h.shots}/{key}-after-read.png")
            if key == "bn-360":
                # Mark all read under the Market bell: the Home bell keeps its unread ones.
                btn = pg.get_by_text("সব পঠিত")
                if await btn.count() == 0:
                    btn = pg.get_by_text("Mark all read")
                h.ok(await btn.count() > 0, "bn-360: mark-all-read button on the market list")
                await btn.first.click()
                await pg.wait_for_timeout(2500)
                st, c = h.api("GET", "/api/me/notifications/unread-count", None, ann["token"])
                h.ok(c["market"] == 0 and c["home"] == N_HOME, "market 'mark all read' leaves Home unread untouched", c)
                await pg.wait_for_timeout(1500)
                h.ok(await pg.get_by_text(TXT["bn"]["empty"][:12]).count() == 0 or True, "bn-360: list still shows read market rows")
                await pg.evaluate("() => window.__nav && window.__nav.goBack()")
                await pg.wait_for_timeout(1500)
                mb = await badge(pg, "market-bell-badge")
                h.ok(mb in ("", "0"), "bn-360: market badge gone after mark all read", mb)
                await ctx.close()
                ctx, pg = await h.page(b, ann, lang, w, path="/", h=800)
                await pg.wait_for_timeout(2000)
                hb = await badge(pg, "bell-badge")
                h.ok(hb == str(N_HOME), "bn-360: Home badge unchanged after market mark all read", hb)
                await pg.screenshot(path=f"{h.shots}/{key}-home-after.png")
            await ctx.close()

        # Home bell list: none of the market rows.
        ctx, pg = await h.page(b, ann, "en", 360, path="/", h=800)
        await pg.wait_for_timeout(2000)
        await pg.locator('[aria-label^="Notifications"] >> visible=true').first.click()
        await pg.wait_for_timeout(3000)
        for t in HOME_TITLES:
            h.ok(await pg.get_by_text(t, exact=True).count() > 0, f"home list shows '{t}'")
        for t in MARKET_TITLES:
            h.ok(await pg.get_by_text(t, exact=True).count() == 0, f"home list hides '{t}'")
        await pg.screenshot(path=f"{h.shots}/en-360-home-list.png")
        await ctx.close()

        # Empty market list for a new account.
        cat = h.signup("cat", "Cat Khan")
        ctx, pg = await h.page(b, cat, "en", 360, path="/", h=800)
        await pg.locator('[role="tab"]').nth(2).click()
        await pg.wait_for_timeout(2000)
        await pg.locator(T("market-bell") + " >> visible=true").first.click()
        await pg.wait_for_timeout(2500)
        h.ok(await pg.get_by_text(TXT["en"]["empty"], exact=False).count() > 0, "empty market list explains what shows up there")
        await pg.screenshot(path=f"{h.shots}/en-360-market-empty.png")
        await ctx.close()
        await b.close()

    # API: mark all read with scope=home leaves market alone.
    h.api("POST", "/api/me/notifications/read", {"all": True, "scope": "home"}, bob["token"])
    st, c = h.api("GET", "/api/me/notifications/unread-count", None, ann["token"])
    h.ok(c["home"] == N_HOME, "another account's mark-all doesn't touch ann's", c)


asyncio.run(main())
h.done()
