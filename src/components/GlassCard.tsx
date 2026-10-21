import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  noPadding?: boolean;
}

export function GlassCard({ children, style, intensity = 60, noPadding = false }: GlassCardProps) {
  const { theme, isDark } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: "hidden",
    ...(Platform.OS === "ios" ? {
      shadowColor: isDark ? "#000" : "#1A2E1A",
      shadowOffset: { width: 0, height: isDark ? 4 : 8 },
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: isDark ? 12 : 16,
    } : {
      elevation: 4,
    }),
  };

  if (Platform.OS === "ios") {
    return (
      <View style={[cardStyle, style]}>
        <BlurView
          intensity={intensity}
          tint={isDark ? "dark" : "light"}
          style={[styles.blurContent, !noPadding && styles.padding]}
        >
          {children}
        </BlurView>
      </View>
    );
  }

  return (
    <View style={[cardStyle, !noPadding && styles.padding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blurContent: {
    flex: 1,
  },
  padding: {
    padding: Spacing.lg,
  },
});
