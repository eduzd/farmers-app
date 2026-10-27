import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/icons/AppIcon";
interface TestCenter {
  id: string;
  name: string;
  location: string;
  distance: string;
  phone: string;
  services: string[];
  fee: number;
  turnaround: string;
}

const TEST_CENTERS: TestCenter[] = [];

const SOIL_PARAMETERS = [
  { id: "ph", name: "pH মান", ideal: "৬.০ - ৭.০", icon: "droplet", color: "#2E96EF" },
  { id: "organic", name: "জৈব পদার্থ", ideal: "> ২.৫%", icon: "leaf", color: "#2E96EF" },
  { id: "nitrogen", name: "নাইট্রোজেন (N)", ideal: "০.১২ - ০.২৫%", icon: "zap", color: "#3D38D0" },
  { id: "phosphorus", name: "ফসফরাস (P)", ideal: "১৫-৩০ পিপিএম", icon: "sun", color: "#B25E09" },
  { id: "potassium", name: "পটাশিয়াম (K)", ideal: "> ০.২ মি.ইক.", icon: "shield", color: "#DA2F2F" },
  { id: "zinc", name: "জিংক (Zn)", ideal: "> ১ পিপিএম", icon: "activity", color: "#00BB77" },
];

export default function SoilTestingScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedTab, setSelectedTab] = useState<"info" | "centers">("info");

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("কল করুন", phone);
  };

  const handleBookTest = (center: TestCenter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "টেস্ট বুকিং",
      `${center.name}\n\nফি: ৳${center.fee}\nসময়: ${center.turnaround}`,
      [
        { text: "বাতিল", style: "cancel" },
        { text: "বুক করুন", onPress: () => {} },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn} style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: "#795548" + "20" }]}>
          <Feather name="layers" size={32} color="#795548" />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>মাটি পরীক্ষা</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          সঠিক সার প্রয়োগের জন্য মাটি পরীক্ষা করুন
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100)} style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            { backgroundColor: selectedTab === "info" ? theme.primary : theme.card },
          ]}
          onPress={() => setSelectedTab("info")}
        >
          <ThemedText
            style={[styles.tabText, { color: selectedTab === "info" ? theme.white : theme.text }]}
          >
            তথ্য
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            { backgroundColor: selectedTab === "centers" ? theme.primary : theme.card },
          ]}
          onPress={() => setSelectedTab("centers")}
        >
          <ThemedText
            style={[styles.tabText, { color: selectedTab === "centers" ? theme.white : theme.text }]}
          >
            টেস্ট সেন্টার
          </ThemedText>
        </Pressable>
      </Animated.View>

      {selectedTab === "info" ? (
        <>
          <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              গুরুত্বপূর্ণ মাটির উপাদান
            </ThemedText>
            <View style={styles.parametersGrid}>
              {SOIL_PARAMETERS.map((param, index) => (
                <Animated.View
                  key={param.id}
                  entering={FadeInUp.delay(200 + index * 50)}
                  style={[styles.paramCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <View style={[styles.paramIcon, { backgroundColor: param.color + "20" }]}>
                    <AppIcon name={param.icon as any} size={20} color={param.color} />
                  </View>
                  <ThemedText style={[styles.paramName, { color: theme.text }]}>{param.name}</ThemedText>
                  <ThemedText style={[styles.paramIdeal, { color: theme.textSecondary }]}>
                    আদর্শ: {param.ideal}
                  </ThemedText>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              মাটি সংগ্রহের নিয়ম
            </ThemedText>
            <View style={[styles.rulesCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              {[
                "জমির ৫-৬ জায়গা থেকে মাটি নিন",
                "উপরের ০-১৫ সেমি গভীরতা থেকে সংগ্রহ করুন",
                "সব মাটি মিশিয়ে ৫০০ গ্রাম নমুনা রাখুন",
                "রোদে শুকিয়ে পরীক্ষাগারে পাঠান",
                "নমুনার সাথে জমির তথ্য দিন",
              ].map((rule, i) => (
                <View key={i} style={styles.ruleItem}>
                  <View style={[styles.ruleNumber, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.ruleNumberText}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={[styles.ruleText, { color: theme.text }]}>{rule}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>
        </>
      ) : (
        <Animated.View entering={FadeInUp} style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            কাছের পরীক্ষাগার
          </ThemedText>
          {TEST_CENTERS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
          {TEST_CENTERS.map((center, index) => (
            <Animated.View
              key={center.id}
              entering={FadeInUp.delay(index * 80)}
              style={[styles.centerCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={styles.centerHeader}>
                <View style={styles.centerInfo}>
                  <ThemedText style={[styles.centerName, { color: theme.text }]}>
                    {center.name}
                  </ThemedText>
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                      {center.location} ({center.distance})
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={[styles.callButton, { backgroundColor: "#2E96EF" }]}
                  onPress={() => handleCall(center.phone)}
                >
                  <Feather name="phone" size={16} color="#fff" />
                </Pressable>
              </View>

              <View style={styles.servicesRow}>
                {center.services.map((service, i) => (
                  <View key={i} style={[styles.serviceBadge, { backgroundColor: theme.primary + "15" }]}>
                    <ThemedText style={[styles.serviceText, { color: theme.primary }]}>
                      {service}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.centerFooter}>
                <View style={styles.feeContainer}>
                  <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>ফি</ThemedText>
                  <ThemedText style={[styles.feeValue, { color: theme.primary }]}>
                    ৳{center.fee}
                  </ThemedText>
                </View>
                <View style={styles.timeContainer}>
                  <ThemedText style={[styles.timeLabel, { color: theme.textSecondary }]}>সময়</ThemedText>
                  <ThemedText style={[styles.timeValue, { color: theme.text }]}>
                    {center.turnaround}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.bookButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleBookTest(center)}
                >
                  <ThemedText style={styles.bookButtonText}>বুক করুন</ThemedText>
                </Pressable>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { alignItems: "center", marginBottom: Spacing.xl },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, textAlign: "center" },
  tabContainer: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.md,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
 },
  tabText: { fontSize: 14, fontWeight: "600" },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  parametersGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  paramCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  paramIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xs },
  paramName: { fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 2 },
  paramIdeal: { fontSize: 11, textAlign: "center" },
  rulesCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  ruleItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  ruleNumber: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ruleNumberText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  ruleText: { flex: 1, fontSize: 13 },
  centerCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md },
  centerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.sm },
  centerInfo: { flex: 1 },
  centerName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12 },
  callButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  servicesRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  serviceBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  serviceText: { fontSize: 11, fontWeight: "500" },
  centerFooter: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  feeContainer: { alignItems: "center" },
  feeLabel: { fontSize: 11 },
  feeValue: { fontSize: 16, fontWeight: "700" },
  timeContainer: { alignItems: "center" },
  timeLabel: { fontSize: 11 },
  timeValue: { fontSize: 14, fontWeight: "600" },
  bookButton: { marginLeft: "auto", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  bookButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
