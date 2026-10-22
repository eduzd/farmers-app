/**
 * Checks the admin product form rules (src/admin/productFormRules.ts) and the shared selling units:
 * kg <-> gram style conversion, contradictory minimum / maximum / step / quick amounts, missing
 * required fields, Bangla messages, and the new units (ton, hali, pair, jar...).
 * Run: npx tsx tests/check-product-form.ts
 */
import { checkProduct, convertNumbers, unitName } from "../src/admin/productFormRules";
import { sellRule, perUnitText, totalContentText, clampQty, upperLimit, SELL_UNITS, isStepMultiple } from "../shared/selling";

const en = (a: string) => a;
const bn = (_a: string, b: string) => b;
let pass = 0, fail = 0;
const ok = (name: string, cond: any, extra?: any) => {
  if (cond) pass++; else { fail++; console.log("FAIL", name, extra === undefined ? "" : JSON.stringify(extra)); }
};
const base = { name: "Rui", category: "fish", sellAs: "weight", unit: "kg", price: "80", quantity: "100", packSize: "", packUnit: "kg", minOrder: "", maxOrder: "", step: "", presets: "", harvestDate: "" };
const chk = (o: any, L: any = en) => checkProduct({ ...base, ...o }, L);

// ---- conversions ----
let c = convertNumbers({ ...base, minOrder: "1", maxOrder: "5", step: "0.5", presets: "1, 2, 5" }, "kg", "g");
ok("kg->g price", c.price === "0.08", c.price);
ok("kg->g stock", c.quantity === "100000", c.quantity);
ok("kg->g min/max/step", c.minOrder === "1000" && c.maxOrder === "5000" && c.step === "500", c);
ok("kg->g presets", c.presets === "1000, 2000, 5000", c.presets);
ok("kg->g unit", c.unit === "g");
ok("kg->g result valid", chk(c).errors.length === 0, chk(c).errors);
c = convertNumbers({ ...base, maxOrder: "50" }, "kg", "g");
ok("kg->g too big max flagged", /Too big.*kg/.test(chk(c).fe.maxOrder || ""), chk(c).fe);
c = convertNumbers({ ...base, unit: "g", price: "2", quantity: "5000", minOrder: "100", step: "50", presets: "100, 250" }, "g", "kg");
ok("g->kg", c.price === "2000" && c.quantity === "5" && c.minOrder === "0.1" && c.step === "0.05" && c.presets === "0.1, 0.25", c);
ok("g->kg result valid", chk(c).errors.length === 0, chk(c).errors);
c = convertNumbers({ ...base, unit: "maund", price: "1600", quantity: "10", minOrder: "1" }, "maund", "kg");
ok("maund->kg", c.price === "40" && c.quantity === "400" && c.minOrder === "40", c);
c = convertNumbers({ ...base, unit: "ton", price: "40000", quantity: "2" }, "ton", "kg");
ok("ton->kg", c.price === "40" && c.quantity === "2000", c);
c = convertNumbers({ ...base, sellAs: "volume", unit: "litre", price: "300", quantity: "20", step: "0.5" }, "litre", "ml");
ok("litre->ml", c.price === "0.3" && c.quantity === "20000" && c.step === "500", c);
c = convertNumbers({ ...base, price: "75", minOrder: "", presets: "" }, "kg", "g");
ok("kg->g keeps empty fields empty, price 3 decimals", c.price === "0.075" && c.minOrder === "" && c.presets === "", c);

// ---- valid setups ----
ok("plain kg valid", chk({}).errors.length === 0, chk({}).errors);
ok("fish kg template valid", chk({ step: "0.5", minOrder: "1", presets: "1, 2, 5, 10" }).errors.length === 0);
ok("seeds by gram valid", chk({ unit: "g", price: "2", quantity: "5000", step: "50", minOrder: "100", presets: "100, 250, 500, 1000" }).errors.length === 0);
ok("fry by piece valid", chk({ sellAs: "piece", unit: "piece", step: "50", minOrder: "100", presets: "100, 500, 1000", quantity: "5000" }).errors.length === 0);
ok("feed sack valid", chk({ sellAs: "pack", unit: "sack", packSize: "25", packUnit: "kg", presets: "1, 2, 5, 10" }).errors.length === 0);
ok("eggs hali valid", chk({ sellAs: "dozen", unit: "hali", presets: "1, 2, 3, 5" }).errors.length === 0);
ok("zero stock is allowed (out of stock)", chk({ quantity: "0", minOrder: "5" }).errors.length === 0, chk({ quantity: "0", minOrder: "5" }).errors);

