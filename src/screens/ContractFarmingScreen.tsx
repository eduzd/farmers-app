import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const CONTRACTS = [
  {
    id: "1",
    company: "এগ্রো ফুড লিমিটেড",
    crop: "ধান (আমন)",
    area: "১০ বিঘা",
    duration: "৪ মাস",
    price: "৳১,২০০/মণ",
    status: "active",
    startDate: "১ আগস্ট ২০২৬",
    endDate: "৩০ নভেম্বর ২০২৬",
    terms: ["বীজ সরবরাহ", "কারিগরি সহায়তা", "নির্ধারিত মূল্যে ক্রয়"],
  },
  {
    id: "2",
    company: "বাংলা ফার্মস",
    crop: "সবজি (টমেটো)",
    area: "৫ বিঘা",
    duration: "৩ মাস",
    price: "৳৮০/কেজি",
    status: "pending",
    startDate: "১ ডিসেম্বর ২০২৬",
    endDate: "২৮ ফেব্রুয়ারি ২০২৭",
    terms: ["চারা সরবরাহ", "সার ও কীটনাশক", "পরিবহন সুবিধা"],
  },
];

const AVAILABLE_CONTRACTS = [
  {
    id: "3",
    company: "গ্রিন ভ্যালি এগ্রো",
    crop: "ভুট্টা",
    area: "১০-২০ বিঘা",
    price: "৳১,০০০/মণ",
    deadline: "১৫ জানুয়ারি ২০২৬",
    benefits: ["বীজ সরবরাহ", "প্রশিক্ষণ", "বাজার নিশ্চিত"],
  },
  {
    id: "4",
    company: "ফ্রেশ হার্ভেস্ট",
    crop: "আলু",
    area: "৫-১৫ বিঘা",
    price: "৳২৫/কেজি",
    deadline: "২০ জানুয়ারি ২০২৬",
    benefits: ["বীজ আলু", "কোল্ড স্টোরেজ", "এডভান্স পেমেন্ট"],
  },
  {
    id: "5",
    company: "অর্গানিক বাংলাদেশ",
    crop: "জৈব সবজি",
    area: "২-৫ বিঘা",
    price: "প্রিমিয়াম মূল্য",
    deadline: "২৫ জানুয়ারি ২০২৬",
    benefits: ["সার্টিফিকেশন", "প্রশিক্ষণ", "রপ্তানি সুবিধা"],
  },
];

