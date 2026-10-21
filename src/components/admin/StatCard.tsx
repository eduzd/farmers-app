import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onPress?: () => void;
}

export function StatCard({
  title,
  value,
  icon,
  iconColor,
  trend,
  onPress,
}: StatCardProps) {
  const { theme } = useTheme();
  const color = iconColor || theme.primary;

  const content = (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color + "15" }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
        {trend && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trend.isPositive ? "#16A34A15" : "#DC262615",
              },
            ]}
          >
            <Feather
              name={trend.isPositive ? "trending-up" : "trending-down"}
              size={12}
              color={trend.isPositive ? "#16A34A" : "#DC2626"}
            />
            <ThemedText
              style={[
                styles.trendText,
                { color: trend.isPositive ? "#16A34A" : "#DC2626" },
              ]}
            >
              {trend.value}%
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText type="h2" style={[styles.value, { color: theme.text }]}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {title}
      </ThemedText>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.8 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.pressable}>{content}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minWidth: "45%",
  },
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "600",
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
});
