import React from "react";
import { Pressable, StyleSheet, View, ViewStyle, StyleProp, TextInputProps } from "react-native";
import { TextInput } from "@/components/MayaText";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Spacing } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
type IconName = keyof typeof Feather.glyphMap;

/** Round icon-only button (header actions, toolbars). */
/** Title-bar icon buttons everywhere match the Market bell and cart: 44px circle, 1px border, 20px icon. */
export const HEADER_ICON_BUTTON = { size: 44, icon: 20, gap: 8 } as const;

export function IconButton({
  icon,
  onPress,
  badge,
  size = 40,
  tone = "surface",
  accessibilityLabel,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  badge?: number;
  size?: number;
  /** "header" / "headerActive": the title-bar icon button, identical to the Market bell and cart. */
  tone?: "surface" | "primary" | "plain" | "header" | "headerActive";
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const isHeader = tone === "header" || tone === "headerActive";
  if (isHeader && size === 40) size = HEADER_ICON_BUTTON.size;
  const bg = tone === "primary" ? theme.primary : tone === "plain" ? "transparent" : tone === "header" ? theme.card
    : tone === "headerActive" ? theme.primarySoft : theme.backgroundDefault;
  const fg = tone === "primary" ? "#FFFFFF" : tone === "header" ? theme.text : tone === "headerActive" ? theme.link : theme.iconDefault;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: theme.cardBorder,
          borderWidth: isHeader ? 1 : tone === "surface" ? StyleSheet.hairlineWidth : 0,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <AppIcon name={icon} size={isHeader ? HEADER_ICON_BUTTON.icon : size * 0.48} color={fg} />
      {badge ? (
        <View style={[styles.badgeDot, { backgroundColor: theme.error, borderColor: theme.backgroundRoot }]}>
          <ThemedText style={styles.badgeDotText}>{badge > 9 ? "9+" : badge}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Selectable pill used for filters and categories. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundDefault,
          borderColor: selected ? theme.primary : theme.cardBorder,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon ? <AppIcon name={icon} size={14} color={selected ? "#FFFFFF" : theme.textSecondary} /> : null}
      <ThemedText
        style={{
          fontSize: 13,
          lineHeight: 18,
          fontFamily: FontFamily.semibold,
          color: selected ? "#FFFFFF" : theme.text,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Small status label. */
export function Badge({
  label,
  color,
  style,
}: {
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const c = color ?? theme.primary;
  return (
    <View style={[styles.badge, { backgroundColor: c + "1A" }, style]}>
      <ThemedText style={{ color: c, fontSize: 11, lineHeight: 14, fontFamily: FontFamily.bold }}>{label}</ThemedText>
    </View>
  );
}

/** Section title row with optional "see all" action. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1 }}>
        <ThemedText type="h4">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="caption" muted>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <ThemedText type="link" style={{ color: theme.primary }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Settings / menu row: icon tile, title, subtitle, chevron. */
export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  destructive,
  showChevron = true,
  style,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const tint = destructive ? theme.error : iconColor ?? theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" }, style]}
    >
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: tint + "1A" }]}>
          <AppIcon name={icon} size={18} color={tint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <ThemedText style={{ fontFamily: FontFamily.semibold, fontSize: 15, color: destructive ? theme.error : theme.text }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="caption" muted numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
      {showChevron && onPress ? <Feather name="chevron-right" size={18} color={theme.textTertiary} /> : null}
    </Pressable>
  );
}

/** Labelled text input with icon, error text and focus ring. */
export function TextField({
  label,
  icon,
  error,
  hint,
  right,
  containerStyle,
  ...inputProps
}: TextInputProps & {
  label?: string;
  icon?: IconName;
  error?: string;
  hint?: string;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? theme.error : focused ? theme.primary : theme.inputBorder;
  return (
    <View style={containerStyle}>
      {label ? (
        <ThemedText type="label" style={{ marginBottom: 6, color: theme.text }}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.inputBackground,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}
      >
        {icon ? <AppIcon name={icon} size={18} color={focused ? theme.primary : theme.textTertiary} /> : null}
        <TextInput
          placeholderTextColor={theme.textTertiary}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, { color: theme.text }, inputProps.style]}
        />
        {right}
      </View>
      {error ? (
        <ThemedText type="caption" style={{ color: theme.error, marginTop: 6 }}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" muted style={{ marginTop: 6 }}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeDotText: { color: "#FFFFFF", fontSize: 9, lineHeight: 12, fontFamily: FontFamily.bold },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: Spacing.md,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    fontFamily: FontFamily.regular,
  },
});
