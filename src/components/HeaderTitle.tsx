import React from "react";
import { View, StyleSheet } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useCommunityStore } from "@/lib/communityStore";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";

interface HeaderTitleProps {
  title?: string;
  useCommunity?: boolean;
}

export function HeaderTitle({ title, useCommunity = false }: HeaderTitleProps) {
  const { theme, isDark } = useTheme();
  const { language } = useI18n();
  const activeCommunity = useCommunityStore((state) => state.activeCommunity);

  const getCommunityName = () => {
    if (!activeCommunity) return title || "";
    return language === "bn" 
      ? activeCommunity.nameBn || activeCommunity.nameEn 
      : activeCommunity.nameEn || activeCommunity.nameBn;
  };

  const getFirstLetter = () => {
    if (useCommunity && activeCommunity) {
      const name = getCommunityName();
      return name?.charAt(0).toUpperCase() || "C";
    }
    return title?.charAt(0).toUpperCase() || "F";
  };

  const displayTitle = useCommunity ? getCommunityName() : title;
  // Every community uses the Maya colours, so the badge follows the app theme.
  const primaryColor = theme.primary;

  return (
    <View style={styles.container}>
      <View style={[
        styles.logoContainer, 
        useCommunity 
          ? { backgroundColor: primaryColor, borderWidth: 0, borderRadius: BorderRadius.full } 
          : { borderColor: theme.text }
      ]}>
        <ThemedText style={[
          styles.logoText, 
          useCommunity ? { color: "#FFFFFF" } : { color: theme.text }
        ]}>
          {getFirstLetter()}
        </ThemedText>
      </View>
      <ThemedText style={[styles.title, { color: theme.text }]}>{displayTitle}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  logoContainer: {
    width: 28,
    height: 28,
    borderWidth: 1.5,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  logoText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
});
