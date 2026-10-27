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
  expert: { icon: "school", color: "#3D38D0", label: "Farming expert", labelBn: "কৃষি বিশেষজ্ঞ", shape: "square" },
  crops: { icon: "rice", color: "#B25E09", label: "Crops farming", labelBn: "ফসল চাষ", shape: "circle" },
  vegetables: { icon: "carrot", color: "#B25E09", label: "Vegetables", labelBn: "সবজি চাষ", shape: "circle" },
  fruits: { icon: "food-apple", color: "#DA2F2F", label: "Fruits", labelBn: "ফল চাষ", shape: "circle" },
  dairy: { icon: "cow", color: "#2E96EF", label: "Dairy farming", labelBn: "দুগ্ধ খামার", shape: "circle" },
  poultry: { icon: "egg", color: "#FF4BB7", label: "Poultry", labelBn: "পোল্ট্রি", shape: "circle" },
  fish: { icon: "fish", color: "#39B1FE", label: "Fish farming", labelBn: "মৎস্য চাষ", shape: "circle" },
  livestock: { icon: "sheep", color: "#B25E09", label: "Livestock", labelBn: "পশুপালন", shape: "circle" },
  organic: { icon: "leaf", color: "#00BB77", label: "Organic farming", labelBn: "জৈব চাষ", shape: "circle" },
  mixed: { icon: "barn", color: "#3D38D0", label: "Mixed farming", labelBn: "মিশ্র চাষ", shape: "circle" },
  farmer: { icon: "sprout", color: "#202936", label: "Farmer", labelBn: "কৃষক", shape: "circle" },
  buyer: { icon: "cart", color: "#00BB77", label: "Buyer", labelBn: "ক্রেতা", shape: "square" },
  company: { icon: "office-building", color: "#4A5568", label: "Company", labelBn: "প্রতিষ্ঠান", shape: "square" },
};

/** Badge key for a user: an expert shows the expert badge, otherwise the farming category, otherwise the role. */
export function badgeKeyFor(u?: { role?: string | null; farmingCategory?: string | null } | null): string | undefined {
  if (!u) return undefined;
  if (u.role === "expert") return "expert";
  if (u.farmingCategory && PROFILE_BADGES[u.farmingCategory]) return u.farmingCategory;
  if (u.role && PROFILE_BADGES[u.role]) return u.role;
  return undefined;
}
