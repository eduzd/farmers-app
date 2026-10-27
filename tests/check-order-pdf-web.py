"""Web check: print / save an order as a PDF after it's placed (throwaway local server, ./dist web export).

- Guest (no account) places a Cash-on-delivery order in the UI; the confirmation has Print and Save PDF.
  Print opens the browser print window on a document with the real order: id, items with units, totals,
  delivery, "Not paid yet", and never the order's private link/key.
- Guest order page (Bangla) also has the buttons; the document is in Bangla and renders as a real PDF.
- Signed-in buyer: OrderDetail has the buttons; a delivered order says "Delivered", a cancelled one "Cancelled".
- Access: someone else can't read the order (signed-in or with a wrong guest key), so they can't print it.

  python3 tests/check-order-pdf-web.py [shots_dir]
"""
import asyncio, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, T
from playwright.async_api import async_playwright

h = H("order-pdf")

# Stub print in every frame (the order document prints from its own iframe) and remember what was printed.
STUB = """
(() => {
  window.print = function () {
    try {
      const top = window.top;
      top.__printed = top.__printed || [];
      top.__printed.push({ title: top.document.title, frameTitle: document.title, lang: document.documentElement.lang,
        html: document.documentElement.outerHTML, text: document.body ? document.body.innerText : '', inFrame: window !== top });
    } catch (e) {}
  };
})();
"""


async def fill_by_placeholder(pg, needles, value):
    for n in needles:
        loc = pg.locator(f'input[placeholder*="{n}"], textarea[placeholder*="{n}"]')
        if await loc.count():
            await loc.first.fill(value)
            return True
    return False


