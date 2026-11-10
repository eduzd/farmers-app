/**
 * Feed Making Calculator: the ingredient list in the name dropdown.
 * Common fish feed ingredients in Bangladesh; edit the list here (English + Bangla name).
 * The farmer can also type any name; names typed before are kept on the phone and shown
 * in the dropdown too (setting `feed_mix_custom_ingredients`).
 */
export interface FeedIngredientOption {
  en: string;
  bn: string;
  /**
   * Typical crude protein %, filled into the row when the ingredient is picked (the farmer can change it).
   * Reference values, not a lab test; real batches vary. Bangladesh market samples reported in published
   * studies: fish meal 51-65 %, mustard oil cake 35-37 %, wheat bran 15 %, DORB 14-18 %, soybean meal 43-48 %,
   * MBM 48-55 %, maize 8-11 %, rice bran 6-14.5 %. Additives that are not a protein source are 0.
   */
  protein?: number;
}

/** The reference protein % for a name from the list (English or Bangla), or undefined. */
export function referenceProtein(name: string): number | undefined {
  const k = name.trim().toLowerCase();
  if (!k) return undefined;
  const hit = FEED_INGREDIENTS.find((o) => o.en.toLowerCase() === k || o.bn.toLowerCase() === k);
  return hit?.protein;
}

export const FEED_INGREDIENTS: FeedIngredientOption[] = [
  // brans and grains (energy)
  { en: 'De-oiled rice bran (DORB)', bn: 'ডি-অয়েলড রাইস ব্র্যান (DORB)', protein: 15 },
  { en: 'Rice bran (A grade)', bn: 'চালের কুঁড়া (এ গ্রেড)', protein: 12 },
  { en: 'Rice bran (B grade)', bn: 'চালের কুঁড়া (বি গ্রেড)', protein: 8 },
  { en: 'Rice polish', bn: 'রাইস পালিশ', protein: 12 },
  { en: 'Rice', bn: 'চাল', protein: 7 },
  { en: 'Broken rice', bn: 'খুদ', protein: 8 },
  { en: 'Wheat bran', bn: 'গমের ভুসি', protein: 15 },
  { en: 'Wheat flour', bn: 'আটা', protein: 14 },
  { en: 'Maize (corn)', bn: 'ভুট্টা', protein: 9 },
  { en: 'Starch', bn: 'স্টার্চ', protein: 0 },
  { en: 'Molasses', bn: 'চিটাগুড়', protein: 3 },
  // plant proteins
  { en: 'Soybean meal', bn: 'সয়াবিন মিল', protein: 44 },
  { en: 'Full-fat soybean', bn: 'ফুল ফ্যাট সয়াবিন', protein: 38 },
  { en: 'Mustard oil cake', bn: 'সরিষার খৈল', protein: 35 },
  { en: 'Rapeseed meal', bn: 'রেপসিড মিল', protein: 36 },
  { en: 'Sesame oil cake', bn: 'তিলের খৈল', protein: 40 },
  { en: 'Corn gluten meal', bn: 'কর্ন গ্লুটেন মিল', protein: 60 },
  { en: 'DDGS', bn: 'ডিডিজিএস (DDGS)', protein: 27 },
  // animal proteins
  { en: 'Fish meal', bn: 'ফিশ মিল', protein: 55 },
  { en: 'Dry fish / shutki dust', bn: 'শুঁটকি গুঁড়া', protein: 45 },
  { en: 'Meat and bone meal (MBM)', bn: 'মিট অ্যান্ড বোন মিল (MBM)', protein: 50 },
  { en: 'Poultry by-product meal', bn: 'পোল্ট্রি বাই-প্রোডাক্ট মিল', protein: 60 },
  { en: 'Blood meal', bn: 'ব্লাড মিল', protein: 80 },
  // oils
  { en: 'Soybean oil', bn: 'সয়াবিন তেল', protein: 0 },
  { en: 'Fish oil', bn: 'ফিশ অয়েল', protein: 0 },
  // minerals and additives
  { en: 'Lime / limestone powder', bn: 'চুন / লাইমস্টোন পাউডার', protein: 0 },
  { en: 'Ground shell (oyster/snail)', bn: 'ঝিনুক / শামুকের খোসা গুঁড়া', protein: 0 },
  { en: 'Dicalcium phosphate (DCP)', bn: 'ডাই-ক্যালসিয়াম ফসফেট (DCP)', protein: 0 },
  { en: 'Salt', bn: 'লবণ', protein: 0 },
  { en: 'Vitamin and mineral premix', bn: 'ভিটামিন-মিনারেল প্রিমিক্স', protein: 0 },
  { en: 'Lysine', bn: 'লাইসিন' },
  { en: 'Methionine', bn: 'মেথিওনিন' },
  { en: 'Binder', bn: 'বাইন্ডার', protein: 0 },
  { en: 'Toxin binder', bn: 'টক্সিন বাইন্ডার', protein: 0 },
  { en: 'Mould inhibitor', bn: 'ছত্রাকরোধী (মোল্ড ইনহিবিটর)', protein: 0 },
  { en: 'Enzyme', bn: 'এনজাইম', protein: 0 },
];

/** Ready-made feed types for the AI protein check; the farmer can type any other. */
export const FEED_TYPES: FeedIngredientOption[] = [
  { en: 'Tilapia grower', bn: 'তেলাপিয়া গ্রোয়ার' },
  { en: 'Pangasius grower', bn: 'পাঙ্গাস গ্রোয়ার' },
  { en: 'Carp (Rui/Katla) grower', bn: 'কার্প (রুই/কাতলা) গ্রোয়ার' },
  { en: 'Koi (climbing perch) grower', bn: 'কই গ্রোয়ার' },
  { en: 'Fish nursery / starter', bn: 'নার্সারি / স্টার্টার' },
  { en: 'Shrimp grower', bn: 'চিংড়ি গ্রোয়ার' },
];
