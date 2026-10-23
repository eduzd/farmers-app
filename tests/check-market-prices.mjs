// Market price board (server/marketPriceRoutes.ts) on a throwaway local server:
// admins post daily prices per district, the public board shows the latest with the change from the day before,
// history, copying a day, validation, admin-only access, and price alerts firing from admin prices.
//   node tests/check-market-prices.mjs
import { ok, call, setup, finish } from "./harness.mjs";

const A = "/api/admin/manage/market-prices";
const today = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const dayBefore = (d, n = 1) => new Date(Date.parse(d) - n * 864e5).toISOString().slice(0, 10);
const y = dayBefore(today);

try {
  const [admin, user] = await setup(["boss", "farmer"]);

  let r = await call("GET", "/api/market-prices");
  ok(r.status === 200 && Array.isArray(r.data?.items) && r.data.items.length === 0, "empty board before any prices (no sample numbers)", r);
  r = await call("GET", "/api/market-prices/meta");
  ok(r.status === 200 && r.data?.districts?.length === 0 && r.data?.today === today, "meta: no districts yet, today's date in Bangladesh", r.data);

  // access
  r = await call("POST", A, user.token, { nameEn: "Rui fish", district: "Dhaka", min: 300, max: 350 });
  ok(r.status === 403, "a normal user can't post prices", r);
  r = await call("POST", A, null, { nameEn: "Rui fish", district: "Dhaka", min: 300, max: 350 });
  ok(r.status === 401, "signed-out can't post prices", r);
  r = await call("GET", A, user.token);
  ok(r.status === 403, "a normal user can't open the admin price list", r);

  // validation
  r = await call("POST", A, admin.token, { nameEn: "", district: "Dhaka", min: 10, max: 20 });
  ok(r.status === 400, "name required", r.data);
  r = await call("POST", A, admin.token, { nameEn: "Potato", district: "", min: 10, max: 20 });
  ok(r.status === 400, "district required", r.data);
  r = await call("POST", A, admin.token, { nameEn: "Potato", district: "Dhaka", min: 30, max: 20 });
  ok(r.status === 400 && /Lowest/.test(r.data?.error), "min above max refused", r.data);
  r = await call("POST", A, admin.token, { nameEn: "Potato", district: "Dhaka", min: -5, max: 20 });
  ok(r.status === 400, "negative price refused", r.data);
  r = await call("POST", A, admin.token, { nameEn: "Potato", district: "Dhaka", min: 10, max: 20, date: "2999-01-01" });
  ok(r.status === 400, "future date refused", r.data);
  r = await call("POST", A, admin.token, { rows: [{ nameEn: "Potato", district: "Dhaka", min: 10, max: 20 }, { nameEn: "Onion", district: "Dhaka", min: 0, max: 0 }] });
  ok(r.status === 400 && /Row 2/.test(r.data?.error), "batch: says which row is wrong and saves nothing", r.data);
  r = await call("GET", "/api/market-prices");
  ok(r.data?.items?.length === 0, "nothing saved from the refused batch", r.data);

  // a price alert set by the user before prices exist
  r = await call("POST", "/api/me/price-alerts", user.token, { product: "রুই মাছ", condition: "below", target: 320 });
  ok(r.status === 201, "user sets a Bangla-name price alert: রুই মাছ below ৳320", r.data);

  // yesterday and today in Dhaka, plus Bogura today
  r = await call("POST", A, admin.token, { rows: [
    { nameEn: "Rui fish", nameBn: "রুই মাছ", category: "fish", unit: "kg", district: "Dhaka", market: "Karwan Bazar", min: 340, max: 380, date: y },
    { nameEn: "Potato", nameBn: "আলু", category: "vegetables", unit: "kg", district: "Dhaka", min: 40, max: 45, date: y },
  ] });
  ok(r.status === 201 && r.data?.saved?.length === 2 && r.data.alertsFired === 0, "admin posts yesterday's Dhaka prices (no alert from old prices)", r.data);
  r = await call("POST", A, admin.token, { rows: [
    { nameEn: "Rui fish", nameBn: "রুই মাছ", category: "fish", unit: "kg", district: "Dhaka", market: "Karwan Bazar", min: 300, max: 330 },
    { nameEn: "Potato", nameBn: "আলু", category: "vegetables", unit: "kg", district: "Dhaka", min: 50, max: 55 },
    { nameEn: "Broiler chicken", nameBn: "ব্রয়লার মুরগি", category: "poultry", unit: "kg", district: "Bogura", min: 170, max: 180 },
  ] });
  ok(r.status === 201 && r.data?.saved?.length === 3, "admin posts today's prices for Dhaka and Bogura", r.data);
  ok(r.data?.alertsFired === 1, "the রুই মাছ alert fires (avg ৳315 ≤ ৳320)", r.data);
  const ruiId = r.data.saved[0].id;

  r = await call("GET", "/api/me/notifications", user.token);
  const notes = Array.isArray(r.data) ? r.data : r.data?.notifications || r.data?.items || [];
  ok(notes.some((n) => /Price alert/.test(n.title) && /315/.test(n.body)), "the user gets a price alert notification with the price", notes.slice(0, 3));
  r = await call("GET", "/api/me/price-alerts", user.token);
  ok(r.data?.[0]?.triggeredAt, "the alert is marked as fired", r.data);

  r = await call("GET", "/api/market-prices?district=Dhaka");
  const rui = r.data?.items?.find((i) => i.itemKey === "rui-fish");
  const potato = r.data?.items?.find((i) => i.itemKey === "potato");
  ok(r.data?.items?.length === 2, "Dhaka board shows 2 products (not Bogura's)", r.data?.items?.map((i) => i.itemKey));
  ok(rui && rui.min === 300 && rui.max === 330 && rui.avg === 315 && rui.date === today, "Rui: today's ৳300–330, average ৳315", rui);
  ok(rui && rui.prevAvg === 360 && rui.change === -45 && rui.trend === "down" && rui.prevDate === y, "Rui: down ৳45 from yesterday's ৳360", rui);
  ok(potato && potato.trend === "up" && potato.change === 10, "Potato: up ৳10", potato);
  ok(rui?.market === "Karwan Bazar" && rui?.nameBn === "রুই মাছ", "market name and Bangla name come through", rui);

  r = await call("GET", "/api/market-prices?category=poultry");
  ok(r.data?.items?.length === 1 && r.data.items[0].district === "Bogura" && r.data.items[0].trend === "stable" && r.data.items[0].change === null, "category filter; a first-day price has no change", r.data);
  r = await call("GET", "/api/market-prices?q=" + encodeURIComponent("আলু"));
  ok(r.data?.items?.length === 1 && r.data.items[0].itemKey === "potato", "search works with the Bangla name", r.data);

  r = await call("GET", "/api/market-prices/meta");
  ok(r.data?.districts?.map((d) => d.district).join(",") === "Bogura,Dhaka" && r.data.categories.includes("fish") && r.data.lastUpdated, "meta lists districts and categories with prices", r.data);

  r = await call("GET", "/api/market-prices/history?item=rui-fish&district=Dhaka");
  ok(r.data?.points?.length === 2 && r.data.points[0].date === y && r.data.points[1].avg === 315, "history: two days in order", r.data);

  // same product + district + day updates instead of duplicating
  r = await call("POST", A, admin.token, { nameEn: "Rui Fish", nameBn: "রুই মাছ", category: "fish", district: "Dhaka", min: 310, max: 340 });
  ok(r.status === 201 && r.data.saved[0].id === ruiId && r.data.saved[0].avg === 325, "posting the same product/day again updates it", r.data);
  r = await call("GET", `${A}?district=Dhaka`, admin.token);
  ok(r.status === 200 && r.data?.rows?.length === 2 && r.data.recentDays?.length === 2, "admin list: today's Dhaka rows and recent days", r.data);

  // edit + delete
  r = await call("PUT", `${A}/${ruiId}`, admin.token, { max: 200 });
  ok(r.status === 400, "edit keeps the min ≤ max rule", r.data);
  r = await call("PUT", `${A}/${ruiId}`, admin.token, { min: 305, max: 335, market: "Jatrabari" });
  ok(r.status === 200 && r.data.avg === 320 && r.data.market === "Jatrabari", "admin edits a price", r.data);
  r = await call("PUT", `${A}/${ruiId}`, user.token, { min: 1, max: 2 });
  ok(r.status === 403, "a normal user can't edit", r.data);

  // copy yesterday into a new day
  const d2 = dayBefore(today, 3);
  r = await call("POST", `${A}/copy`, admin.token, { district: "Dhaka", fromDate: y, toDate: d2 });
  ok(r.status === 200 && r.data.copied === 2, "copy a day's prices to another day", r.data);
  r = await call("POST", `${A}/copy`, admin.token, { district: "Dhaka", fromDate: y, toDate: d2 });
  ok(r.status === 200 && r.data.copied === 0, "copying again doesn't duplicate", r.data);
  r = await call("POST", `${A}/copy`, admin.token, { district: "Sylhet" });
  ok(r.status === 404, "copy with nothing earlier says so", r.data);

  r = await call("GET", `${A}/items`, admin.token);
  ok(r.status === 200 && r.data.length === 3 && r.data.some((i) => i.nameBn === "আলু"), "admin quick-pick list of products used before", r.data);

  r = await call("DELETE", `${A}/${ruiId}`, user.token);
  ok(r.status === 403, "a normal user can't delete", r.data);
  r = await call("DELETE", `${A}/${ruiId}`, admin.token);
  ok(r.status === 200, "admin deletes today's Rui price", r.data);
  r = await call("GET", "/api/market-prices?district=Dhaka");
  const rui2 = r.data?.items?.find((i) => i.itemKey === "rui-fish");
  ok(rui2 && rui2.date === y && rui2.avg === 360, "board falls back to the latest remaining day", rui2);
  await finish();
} catch (e) {
  await finish(e);
}
