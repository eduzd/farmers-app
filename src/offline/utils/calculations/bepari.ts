export interface WeightRow {
  weight_kg: number;
  pieces: number;
}

export interface DeductionItem {
  name: string;
  type: 'fixed' | 'percent' | 'weight_loss';
  value: number;
}

export interface ExtraItem {
  name: string;
  type: 'fixed' | 'per_kg';
  value: number;
}

export type RoundingMode = 'NEAREST' | 'FLOOR' | 'CEIL';

export interface StepRuleSettings {
  target_avg_weight_kg: number;
  base_price_per_kg: number;
  step_grams: number;
  step_price_change: number;
  rounding_mode: RoundingMode;
}

export interface PriceTableEntry {
  min_weight: number;
  max_weight: number;
  price_per_kg: number;
}

export interface BepariInputs {
  rows: WeightRow[];
  pricing_mode: 'STEP_RULE' | 'PRICE_TABLE';
  step_rule_settings?: StepRuleSettings;
  price_table?: PriceTableEntry[];
  deductions: DeductionItem[];
  extras: ExtraItem[];
}

export interface BepariOutputs {
  total_weight: number;
  total_pieces: number;
  avg_weight: number;
  final_price_per_kg: number;
  price_calculation_details: string;
  effective_weight: number;
  gross_amount: number;
  deductions_breakdown: { name: string; amount: number }[];
  extras_breakdown: { name: string; amount: number }[];
  total_deductions: number;
  total_extras: number;
  net_amount: number;
  per_piece_net: number;
}

function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case 'FLOOR':
      return Math.floor(value);
    case 'CEIL':
      return Math.ceil(value);
    case 'NEAREST':
    default:
      return Math.round(value);
  }
}

export function calculateBepari(inputs: BepariInputs): BepariOutputs {
  const { rows, pricing_mode, step_rule_settings, price_table, deductions, extras } = inputs;

  const total_weight = rows.reduce((sum, row) => sum + (row.weight_kg || 0), 0);
  const total_pieces = rows.reduce((sum, row) => sum + (row.pieces || 0), 0);
  const avg_weight = total_pieces > 0 ? total_weight / total_pieces : 0;

  let final_price_per_kg = 0;
  let price_calculation_details = '';

  if (pricing_mode === 'STEP_RULE' && step_rule_settings) {
    const {
      target_avg_weight_kg,
      base_price_per_kg,
      step_grams,
      step_price_change,
      rounding_mode,
    } = step_rule_settings;

    const diff_grams = (avg_weight - target_avg_weight_kg) * 1000;
    const steps = diff_grams / step_grams;
    const stepsRounded = applyRounding(steps, rounding_mode);
    final_price_per_kg = base_price_per_kg + stepsRounded * step_price_change;

    price_calculation_details = `Base: ${base_price_per_kg}, Steps: ${stepsRounded}, Change: ${step_price_change}/step`;
  } else if (pricing_mode === 'PRICE_TABLE' && price_table && price_table.length > 0) {
    let found = false;
    for (const entry of price_table) {
      if (avg_weight >= entry.min_weight && avg_weight <= entry.max_weight) {
        final_price_per_kg = entry.price_per_kg;
        price_calculation_details = `Table: ${entry.min_weight}-${entry.max_weight}kg = ${entry.price_per_kg}/kg`;
        found = true;
        break;
      }
    }
    if (!found) {
      const closest = price_table.reduce((prev, curr) => {
        const prevDiff = Math.abs((prev.min_weight + prev.max_weight) / 2 - avg_weight);
        const currDiff = Math.abs((curr.min_weight + curr.max_weight) / 2 - avg_weight);
        return currDiff < prevDiff ? curr : prev;
      });
      final_price_per_kg = closest.price_per_kg;
      price_calculation_details = `Closest: ${closest.min_weight}-${closest.max_weight}kg = ${closest.price_per_kg}/kg`;
    }
  }

  let effective_weight = total_weight;
  const deductions_breakdown: { name: string; amount: number }[] = [];
  let total_deductions = 0;

  for (const deduction of deductions) {
    let amount = 0;
    if (deduction.type === 'weight_loss') {
      effective_weight -= deduction.value;
      amount = deduction.value * final_price_per_kg;
      deductions_breakdown.push({ name: `${deduction.name} (${deduction.value}kg)`, amount });
    } else if (deduction.type === 'percent') {
      const percentLoss = effective_weight * (deduction.value / 100);
      effective_weight -= percentLoss;
      amount = percentLoss * final_price_per_kg;
      deductions_breakdown.push({ name: `${deduction.name} (${deduction.value}%)`, amount });
    } else if (deduction.type === 'fixed') {
      amount = deduction.value;
      deductions_breakdown.push({ name: deduction.name, amount });
    }
    total_deductions += amount;
  }

  const gross_amount = final_price_per_kg * effective_weight;

  const extras_breakdown: { name: string; amount: number }[] = [];
  let total_extras = 0;

  for (const extra of extras) {
    let amount = 0;
    if (extra.type === 'per_kg') {
      amount = extra.value * effective_weight;
      extras_breakdown.push({ name: `${extra.name} (${extra.value}/kg)`, amount });
    } else if (extra.type === 'fixed') {
      amount = extra.value;
      extras_breakdown.push({ name: extra.name, amount });
    }
    total_extras += amount;
  }

  const fixedDeductions = deductions
    .filter(d => d.type === 'fixed')
    .reduce((sum, d) => sum + d.value, 0);

  const net_amount = gross_amount - fixedDeductions + total_extras;
  const per_piece_net = total_pieces > 0 ? net_amount / total_pieces : 0;

  return {
    total_weight,
    total_pieces,
    avg_weight,
    final_price_per_kg,
    price_calculation_details,
    effective_weight,
    gross_amount,
    deductions_breakdown,
    extras_breakdown,
    total_deductions,
    total_extras,
    net_amount,
    per_piece_net,
  };
}

export const defaultStepRuleSettings: StepRuleSettings = {
  target_avg_weight_kg: 1.5,
  base_price_per_kg: 300,
  step_grams: 100,
  step_price_change: 5,
  rounding_mode: 'NEAREST',
};
