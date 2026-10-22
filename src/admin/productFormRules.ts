/**
 * Pure rules behind the admin product form (no React), so they can be checked on their own:
 * unit names, every field check and the kg <-> gram style conversion. Data rules are shared/selling.ts.
 */
import { PART_UNITS, UNIT_IN_BASE, MAX_QTY, round3, isStepMultiple, type SellAs } from "@shared/selling";

export type LFn = (en: string, bn: string) => string;

export const BN = "০১২৩৪৫৬৭৮৯";
export const n2s = (n: number) => String(round3(n));
export const bnNum = (s: string | number) => String(s).replace(/[0-9]/g, (d) => BN[Number(d)]);
export const tk = (n: number) => `৳${(Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const numOk = (v: any) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));

export const unitName = (u: string, L: LFn) =>
  (({
    kg: L("kg", "কেজি"), g: L("gram", "গ্রাম"), maund: L("maund", "মণ"), ton: L("ton", "টন"), piece: L("piece", "পিস"), pieces: L("pieces", "পিস"),
    bag: L("bag", "ব্যাগ"), box: L("box", "বক্স"), packet: L("packet", "প্যাকেট"), sack: L("sack", "বস্তা"), crate: L("crate", "ক্রেট"),
    bottle: L("bottle", "বোতল"), jar: L("jar", "জার"), can: L("can", "ক্যান"), pouch: L("pouch", "পাউচ"), tray: L("tray", "ট্রে"),
    carton: L("carton", "কার্টন"), drum: L("drum", "ড্রাম"), bucket: L("bucket", "বালতি"),
    litre: L("litre", "লিটার"), ml: L("ml", "মিলি"), dozen: L("dozen", "ডজন"), hali: L("hali", "হালি"), pair: L("pair", "জোড়া"),
  } as Record<string, string>)[u] || u);

/**
 * Every check on the form, as a pure function (also used by tests/check-product-form.ts).
 * fe: a problem per field, shown under that field. needed: required things still missing.
 */
export function checkProduct(f: any, L: LFn, N: (s: string | number) => string = String) {
  const sellAs = f.sellAs as SellAs;
  const unitLabel = unitName(f.unit, L);
  const stepN = Number(f.step) > 0 ? Number(f.step) : 1;
  const partOk = PART_UNITS.includes(f.unit);
  const onStep = (v: number) => isStepMultiple(v, stepN); // the same test the server uses
  const presetList: number[] = String(f.presets || "").split(/[,\s]+/).filter(Boolean).map(Number);
  const minN = Number(f.minOrder) > 0 ? Number(f.minOrder) : stepN;
  const maxN = Number(f.maxOrder) > 0 ? Number(f.maxOrder) : null;
  const fe: Record<string, string> = {}; // problem per field, shown under it
  const needed: string[] = []; // missing required things, shown after the first save tap
  if (!f.name.trim()) needed.push(L("Write the product name", "পণ্যের নাম লিখুন"));
  if (!f.category) needed.push(L("Pick a category", "ক্যাটাগরি বেছে নিন"));
  if (!(Number(f.price) > 0)) (String(f.price).trim() ? (fe.price = L("Price must be a number more than 0", "দাম ০-এর বেশি সংখ্যা হতে হবে")) : needed.push(L("Write the price", "দাম লিখুন")));
  if (sellAs === "pack" && !(Number(f.packSize) > 0)) (String(f.packSize).trim() ? (fe.packSize = L("Write a number more than 0", "০-এর বেশি সংখ্যা লিখুন")) : needed.push(L(`Write how much is in one ${unitLabel}`, `এক ${unitLabel}-এ কতটুকু আছে লিখুন`)));
  if (String(f.quantity).trim() && !(Number(f.quantity) >= 0)) fe.quantity = L("Stock must be a number", "স্টক সংখ্যা হতে হবে");
  const whole = (v: any) => Number.isInteger(Number(v));
  const bigger = f.unit === "g" ? ["kg", "কেজি"] : f.unit === "ml" ? ["litre", "লিটার"] : f.unit === "kg" ? ["maund or ton", "মণ বা টন"] : null;
  const big = L(`Too big. Use a larger unit${bigger ? ` (like ${bigger[0]})` : ""}.`, `অনেক বেশি। বড় একক ব্যবহার করুন${bigger ? ` (যেমন ${bigger[1]})` : ""}।`);
  if (String(f.step).trim()) {
    if (!(Number(f.step) > 0)) fe.step = L("Write a number more than 0", "০-এর বেশি সংখ্যা লিখুন");
    else if (!partOk && !whole(f.step)) fe.step = L(`Use a whole number for ${unitLabel}`, `${unitLabel}-এর জন্য পূর্ণ সংখ্যা দিন`);
    else if (Number(f.step) > MAX_QTY) fe.step = big;
  }
  if (String(f.minOrder).trim()) {
    if (!(Number(f.minOrder) > 0)) fe.minOrder = L("Write a number more than 0, or leave it empty", "০-এর বেশি সংখ্যা লিখুন, অথবা খালি রাখুন");
    else if (!partOk && !whole(f.minOrder)) fe.minOrder = L(`Use a whole number for ${unitLabel}`, `${unitLabel}-এর জন্য পূর্ণ সংখ্যা দিন`);
    else if (Number(f.minOrder) > MAX_QTY) fe.minOrder = big;
    else if (!fe.step && !onStep(Number(f.minOrder))) fe.minOrder = L(`It has to fit the + amount: ${n2s(stepN)}, ${n2s(stepN * 2)}, ${n2s(stepN * 3)} ${unitLabel}…`, `এটি + পরিমাণের সাথে মিলতে হবে: ${N(n2s(stepN))}, ${N(n2s(stepN * 2))}, ${N(n2s(stepN * 3))} ${unitLabel}…`);
    else if (Number(f.quantity) > 0 && Number(f.minOrder) > Number(f.quantity)) fe.minOrder = L("Can't be more than your stock", "আপনার স্টকের বেশি হতে পারে না");
  }
  if (String(f.maxOrder).trim()) {
    if (!(Number(f.maxOrder) > 0)) fe.maxOrder = L("Write a number more than 0, or leave it empty for no limit", "০-এর বেশি সংখ্যা লিখুন, অথবা সীমা না চাইলে খালি রাখুন");
    else if (!partOk && !whole(f.maxOrder)) fe.maxOrder = L(`Use a whole number for ${unitLabel}`, `${unitLabel}-এর জন্য পূর্ণ সংখ্যা দিন`);
    else if (Number(f.maxOrder) > MAX_QTY) fe.maxOrder = big;
    else if (Number(f.maxOrder) < minN) fe.maxOrder = L(`Can't be less than the minimum (${n2s(minN)} ${unitLabel})`, `সর্বনিম্নের (${N(n2s(minN))} ${unitLabel}) কম হতে পারে না`);
    else if (!fe.step && !onStep(Number(f.maxOrder))) fe.maxOrder = L(`It has to fit the + amount (${n2s(stepN)} ${unitLabel} at a time)`, `এটি + পরিমাণের (একবারে ${N(n2s(stepN))} ${unitLabel}) সাথে মিলতে হবে`);
  }
  const badPresets = presetList.filter((v) => !(v > 0) || v > MAX_QTY || (!partOk && !Number.isInteger(v)) || (!fe.step && !onStep(v)) || v < minN - 1e-9 || (maxN !== null && v > maxN + 1e-9));
  if (badPresets.length) fe.presets = L(`These don't fit your order rules: ${badPresets.map(n2s).join(", ")}. Each must be between the minimum and maximum and fit the + amount.`, `এগুলো অর্ডারের নিয়মের সাথে মেলে না: ${badPresets.map((v) => N(n2s(v))).join(", ")}। প্রতিটি সর্বনিম্ন ও সর্বোচ্চের মধ্যে এবং + পরিমাণের সাথে মিলতে হবে।`);
  else if (presetList.length > 6) fe.presets = L("Up to 6 quick buttons", "সর্বোচ্চ ৬টি দ্রুত বোতাম");
  if (f.harvestDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.harvestDate)) fe.harvestDate = L("Use YYYY-MM-DD, e.g. 2026-10-20", "YYYY-MM-DD লিখুন, যেমন 2026-10-20");
  const errors = [...needed, ...Object.values(fe)];
  return { stepN, partOk, presetList, minN, maxN, fe, needed, badPresets, errors };
}

/** Changes the typed numbers when the unit switches within weight or volume (kg -> g multiplies amounts by 1000, divides the price by 1000). */
export function convertNumbers(x: any, from: string, to: string) {
  const r = UNIT_IN_BASE[from].factor / UNIT_IN_BASE[to].factor;
  const amt = (v: string) => (numOk(v) && String(v).trim() ? n2s(Number(v) * r) : v);
  return {
    ...x,
    unit: to,
    price: numOk(x.price) && String(x.price).trim() ? String(Math.round((Number(x.price) / r) * 1000) / 1000) : x.price,
    quantity: amt(x.quantity), minOrder: amt(x.minOrder), maxOrder: amt(x.maxOrder), step: amt(x.step),
    presets: String(x.presets || "").split(/[,\s]+/).filter(Boolean).map((p: string) => amt(p)).join(", "),
  };
}

