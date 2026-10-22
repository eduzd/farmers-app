/**
 * How a shop product is sold, shared by the server, the admin dashboard and the main app's shop,
 * so the amount a buyer can pick is checked by the same rules everywhere.
 *
 *   weight  kg / g / maund                 e.g. rice, fish feed
 *   volume  litre / ml                     e.g. milk, oil, BKC
 *   pack    bag / box / packet / sack / crate / bottle, each holding a fixed amount (packSize + packUnit)
 *   piece   one at a time                  e.g. a fish, a plant
 *   dozen   12 pieces                      e.g. eggs
 *
 * The admin sets per product: price per unit, stock (in the same unit), minimum, maximum, the step buyers
 * add at a time (e.g. 0.5 kg) and up to six quick amounts (e.g. 1, 5, 10 kg).
 * Products made before these settings existed keep working: whole numbers, step 1, minimum 1.
 */
export type SellAs = "weight" | "piece" | "pack" | "volume" | "dozen";
export const SELL_AS_LIST: SellAs[] = ["weight", "piece", "pack", "volume", "dozen"];
export const SELL_UNITS: Record<SellAs, string[]> = {
  weight: ["kg", "g", "maund"],
  piece: ["piece"],
  pack: ["bag", "box", "packet", "sack", "crate", "bottle"],
  volume: ["litre", "ml"],
  dozen: ["dozen"],
};
export const PACK_CONTENT = ["kg", "g", "litre", "ml", "pieces"];
/** Units where a part amount (2.5 kg, 1.5 litre) makes sense, so the admin may set a step below 1. */
export const PART_UNITS = ["kg", "maund", "litre"];
export const MAX_QTY = 9999;

const UNIT_NAMES: Record<string, [string, string, string]> = {
  // [english one, english many, bangla]
  kg: ["kg", "kg", "কেজি"], g: ["gram", "grams", "গ্রাম"], maund: ["maund", "maunds", "মণ"],
  piece: ["piece", "pieces", "পিস"], pieces: ["piece", "pieces", "পিস"], pcs: ["piece", "pieces", "পিস"],
  bag: ["bag", "bags", "ব্যাগ"], box: ["box", "boxes", "বক্স"], packet: ["packet", "packets", "প্যাকেট"],
  sack: ["sack", "sacks", "বস্তা"], crate: ["crate", "crates", "ক্রেট"], bottle: ["bottle", "bottles", "বোতল"],
  litre: ["litre", "litres", "লিটার"], liter: ["litre", "litres", "লিটার"], ml: ["ml", "ml", "মিলি"],
  dozen: ["dozen", "dozen", "ডজন"],
};

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const money = (n: number) => Math.round(n * 100) / 100;

/** "kg" / "bags" / "বস্তা" for an amount. */
export function unitWord(unit: string, amount = 1, bn = false): string {
  const u = String(unit || "").toLowerCase();
  const n = UNIT_NAMES[u];
  if (!n) return unit || "";
  return bn ? n[2] : amount === 1 ? n[0] : n[1];
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function num(n: number, bn = false): string {
  const s = String(round3(n));
  return bn ? s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : s;
}

export function guessSellAs(d: any): SellAs {
  if (d?.sellAs && (SELL_UNITS as any)[d.sellAs]) return d.sellAs;
  const u = String(d?.unit || "").toLowerCase();
  for (const k of SELL_AS_LIST) if (SELL_UNITS[k].includes(u)) return k;
  if (u === "liter" || u === "l") return "volume";
  if (u === "pcs" || u === "pieces") return "piece";
  return u ? "piece" : "weight";
}

export type SellRule = {
  sellAs: SellAs;
  unit: string;
  /** set by the admin with the new product form (false for older products) */
  configured: boolean;
  step: number;
  min: number;
  max: number | null;
  /** null = stock not tracked */
  stock: number | null;
  packSize: number | null;
  packUnit: string;
  presets: number[];
};

const pos = (v: any): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round3(n) : null;
};

export function sellRule(d: any): SellRule {
  const sellAs = guessSellAs(d);
  const unit = String(d?.unit || SELL_UNITS[sellAs][0]);
  const step = pos(d?.step) || 1;
  let min = pos(d?.minOrder) || step;
  if (min < step) min = step;
  const max = pos(d?.maxOrder);
  const stockRaw = d?.quantity;
  const stock = stockRaw === undefined || stockRaw === null || stockRaw === "" || Number.isNaN(Number(stockRaw)) ? null : Math.max(0, round3(Number(stockRaw)));
  const presets = (Array.isArray(d?.presets) ? d.presets : [])
    .map((x: any) => pos(x))
    .filter((x: number | null): x is number => x !== null && x >= min && (max === null || x <= max) && isStepMultiple(x, step))
    .slice(0, 6);
  return {
    sellAs, unit, configured: !!d?.sellAs, step, min, max, stock,
    packSize: sellAs === "pack" ? pos(d?.packSize) : null,
    packUnit: sellAs === "pack" ? String(d?.packUnit || "") : "",
    presets: ([...new Set(presets)] as number[]).sort((a, b) => a - b),
  };
}