async def printed(pg, n, ms=8000):
    for _ in range(ms // 250):
        got = await pg.evaluate("()=> (window.__printed||[]).length")
        if got >= n:
            return (await pg.evaluate("()=>window.__printed"))[n - 1]
        await pg.wait_for_timeout(250)
    return None


async def as_pdf(br, html, name, lang):
    """Render the document HTML the way a browser would print it, save the PDF, return its text and font checks."""
    ctx = await br.new_context(viewport={"width": 800, "height": 1100})
    pg = await ctx.new_page()
    await pg.set_content(html, wait_until="networkidle")
    await pg.evaluate("()=>document.fonts.ready")
    fonts = await pg.evaluate("""()=>({dm: document.fonts.check('16px "DM Sans"'), hind: document.fonts.check('16px "Hind Siliguri"', 'অর্ডার')})""")
    await pg.screenshot(path=f"{h.shots}/{name}.png", full_page=True)
    await pg.emulate_media(media="print")
    path = f"{h.shots}/{name}.pdf"
    await pg.pdf(path=path, format="A4", print_background=True, prefer_css_page_size=True)
    await ctx.close()
    from pypdf import PdfReader
    txt = "\n".join((pg_.extract_text() or "") for pg_ in PdfReader(path).pages)
    return txt, fonts, os.path.getsize(path)


async def main():
    h.start()
    admin = h.signup("boss", "Admin Rahim")
    seller = h.signup("sell", "Seller Karim")
    buyer = h.signup("buy", "Buyer Jamal")
    stranger = h.signup("other", "Stranger Ali")
    h.make_admin(admin)
    A = "/api/admin/manage"
    st, shop = h.api("POST", f"{A}/stores", {"name": "Padma Fish Feed", "owner": seller["email"]}, admin["token"])
    assert st == 201, (st, shop)
    st, feed = h.api("POST", f"{A}/products", {"storeId": shop["id"], "category": "other", "name": "Floating fish feed", "price": 1450,
                                               "quantity": 40, "unit": "bag", "sellAs": "pack", "packSize": 25, "packUnit": "kg"}, admin["token"])
    assert st == 201, (st, feed)
    st, tom = h.api("POST", f"{A}/products", {"storeId": shop["id"], "category": "vegetables", "name": "Fresh tomato", "price": 60,
                                              "quantity": 100, "unit": "kg"}, admin["token"])
    assert st == 201, (st, tom)
    slug = shop["slug"]

    # signed-in buyer: two orders through the real checkout API (server works out the totals)
    def place(oid, items, notes=""):
        body = {"id": oid, "total": 0, "paymentMethod": "cod", "items": items,
                "shippingAddress": {"fullName": "Buyer Jamal", "address": "House 5, Road 3", "city": "Dhaka", "phone": "01712345678"},
                "checkout": {"deliveryMethod": "home", "zone": "inside_dhaka", "contactName": "Buyer Jamal", "contactPhone": "01712345678",
                             "altPhone": "01812345678", "address": "House 5, Road 3, Mirpur", "division": "Dhaka", "district": "Dhaka",
                             "upazila": "Mirpur", "deliveryDate": "2026-10-29", "timeSlot": "morning", "notes": notes, "couponCode": ""}}
        return h.api("POST", "/api/shop-orders", body, buyer["token"])

    st, oa = place("ORD-PDFA1", [{"productId": feed["id"], "name": "Floating fish feed", "price": 1450, "quantity": 2, "unit": "bag"},
                                 {"productId": tom["id"], "name": "Fresh tomato", "price": 60, "quantity": 2, "unit": "kg"}], "Call before coming")
    h.ok(st == 201, "signed-in order A placed", (st, oa))
    st, ob = place("ORD-PDFB2", [{"productId": tom["id"], "name": "Fresh tomato", "price": 60, "quantity": 3, "unit": "kg"}])
    h.ok(st == 201, "signed-in order B placed", (st, ob))
    for s in ["confirmed", "processing", "shipped", "delivered"]:
        st, _ = h.api("PUT", "/api/orders/ORD-PDFB2/status", {"status": s}, seller["token"])
    h.ok(st == 200, "seller marks order B delivered", st)

    # access control on the data the document is built from
    st, _ = h.api("GET", "/api/orders/ORD-PDFA1", tok=stranger["token"])
    h.ok(st in (403, 404), "another signed-in user can't read order A (so can't print it)", st)
    st, _ = h.api("GET", "/api/orders/ORD-PDFA1")
    h.ok(st in (401, 403, 404), "no sign-in can't read order A", st)
    st, mine = h.api("GET", "/api/orders/ORD-PDFA1", tok=buyer["token"])
    h.ok(st == 200 and mine.get("id") == "ORD-PDFA1", "buyer reads order A", st)

    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--no-sandbox"])

        # ---------- guest places an order (English, phone size)
        ctx = await br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await ctx.add_init_script("localStorage.setItem('language','en');")
        await ctx.add_init_script(STUB)
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: h.errors.append(f"guest-en: {str(e)[:200]}"))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(f"{h.base}/product/{feed['id']}", wait_until="networkidle", timeout=180000)
        await pg.wait_for_timeout(3000)
        await pg.locator(T("product-add-to-cart")).first.click()
        await pg.wait_for_timeout(1200)
        cart_btn = pg.locator(T("product-cart-badge"))
        if await cart_btn.count():
            await cart_btn.first.click()
        else:
            await pg.goto(f"{h.base}/shop/{slug}", wait_until="networkidle"); await pg.wait_for_timeout(2000)
            await pg.locator(T("shop-cart")).first.click()
        await pg.wait_for_timeout(1500)
        await pg.get_by_text("Checkout", exact=False).last.click()
        await pg.wait_for_timeout(2500)
        await fill_by_placeholder(pg, ["Full name"], "Rahim Mia")
        await fill_by_placeholder(pg, ["01XXXXXXXXX"], "01712345678")
        await pg.get_by_text("Dhaka", exact=True).first.click()
        await pg.wait_for_timeout(400)
        await fill_by_placeholder(pg, ["e.g. Bogura"], "Dhaka")
        await fill_by_placeholder(pg, ["e.g. Sherpur"], "Mirpur")
        await fill_by_placeholder(pg, ["Village, road"], "House 5, Road 3, Mirpur")
        for tid, v in [("input-contact-name", "Rahim Mia"), ("input-contact-phone", "01712345678")]:
            loc = pg.locator(T(tid))
            if await loc.count() and not (await loc.first.input_value()).strip():
                await loc.first.fill(v)
        h.ok(await pg.locator(T("placed-doc-print")).count() == 0, "no print buttons before the order is placed")
        place_btn = pg.locator(T("button-place-order"))
        if await place_btn.count() == 0:
            place_btn = pg.get_by_text("Place order", exact=False)
        await place_btn.last.click()
        await pg.wait_for_timeout(4000)
        st, sales = h.api("GET", "/api/me/sales", tok=seller["token"])
        guest_orders = [s for s in (sales or []) if "(Guest)" in (s.get("buyer") or {}).get("name", "")]
        gid = guest_orders[0]["id"] if guest_orders else None
        h.ok(bool(gid), "guest order placed in the UI", (st, sales))
        h.ok(await h.wait_for(pg, "placed-doc-print") and await pg.locator(T("placed-doc-pdf")).count() > 0,
             "order-placed screen has Print and Save PDF")
        h.ok(await pg.locator(T("placed-doc-hint")).count() > 0, "web hint: choose 'Save as PDF' in the print window")
        h.ok(await h.no_overflow(pg), "order-placed screen fits at 390px")
        await pg.screenshot(path=f"{h.shots}/01-order-placed-guest-en.png")

        await pg.locator(T("placed-doc-print")).first.click()
        doc = await printed(pg, 1)
        h.ok(doc and doc["inFrame"], "Print opens the print window on the order document (not the app page)", doc and doc.get("inFrame"))
        txt = (doc or {}).get("text", "")
        html = (doc or {}).get("html", "")
        h.ok(gid and gid in txt, "document shows the order number", txt[:300])
        h.ok("Floating fish feed" in txt and "Rahim Mia" in txt and "01712345678" in txt, "document shows item, name and phone")
        h.ok("25 kg" in txt, "document shows the pack size (25 kg bag)", txt[:800])
        total = guest_orders[0]["total"] if guest_orders else None
        h.ok(total is not None and f"৳{int(total)}" in txt.replace(",", ""), "document shows the server total", (total, txt[-600:]))
        h.ok("Not paid yet" in txt and "Cash on delivery" in txt, "COD order says 'Not paid yet'", txt[-500:])
        h.ok("Paid ·" not in txt, "COD order never says Paid")
        h.ok("?k=" not in html and "/order/" not in html, "document has no private order link / key")
        h.ok(doc and doc["title"].startswith("Farmers-order-"), "saved PDF gets the name Farmers-order-<id>", doc and doc["title"])
        await pg.wait_for_timeout(2500)
        h.ok(not (await pg.evaluate("()=>document.title")).startswith("Farmers-order-"), "page title goes back after printing")
        await pg.locator(T("placed-doc-pdf")).first.click()
        doc2 = await printed(pg, 2)
        h.ok(doc2 and doc2["inFrame"] and gid in doc2["text"], "Save PDF opens the same document in the print window")
        pdf_txt, fonts, size = await as_pdf(br, html, "02-guest-order-en", "en")
        h.ok(size > 5000 and gid in pdf_txt and "Floating fish feed" in pdf_txt, "English document prints to a real PDF with the order text", pdf_txt[:300])
        h.ok(fonts["dm"], "document uses DM Sans (Maya text font)", fonts)

        # Track order -> guest order page has the buttons too
        await pg.get_by_text("Track order", exact=True).first.click()
        await pg.wait_for_timeout(2500)
        h.ok(await h.wait_for(pg, "guest-order-doc-print"), "guest order page has Print and Save PDF")
        link = await pg.evaluate("()=>location.href")
        key = await pg.evaluate("""()=>{ for (const k of Object.keys(localStorage)) { const v = localStorage.getItem(k)||''; const m = v.match(/"key":"([A-Za-z0-9_-]{32,128})"/); if (m) return m[1]; } return null; }""")
        h.ok(bool(key), "guest key found on this browser")
        h.ok(key and key not in html, "document never contains the guest key")
        await ctx.close()

        # ---------- Bangla guest order page
        ctx = await br.new_context(viewport={"width": 360, "height": 800}, device_scale_factor=2)
        await ctx.add_init_script("localStorage.setItem('language','bn');")
        await ctx.add_init_script(STUB)
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: h.errors.append(f"guest-bn: {str(e)[:200]}"))
        await pg.goto(f"{h.base}/order/{gid}?k={key}", wait_until="networkidle")
        await pg.wait_for_timeout(3000)
        h.ok(await h.wait_for(pg, "guest-order-doc-pdf"), "Bangla guest order page has the buttons")
        h.ok((await h.text(pg, "guest-order-doc-pdf")) and "PDF" in await h.text(pg, "guest-order-doc-pdf"), "Bangla button label", await h.text(pg, "guest-order-doc-pdf"))
        h.ok(await h.no_overflow(pg), "guest order page fits at 360px")
        await pg.screenshot(path=f"{h.shots}/03-guest-order-page-bn.png", full_page=True)
        await pg.locator(T("guest-order-doc-pdf")).first.click()
        doc = await printed(pg, 1)
        txt = (doc or {}).get("text", "")
        h.ok(doc and doc["lang"] == "bn" and "অর্ডারের বিবরণ" in txt, "Bangla document", txt[:300])
        h.ok("এখনো পরিশোধ হয়নি" in txt, "Bangla COD says not paid yet")
        pdf_txt, fonts, size = await as_pdf(br, doc["html"], "04-guest-order-bn", "bn")
        h.ok(size > 5000 and gid in pdf_txt, "Bangla document prints to a real PDF", size)
        h.ok(fonts["hind"], "Bangla text uses Hind Siliguri", fonts)
        # wrong key: no order, no buttons
        await pg.goto(f"{h.base}/order/{gid}?k={'x' * 40}", wait_until="networkidle")
        await pg.wait_for_timeout(2500)
        h.ok(await pg.locator(T("guest-order-doc-print")).count() == 0, "wrong guest key: no order and nothing to print")
        await ctx.close()
        st, _ = h.api("GET", f"/api/guest-orders/{gid}")
        h.ok(st in (401, 403, 404), "guest order can't be read without its key", st)

        # ---------- signed-in buyer: OrderDetail
        for lang, w in [("en", 390), ("bn", 320)]:
            ctx, pg = await h.page(br, buyer, lang, w)
            await ctx.add_init_script(STUB)
            await pg.reload(wait_until="networkidle")
            await pg.wait_for_timeout(3000)
            for i, (oid, want_en, want_bn) in enumerate([("ORD-PDFA1", "Not paid yet", "এখনো পরিশোধ হয়নি"), ("ORD-PDFB2", "Delivered · cash on delivery", "ডেলিভারি হয়েছে · ক্যাশ অন ডেলিভারি")]):
                await pg.evaluate(f"()=>window.__nav.navigate('OrderDetail', {{ orderId: '{oid}' }})")
                await pg.wait_for_timeout(2500)
                okb = await h.wait_for(pg, "order-detail-doc-print")
                h.ok(okb, f"[{lang} {w}] order page {oid} has Print and Save PDF")
                if not okb:
                    continue
                await pg.screenshot(path=f"{h.shots}/05-order-detail-{oid}-{lang}-{w}.png", full_page=True)
                h.ok(await h.no_overflow(pg), f"[{lang} {w}] order page fits")
                await pg.locator(T("order-detail-doc-print")).last.click()
                doc = await printed(pg, i + 1)
                txt = (doc or {}).get("text", "")
                h.ok(doc and oid in txt and (want_bn if lang == "bn" else want_en) in txt, f"[{lang}] {oid} document has the right payment line", txt[-500:])
                if oid == "ORD-PDFA1":
                    h.ok("Fresh tomato" in txt and "Floating fish feed" in txt, f"[{lang}] both items listed")
                    h.ok(("Call before coming" in txt) and ("01812345678" in txt), f"[{lang}] note and second phone listed")
                    h.ok(("2 kg" in txt) or ("২ কেজি" in txt) or ("2 কেজি" in txt), f"[{lang}] 2 kg tomatoes", txt[:900])
                    if lang == "en":
                        h.ok("Morning (9am–12pm)" in txt and "Home delivery" in txt and "Inside Dhaka" in txt, "delivery method, zone and time slot")
                        await as_pdf(br, doc["html"], "06-signed-in-order-A-en", "en")
                    else:
                        await as_pdf(br, doc["html"], "07-signed-in-order-A-bn", "bn")
            await ctx.close()

        # ---------- stranger can't open order A's page
        ctx, pg = await h.page(br, stranger, "en", 390)
        await pg.evaluate("()=>window.__nav.navigate('OrderDetail', { orderId: 'ORD-PDFA1' })")
        await pg.wait_for_timeout(3000)
        h.ok(await pg.locator(T("order-detail-doc-print")).count() == 0, "another user doesn't get order A's page or print buttons")
        await ctx.close()

        # cancelled order
        st, _ = h.api("PUT", "/api/orders/ORD-PDFA1/status", {"status": "cancelled"}, buyer["token"])
        ctx, pg = await h.page(br, buyer, "en", 390)
        await ctx.add_init_script(STUB)
        await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(3000)
        await pg.evaluate("()=>window.__nav.navigate('OrderDetail', { orderId: 'ORD-PDFA1' })")
        await pg.wait_for_timeout(2500)
        if await h.wait_for(pg, "order-detail-doc-print"):
            await pg.locator(T("order-detail-doc-print")).last.click()
            doc = await printed(pg, 1)
            txt = (doc or {}).get("text", "")
            h.ok("Cancelled" in txt and "nothing to pay" in txt, "cancelled order prints as Cancelled, nothing to pay", (st, txt[-400:]))
        else:
            h.ok(False, "cancelled order page opens")
        await ctx.close()
        await br.close()
    h.done()


asyncio.run(main())
