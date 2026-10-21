import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Palette, Shadows, Spacing } from "@/constants/theme";

/** Shared frame for Login, Signup and OTP: green hero, title, and a form sheet. */
export function AuthShell({
  title,
  subtitle,
  icon = "feather",
  onBack,
  backLabel,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[Palette.leafDark, Palette.leaf, Palette.leafLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.decorA} />
        <View style={styles.decorB} />
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? "Back"}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{
          paddingTop: insets.top + 76,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <View style={styles.logo}>
            <Feather name={icon} size={22} color={Palette.leaf} />
          </View>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
        </View>

        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.cardBorder }, Shadows.large]}>
          {children}
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

/** "or" divider between social and email sign-in. */
export function AuthDivider({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
      <ThemedText type="caption" muted>
        {label}
      </ThemedText>
      <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
    </View>
  );
}

/** Inline error banner for forms. */
export function FormError({ message }: { message?: string }) {
  const { theme } = useTheme();
  if (!message) return null;
  return (
    <View style={[styles.error, { backgroundColor: theme.error + "14", borderColor: theme.error + "40" }]}>
      <Feather name="alert-circle" size={16} color={theme.error} />
      <ThemedText type="small" style={{ color: theme.error, flex: 1 }}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    height: 300,
    paddingHorizontal: Spacing.lg,
    overflow: "hidden",
  },
  decorA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -80,
    top: -60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    left: -60,
    top: 140,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  heading: { alignItems: "center", marginBottom: Spacing.xl },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 34,
    fontFamily: FontFamily.bold,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 320,
  },
  sheet: {
    borderRadius: BorderRadius["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  footer: { marginTop: Spacing.xl, alignItems: "center", gap: Spacing.md },
  divider: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
