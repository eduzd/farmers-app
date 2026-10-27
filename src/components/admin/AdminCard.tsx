import React from "react";
import { View, StyleSheet, Pressable, ViewStyle } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
interface AdminCardProps {
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  headerRight?: React.ReactNode;
}

export function AdminCard({
  title,
  subtitle,
  icon,
  iconColor,
  children,
  onPress,
  style,
  headerRight,
}: AdminCardProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
        style,
      ]}
    >
      {(title || icon) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: (iconColor || theme.primary) + "15" },
                ]}
              >
                <AppIcon
                  name={icon}
                  size={18}
                  color={iconColor || theme.primary}
                />
              </View>
            )}
            <View style={styles.titleContainer}>
              {title && (
                <ThemedText type="h4" style={{ color: theme.text }}>
                  {title}
                </ThemedText>
              )}
              {subtitle && (
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {subtitle}
                </ThemedText>
              )}
            </View>
          </View>
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
});
