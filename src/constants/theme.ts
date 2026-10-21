/**
 * Farmers design tokens.
 *
 * One source of truth for colour, spacing, radius, type and elevation.
 * Every screen reads colours through `useTheme()` so light/dark mode and
 * community accents stay consistent. Keep raw hex values out of screens:
 * use `theme.*` for surfaces/text and `Palette.*` for status hues.
 */
import { Platform, ViewStyle } from "react-native";

/** Brand + status hues. Each hue has a strong tone and a soft tint for backgrounds. */
export const Palette = {
  leaf: "#1E7F4F", // brand green
  leafLight: "#2FA36B",
  leafDark: "#14583A",
  leafSoft: "#E5F3EB",
  harvest: "#E3A008", // harvest gold accent
  harvestSoft: "#FDF3D8",
  river: "#2563EB", // info / water / fish
  riverSoft: "#E3ECFD",
  clay: "#DC2626", // danger
  claySoft: "#FDE7E7",
  sun: "#EA8A0C", // warning
  sunSoft: "#FEF0DC",
  plum: "#7C3AED",
  plumSoft: "#EFE7FD",
  teal: "#0D9488",
  tealSoft: "#DDF4F1",
  rose: "#DB2777",
  roseSoft: "#FCE4F0",
  slate: "#475569",
  slateSoft: "#E8EDF2",
  gold: "#F5B700",
  white: "#FFFFFF",
  black: "#000000",
};

export const Colors = {
  light: {
    primary: Palette.leaf,
    primaryTint: Palette.leafLight,
    primaryDark: Palette.leafDark,
    primarySoft: Palette.leafSoft,
    accent: Palette.harvest,
    accentSoft: Palette.harvestSoft,
    text: "#0F1A14",
    textSecondary: "#5A6A61",
    textTertiary: "#8B9A91",
    buttonText: "#FFFFFF",
    tabIconDefault: "#8B9A91",
    tabIconSelected: Palette.leaf,
    link: Palette.leaf,
    backgroundRoot: "#F5F7F4",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#EDF1EC",
    backgroundTertiary: "#E2E8E3",
    white: "#FFFFFF",
    overlay: "rgba(9, 20, 14, 0.45)",
    inputBorder: "#D6DED8",
    inputBackground: "#FFFFFF",
    gradientStart: "#1E7F4F",
    gradientEnd: "#2FA36B",
    card: "#FFFFFF",
    cardBorder: "#E4EAE5",
    cardText: "#0F1A14",
    surface: "#FFFFFF",
    surfaceSecondary: "#F5F7F4",
    divider: "#E8EDE9",
    border: "#E4EAE5",
    iconDefault: "#24332B",
    iconSecondary: "#7A8A81",
    success: "#16A34A",
    error: Palette.clay,
    warning: Palette.sun,
    info: Palette.river,
    shadow: "rgba(16, 40, 26, 0.10)",
  },
  dark: {
    primary: "#2FA36B",
    primaryTint: "#43C285",
    primaryDark: "#1E7F4F",
    primarySoft: "#143324",
    accent: "#F2B83A",
    accentSoft: "#3A2E10",
    text: "#ECF3EE",
    textSecondary: "#A2B4A9",
    textTertiary: "#71837A",
    buttonText: "#FFFFFF",
    tabIconDefault: "#71837A",
    tabIconSelected: "#43C285",
    link: "#5FD39A",
    backgroundRoot: "#0A100C",
    backgroundDefault: "#111915",
    backgroundSecondary: "#18221C",
    backgroundTertiary: "#222E27",
    white: "#131C17",
    overlay: "rgba(0, 0, 0, 0.7)",
    inputBorder: "#2B3A32",
    inputBackground: "#131C17",
    gradientStart: "#14583A",
    gradientEnd: "#1E7F4F",
    card: "#131C17",
    cardBorder: "#223029",
    cardText: "#ECF3EE",
    surface: "#18221C",
    surfaceSecondary: "#111915",
    divider: "#1F2B24",
    border: "#223029",
    iconDefault: "#ECF3EE",
    iconSecondary: "#A2B4A9",
    success: "#22C55E",
    error: "#F05252",
    warning: "#F59E0B",
    info: "#60A5FA",
    shadow: "rgba(0, 0, 0, 0.5)",
  },
};

export type ThemeColors = typeof Colors.light;

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
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
};

/** Bangla script fallbacks: Plus Jakarta Sans has no Bengali glyphs. */
export const BanglaFontFamily: Record<string, string> = {
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
    web: { boxShadow: `0px ${y}px ${blur * 2}px rgba(11, 42, 26, ${opacity})` } as ViewStyle,
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
    sans: "'Plus Jakarta Sans', 'Hind Siliguri', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
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
