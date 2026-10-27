/**
 * Maya-style theme for the whole app (main app and admin dashboard).
 *
 * Every screen uses the visual language of maya.net: deep navy ink (#202936) for text and
 * primary buttons, sky blue (#37B1FF) for highlights and tags, a pale blue band
 * (#E3F4FF), Maya pink (#FF4BB7) as the accent, mint green (#00BB77) for "supported" /
 * success, flat white cards with a 1px #E6E6E6 hairline and 12px corners, DM Sans for
 * text and a heavy condensed display face for big headings.
 *
 * Fonts: DM Sans and Anton are SIL Open Font License fonts (see assets/fonts/maya).
 * Maya's own heading face (JuturuBlaarr) is not openly licensed, so Anton, the closest
 * open condensed display face to its Impact fallback, stands in for it. Bangla text
 * still renders with Hind Siliguri because neither face has Bengali glyphs.
 */
import type { ThemeColors } from "@/constants/theme";

export const MayaPalette = {
  ink: "#202936", // Maya navy: headings, body text, dark buttons
  inkSoft: "#4A5568", // navy-tinted secondary text
  sky: "#39B1FE", // Maya sky blue: icons, highlights, tags, bands
  skyStrong: "#2E96EF", // Maya link blue: primary buttons and active states
  skySoft: "#E3F4FF", // Maya pale blue band
  skyMist: "#F3FAFF", // lightest step of the pale blue band, page background
  pink: "#FF4BB7", // Maya pink: prices, favourites, badges
  pinkSoft: "#FFD5EE", // Maya pink band
  green: "#00BB77", // Maya "supported" green
  greenBright: "#00CC58",
  mint: "#D8FFF2", // Maya mint band
  mintStrong: "#B0FFE2",
  violet: "#3D38D0",
  lavender: "#F2F2FF",
  amber: "#B25E09",
  red: "#DA2F2F",
  line: "#D6EAF8", // pale-blue hairline instead of grey
  surface: "#F3FAFF",
  surface2: "#E3F4FF",
  white: "#FFFFFF",
};

/**
 * Maya colours for the whole app. Colour comes from Maya's own bands and accents: sky blue for
 * buttons, icons and active states, navy for text, pink for prices and favourites, pale blue,
 * pink and mint bands for soft fills. No neutral greys.
 */
export const MayaColors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    primary: MayaPalette.skyStrong,
    primaryTint: MayaPalette.sky,
    primaryDark: MayaPalette.ink,
    primarySoft: MayaPalette.skySoft,
    accent: MayaPalette.pink,
    accentSoft: MayaPalette.pinkSoft,
    text: MayaPalette.ink,
    textSecondary: MayaPalette.inkSoft,
    textTertiary: "#7A8CA3",
    buttonText: "#FFFFFF",
    tabIconDefault: "#7A8CA3",
    tabIconSelected: MayaPalette.skyStrong,
    link: MayaPalette.skyStrong,
    backgroundRoot: MayaPalette.skyMist,
    backgroundDefault: MayaPalette.white,
    backgroundSecondary: MayaPalette.skySoft,
    backgroundTertiary: "#CFEBFF",
    white: MayaPalette.white,
    overlay: "rgba(32, 41, 54, 0.45)",
    inputBorder: "#C7E3F8",
    inputBackground: MayaPalette.white,
    gradientStart: MayaPalette.sky,
    gradientEnd: MayaPalette.violet,
    card: MayaPalette.white,
    cardBorder: MayaPalette.line,
    cardText: MayaPalette.ink,
    surface: MayaPalette.white,
    surfaceSecondary: MayaPalette.skyMist,
    divider: "#E1F0FB",
    border: MayaPalette.line,
    iconDefault: MayaPalette.ink,
    iconSecondary: "#5E7FA3",
    success: MayaPalette.green,
    error: MayaPalette.red,
    warning: MayaPalette.amber,
    info: MayaPalette.sky,
    shadow: "rgba(46, 150, 239, 0.12)",
  },
  // maya.net has no dark mode; this is Maya navy with the same sky blue and pink accents.
  dark: {
    primary: MayaPalette.skyStrong,
    primaryTint: MayaPalette.sky,
    primaryDark: "#1F86DB",
    primarySoft: "#16324D",
    accent: "#FF6EC4",
    accentSoft: "#4A1A3B",
    text: "#EEF6FF",
    textSecondary: "#A9C2DC",
    textTertiary: "#7891AC",
    buttonText: "#FFFFFF",
    tabIconDefault: "#7891AC",
    tabIconSelected: MayaPalette.sky,
    link: "#6CC6FF",
    backgroundRoot: "#141B26",
    backgroundDefault: "#202936",
    backgroundSecondary: "#253247",
    backgroundTertiary: "#2C3B54",
    white: "#202936",
    overlay: "rgba(5, 10, 18, 0.72)",
    inputBorder: "#33445E",
    inputBackground: "#202936",
    gradientStart: "#1E8FD9",
    gradientEnd: MayaPalette.violet,
    card: "#202936",
    cardBorder: "#2F3F57",
    cardText: "#EEF6FF",
    surface: "#253247",
    surfaceSecondary: "#202936",
    divider: "#2A384D",
    border: "#2F3F57",
    iconDefault: "#EEF6FF",
    iconSecondary: "#8FB4DA",
    success: "#22D193",
    error: "#F05252",
    warning: "#F2A23A",
    info: "#6CC6FF",
    shadow: "rgba(0, 0, 0, 0.5)",
  },
};

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
