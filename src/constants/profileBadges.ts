import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * The small badge on the bottom-left of a person's avatar, and the matching chip on the
 * profile page. It comes from what they picked when they set up their account: the farming
 * category, or the role (expert, buyer, company).
 *
 * Every category has its own icon and its own colour, so a dairy farmer, a fish farmer and an
 * expert never look alike. Farming categories are round badges; roles (expert, buyer,
 * company) are rounded squares, so an expert stands out from farmers at a glance.
 */
export type ProfileBadgeIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export interface ProfileBadge {
  icon: ProfileBadgeIconName;
  color: string;
  label: string;
  labelBn: string;
  shape: "circle" | "square";
}

export const PROFILE_BADGES: Record<string, ProfileBadge> = {
  expert: { icon: "school", color: "#7C3AED", label: "Farming expert", labelBn: "কৃষি বিশেষজ্ঞ", shape: "square" },
  crops: { icon: "rice", color: "#CA8A04", label: "Crops farming", labelBn: "ফসল চাষ", shape: "circle" },
  vegetables: { icon: "carrot", color: "#EA580C", label: "Vegetables", labelBn: "সবজি চাষ", shape: "circle" },
  fruits: { icon: "food-apple", color: "#DC2626", label: "Fruits", labelBn: "ফল চাষ", shape: "circle" },
  dairy: { icon: "cow", color: "#2563EB", label: "Dairy farming", labelBn: "দুগ্ধ খামার", shape: "circle" },
  poultry: { icon: "egg", color: "#DB2777", label: "Poultry", labelBn: "পোল্ট্রি", shape: "circle" },
  fish: { icon: "fish", color: "#0891B2", label: "Fish farming", labelBn: "মৎস্য চাষ", shape: "circle" },
  livestock: { icon: "sheep", color: "#92400E", label: "Livestock", labelBn: "পশুপালন", shape: "circle" },
  organic: { icon: "leaf", color: "#16A34A", label: "Organic farming", labelBn: "জৈব চাষ", shape: "circle" },
  mixed: { icon: "barn", color: "#4F46E5", label: "Mixed farming", labelBn: "মিশ্র চাষ", shape: "circle" },
  farmer: { icon: "sprout", color: "#14583A", label: "Farmer", labelBn: "কৃষক", shape: "circle" },
  buyer: { icon: "cart", color: "#0D9488", label: "Buyer", labelBn: "ক্রেতা", shape: "square" },
  company: { icon: "office-building", color: "#475569", label: "Company", labelBn: "প্রতিষ্ঠান", shape: "square" },
};

/** Badge key for a user: an expert shows the expert badge, otherwise the farming category, otherwise the role. */
export function badgeKeyFor(u?: { role?: string | null; farmingCategory?: string | null } | null): string | undefined {
  if (!u) return undefined;
  if (u.role === "expert") return "expert";
  if (u.farmingCategory && PROFILE_BADGES[u.farmingCategory]) return u.farmingCategory;
  if (u.role && PROFILE_BADGES[u.role]) return u.role;
  return undefined;
}