// ---- contradictory limits ----
let r = chk({ minOrder: "10", maxOrder: "5" });
ok("max below min", /less than the minimum/.test(r.fe.maxOrder || ""), r.fe);
r = chk({ step: "0.5", minOrder: "0.7" });
ok("min off step", /fit the \+ amount/.test(r.fe.minOrder || ""), r.fe);
r = chk({ step: "5", maxOrder: "12" });
ok("max off step", /fit the \+ amount/.test(r.fe.maxOrder || ""), r.fe);
r = chk({ step: "5", maxOrder: "3" });
ok("max below one step", !!r.fe.maxOrder, r.fe);
r = chk({ quantity: "3", minOrder: "5" });
ok("min above stock", /stock/.test(r.fe.minOrder || ""), r.fe);
r = chk({ sellAs: "piece", unit: "piece", step: "0.5" });
ok("half step for piece", /whole number/.test(r.fe.step || ""), r.fe);
r = chk({ sellAs: "dozen", unit: "dozen", minOrder: "1.5" });
ok("1.5 dozen min", /whole number/.test(r.fe.minOrder || ""), r.fe);
r = chk({ unit: "g", step: "0.5" });
ok("half gram step", /whole number/.test(r.fe.step || ""), r.fe);
r = chk({ minOrder: "2", maxOrder: "10", presets: "1, 5, 20" });
ok("quick amounts outside limits", r.badPresets.join(",") === "1,20" && !!r.fe.presets, r);
r = chk({ step: "0.5", presets: "0.75, 1" });
ok("quick amount off step", r.badPresets.join(",") === "0.75", r.badPresets);
r = chk({ presets: "1, 2, 3, 4, 5, 6, 7" });
ok("more than 6 quick amounts", /6/.test(r.fe.presets || ""), r.fe);
r = chk({ step: "0" });
ok("step 0", !!r.fe.step, r.fe);
r = chk({ maxOrder: "-3" });
ok("negative max", !!r.fe.maxOrder, r.fe);
r = chk({ minOrder: "abc" });
ok("text in min", !!r.fe.minOrder, r.fe);
r = chk({ price: "0" });
ok("price 0", !!r.fe.price, r.fe);
r = chk({ quantity: "-1" });
ok("negative stock", !!r.fe.quantity, r.fe);
r = chk({ minOrder: "20000" });
ok("min above 9999", /Too big.*maund or ton/.test(r.fe.minOrder || ""), r.fe);
r = chk({ harvestDate: "20-10-2026" });
ok("bad date", !!r.fe.harvestDate, r.fe);

// ---- required ----
r = chk({ name: " ", category: "", price: "" });
ok("required name/category/price", r.needed.length === 3, r.needed);
r = chk({ sellAs: "pack", unit: "bag", packSize: "" });
ok("pack needs amount inside", r.needed.some((x) => /one bag/.test(x)), r.needed);

// ---- Bangla ----
r = chk({ minOrder: "10", maxOrder: "5" }, bn);
ok("bangla message", /সর্বনিম্নের/.test(r.fe.maxOrder || ""), r.fe);
ok("bangla unit names", unitName("hali", bn) === "হালি" && unitName("ton", bn) === "টন" && unitName("bucket", bn) === "বালতি");

// ---- shared selling: new units ----
ok("new units listed", SELL_UNITS.weight.includes("ton") && SELL_UNITS.dozen.includes("hali") && SELL_UNITS.pack.includes("jar"));
let rule = sellRule({ sellAs: "dozen", unit: "hali", quantity: 50 });
ok("hali per-unit text", /4 pieces/.test(perUnitText(rule, false)), perUnitText(rule, false));
ok("hali total", /12 pieces in all/.test(totalContentText(rule, 3, false)), totalContentText(rule, 3, false));
rule = sellRule({ sellAs: "dozen", unit: "dozen", quantity: 50 });
ok("dozen still 12", /12 pieces/.test(perUnitText(rule, false)) && /24 pieces/.test(totalContentText(rule, 2, false)));
rule = sellRule({ sellAs: "weight", unit: "ton", quantity: 10, step: 0.5, minOrder: 1 });
ok("ton allows halves", clampQty(rule, 1.5) === 1.5 && upperLimit(rule) === 10, [clampQty(rule, 1.5), upperLimit(rule)]);
rule = sellRule({ sellAs: "weight", unit: "g", quantity: 5000, step: 50, minOrder: 100, maxOrder: 1000 });
ok("gram clamps to step and max", clampQty(rule, 130) === 150 && clampQty(rule, 5000) === 1000 && clampQty(rule, 10) === 100, [clampQty(rule, 130), clampQty(rule, 5000), clampQty(rule, 10)]);
ok("isStepMultiple float", isStepMultiple(0.3, 0.1) && isStepMultiple(1.5, 0.25) === true);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
