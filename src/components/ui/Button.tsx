import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Spacing } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
import { useThemeScope } from "@/contexts/ThemeScope";
import { MayaFontFamily, MayaRadius } from "@/constants/mayaTheme";
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 54 };
const FONT: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };

export function Button({
  title,
  children,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const { theme } = useTheme();
  const maya = useThemeScope() === "maya";
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = maya
    ? {
        // Maya buttons: solid navy primary, white with a dark 1px outline as secondary.
        primary: { bg: theme.primary, fg: theme.buttonText, border: theme.primary },
        secondary: { bg: theme.backgroundDefault, fg: theme.text, border: theme.text },
        outline: { bg: theme.backgroundDefault, fg: theme.text, border: theme.border },
        ghost: { bg: "transparent", fg: theme.link },
        danger: { bg: theme.error, fg: "#FFFFFF", border: theme.error },
      }
    : {
        primary: { bg: theme.primary, fg: "#FFFFFF" },
        secondary: { bg: theme.primarySoft, fg: theme.primary },
        outline: { bg: "transparent", fg: theme.text, border: theme.inputBorder },
        ghost: { bg: "transparent", fg: theme.primary },
        danger: { bg: theme.error, fg: "#FFFFFF" },
      };
  const c = palette[variant];
  const label = title ?? (typeof children === "string" ? children : undefined);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === "sm" ? Spacing.md : Spacing.xl,
          backgroundColor: c.bg,
          borderColor: c.border ?? "transparent",
          borderWidth: c.border ? (maya ? 1 : 1.5) : 0,
          ...(maya ? { borderRadius: size === "sm" ? MayaRadius.sm : MayaRadius.md } : null),
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : undefined,
        },
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <AppIcon name={icon} size={FONT[size] + 3} color={c.fg} /> : null}
          {label ? (
            <ThemedText style={{ color: c.fg, fontSize: FONT[size], fontFamily: maya ? MayaFontFamily.medium : FontFamily.semibold, lineHeight: FONT[size] + 6 }}>
              {label}
            </ThemedText>
          ) : (
            children
          )}
          {iconRight ? <AppIcon name={iconRight} size={FONT[size] + 3} color={c.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
