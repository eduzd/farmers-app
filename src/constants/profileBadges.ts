import { Feather } from "@expo/vector-icons";

/**
 * The small badge on the bottom-left of a person's avatar. It comes from what they picked
 * when they set up their account: the farming category, or the role (expert, buyer, company).
 */
export interface ProfileBadge {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  label: string;
  labelBn: string;
}

export const PROFILE_BADGES: Record<string, ProfileBadge> = {
  expert: { icon: "award", color: "#DB2777", label: "Farming expert", labelBn: "কৃষি বিশেষজ্ঞ" },
  crops: { icon: "sun", color: "#2FA36B", label: "Crops farming", labelBn: "ফসল চাষ" },
  vegetables: { icon: "feather", color: "#16A34A", label: "Vegetables", labelBn: "সবজি চাষ" },
  fruits: { icon: "gift", color: "#EA8A0C", label: "Fruits", labelBn: "ফল চাষ" },
  dairy: { icon: "droplet", color: "#2563EB", label: "Dairy farming", labelBn: "দুগ্ধ খামার" },
  poultry: { icon: "sunrise", color: "#B45309", label: "Poultry", labelBn: "পোল্ট্রি" },
  fish: { icon: "anchor", color: "#0891B2", label: "Fish farming", labelBn: "মৎস্য চাষ" },
  livestock: { icon: "shield", color: "#92400E", label: "Livestock", labelBn: "পশুপালন" },
  organic: { icon: "heart", color: "#65A30D", label: "Organic farming", labelBn: "জৈব চাষ" },
  mixed: { icon: "grid", color: "#7C3AED", label: "Mixed farming", labelBn: "মিশ্র চাষ" },
  farmer: { icon: "sun", color: "#14583A", label: "Farmer", labelBn: "কৃষক" },
  buyer: { icon: "shopping-cart", color: "#0D9488", label: "Buyer", labelBn: "ক্রেতা" },
  company: { icon: "briefcase", color: "#475569", label: "Company", labelBn: "প্রতিষ্ঠান" },
};

/** Badge key for a user: an expert shows the expert badge, otherwise the farming category, otherwise the role. */
export function badgeKeyFor(u?: { role?: string | null; farmingCategory?: string | null } | null): string | undefined {
  if (!u) return undefined;
  if (u.role === "expert") return "expert";
  if (u.farmingCategory && PROFILE_BADGES[u.farmingCategory]) return u.farmingCategory;
  if (u.role && PROFILE_BADGES[u.role]) return u.role;
  return undefined;
}
