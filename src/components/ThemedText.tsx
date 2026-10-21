import React from "react";
import { Text, StyleSheet, type TextProps, type TextStyle } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Typography, BanglaFontFamily, FontFamily } from "@/constants/theme";

export type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "small"
  | "caption"
  | "label"
  | "link";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: TextVariant;
  /** Shorthand for the secondary text colour. */
  muted?: boolean;
};

const BENGALI = /[\u0980-\u09FF]/;

function containsBangla(children: React.ReactNode): boolean {
  if (typeof children === "string") return BENGALI.test(children);
  if (Array.isArray(children)) return children.some((c) => typeof c === "string" && BENGALI.test(c));
  return false;
}

const WEIGHT_TO_FAMILY: Record<string, string> = {
  "400": FontFamily.regular,
  normal: FontFamily.regular,
  "500": FontFamily.medium,
  "600": FontFamily.semibold,
  "700": FontFamily.bold,
  bold: FontFamily.bold,
  "800": FontFamily.extrabold,
  "900": FontFamily.extrabold,
};

/**
 * Text that follows the design system: variant sizes, theme colours and
 * script-aware fonts. Bangla text is rendered with Hind Siliguri (Plus
 * Jakarta Sans has no Bengali glyphs), matched to the requested weight.
 */
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  muted,
  children,
  ...rest
}: ThemedTextProps) {
  const { theme, isDark } = useTheme();

  let color = theme.text;
  if (type === "link") color = theme.link;
  if (muted) color = theme.textSecondary;
  if (isDark && darkColor) color = darkColor;
  if (!isDark && lightColor) color = lightColor;

  const flat = (StyleSheet.flatten([Typography[type] ?? Typography.body, style]) || {}) as TextStyle;
  let family = flat.fontFamily;
  // A bare fontWeight without a family should still pick the right font file.
  if (flat.fontWeight && (!family || family === FontFamily.regular)) {
    family = WEIGHT_TO_FAMILY[String(flat.fontWeight)] ?? family;
  }
  let lineHeight = flat.lineHeight;
  if (family && containsBangla(children)) {
    family = BanglaFontFamily[family] ?? family;
    // Bengali glyphs need a little more vertical room than Latin.
    if (lineHeight) lineHeight = Math.round(lineHeight * 1.1);
  }

  return (
    <Text style={[{ color }, flat, family ? { fontFamily: family } : null, lineHeight ? { lineHeight } : null]} {...rest}>
      {children}
    </Text>
  );
}
