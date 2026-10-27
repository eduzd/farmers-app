/**
 * Seller Hub look: clean business tool (slate + blue), separate from the main Farmers design.
 * It has a light and a dark set; SellerAppScreen calls setSellerDark() at the top of each render,
 * and S / STATUS_COLORS always read the current set, so every piece of the hub follows dark mode.
 */
const LIGHT = {
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
  warning: "#B25E09",
  warningSoft: "#FFFBEB",
  danger: "#DA2F2F",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  thead: "#F8FAFC",
  radius: 10,
};
export type SellerPalette = typeof LIGHT;

// Same deep Maya navy as the main app's dark mode: darker page, slightly raised cards, soft white text.
const DARK: SellerPalette = {
  bg: "#0B1119",
  surface: "#141C27",
  sidebar: "#0F1620",
  sidebarText: "#A9B8CC",
  sidebarActive: "#1E2A3B",
  border: "#233146",
  text: "#E6EEF7",
  muted: "#A6B8CC",
  faint: "#8095AD",
  primary: "#2E96EF",
  primarySoft: "#132A40",
  success: "#22D193",
  successSoft: "#0E3026",
  warning: "#F2A23A",
  warningSoft: "#382810",
  danger: "#F26464",
  dangerSoft: "#3A1618",
  dangerBorder: "#5C2428",
  thead: "#101823",
  radius: 10,
};

const STATUS_LIGHT: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "#B25E09", bg: "#FFF1DE" },
  confirmed: { fg: "#3D38D0", bg: "#E3F4FF" },
  processing: { fg: "#3D38D0", bg: "#EDE9FE" },
  shipped: { fg: "#1F86DB", bg: "#CFFAFE" },
  delivered: { fg: "#00875A", bg: "#D8FFF2" },
  cancelled: { fg: "#DA2F2F", bg: "#FEE2E2" },
};
const STATUS_DARK: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "#F2A23A", bg: "#382810" },
  confirmed: { fg: "#A29EFF", bg: "#211F4A" },
  processing: { fg: "#A29EFF", bg: "#211F4A" },
  shipped: { fg: "#6CC6FF", bg: "#132A40" },
  delivered: { fg: "#22D193", bg: "#0E3026" },
  cancelled: { fg: "#FF7B7B", bg: "#3A1618" },
};

let dark = false;
export function setSellerDark(d: boolean) {
  dark = !!d;
}
export function isSellerDark() {
  return dark;
}
export const SELLER_LIGHT = LIGHT;
export const SELLER_DARK = DARK;

export const S: SellerPalette = new Proxy({} as SellerPalette, {
  get: (_t, k: string) => (dark ? DARK : LIGHT)[k as keyof SellerPalette],
});

export const STATUS_COLORS: Record<string, { fg: string; bg: string }> = new Proxy({} as Record<string, { fg: string; bg: string }>, {
  get: (_t, k: string) => (dark ? STATUS_DARK : STATUS_LIGHT)[k],
  has: (_t, k: string) => k in STATUS_LIGHT,
  ownKeys: () => Reflect.ownKeys(STATUS_LIGHT),
  getOwnPropertyDescriptor: (_t, k: string) =>
    k in STATUS_LIGHT ? { enumerable: true, configurable: true, value: (dark ? STATUS_DARK : STATUS_LIGHT)[k] } : undefined,
});

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
