// Guest checkout check on a locally run server with a throwaway database:
// people without an account buy from a shop or a shared product link, see and cancel only their own order
// with the order key, and sellers / admins see the order marked as a guest's. Signed-in checkout still works.
//
//   node tests/check-guest-checkout.mjs
//
// Orders here go to the throwaway database only. The admin is promoted straight in that database.
import { ok, call, setup, finish, counts } from "./harness.mjs";

const stamp = Date.now();
const key = (n) => `guestkey${stamp}${n}`.padEnd(40, "x");
const address = { contactName: "Rahim Mia", contactPhone: "01712345678", zone: "inside_dhaka", division: "Dhaka", district: "Dhaka", address: "House 1, Road 2, Mirpur" };

try {
  const [admin, buyer, seller, other] = await setup(["boss", "buyer", "seller", "other"]);
  const A = "/api/admin/manage";

  let r = await call("POST", `${A}/stores`, admin.token, { name: `Guest Shop ${stamp}`, owner: seller.email });
  ok(r.status === 201, "seller shop opened", r);
  const shop = r.data;
  r = await call("POST", `${A}/products`, admin.token, { storeId: shop.id, category: "other", name: "Fish feed", price: 1500, quantity: 30, unit: "bag", sellAs: "pack", packSize: 25, packUnit: "kg" });
  ok(r.status === 201, "product added", r);
  const feed = r.data;
  r = await call("POST", `${A}/products`, admin.token, { storeId: shop.id, category: "other", name: "Hidden thing", price: 10, quantity: 5, unit: "piece", sellAs: "piece" });
  const hidden = r.data;
  await call("PUT", `${A}/products/${hidden.id}`, admin.token, { hidden: true });

  // ---- public shop + product link without any account
  r = await call("GET", `/api/stores/${shop.slug}`, null);
  ok(r.status === 200 && (r.data?.products || []).some((p) => p.id === feed.id), "shop page opens without an account", r.status);
  r = await call("GET", `/api/catalog/listings/${feed.id}`, null);
  ok(r.status === 200 && r.data?.id === feed.id && r.data?.name === "Fish feed", "shared product link loads the product without an account", r);
  r = await call("GET", `/api/catalog/listings/${hidden.id}`, null);
  ok(r.status === 404, "hidden product link says it isn't available", r);
  r = await call("GET", `/api/catalog/listings/nope-${stamp}`, null);
  ok(r.status === 404, "unknown product link is 404", r);
  r = await call("GET", "/api/checkout/payment-methods", null);
  ok(r.status === 200 && (r.data?.methods || []).some((m) => m.id === "cod"), "payment methods load without an account", r);
  r = await call("POST", "/api/checkout/quote", null, { items: [{ productId: feed.id, quantity: 2 }], zone: "inside_dhaka", division: "Dhaka", deliveryMethod: "standard" });
  ok(r.status === 200 && r.data?.subtotal === 3000, "price quote works without an account", r);

  // ---- guest orders need the full checkout and an order key
  const items = [{ productId: feed.id, name: "Fish feed", price: 1, quantity: 2 }];
  r = await call("POST", "/api/shop-orders", null, { id: `ORD-G-${stamp}-0`, total: 1, itemCount: 2, items, paymentMethod: "cod" });
  ok(r.status === 400 && r.data?.code === "guest_checkout_required", "guest order without delivery details is refused", r);
  r = await call("POST", "/api/shop-orders", null, { id: `ORD-G-${stamp}-0`, items, paymentMethod: "cod", guestKey: "short", checkout: { ...address, deliveryMethod: "standard" } });
  ok(r.status === 400 && r.data?.code === "guest_key_invalid", "guest order with a weak key is refused", r);
  r = await call("POST", "/api/shop-orders", null, { id: `ORD-G-${stamp}-0`, items, paymentMethod: "cod", guestKey: key(0), checkout: { ...address, contactPhone: "123", deliveryMethod: "standard" } });
  ok(r.status === 400 && /mobile number/i.test(r.data?.error || ""), "guest order with a bad phone is refused", r);
  r = await call("POST", "/api/shop-orders", null, { id: `ORD-G-${stamp}-0`, items, paymentMethod: "cod", guestKey: key(0), checkout: { ...address, contactName: " ", deliveryMethod: "standard" } });
  ok(r.status === 400 && /name/i.test(r.data?.error || ""), "guest order without a name is refused", r);
  r = await call("POST", "/api/shop-orders", null, { id: `ORD-G-${stamp}-0`, items: [{ productId: feed.id, quantity: 500 }], paymentMethod: "cod", guestKey: key(0), checkout: { ...address, deliveryMethod: "standard" } });
  ok(r.status === 409, "guest can't order more than the stock", r);

  // ---- a good guest order: the server sets the prices
  const gid = `ORD-G-${stamp}-1`;
  r = await call("POST", "/api/shop-orders", null, { id: gid, total: 5, items, paymentMethod: "cod", guestKey: key(1), checkout: { ...address, deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.id === gid && r.data?.guest === true, "guest places an order without an account", r);
  ok(r.data?.items?.[0]?.price === 1500 && r.data?.total === r.data?.checkout?.total && r.data.total === 3000 + (r.data?.checkout?.deliveryFee || 0) - (r.data?.checkout?.discount || 0), "server prices the guest order (not the 1 taka the app sent)", r.data);
  const placedTotal = r.data?.total;
  r = await call("GET", `/api/stores/${shop.slug}`, null);
  ok((r.data?.products || []).find((p) => p.id === feed.id)?.quantity === 28, "stock goes down after the guest order", (r.data?.products || []).find((p) => p.id === feed.id));
  r = await call("POST", "/api/shop-orders", null, { id: gid, items, paymentMethod: "cod", guestKey: key(1), checkout: { ...address, deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.duplicate === true && r.data?.id === gid, "same guest retrying gets the same order back", r);

  // ---- someone else re-using the id gets a new order, never the guest's details
  r = await call("POST", "/api/shop-orders", null, { id: gid, items, paymentMethod: "cod", guestKey: key(2), checkout: { ...address, contactName: "Intruder", deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.id !== gid && !r.data?.duplicate && r.data?.checkout?.contactName === "Intruder", "another guest using the same id gets a fresh order, not Rahim's", r);
  const intruderId = r.data?.id;
  r = await call("POST", "/api/shop-orders", other.token, { id: gid, items, paymentMethod: "cod", checkout: { ...address, contactName: "Other", deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.id !== gid && r.data?.checkout?.contactName === "Other", "a signed-in user using the guest's id gets a fresh order", r);

  // ---- reading the order: only with the right key
  r = await call("GET", `/api/guest-orders/${gid}?k=${key(1)}`, null);
  ok(r.status === 200 && r.data?.id === gid && r.data?.status === "pending" && r.data?.total === placedTotal && r.data?.checkout?.contactName === "Rahim Mia", "guest opens their order with the key", r);
  ok(r.data && !("sellerIds" in r.data) && !("buyerId" in r.data), "guest view hides seller and buyer ids", r.data);
  r = await call("GET", `/api/guest-orders/${gid}?k=${key(2)}`, null);
  ok(r.status === 404, "wrong key can't open the order", r);
  r = await call("GET", `/api/guest-orders/${gid}`, null);
  ok(r.status === 404, "no key can't open the order", r);
  r = await call("GET", `/api/orders/${gid}`, other.token);
  ok(r.status === 403, "another signed-in user can't open the guest order", r);
  r = await call("GET", `/api/guest-orders/${gid}`, other.token);
  ok(r.status === 404, "a token without the key can't open it either", r);

  // ---- the seller and the admin see it as a guest order
  r = await call("GET", "/api/me/sales", seller.token);
  const sale = (r.data || []).find((o) => o.id === gid);
  ok(sale?.buyer?.name === "Rahim Mia (Guest)" && sale?.buyer?.guest === true, "seller sees the order from 'Rahim Mia (Guest)'", sale?.buyer || r);
  r = await call("GET", "/api/me/notifications", seller.token);
  const list = Array.isArray(r.data) ? r.data : r.data?.notifications || r.data?.items || [];
  ok(list.some((n) => /Rahim Mia \(Guest\) ordered/.test(n.body || "")), "seller's new order notice names the guest", list.slice(0, 3));
  r = await call("GET", `${A}/orders/${gid}`, admin.token);
  ok(r.status === 200 && r.data?.buyerName === "Rahim Mia (Guest)" && r.data?.buyerPhone === "01712345678" && r.data?.isGuest === true, "admin order view marks the guest with their phone", r.data);
  r = await call("GET", `${A}/orders`, admin.token);
  const arr = Array.isArray(r.data) ? r.data : r.data?.orders || r.data?.items || [];
  ok(arr.some((o) => o.id === gid && o.buyerName === "Rahim Mia (Guest)" && o.isGuest === true), "admin order list shows the guest's name", arr.slice(0, 2));
  r = await call("GET", `${A}/products/${feed.id}`, admin.token);
  const arr2 = r.data?.orderList || [];
  ok(r.status === 200 && arr2.some((o) => o.id === gid && o.buyerName === "Rahim Mia (Guest)"), "admin product page lists the guest's order", { status: r.status, first: arr2[0] });

  // ---- seller confirms; guest sees it; guest can't cancel a confirmed order
  r = await call("POST", `/api/guest-orders/${intruderId}/cancel?k=${key(1)}`, null);
  ok(r.status === 404, "guest can't cancel someone else's order with their own key", r);
  r = await call("PUT", `/api/orders/${gid}/status`, seller.token, { status: "confirmed" });
  ok(r.status === 200 && r.data?.status === "confirmed", "seller confirms the guest order", r);
  r = await call("GET", `/api/guest-orders/${gid}?k=${key(1)}`, null);
  ok(r.data?.status === "confirmed" && (r.data?.history || []).length === 2 && !(r.data.history || []).some((h) => h.by), "guest sees it's confirmed (history without who did it)", r.data?.history);
  r = await call("POST", `/api/guest-orders/${gid}/cancel?k=${key(1)}`, null);
  ok(r.status === 400, "guest can't cancel after the seller confirmed", r);
  r = await call("POST", `/api/guest-orders/${intruderId}/cancel?k=${key(2)}`, null);
  ok(r.status === 200 && r.data?.status === "cancelled", "guest cancels their own pending order", r);

  // ---- older app versions (no key): order still goes through, but nobody can open it as a guest
  const lid = `ORD-L-${stamp}-1`;
  r = await call("POST", "/api/shop-orders", null, { id: lid, items: [{ productId: feed.id, quantity: 1 }], paymentMethod: "cod", checkout: { ...address, deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.id === lid, "older app's guest order (no key) still goes through", r);
  r = await call("POST", "/api/shop-orders", null, { id: lid, items: [{ productId: feed.id, quantity: 1 }], paymentMethod: "cod", checkout: { ...address, contactName: "Copycat", deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.id !== lid && !r.data?.duplicate, "re-sending a keyless order id never returns the first order", r);
  r = await call("GET", `/api/guest-orders/${lid}?k=${key(1)}`, null);
  ok(r.status === 404, "a keyless guest order can't be opened with any key", r);

  // ---- signed-in checkout still works as before
  const bid = `ORD-B-${stamp}-1`;
  r = await call("POST", "/api/shop-orders", buyer.token, { id: bid, items, paymentMethod: "cod", checkout: { ...address, contactName: "Buyer", deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.id === bid && !r.data?.guest, "signed-in buyer still checks out (no key needed)", r);
  r = await call("POST", "/api/shop-orders", buyer.token, { id: bid, items, paymentMethod: "cod", checkout: { ...address, contactName: "Buyer", deliveryMethod: "standard" } });
  ok(r.status === 201 && r.data?.duplicate === true && r.data?.id === bid, "signed-in retry still returns the saved order", r);
  r = await call("GET", "/api/me/orders", buyer.token);
  const mine = Array.isArray(r.data) ? r.data : r.data?.orders || [];
  ok(mine.some((o) => o.id === bid) && !mine.some((o) => o.id === gid), "buyer's own orders list has theirs only", mine.map((o) => o.id));
  r = await call("GET", `/api/guest-orders/${bid}?k=${key(1)}`, null);
  ok(r.status === 404, "a signed-in buyer's order can't be opened through the guest link", r);

  // ---- flood limit
  let limited = false;
  for (let i = 0; i < 10 && !limited; i++) {
    const x = await call("POST", "/api/shop-orders", null, { id: `ORD-F-${stamp}-${i}`, items: [{ productId: feed.id, quantity: 1 }], paymentMethod: "cod", guestKey: key(100 + i), checkout: { ...address, deliveryMethod: "standard" } });
    if (x.status === 429) limited = true;
  }
  ok(limited, "too many guest orders from one connection are slowed down");
  r = await call("POST", "/api/shop-orders", buyer.token, { id: `ORD-B-${stamp}-2`, items: [{ productId: feed.id, quantity: 1 }], paymentMethod: "cod", checkout: { ...address, deliveryMethod: "standard" } });
  ok(r.status === 201 || r.status === 409, "signed-in buyers aren't hit by the guest limit", r);
  await finish();
} catch (e) {
  await finish(e);
}
