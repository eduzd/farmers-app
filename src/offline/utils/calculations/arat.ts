export interface FeeItem {
  name: string;
  amount: number;
}

export interface AratInputs {
  weight_kg: number;
  rate_per_kg: number;
  pieces?: number;
  commission_percent: number;
  fees: FeeItem[];
  tax_percent?: number;
  extras: FeeItem[];
}

export interface AratOutputs {
  weight_kg: number;
  rate_per_kg: number;
  pieces: number;
  avg_weight: number;
  gross_amount: number;
  commission_amount: number;
  commission_percent: number;
  fees_breakdown: { name: string; amount: number }[];
  total_fees: number;
  tax_amount: number;
  extras_breakdown: { name: string; amount: number }[];
  total_extras: number;
  net_amount: number;
  per_piece_net: number;
}

export function calculateArat(inputs: AratInputs): AratOutputs {
  const {
    weight_kg,
    rate_per_kg,
    pieces = 0,
    commission_percent,
    fees,
    tax_percent = 0,
    extras,
  } = inputs;

  const avg_weight = pieces > 0 ? weight_kg / pieces : 0;
  const gross_amount = weight_kg * rate_per_kg;

  const commission_amount = gross_amount * (commission_percent / 100);

  const fees_breakdown = fees.map(fee => ({
    name: fee.name,
    amount: fee.amount,
  }));
  const total_fees = fees.reduce((sum, fee) => sum + fee.amount, 0);

  const tax_amount = gross_amount * (tax_percent / 100);

  const extras_breakdown = extras.map(extra => ({
    name: extra.name,
    amount: extra.amount,
  }));
  const total_extras = extras.reduce((sum, extra) => sum + extra.amount, 0);

  const net_amount = gross_amount - commission_amount - total_fees - tax_amount + total_extras;
  const per_piece_net = pieces > 0 ? net_amount / pieces : 0;

  return {
    weight_kg,
    rate_per_kg,
    pieces,
    avg_weight,
    gross_amount,
    commission_amount,
    commission_percent,
    fees_breakdown,
    total_fees,
    tax_amount,
    extras_breakdown,
    total_extras,
    net_amount,
    per_piece_net,
  };
}

export const defaultAratSettings = {
  commission_percent: 5,
  default_fees: [
    { name: 'Labour/Hamali', amount: 0 },
    { name: 'Ice', amount: 0 },
    { name: 'Transport', amount: 0 },
  ],
  tax_percent: 0,
};
