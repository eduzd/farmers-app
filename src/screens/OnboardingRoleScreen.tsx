import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Feather } from "@/components/icons/Feather";
import { PROFILE_BADGES } from "@/constants/profileBadges";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Role = "farmer" | "buyer" | "company" | "expert";

interface RoleOption {
  id: Role;
  icon: keyof typeof Feather.glyphMap;
  titleKey: string;
  descKey: string;
}

const ROLES: RoleOption[] = [
  { id: "farmer", icon: "sun", titleKey: "onboarding.farmer", descKey: "onboarding.farmerDesc" },
  { id: "buyer", icon: "shopping-cart", titleKey: "onboarding.buyer", descKey: "onboarding.buyerDesc" },
  { id: "company", icon: "briefcase", titleKey: "onboarding.company", descKey: "onboarding.companyDesc" },
  { id: "expert", icon: "award", titleKey: "onboarding.expert", descKey: "onboarding.expertDesc" },
];

export default function OnboardingRoleScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { setUserRole } = useAuthStore();
  const { t } = useI18n();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleSelectRole = (role: Role) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRole(role);
  };

  const handleContinue = async () => {
    if (!selectedRole) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setUserRole(selectedRole);
    navigation.navigate("OnboardingProfile");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientEnd]}
        locations={[0, 0.3]}
        style={styles.gradient}
      >
        <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>{t("onboarding.selectRole")}</ThemedText>
            <ThemedText style={styles.subtitle}>{t("onboarding.selectRoleSubtitle")}</ThemedText>
          </View>

          <View style={styles.rolesContainer}>
            {ROLES.map((role) => (
              <Pressable
                key={role.id}
                style={({ pressed }) => [
                  styles.roleCard,
                  { backgroundColor: theme.white },
                  selectedRole === role.id && [styles.roleCardSelected, { borderColor: theme.primary }],
                  pressed && styles.roleCardPressed,
                ]}
                onPress={() => handleSelectRole(role.id)}
              >
                <View
                  style={[
                    styles.roleIcon,
                    {
                      backgroundColor: selectedRole === role.id ? PROFILE_BADGES[role.id].color : PROFILE_BADGES[role.id].color + "1F",
                      borderRadius: PROFILE_BADGES[role.id].shape === "square" ? 12 : 24,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={PROFILE_BADGES[role.id].icon}
                    size={24}
                    color={selectedRole === role.id ? theme.buttonText : PROFILE_BADGES[role.id].color}
                  />
                </View>
                <View style={styles.roleContent}>
                  <ThemedText style={[styles.roleTitle, { color: theme.text }]}>
                    {t(role.titleKey)}
                  </ThemedText>
                  <ThemedText style={[styles.roleDesc, { color: theme.textSecondary }]}>
                    {t(role.descKey)}
                  </ThemedText>
                </View>
                {selectedRole === role.id ? (
                  <View style={[styles.checkIcon, { backgroundColor: theme.primary }]}>
                    <Feather name="check" size={16} color={theme.buttonText} />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <Pressable
              style={({ pressed }) => [
                styles.continueButton,
                { backgroundColor: theme.primary },
                pressed && styles.buttonPressed,
                !selectedRole && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!selectedRole}
            >
              <ThemedText style={[styles.continueButtonText, { color: theme.buttonText }]}>
                {t("common.continue")}
              </ThemedText>
              <Feather name="arrow-right" size={20} color={theme.buttonText} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
    color: "#FFFFFF",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "DMSans_400Regular",
  },
  rolesContainer: {
    flex: 1,
    gap: Spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  roleCardSelected: {
    borderWidth: 2,
  },
  roleCardPressed: {
    opacity: 0.9,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  roleContent: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 14,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: Spacing.xl,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
});
