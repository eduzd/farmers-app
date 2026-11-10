/**
 * Feed Making Calculator: the cost of making one batch of fish feed.
 *
 * Ingredients:   cost of each = kg x price per kg; their kg and cost are added up.
 * Protein:       mix protein % = sum(kg x protein %) / total kg (an ingredient with no protein %
 *                entered counts as 0 and is listed in `proteinMissing`).
 * Milling:       milling cost = total kg / basis kg x charge (e.g. 500 taka for every 100 kg).
 * Total cost:    ingredients + milling.
 * Loss:          usable kg = total kg - total kg x loss %. The whole cost is carried by the usable kg,
 *                so the loss raises the cost of every usable kg and every bag.
 * Bags:          bags = usable kg / bag size (25 kg); cost per bag = total cost / bags.
 *
 * Pure functions only, so the numbers can be tested without the screen.
 */

export interface FeedMixRow {
  name: string;
  kg: string;
  price: string;
  protein: string;
}

export interface FeedMixSettings {
  /** Milling charge in taka for every `millingBasisKg` kg. */
  millingCharge: string;
  /** The weight the milling charge is for, e.g. 100 or 1000 kg. */
  millingBasisKg: string;
  /** Weight lost while making the feed, in percent of the total weight. */
  lossPercent: string;
  /** Weight of one bag in kg. */
  bagKg: string;
}

export const DEFAULT_FEED_MIX_SETTINGS: FeedMixSettings = {
  millingCharge: '',
  millingBasisKg: '100',
  lossPercent: '',
  bagKg: '25',
};

export const EMPTY_FEED_MIX_ROW: FeedMixRow = { name: '', kg: '', price: '', protein: '' };

export interface FeedMixLine {
  index: number;
  name: string;
  kg: number;
  price: number;
  protein: number | null;
  cost: number;
  /** Share of the total weight, in percent. */
  sharePercent: number;
}

export type FeedMixProblem = 'basis' | 'loss' | 'bag' | 'protein';

export interface FeedMixResult {
  lines: FeedMixLine[];
  totalKg: number;
  ingredientCost: number;
  millingCharge: number;
  millingBasisKg: number;
  millingCost: number;
  totalCost: number;
  lossPercent: number;
  lossKg: number;
  usableKg: number;
  bagKg: number;
  bags: number;
  fullBags: number;
  leftoverKg: number;
  costPerInputKg: number;
  costPerUsableKg: number;
  costPerBag: number;
  /** Weighted protein % of the mix (by weight). */
  proteinPercent: number;
  proteinKg: number;
  /** Ingredients (1-based row numbers) that have weight but no protein %. */
  proteinMissing: number[];
  /** Inputs that could not be used; the matching parts are left at 0. */
  problems: FeedMixProblem[];
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Reads a typed number; Bangla digits and a comma decimal are accepted. Blank or bad -> NaN. */
export function parseNum(v: unknown): number {
  if (typeof v === 'number') return v;
  let s = String(v ?? '')
    .trim()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[\s_]/g, '');
  // "10,000" / "1,25,000.5" (thousands or lakh commas) -> commas dropped; a single "12,5" is a decimal comma.
  if (/^-?\d{1,3}(,\d{2,3})*,\d{3}(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (s === '' || s === '.') return NaN;
  if (!/^-?\d*\.?\d*$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** A row counts once it has a weight above 0. */
export function isFilledRow(r: FeedMixRow): boolean {
  return pos(parseNum(r.kg)) > 0;
}

export function calculateFeedMix(rows: FeedMixRow[], settings: FeedMixSettings): FeedMixResult | null {
  const problems: FeedMixProblem[] = [];
  const raw = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => isFilledRow(r));
  if (raw.length === 0) return null;

  let totalKg = 0;
  let ingredientCost = 0;
  let proteinWeighted = 0;
  const proteinMissing: number[] = [];
  const pre = raw.map(({ r, i }) => {
    const kg = pos(parseNum(r.kg));
    const price = pos(parseNum(r.price));
    const pRaw = parseNum(r.protein);
    let protein: number | null = Number.isFinite(pRaw) && pRaw >= 0 ? pRaw : null;
    if (protein !== null && protein > 100) {
      protein = null;
      if (!problems.includes('protein')) problems.push('protein');
    }
    if (protein === null) proteinMissing.push(i + 1);
    const cost = kg * price;
    totalKg += kg;
    ingredientCost += cost;
    proteinWeighted += kg * (protein ?? 0);
    return { index: i + 1, name: (r.name || '').trim(), kg, price, protein, cost };
  });
  const lines: FeedMixLine[] = pre.map((l) => ({ ...l, sharePercent: totalKg > 0 ? (l.kg / totalKg) * 100 : 0 }));

  // Milling: charge for every `basis` kg, scaled to the batch.
  const chargeRaw = parseNum(settings.millingCharge);
  const millingCharge = pos(chargeRaw);
  const basisRaw = parseNum(settings.millingBasisKg);
  const millingBasisKg = pos(basisRaw);
  let millingCost = 0;
  if (millingCharge > 0) {
    if (millingBasisKg > 0) millingCost = (totalKg / millingBasisKg) * millingCharge;
    else problems.push('basis');
  }

  const totalCost = ingredientCost + millingCost;

  // Loss: 0 to under 100 %.
  const lossRaw = parseNum(settings.lossPercent);
  let lossPercent = 0;
  if (Number.isFinite(lossRaw) && lossRaw !== 0) {
    if (lossRaw > 0 && lossRaw < 100) lossPercent = lossRaw;
    else problems.push('loss');
  }
  const lossKg = (totalKg * lossPercent) / 100;
  const usableKg = totalKg - lossKg;

  // Bags of `bagKg` kg (25 kg unless changed).
  const bagRaw = parseNum(settings.bagKg);
  let bagKg = pos(bagRaw);
  if (!(bagKg > 0)) {
    if (String(settings.bagKg ?? '').trim() !== '') problems.push('bag');
    bagKg = 25;
  }
  const bags = usableKg / bagKg;
  const fullBags = Math.floor(bags + 1e-9);
  const leftoverKg = Math.max(0, usableKg - fullBags * bagKg);

  const costPerInputKg = totalKg > 0 ? totalCost / totalKg : 0;
  const costPerUsableKg = usableKg > 0 ? totalCost / usableKg : 0;
  const costPerBag = bags > 0 ? totalCost / bags : 0;

  const proteinPercent = totalKg > 0 ? proteinWeighted / totalKg : 0;
  const proteinKg = proteinWeighted / 100;

  return {
    lines,
    totalKg,
    ingredientCost,
    millingCharge,
    millingBasisKg,
    millingCost,
    totalCost,
    lossPercent,
    lossKg,
    usableKg,
    bagKg,
    bags,
    fullBags,
    leftoverKg,
    costPerInputKg,
    costPerUsableKg,
    costPerBag,
    proteinPercent,
    proteinKg,
    proteinMissing,
    problems,
  };
}

/** Rounds for display: up to `d` decimals, trailing zeros dropped (12.50 -> 12.5, 3.00 -> 3). */
export function fmtNum(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(d);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Taka with thousands separators and 2 decimals at most. */
export function fmtTaka(n: number, d = 2): string {
  if (!Number.isFinite(n)) n = 0;
  const [i, f] = fmtNum(Math.abs(n), d).split('.');
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}৳${withCommas}${f ? `.${f}` : ''}`;
}
