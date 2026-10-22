import React from "react";
import { View, StyleSheet, ImageBackground, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, FontFamily, Palette, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const COPY = {
  en: {
    brand: "Farmers",
    headline: ["Grow.", "Trade.", "Thrive."],
    subtitle: "The network for modern farmers, buyers and experts: market, community and farm accounts in one app.",
    features: [
      { icon: "percent", label: "Offline calculators" },
      { icon: "shopping-bag", label: "Marketplace" },
      { icon: "users", label: "Community" },
    ],
    start: "Get started",
    guest: "Explore as guest",
    login: "Log in",
    support: "Support",
    trust: "Trusted by 50k+ farmers",
  },
  bn: {
    brand: "কৃষক",
    headline: ["চাষ করুন।", "বিক্রি করুন।", "এগিয়ে যান।"],
    subtitle: "আধুনিক কৃষক, ক্রেতা ও বিশেষজ্ঞদের নেটওয়ার্ক: বাজার, কমিউনিটি আর খামারের হিসাব এক অ্যাপে।",
    features: [
      { icon: "percent", label: "অফলাইন হিসাব" },
      { icon: "shopping-bag", label: "বাজার" },
      { icon: "users", label: "কমিউনিটি" },
    ],
    start: "শুরু করুন",
    guest: "অতিথি হিসেবে দেখুন",
    login: "লগ ইন",
    support: "সহায়তা",
    trust: "৫০ হাজারেরও বেশি কৃষকের আস্থা",
  },
} as const;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { loginAsGuest } = useAuthStore();
  const { language, setLanguage } = useI18n();
  const t = COPY[language === "bn" ? "bn" : "en"];

  const tap = (style = Haptics.ImpactFeedbackStyle.Light) => Haptics.impactAsync(style).catch(() => {});

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/images/farm-background.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(6,24,14,0.35)", "rgba(6,24,14,0.55)", "rgba(6,24,14,0.96)"]}
        locations={[0, 0.45, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        bounces={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Feather name="feather" size={18} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.brandText}>{t.brand}</ThemedText>
          </View>
          <View style={styles.langToggle} accessibilityRole="radiogroup">
            {([
              ["bn", "বাংলা"],
              ["en", "EN"],
            ] as const).map(([code, label]) => {
              const active = language === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    tap();
                    setLanguage(code);
                  }}
                  style={[styles.langBtn, active && styles.langBtnActive]}
                >
                  <ThemedText style={[styles.langText, active && styles.langTextActive]}>{label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.spacer} />

        <View>
          {t.headline.map((line, i) => (
            <ThemedText key={line} style={[styles.headline, i === 2 && { color: Palette.gold }]}>
              {line}
            </ThemedText>
          ))}
          <ThemedText style={styles.subtitle}>{t.subtitle}</ThemedText>

          <View style={styles.features}>
            {t.features.map((f) => (
              <View key={f.label} style={styles.featurePill}>
                <AppIcon name={f.icon as keyof typeof Feather.glyphMap} size={13} color="#FFFFFF" />
                <ThemedText style={styles.featureText}>{f.label}</ThemedText>
              </View>
            ))}
          </View>

          <Pressable
            testID="button-get-started"
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => {
              tap(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate("Signup");
            }}
          >
            <ThemedText style={styles.primaryText}>{t.start}</ThemedText>
            <View style={styles.primaryArrow}>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </View>
          </Pressable>

          <Pressable
            testID="button-explore-guest"
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={async () => {
              tap();
              await loginAsGuest();
            }}
          >
            <ThemedText style={styles.secondaryText}>{t.guest}</ThemedText>
          </Pressable>

          <View style={styles.links}>
            <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8} accessibilityRole="link">
              <ThemedText style={styles.linkText}>{t.login}</ThemedText>
            </Pressable>
            <View style={styles.linkDot} />
            <Pressable onPress={() => navigation.navigate("Support")} hitSlop={8} accessibilityRole="link">
              <ThemedText style={styles.linkText}>{t.support}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.trust}>
            <View style={styles.avatars}>
              {[Palette.leafLight, Palette.harvest, Palette.river].map((c, i) => (
                <View key={c} style={[styles.miniAvatar, { backgroundColor: c, marginLeft: i === 0 ? 0 : -8 }]}>
                  <Feather name="user" size={11} color="#FFFFFF" />
                </View>
              ))}
            </View>
            <ThemedText style={styles.trustText}>{t.trust}</ThemedText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06180E" },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Palette.leaf,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  brandText: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontFamily: FontFamily.bold },
  langToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: BorderRadius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  langBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full },
  langBtnActive: { backgroundColor: "#FFFFFF" },
  langText: { color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 16, fontFamily: FontFamily.semibold },
  langTextActive: { color: "#0F1A14" },
  spacer: { flex: 1, minHeight: 120 },
  headline: {
    color: "#FFFFFF",
    fontSize: 46,
    lineHeight: 52,
    fontFamily: FontFamily.extrabold,
    letterSpacing: -1,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    lineHeight: 24,
    marginTop: Spacing.lg,
  },
  features: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.xl },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  featureText: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontFamily: FontFamily.semibold },
  primaryBtn: {
    marginTop: Spacing["3xl"],
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: Spacing.xl,
    paddingRight: 8,
  },
  primaryText: { color: "#0F1A14", fontSize: 16, lineHeight: 22, fontFamily: FontFamily.bold },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.leaf,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    marginTop: Spacing.md,
    height: 54,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontFamily: FontFamily.semibold },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  linkText: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20, fontFamily: FontFamily.semibold },
  linkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.5)" },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing["2xl"],
  },
  avatars: { flexDirection: "row" },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#06180E",
  },
  trustText: { color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
});
