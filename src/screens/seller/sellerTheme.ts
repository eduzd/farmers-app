/** Seller Hub look: clean business tool (slate + blue), separate from the main Farmers design. */
export const S = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  sidebar: "#202936",
  sidebarText: "#CBD5E1",
  sidebarActive: "#202936",
  border: "#E2E8F0",
  text: "#202936",
  muted: "#7A8CA3",
  faint: "#7A8CA3",
  primary: "#2E96EF",
  primarySoft: "#EFF6FF",
  success: "#00875A",
  successSoft: "#D8FFF2",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  danger: "#DA2F2F",
  dangerSoft: "#FEF2F2",
  radius: 10,
};

export const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "#B25E09", bg: "#FFF1DE" },
  confirmed: { fg: "#3D38D0", bg: "#E3F4FF" },
  processing: { fg: "#3D38D0", bg: "#EDE9FE" },
  shipped: { fg: "#1F86DB", bg: "#CFFAFE" },
  delivered: { fg: "#00875A", bg: "#D8FFF2" },
  cancelled: { fg: "#DA2F2F", bg: "#FEE2E2" },
};

export const NEXT_STATUS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const THEME_SWATCHES = ["#2E96EF", "#3D38D0", "#00875A", "#3D38D0", "#FF4BB7", "#B25E09", "#B25E09", "#202936"];
export const CATEGORIES = ["vegetables", "fruits", "grains", "fish", "livestock", "dairy", "seeds", "fertilizer", "equipment", "other"];
