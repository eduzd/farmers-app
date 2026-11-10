// Number checks for the Feed Making Calculator. Run: npx tsx tests/feed-mix-calc.test.ts
import { calculateFeedMix, parseNum, fmtTaka, DEFAULT_FEED_MIX_SETTINGS } from '../src/screens/calculate/feedMixCalc';
import { FEED_INGREDIENTS, referenceProtein } from '../src/screens/calculate/feedIngredients';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); }
};
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const row = (name: string, kg: string, price: string, protein = '') => ({ name, kg, price, protein });
const S = (o: Partial<typeof DEFAULT_FEED_MIX_SETTINGS> = {}) => ({ ...DEFAULT_FEED_MIX_SETTINGS, ...o });

// parseNum
ok('plain', parseNum('12.5') === 12.5);
ok('bangla digits', parseNum('১২৩.৫') === 123.5);
ok('thousands commas', parseNum('10,000') === 10000);
ok('lakh commas', parseNum('1,25,000.5') === 125000.5);
ok('decimal comma', parseNum('12,5') === 12.5);
ok('spaces', parseNum(' 10 000 ') === 10000);
ok('empty NaN', Number.isNaN(parseNum('')));
ok('junk NaN', Number.isNaN(parseNum('abc')));

// empty -> null
ok('empty rows null', calculateFeedMix([row('', '', '')], S()) === null);

// worked example: 600 kg DORB @ 32 (15%), 300 kg mustard cake @ 55 (35%), 100 kg fish meal @ 140 (55%)
const rows = [row('DORB', '600', '32', '15'), row('Mustard oil cake', '300', '55', '35'), row('Fish meal', '100', '140', '55'), row('', '', '')];
const r = calculateFeedMix(rows, S({ millingCharge: '250', millingBasisKg: '100', lossPercent: '2', bagKg: '25' }))!;
ok('total kg', r.totalKg === 1000, r.totalKg);
ok('ingredient cost', near(r.ingredientCost, 600 * 32 + 300 * 55 + 100 * 140), r.ingredientCost); // 49,700
ok('milling', near(r.millingCost, 2500), r.millingCost);
ok('total cost', near(r.totalCost, 52200), r.totalCost);
ok('loss kg', near(r.lossKg, 20), r.lossKg);
ok('usable', near(r.usableKg, 980), r.usableKg);
ok('bags', near(r.bags, 39.2), r.bags);
ok('full bags', r.fullBags === 39 && near(r.leftoverKg, 5), [r.fullBags, r.leftoverKg]);
ok('cost per usable kg', near(r.costPerUsableKg, 52200 / 980), r.costPerUsableKg);
ok('cost per bag', near(r.costPerBag, (52200 / 980) * 25), r.costPerBag);
ok('protein', near(r.proteinPercent, (600 * 15 + 300 * 35 + 100 * 55) / 1000), r.proteinPercent); // 25.0
ok('no problems', r.problems.length === 0, r.problems);

// per 1000 kg basis
const r2 = calculateFeedMix(rows, S({ millingCharge: '2000', millingBasisKg: '1000' }))!;
ok('milling per 1000', near(r2.millingCost, 2000), r2.millingCost);

// zero / empty basis is safe
for (const b of ['0', '', 'abc']) {
  const z = calculateFeedMix(rows, S({ millingCharge: '250', millingBasisKg: b }))!;
  ok(`basis ${JSON.stringify(b)} safe`, Number.isFinite(z.millingCost) && Number.isFinite(z.totalCost) && Number.isFinite(z.costPerBag), z);
}
const zb = calculateFeedMix(rows, S({ millingCharge: '250', millingBasisKg: '0' }))!;
ok('basis 0 flagged', zb.problems.includes('basis') && zb.millingCost === 0);

// loss 100% or more is refused, never divides by zero
const l = calculateFeedMix(rows, S({ lossPercent: '100' }))!;
ok('loss 100 safe', Number.isFinite(l.costPerBag) && l.problems.includes('loss'), l);
const bag0 = calculateFeedMix(rows, S({ bagKg: '0' }))!;
ok('bag 0 safe', Number.isFinite(bag0.bags) && bag0.problems.includes('bag'), bag0);

// large: 12 tons and more, decimals
const big = calculateFeedMix([row('Maize', '12,500.75', '38.5', '9'), row('Soybean meal', '2500.25', '72.25', '44')], S({ millingCharge: '3000', millingBasisKg: '1000', lossPercent: '1.5' }))!;
ok('big total kg', near(big.totalKg, 15001), big.totalKg);
ok('big cost', near(big.ingredientCost, 12500.75 * 38.5 + 2500.25 * 72.25), big.ingredientCost);
ok('big milling', near(big.millingCost, 15001 / 1000 * 3000), big.millingCost);
ok('big usable', near(big.usableKg, 15001 * 0.985), big.usableKg);
ok('big bags', near(big.bags, 15001 * 0.985 / 25), big.bags);
ok('taka format big', fmtTaka(1234567.891) === '৳1,234,567.89', fmtTaka(1234567.891));
const huge = calculateFeedMix([row('Rice bran', '100000', '30', '12')], S())!;
ok('100 tons', near(huge.totalKg, 100000) && near(huge.ingredientCost, 3000000));

// missing protein counts as 0 and is reported
const mp = calculateFeedMix([row('A', '50', '10', '40'), row('Custom', '50', '10', '')], S())!;
ok('missing protein', near(mp.proteinPercent, 20) && mp.proteinMissing.join() === '2', mp);
const bad = calculateFeedMix([row('A', '50', '10', '140')], S())!;
ok('protein >100 flagged', bad.problems.includes('protein'), bad.problems);

// row with kg but no price still counts weight
const np = calculateFeedMix([row('Salt', '5', '', '0')], S())!;
ok('kg without price', np.totalKg === 5 && np.ingredientCost === 0);

// ingredient list
const names = FEED_INGREDIENTS.map((o) => o.en);
for (const must of ['De-oiled rice bran (DORB)', 'Rice', 'Lime / limestone powder', 'Salt', 'Mustard oil cake', 'Rapeseed meal', 'Fish meal', 'Soybean meal', 'Maize (corn)', 'Wheat bran', 'Broken rice', 'Molasses', 'Vitamin and mineral premix']) ok(`list has ${must}`, names.includes(must));
ok('every item bangla', FEED_INGREDIENTS.every((o) => o.bn && o.bn !== o.en));
ok('protein on all but amino acids', FEED_INGREDIENTS.filter((o) => typeof o.protein !== 'number').map((o) => o.en).join() === 'Lysine,Methionine');
ok('ref protein bn', referenceProtein('সরিষার খৈল') === 35 || referenceProtein('Mustard oil cake') === 35);
console.log(`feed-mix-calc: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
