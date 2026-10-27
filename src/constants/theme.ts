/**
 * Farmers design tokens.
 *
 * One source of truth for colour, spacing, radius, type and elevation.
 * Every screen reads colours through `useTheme()` so light/dark mode and
 * community accents stay consistent. Keep raw hex values out of screens:
 * use `theme.*` for surfaces/text and `Palette.*` for status hues.
 */
import { Platform, ViewStyle } from "react-native";
import { MayaColors } from "@/constants/mayaTheme";

/** Brand + status hues. Each hue has a strong tone and a soft tint for backgrounds. */
export const Palette = {
  // Brand hues now follow Maya (maya.net): the old names stay so every screen keeps working.
  leaf: "#2E96EF", // Maya link blue (was brand green)
  leafLight: "#39B1FE", // Maya sky blue
  leafDark: "#202936", // Maya navy
  leafSoft: "#E3F4FF", // Maya pale blue band
  harvest: "#FF4BB7", // Maya pink accent
  harvestSoft: "#FFD5EE",
  river: "#2E96EF", // info / water / fish
  riverSoft: "#E3F4FF",
  clay: "#DA2F2F", // danger
  claySoft: "#FDE7E7",
  sun: "#B25E09", // warning (Maya amber)
  sunSoft: "#FFF1DE",
  plum: "#3D38D0", // Maya violet
  plumSoft: "#F2F2FF",
  teal: "#00BB77", // Maya green
  tealSoft: "#D8FFF2",
  rose: "#FF4BB7", // Maya pink
  roseSoft: "#FFD5EE",
  slate: "#4A5568",
  slateSoft: "#E3F4FF",
  gold: "#F5B700",
  white: "#FFFFFF",
  black: "#000000",
};

/** The whole app uses the Maya palette (see constants/mayaTheme.ts). */
export const Colors = MayaColors;

export type ThemeColors = {
  primary: string;
  primaryTint: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  buttonText: string;
  tabIconDefault: string;
  tabIconSelected: string;
  link: string;
  backgroundRoot: string;
  backgroundDefault: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  white: string;
  overlay: string;
  inputBorder: string;
  inputBackground: string;
  gradientStart: string;
  gradientEnd: string;
  card: string;
  cardBorder: string;
  cardText: string;
  surface: string;
  surfaceSecondary: string;
  divider: string;
  border: string;
  iconDefault: string;
  iconSecondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  shadow: string;
};

/** 4-pt spacing scale. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 56,
  "7xl": 64,
  inputHeight: 52,
  buttonHeight: 52,
  screenPadding: 16,
};

export const BorderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  "2xl": 26,
  "3xl": 32,
  full: 9999,
};

export const FontFamily = {
  // Maya's text face, DM Sans (SIL Open Font License), everywhere in the app.
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  extrabold: "DMSans_800ExtraBold",
};

/** Bangla script fallbacks: DM Sans (and Plus Jakarta Sans) have no Bengali glyphs. */
export const BanglaFontFamily: Record<string, string> = {
  DMSans_400Regular: "HindSiliguri_400Regular",
  DMSans_500Medium: "HindSiliguri_500Medium",
  DMSans_600SemiBold: "HindSiliguri_600SemiBold",
  DMSans_700Bold: "HindSiliguri_700Bold",
  DMSans_800ExtraBold: "HindSiliguri_700Bold",
  Anton_400Regular: "HindSiliguri_700Bold",
  PlusJakartaSans_400Regular: "HindSiliguri_400Regular",
  PlusJakartaSans_500Medium: "HindSiliguri_500Medium",
  PlusJakartaSans_600SemiBold: "HindSiliguri_600SemiBold",
  PlusJakartaSans_700Bold: "HindSiliguri_700Bold",
  PlusJakartaSans_800ExtraBold: "HindSiliguri_700Bold",
};

export const Typography = {
  sizes: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    "2xl": 20,
    "3xl": 24,
    "4xl": 28,
    "5xl": 32,
  },
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800" as const,
    fontFamily: FontFamily.extrabold,
    letterSpacing: -0.6,
  },
  h1: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700" as const,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700" as const,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600" as const,
    fontFamily: FontFamily.semibold,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
    fontFamily: FontFamily.regular,
  },
  small: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "400" as const,
    fontFamily: FontFamily.regular,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    fontFamily: FontFamily.medium,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.2,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
    fontFamily: FontFamily.semibold,
  },
};

function shadow(y: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0B2A1A",
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: { elevation },
    web: { boxShadow: `0px ${y}px ${blur * 2}px rgba(32, 41, 54, ${opacity})` } as ViewStyle,
    default: {},
  }) as ViewStyle;
}

export const Shadows = {
  small: shadow(1, 3, 0.06, 1),
  medium: shadow(4, 10, 0.08, 3),
  large: shadow(10, 20, 0.12, 8),
};

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.regular,
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: FontFamily.regular,
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'DM Sans', 'Hind Siliguri', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  },
});

/**
 * Community accents. Communities keep their own colour identity but only the
 * accent changes: surfaces, text and borders always come from the design
 * system so every community looks equally polished.
 */
export const CommunityAccents: Record<string, { light: string; dark: string; soft: string; softDark: string }> = {
  agriculture: { light: Palette.leaf, dark: "#2FA36B", soft: Palette.leafSoft, softDark: "#143324" },
  health: { light: Palette.rose, dark: "#EC4899", soft: Palette.roseSoft, softDark: "#3A1427" },
  education: { light: Palette.river, dark: "#3B82F6", soft: Palette.riverSoft, softDark: "#13233F" },
  business: { light: Palette.sun, dark: "#F59E0B", soft: Palette.sunSoft, softDark: "#3A2A10" },
  technology: { light: Palette.plum, dark: "#8B5CF6", soft: Palette.plumSoft, softDark: "#251A3F" },
};