export function isStepMultiple(qty: number, step: number) {
  const k = qty / step;
  return Math.abs(k - Math.round(k)) < 1e-6;
}

/** The most a buyer can order right now (max order and stock), or null for no limit below MAX_QTY. */
export function upperLimit(r: SellRule): number {
  let hi = MAX_QTY;
  if (r.max !== null) hi = Math.min(hi, r.max);
  if (r.stock !== null) hi = Math.min(hi, r.stock);
  // round down to a whole number of steps
  return round3(Math.floor(hi / r.step + 1e-9) * r.step);
}

/** Nearest allowed amount: on a step, between the minimum and the limit. */
export function clampQty(r: SellRule, q: number): number {
  if (!Number.isFinite(q)) q = r.min;
  let v = round3(Math.round(q / r.step) * r.step);
  if (v < r.min) v = r.min;
  const hi = upperLimit(r);
  if (hi >= r.min && v > hi) v = hi;
  return round3(v);
}

export type QtyProblem = { code: "amount" | "min" | "max" | "step" | "stock"; message: string };

/** Checks an amount a buyer asked for. Returns null when it is fine. Messages are English (server). */
export function checkQty(r: SellRule, q: any, name = "this product"): QtyProblem | null {
  const qty = Number(q);
  const u = (n: number) => `${num(n)} ${unitWord(r.unit, n)}`;
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) return { code: "amount", message: `Choose how much ${name} you want` };
  if (!isStepMultiple(qty, r.step)) return { code: "step", message: `${name} is sold in steps of ${u(r.step)}` };
  if (qty < r.min - 1e-9) return { code: "min", message: `${name} has a minimum order of ${u(r.min)}` };
  if (r.max !== null && qty > r.max + 1e-9) return { code: "max", message: `You can order up to ${u(r.max)} of ${name}` };
  if (r.stock !== null && qty > r.stock + 1e-9) return { code: "stock", message: `Only ${u(r.stock)} of ${name} left` };
  return null;
}

/** "per kg", "per bag (25 kg)", "per bottle (500 ml)" */
export function perUnitText(r: SellRule, bn = false): string {
  const pack = r.sellAs === "pack" && r.packSize ? ` (${num(r.packSize, bn)} ${unitWord(r.packUnit, r.packSize, bn)})` : "";
  const dozen = r.sellAs === "dozen" ? (bn ? " (১২ পিস)" : " (12 pieces)") : "";
  return bn ? `প্রতি ${unitWord(r.unit, 1, true)}${pack}${dozen}` : `per ${unitWord(r.unit, 1)}${pack}${dozen}`;
}

/** "2.5 kg", "3 bags", "৩ বস্তা" */
export function amountText(r: { unit: string }, qty: number, bn = false): string {
  return `${num(qty, bn)} ${unitWord(r.unit, qty, bn)}`;
}

/** For packs: what the whole amount comes to, e.g. 3 bags of 25 kg -> "75 kg in all". */
export function totalContentText(r: SellRule, qty: number, bn = false): string {
  if (r.sellAs === "pack" && r.packSize) {
    const t = round3(r.packSize * qty);
    return bn ? `মোট ${num(t, bn)} ${unitWord(r.packUnit, t, true)}` : `${num(t)} ${unitWord(r.packUnit, t)} in all`;
  }
  if (r.sellAs === "dozen") return bn ? `মোট ${num(qty * 12, true)} পিস` : `${num(qty * 12)} pieces in all`;
  return "";
}

/** What gets saved on each order line so the order always says how it was sold. */
export function lineSaleInfo(r: SellRule) {
  return { unit: r.unit, sellAs: r.sellAs, ...(r.packSize ? { packSize: r.packSize, packUnit: r.packUnit } : {}), step: r.step };
}

/** One order line as people read it: "2.5 kg", "3 bags (25 kg each)", or just "2" for old orders with no unit. */
export function orderLineText(it: { quantity?: any; unit?: string; sellAs?: string; packSize?: any; packUnit?: string }, bn = false): string {
  const q = Number(it?.quantity) || 1;
  if (!it?.unit) return num(q, bn);
  const pack = it.sellAs === "pack" && Number(it.packSize) > 0
    ? bn ? ` (প্রতিটি ${num(Number(it.packSize), true)} ${unitWord(it.packUnit || "", Number(it.packSize), true)})` : ` (${num(Number(it.packSize))} ${unitWord(it.packUnit || "", Number(it.packSize))} each)`
    : "";
  return `${num(q, bn)} ${unitWord(it.unit, q, bn)}${pack}`;
}
