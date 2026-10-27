/**
 * Maya-style marketplace theme.
 *
 * The marketplace (Market tab, shops, product pages, cart, checkout and guest order
 * tracking) uses the visual language of maya.net: deep navy ink (#202936) for text and
 * primary buttons, sky blue (#37B1FF) for highlights and tags, a pale blue band
 * (#E3F4FF), hot pink (#FF4BB7) for prices, mint green (#00BB77) for "supported" /
 * success, flat white cards with a 1px #E6E6E6 hairline and 12px corners, DM Sans for
 * text and a heavy condensed display face for big headings. The rest of the app keeps
 * the Farmers green design system; only screens wrapped in <MayaScope> read these.
 *
 * Fonts: DM Sans and Anton are SIL Open Font License fonts (see assets/fonts/maya).
 * Maya's own heading face (JuturuBlaarr) is not openly licensed, so Anton, the closest
 * open condensed display face to its Impact fallback, stands in for it. Bangla text
 * still renders with Hind Siliguri because neither face has Bengali glyphs.
 */
import type { ThemeColors } from "@/constants/theme";

export const MayaPalette = {
  ink: "#202936", // primary buttons, headings, body text
  inkSoft: "#545454", // secondary text
  sky: "#37B1FF", // highlight, tags, "Most popular"
  skyStrong: "#0E8CE4", // sky blue dark enough for small link text
  skySoft: "#E3F4FF", // pale blue band / soft fills
  pink: "#FF4BB7", // prices
  pinkSoft: "#FFE6F4",
  green: "#00BB77", // supported / success
  greenBright: "#00CC58",
  mint: "#D8FFF2",
  violet: "#3D38D0",
  lavender: "#F2F2FF",
  amber: "#B25E09",
  red: "#DA2F2F",
  line: "#E6E6E6",
  surface: "#F9F9F9",
  surface2: "#F5F5F5",
  white: "#FFFFFF",
};

export const MayaColors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    primary: MayaPalette.ink,
    primaryTint: MayaPalette.sky,
    primaryDark: "#141A23",
    primarySoft: MayaPalette.skySoft,
    accent: MayaPalette.pink,
    accentSoft: MayaPalette.pinkSoft,
    text: MayaPalette.ink,
    textSecondary: MayaPalette.inkSoft,
    textTertiary: "#8A8F98",
    buttonText: "#FFFFFF",
    tabIconDefault: "#8A8F98",
    tabIconSelected: MayaPalette.ink,
    link: MayaPalette.skyStrong,
    backgroundRoot: MayaPalette.white,
    backgroundDefault: MayaPalette.white,
    backgroundSecondary: MayaPalette.surface2,
    backgroundTertiary: "#ECECEC",
    white: MayaPalette.white,
    overlay: "rgba(32, 41, 54, 0.45)",
    inputBorder: MayaPalette.line,
    inputBackground: MayaPalette.white,
    gradientStart: MayaPalette.sky,
    gradientEnd: MayaPalette.violet,
    card: MayaPalette.white,
    cardBorder: MayaPalette.line,
    cardText: MayaPalette.ink,
    surface: MayaPalette.white,
    surfaceSecondary: MayaPalette.surface,
    divider: "#EDEDED",
    border: MayaPalette.line,
    iconDefault: MayaPalette.ink,
    iconSecondary: MayaPalette.inkSoft,
    success: MayaPalette.green,
    error: MayaPalette.red,
    warning: MayaPalette.amber,
    info: MayaPalette.sky,
    shadow: "rgba(32, 41, 54, 0.08)",
  },
  // maya.net has no dark mode; this keeps the same navy / sky / pink voice on dark surfaces.
  dark: {
    primary: MayaPalette.sky,
    primaryTint: "#6CC6FF",
    primaryDark: "#1E8FD9",
    primarySoft: "#132A3D",
    accent: "#FF6EC4",
    accentSoft: "#3A1430",
    text: "#EEF2F7",
    textSecondary: "#A9B1BD",
    textTertiary: "#76808D",
    buttonText: "#0E131A",
    tabIconDefault: "#76808D",
    tabIconSelected: MayaPalette.sky,
    link: "#6CC6FF",
    backgroundRoot: "#0E131A",
    backgroundDefault: "#151B24",
    backgroundSecondary: "#1B222D",
    backgroundTertiary: "#242C38",
    white: "#151B24",
    overlay: "rgba(0, 0, 0, 0.7)",
    inputBorder: "#2A3340",
    inputBackground: "#151B24",
    gradientStart: "#1E8FD9",
    gradientEnd: "#3D38D0",
    card: "#151B24",
    cardBorder: "#26303C",
    cardText: "#EEF2F7",
    surface: "#1B222D",
    surfaceSecondary: "#151B24",
    divider: "#222A35",
    border: "#26303C",
    iconDefault: "#EEF2F7",
    iconSecondary: "#A9B1BD",
    success: "#22D193",
    error: "#F05252",
    warning: "#F2A23A",
    info: "#6CC6FF",
    shadow: "rgba(0, 0, 0, 0.5)",
  },
};

/** Price colour (Maya shows prices in hot pink). */
export function mayaPriceColor(isDark: boolean) {
  return isDark ? "#FF6EC4" : MayaPalette.pink;
}

export const MayaFontFamily = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  extrabold: "DMSans_800ExtraBold",
  display: "Anton_400Regular",
};

/** Plus Jakarta Sans (app default) -> DM Sans (Maya) for the same weight. */
export const MAYA_FONT_MAP: Record<string, string> = {
  PlusJakartaSans_400Regular: MayaFontFamily.regular,
  PlusJakartaSans_500Medium: MayaFontFamily.medium,
  PlusJakartaSans_600SemiBold: MayaFontFamily.semibold,
  PlusJakartaSans_700Bold: MayaFontFamily.bold,
  PlusJakartaSans_800ExtraBold: MayaFontFamily.extrabold,
};

/** Bangla fallbacks for the Maya faces (neither has Bengali glyphs). */
export const MayaBanglaFontFamily: Record<string, string> = {
  DMSans_400Regular: "HindSiliguri_400Regular",
  DMSans_500Medium: "HindSiliguri_500Medium",
  DMSans_600SemiBold: "HindSiliguri_600SemiBold",
  DMSans_700Bold: "HindSiliguri_700Bold",
  DMSans_800ExtraBold: "HindSiliguri_700Bold",
  Anton_400Regular: "HindSiliguri_700Bold",
};

/** Maya corners: 12px buttons and cards, 8px small buttons, pill chips. */
export const MayaRadius = { sm: 8, md: 12, lg: 12, xl: 16, pill: 999 };

/** Maya icon treatment: thin outline strokes. */
export const MAYA_ICON_STROKE = 1.5;
