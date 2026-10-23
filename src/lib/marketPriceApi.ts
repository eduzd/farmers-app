// Daily market prices (বাজার দর) posted by admins per district. See server/marketPriceRoutes.ts.
import { apiGet } from "@/lib/api";

export type MarketPrice = {
  id: string;
  itemKey: string;
  nameEn: string;
  nameBn: string;
  category: string;
  unit: string;
  district: string;
  market: string;
  min: number;
  max: number;
  avg: number;
  date: string;
  prevAvg: number | null;
  prevDate: string | null;
  change: number | null;
  changePct: number | null;
  trend: "up" | "down" | "stable";
};
export type MarketMeta = {
  districts: { district: string; items: number; lastDate: string }[];
  categories: string[];
  lastUpdated: string | null;
  today: string;
};

export const fetchMarketMeta = () => apiGet<MarketMeta>("/api/market-prices/meta");
export const fetchMarketPrices = (district: string, category: string, q = "") =>
  apiGet<{ items: MarketPrice[]; today: string }>(
    `/api/market-prices?district=${encodeURIComponent(district === "all" ? "" : district)}&category=${encodeURIComponent(category === "all" ? "" : category)}&q=${encodeURIComponent(q)}`,
  );
export const fetchPriceHistory = (item: string, district: string) =>
  apiGet<{ points: MarketPrice[] }>(`/api/market-prices/history?item=${encodeURIComponent(item)}&district=${encodeURIComponent(district)}`);

export const PRICE_CATEGORY_LABELS: Record<string, [string, string]> = {
  vegetables: ["Vegetables", "সবজি"],
  fruits: ["Fruits", "ফল"],
  grains: ["Rice & grains", "চাল ও শস্য"],
  fish: ["Fish", "মাছ"],
  livestock: ["Livestock & meat", "গবাদিপশু ও মাংস"],
  poultry: ["Poultry & eggs", "হাঁস-মুরগি ও ডিম"],
  dairy: ["Milk & dairy", "দুধ ও দুগ্ধজাত"],
  spices: ["Spices", "মসলা"],
  feed: ["Feed", "খাদ্য (ফিড)"],
  other: ["Other", "অন্যান্য"],
};
export const PRICE_UNIT_LABELS: Record<string, [string, string]> = {
  kg: ["kg", "কেজি"],
  maund: ["maund", "মণ"],
  litre: ["litre", "লিটার"],
  piece: ["piece", "পিস"],
  dozen: ["dozen", "ডজন"],
  hali: ["hali (4)", "হালি"],
  quintal: ["quintal", "কুইন্টাল"],
};
export const categoryLabel = (c: string, bn: boolean) => (PRICE_CATEGORY_LABELS[c] || [c, c])[bn ? 1 : 0];
export const unitLabel = (u: string, bn: boolean) => (PRICE_UNIT_LABELS[u] || [u, u])[bn ? 1 : 0];
export const bnNum = (n: number | string, bn: boolean) => {
  const s = typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n;
  return bn ? s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : s;
};
/** "Today", "Yesterday" or "22 Oct" in the user's language. */
export function dayLabel(date: string, today: string, bn: boolean) {
  if (!date) return "";
  if (date === today) return bn ? "আজ" : "Today";
  const y = new Date(Date.parse(today) - 864e5).toISOString().slice(0, 10);
  if (date === y) return bn ? "গতকাল" : "Yesterday";
  const d = new Date(date + "T00:00:00Z");
  const months = bn
    ? ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${bnNum(String(d.getUTCDate()), bn)} ${months[d.getUTCMonth()]}`;
}

/** All 64 districts of Bangladesh, [English, Bangla]. */
export const BD_DISTRICTS: [string, string][] = [
  ["Dhaka", "ঢাকা"],
  ["Gazipur", "গাজীপুর"],
  ["Narayanganj", "নারায়ণগঞ্জ"],
  ["Narsingdi", "নরসিংদী"],
  ["Manikganj", "মানিকগঞ্জ"],
  ["Munshiganj", "মুন্সীগঞ্জ"],
  ["Tangail", "টাঙ্গাইল"],
  ["Kishoreganj", "কিশোরগঞ্জ"],
  ["Faridpur", "ফরিদপুর"],
  ["Gopalganj", "গোপালগঞ্জ"],
  ["Madaripur", "মাদারীপুর"],
  ["Rajbari", "রাজবাড়ী"],
  ["Shariatpur", "শরীয়তপুর"],
  ["Chattogram", "চট্টগ্রাম"],
  ["Cox's Bazar", "কক্সবাজার"],
  ["Cumilla", "কুমিল্লা"],
  ["Brahmanbaria", "ব্রাহ্মণবাড়িয়া"],
  ["Chandpur", "চাঁদপুর"],
  ["Feni", "ফেনী"],
  ["Lakshmipur", "লক্ষ্মীপুর"],
  ["Noakhali", "নোয়াখালী"],
  ["Khagrachhari", "খাগড়াছড়ি"],
  ["Rangamati", "রাঙামাটি"],
  ["Bandarban", "বান্দরবান"],
  ["Rajshahi", "রাজশাহী"],
  ["Bogura", "বগুড়া"],
  ["Joypurhat", "জয়পুরহাট"],
  ["Naogaon", "নওগাঁ"],
  ["Natore", "নাটোর"],
  ["Chapainawabganj", "চাঁপাইনবাবগঞ্জ"],
  ["Pabna", "পাবনা"],
  ["Sirajganj", "সিরাজগঞ্জ"],
  ["Khulna", "খুলনা"],
  ["Bagerhat", "বাগেরহাট"],
  ["Satkhira", "সাতক্ষীরা"],
  ["Jashore", "যশোর"],
  ["Jhenaidah", "ঝিনাইদহ"],
  ["Magura", "মাগুরা"],
  ["Narail", "নড়াইল"],
  ["Kushtia", "কুষ্টিয়া"],
  ["Chuadanga", "চুয়াডাঙ্গা"],
  ["Meherpur", "মেহেরপুর"],
  ["Barishal", "বরিশাল"],
  ["Bhola", "ভোলা"],
  ["Patuakhali", "পটুয়াখালী"],
  ["Pirojpur", "পিরোজপুর"],
  ["Jhalokati", "ঝালকাঠি"],
  ["Barguna", "বরগুনা"],
  ["Sylhet", "সিলেট"],
  ["Moulvibazar", "মৌলভীবাজার"],
  ["Habiganj", "হবিগঞ্জ"],
  ["Sunamganj", "সুনামগঞ্জ"],
  ["Rangpur", "রংপুর"],
  ["Dinajpur", "দিনাজপুর"],
  ["Thakurgaon", "ঠাকুরগাঁও"],
  ["Panchagarh", "পঞ্চগড়"],
  ["Nilphamari", "নীলফামারী"],
  ["Lalmonirhat", "লালমনিরহাট"],
  ["Kurigram", "কুড়িগ্রাম"],
  ["Gaibandha", "গাইবান্ধা"],
  ["Mymensingh", "ময়মনসিংহ"],
  ["Jamalpur", "জামালপুর"],
  ["Sherpur", "শেরপুর"],
  ["Netrokona", "নেত্রকোনা"],
];
export const districtLabel = (d: string, bn: boolean) => (bn ? BD_DISTRICTS.find((x) => x[0].toLowerCase() === d.toLowerCase())?.[1] || d : d);
