export interface FeedInputs {
  fish_count: number;
  avg_weight_kg: number;
  feed_rate_percent_per_day: number;
  days_in_month: number;
  wastage_percent?: number;
  bag_size_kg?: number;
  bag_price?: number;
  morning_percent?: number;
}

export interface FeedOutputs {
  fish_count: number;
  avg_weight_kg: number;
  biomass: number;
  feed_rate_percent: number;
  daily_feed_kg: number;
  monthly_feed_kg: number;
  wastage_kg: number;
  total_feed_with_wastage_kg: number;
  bag_size_kg: number;
  total_bags: number;
  bag_price: number;
  total_cost: number;
  morning_feed_kg: number;
  evening_feed_kg: number;
  morning_percent: number;
  evening_percent: number;
}

export function calculateFeed(inputs: FeedInputs): FeedOutputs {
  const {
    fish_count,
    avg_weight_kg,
    feed_rate_percent_per_day,
    days_in_month,
    wastage_percent = 0,
    bag_size_kg = 25,
    bag_price = 0,
    morning_percent = 40,
  } = inputs;

  const biomass = fish_count * avg_weight_kg;
  const daily_feed_kg = biomass * (feed_rate_percent_per_day / 100);
  const monthly_feed_kg = daily_feed_kg * days_in_month;
  const wastage_kg = monthly_feed_kg * (wastage_percent / 100);
  const total_feed_with_wastage_kg = monthly_feed_kg + wastage_kg;

  const total_bags = Math.ceil(total_feed_with_wastage_kg / bag_size_kg);
  const total_cost = total_bags * bag_price;

  const morning_feed_kg = daily_feed_kg * (morning_percent / 100);
  const evening_percent = 100 - morning_percent;
  const evening_feed_kg = daily_feed_kg * (evening_percent / 100);

  return {
    fish_count,
    avg_weight_kg,
    biomass,
    feed_rate_percent: feed_rate_percent_per_day,
    daily_feed_kg,
    monthly_feed_kg,
    wastage_kg,
    total_feed_with_wastage_kg,
    bag_size_kg,
    total_bags,
    bag_price,
    total_cost,
    morning_feed_kg,
    evening_feed_kg,
    morning_percent,
    evening_percent,
  };
}

export const defaultFeedSettings = {
  feed_rate_percent_per_day: 3,
  days_in_month: 30,
  wastage_percent: 5,
  bag_size_kg: 25,
  morning_percent: 40,
};