export default function ContractFarmingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("my");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Pressable
          style={[styles.tab, activeTab === "my" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("my");
          }}
        >
          <ThemedText style={[styles.tabText, { color: activeTab === "my" ? "#fff" : theme.text }]}>
            আমার চুক্তি
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "available" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("available");
          }}
        >
          <ThemedText style={[styles.tabText, { color: activeTab === "available" ? "#fff" : theme.text }]}>
            উপলব্ধ চুক্তি
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "my" ? (
          <>
            {CONTRACTS.map((contract, index) => (
              <Animated.View key={contract.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <View style={[styles.contractCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.contractHeader}>
                    <View style={[styles.companyLogo, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.companyInitial}>{contract.company.charAt(0)}</ThemedText>
                    </View>
                    <View style={styles.contractInfo}>
                      <ThemedText style={[styles.companyName, { color: theme.text }]}>{contract.company}</ThemedText>
                      <ThemedText style={[styles.cropName, { color: theme.textSecondary }]}>{contract.crop}</ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: contract.status === "active" ? "#16A34A20" : "#EA8A0C20" },
                      ]}
                    >
                      <ThemedText
                        style={[styles.statusText, { color: contract.status === "active" ? "#16A34A" : "#EA8A0C" }]}
                      >
                        {contract.status === "active" ? "চলমান" : "অপেক্ষমান"}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.contractDetails}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Feather name="map" size={16} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailText, { color: theme.text }]}>{contract.area}</ThemedText>
                      </View>
                      <View style={styles.detailItem}>
                        <Feather name="clock" size={16} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailText, { color: theme.text }]}>{contract.duration}</ThemedText>
                      </View>
                      <View style={styles.detailItem}>
                        <Feather name="dollar-sign" size={16} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailText, { color: theme.primary }]}>{contract.price}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.termsSection, { borderTopColor: theme.cardBorder }]}>
                    <ThemedText style={[styles.termsTitle, { color: theme.textSecondary }]}>সুবিধা সমূহ:</ThemedText>
                    <View style={styles.termsList}>
                      {contract.terms.map((term, i) => (
                        <View key={i} style={styles.termItem}>
                          <Feather name="check" size={14} color="#16A34A" />
                          <ThemedText style={[styles.termText, { color: theme.text }]}>{term}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.contractActions}>
                    <Pressable style={[styles.actionBtn, { backgroundColor: theme.primary + "20" }]}>
                      <Feather name="file-text" size={18} color={theme.primary} />
                      <ThemedText style={[styles.actionText, { color: theme.primary }]}>বিস্তারিত</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, { backgroundColor: theme.primary }]}>
                      <Feather name="message-circle" size={18} color="#fff" />
                      <ThemedText style={[styles.actionText, { color: "#fff" }]}>যোগাযোগ</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        ) : (
          <>
            {AVAILABLE_CONTRACTS.map((contract, index) => (
              <Animated.View key={contract.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <LinearGradient
                  colors={isDark ? ["#1e293b", "#0f172a"] : ["#ffffff", "#f8fafc"]}
                  style={[styles.availableCard, { borderColor: theme.cardBorder }]}
                >
                  <View style={styles.availableHeader}>
                    <View>
                      <ThemedText style={[styles.companyName, { color: theme.text }]}>{contract.company}</ThemedText>
                      <ThemedText style={[styles.cropName, { color: theme.primary }]}>{contract.crop}</ThemedText>
                    </View>
                    <View style={[styles.priceBadge, { backgroundColor: "#16A34A20" }]}>
                      <ThemedText style={[styles.priceText, { color: "#16A34A" }]}>{contract.price}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.availableDetails}>
                    <View style={styles.availableDetail}>
                      <Feather name="map" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.availableDetailText, { color: theme.text }]}>
                        জমি: {contract.area}
                      </ThemedText>
                    </View>
                    <View style={styles.availableDetail}>
                      <Feather name="calendar" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.availableDetailText, { color: theme.text }]}>
                        শেষ তারিখ: {contract.deadline}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.benefitsList}>
                    {contract.benefits.map((benefit, i) => (
                      <View key={i} style={[styles.benefitChip, { backgroundColor: theme.primary + "15" }]}>
                        <ThemedText style={[styles.benefitText, { color: theme.primary }]}>{benefit}</ThemedText>
                      </View>
                    ))}
                  </View>

                  <Pressable style={[styles.applyButton, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.applyText}>আবেদন করুন</ThemedText>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </Pressable>
                </LinearGradient>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: "row",
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  content: { padding: Spacing.lg, paddingTop: 0 },
  contractCard: { borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  contractHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.md },
  companyLogo: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  companyInitial: { color: "#fff", fontSize: 20, fontWeight: "700" },
  contractInfo: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "600" },
  cropName: { fontSize: 14, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  statusText: { fontSize: 12, fontWeight: "600" },
  contractDetails: { padding: Spacing.md, paddingTop: 0 },
  detailRow: { flexDirection: "row", gap: Spacing.lg },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 14, fontWeight: "500" },
  termsSection: { padding: Spacing.md, borderTopWidth: 1 },
  termsTitle: { fontSize: 13, marginBottom: Spacing.xs },
  termsList: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  termItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  termText: { fontSize: 13 },
  contractActions: { flexDirection: "row", padding: Spacing.md, gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  actionText: { fontSize: 14, fontWeight: "600" },
  availableCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  availableHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  priceBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  priceText: { fontSize: 14, fontWeight: "700" },
  availableDetails: { marginTop: Spacing.md, gap: Spacing.xs },
  availableDetail: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  availableDetailText: { fontSize: 14 },
  benefitsList: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.md },
  benefitChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  benefitText: { fontSize: 12, fontWeight: "500" },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  applyText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
