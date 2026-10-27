import React, { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { BanglaFontFamily, FontFamily } from "@/constants/theme";

/**
 * Drop-ins for React Native's Text and TextInput that give plain text Maya's DM Sans.
 *
 * Screens written with raw <Text> and their own fontSize / fontWeight used to fall back to
 * the system font. These pick the DM Sans file for the requested weight (Hind Siliguri for
 * Bangla) whenever no fontFamily is set. A nested <Text> with no size or weight of its own
 * is left alone, so it still inherits its parent's font.
 */

const BENGALI = /[\u0980-\u09FF]/;

function containsBangla(children: React.ReactNode): boolean {
  if (typeof children === "string") return BENGALI.test(children);
  if (Array.isArray(children)) return children.some((c) => typeof c === "string" && BENGALI.test(c));
  return false;
}

const WEIGHT_TO_FAMILY: Record<string, string> = {
  "100": FontFamily.regular,
  "200": FontFamily.regular,
  "300": FontFamily.regular,
  "400": FontFamily.regular,
  normal: FontFamily.regular,
  "500": FontFamily.medium,
  "600": FontFamily.semibold,
  "700": FontFamily.bold,
  bold: FontFamily.bold,
  "800": FontFamily.extrabold,
  "900": FontFamily.extrabold,
};

function familyFor(flat: TextStyle, bangla: boolean): string {
  const latin = WEIGHT_TO_FAMILY[String(flat.fontWeight ?? "400")] ?? FontFamily.regular;
  return bangla ? BanglaFontFamily[latin] ?? latin : latin;
}

export const Text = forwardRef<RNText, TextProps>(function MayaText(props, ref) {
  const flat = (StyleSheet.flatten(props.style) || {}) as TextStyle;
  if (flat.fontFamily || (flat.fontSize == null && flat.fontWeight == null)) {
    return <RNText ref={ref} {...props} />;
  }
  return (
    <RNText ref={ref} {...props} style={[props.style, { fontFamily: familyFor(flat, containsBangla(props.children)) }]} />
  );
}) as unknown as typeof RNText;

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function MayaTextInput(props, ref) {
  const flat = (StyleSheet.flatten(props.style) || {}) as TextStyle;
  if (flat.fontFamily) return <RNTextInput ref={ref} {...props} />;
  const bangla = BENGALI.test(String(props.value ?? props.defaultValue ?? props.placeholder ?? ""));
  return <RNTextInput ref={ref} {...props} style={[props.style, { fontFamily: familyFor(flat, bangla) }]} />;
}) as unknown as typeof RNTextInput;
