/** Seller Hub look: clean business tool (slate + blue), separate from the main Farmers design. */
export const S = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  sidebar: "#0F172A",
  sidebarText: "#CBD5E1",
  sidebarActive: "#1E293B",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  faint: "#94A3B8",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  success: "#059669",
  successSoft: "#ECFDF5",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  radius: 10,
};

export const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "#B45309", bg: "#FEF3C7" },
  confirmed: { fg: "#1D4ED8", bg: "#DBEAFE" },
  processing: { fg: "#6D28D9", bg: "#EDE9FE" },
  shipped: { fg: "#0E7490", bg: "#CFFAFE" },
  delivered: { fg: "#047857", bg: "#D1FAE5" },
  cancelled: { fg: "#B91C1C", bg: "#FEE2E2" },
};

export const NEXT_STATUS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const THEME_SWATCHES = ["#2563EB", "#0F766E", "#059669", "#7C3AED", "#DB2777", "#EA580C", "#CA8A04", "#0F172A"];
export const CATEGORIES = ["vegetables", "fruits", "grains", "fish", "livestock", "dairy", "seeds", "fertilizer", "equipment", "other"];
