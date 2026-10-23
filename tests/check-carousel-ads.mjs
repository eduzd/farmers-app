// Carousel ads on a throwaway local server: the public feed returns EVERY live ad for a page
// (no three-card cap, well past the old 12 limit), in the admin's order, with Everywhere ads on
// both Home and Connect, and hidden / ended ads left out.
//   node tests/check-carousel-ads.mjs
import { ok, call, setup, finish } from "./harness.mjs";

const A = "/api/admin/manage/ads";
try {
  const [admin, user] = await setup(["boss", "farmer"]);

  let r = await call("GET", "/api/ads?placement=home");
  ok(r.status === 200 && Array.isArray(r.data) && r.data.length === 0, "no ads yet: empty list (app shows its built-in cards)", r);

  // 7 Home ads, 5 Connect ads, 2 Everywhere ads, 1 Market ad
  const made = { home: [], connect: [], all: [], market: [] };
  const plan = [["home", 7], ["connect", 5], ["all", 2], ["market", 1]];
  for (const [placement, n] of plan) {
    for (let i = 1; i <= n; i++) {
      const c = await call("POST", A, admin.token, {
        titleEn: `${placement} ad ${i}`, titleBn: `${placement} বিজ্ঞাপন ${i}`, subtitleEn: `line ${i}`, ctaEn: "Shop now", ctaBn: "কিনুন",
        placement, linkType: i % 2 ? "product" : "url", linkTarget: i % 2 ? `p-${i}` : `https://example.com/${i}`,
      });
      if (c.status === 201) made[placement].push(c.data.id);
    }
  }
  ok(made.home.length === 7 && made.connect.length === 5 && made.all.length === 2 && made.market.length === 1, "admin creates 15 ads", made);

  r = await call("GET", "/api/ads?placement=home");
  ok(r.data?.length === 9, "Home gets all 7 Home ads + 2 Everywhere ads (more than three)", r.data?.map((a) => a.titleEn));
  r = await call("GET", "/api/ads?placement=connect");
  ok(r.data?.length === 7, "Connect gets all 5 Connect ads + 2 Everywhere ads", r.data?.map((a) => a.titleEn));
  ok(r.data?.every((a) => a.placement === "connect" || a.placement === "all"), "Connect never gets Home or Market ads");
  ok(r.data?.[0]?.linkType === "product" && r.data?.[0]?.linkTarget === "p-1" && r.data?.[1]?.linkType === "url", "tap targets come through", r.data?.slice(0, 2));
  ok(r.data?.[0]?.titleBn && r.data?.[0]?.ctaBn === "কিনুন", "Bangla text comes through");

  // order follows the admin's reorder
  const connectIds = (await call("GET", A, admin.token)).data.map((a) => a.id);
  const reversed = [...connectIds].reverse();
  await call("POST", `${A}/reorder`, admin.token, { ids: reversed });
  r = await call("GET", "/api/ads?placement=connect");
  const expected = reversed.filter((id) => made.connect.includes(id) || made.all.includes(id));
  ok(JSON.stringify(r.data.map((a) => a.id)) === JSON.stringify(expected), "Connect order follows the admin's order");

  // hidden / ended are left out
  await call("PUT", `${A}/${made.connect[0]}`, admin.token, { active: false });
  await call("PUT", `${A}/${made.connect[1]}`, admin.token, { endsAt: "2020-01-01" });
  r = await call("GET", "/api/ads?placement=connect");
  ok(r.data.length === 5 && !r.data.some((a) => a.id === made.connect[0] || a.id === made.connect[1]), "hidden and ended ads are not shown", r.data.map((a) => a.titleEn));

  // well past the old cap of 12 on one page
  for (let i = 8; i <= 20; i++) await call("POST", A, admin.token, { titleEn: `home ad ${i}`, placement: "home" });
  r = await call("GET", "/api/ads?placement=home");
  ok(r.data?.length === 22, "Home with 20 Home ads + 2 Everywhere shows all 22 (old limit was 12)", r.data?.length);

  // public read needs no account; admin list stays admin-only
  r = await call("GET", A, user.token);
  ok(r.status === 403 || r.status === 401, "normal user can't read the admin ad list", r.status);
} catch (e) {
  await finish(e);
}
await finish();
