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

import { EmptyState } from "@/components/ui";
const TEST_TYPES = [
  { id: "soil", name: "মাটি পরীক্ষা", icon: "layers", price: "৳৫০০-১,০০০", duration: "২-৩ দিন" },
  { id: "water", name: "পানি পরীক্ষা", icon: "droplet", price: "৳৩০০-৬০০", duration: "১-২ দিন" },
  { id: "crop", name: "ফসল গুণমান", icon: "check-circle", price: "৳৪০০-৮০০", duration: "১ দিন" },
  { id: "seed", name: "বীজ পরীক্ষা", icon: "sun", price: "৳২৫০-৫০০", duration: "৩-৫ দিন" },
  { id: "fertilizer", name: "সার পরীক্ষা", icon: "package", price: "৳৩৫০-৭০০", duration: "২ দিন" },
  { id: "pesticide", name: "কীটনাশক অবশিষ্ট", icon: "shield", price: "৳৮০০-১,৫০০", duration: "৩-৪ দিন" },
];

const LABS: any[] = [];

const MY_TESTS: any[] = [];

export default function QualityTestingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("tests");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Pressable
          style={[styles.tab, activeTab === "tests" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("tests");
          }}
        >
          <ThemedText style={[styles.tabText, { color: activeTab === "tests" ? "#fff" : theme.text }]}>
            পরীক্ষা সমূহ
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "labs" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("labs");
          }}
        >
          <ThemedText style={[styles.tabText, { color: activeTab === "labs" ? "#fff" : theme.text }]}>
            ল্যাব সমূহ
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "my" && { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("my");
          }}
        >
          <ThemedText style={[styles.tabText, { color: activeTab === "my" ? "#fff" : theme.text }]}>
            আমার পরীক্ষা
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "tests" ? (
          <Animated.View entering={FadeInUp.duration(400)}>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              উপলব্ধ পরীক্ষা
            </ThemedText>
            <View style={styles.testsGrid}>
              {TEST_TYPES.map((test, index) => (
                <Animated.View key={test.id} entering={FadeInUp.delay(index * 60).duration(400)}>
                  <Pressable
                    style={[styles.testCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  >
                    <View style={[styles.testIcon, { backgroundColor: theme.primary + "20" }]}>
                      <Feather name={test.icon as any} size={28} color={theme.primary} />
                    </View>
                    <ThemedText style={[styles.testName, { color: theme.text }]}>{test.name}</ThemedText>
                    <ThemedText style={[styles.testPrice, { color: theme.primary }]}>{test.price}</ThemedText>
                    <View style={styles.testDuration}>
                      <Feather name="clock" size={12} color={theme.textSecondary} />
                      <ThemedText style={[styles.testDurationText, { color: theme.textSecondary }]}>
                        {test.duration}
                      </ThemedText>
                    </View>
                    <Pressable style={[styles.bookButton, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.bookButtonText}>বুক করুন</ThemedText>
                    </Pressable>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : activeTab === "labs" ? (
          <Animated.View entering={FadeInUp.duration(400)}>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              স্বীকৃত ল্যাবরেটরি
            </ThemedText>
            {LABS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {LABS.map((lab, index) => (
              <Animated.View key={lab.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <View style={[styles.labCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <View style={styles.labHeader}>
                    <View style={[styles.labAvatar, { backgroundColor: theme.primary }]}>
                      <Feather name="activity" size={24} color="#fff" />
                    </View>
                    <View style={styles.labInfo}>
                      <ThemedText style={[styles.labName, { color: theme.text }]}>{lab.name}</ThemedText>
                      <View style={styles.labLocation}>
                        <Feather name="map-pin" size={12} color={theme.textSecondary} />
                        <ThemedText style={[styles.labLocationText, { color: theme.textSecondary }]}>
                          {lab.location}
                        </ThemedText>
                      </View>
                    </View>
                    {lab.accredited ? (
                      <View style={[styles.accreditedBadge, { backgroundColor: "#16A34A20" }]}>
                        <Feather name="check-circle" size={14} color="#16A34A" />
                        <ThemedText style={[styles.accreditedText, { color: "#16A34A" }]}>স্বীকৃত</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.labTests}>
                    {lab.tests.map((testId: string) => {
                      const test = TEST_TYPES.find((t) => t.id === testId);
                      return test ? (
                        <View key={testId} style={[styles.testChip, { backgroundColor: theme.primary + "15" }]}>
                          <ThemedText style={[styles.testChipText, { color: theme.primary }]}>{test.name}</ThemedText>
                        </View>
                      ) : null;
                    })}
                  </View>
                  <View style={styles.labFooter}>
                    <View style={styles.labRating}>
                      <Feather name="star" size={16} color="#EA8A0C" />
                      <ThemedText style={[styles.labRatingText, { color: theme.text }]}>{lab.rating}</ThemedText>
                    </View>
                    <Pressable style={[styles.viewButton, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.viewButtonText}>বিস্তারিত</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(400)}>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
              আমার পরীক্ষার ইতিহাস
            </ThemedText>
            {MY_TESTS.length === 0 ? <EmptyState icon="inbox" title="এখনও কিছু নেই" message="নতুন তথ্য যোগ হলে এখানে দেখা যাবে।" /> : null}
            {MY_TESTS.map((test, index) => (
              <View
                key={test.id}
                style={[styles.myTestCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.myTestHeader}>
                  <ThemedText style={[styles.myTestType, { color: theme.text }]}>{test.type}</ThemedText>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: test.status === "completed" ? "#16A34A20" : "#EA8A0C20" },
                    ]}
                  >
                    <ThemedText
                      style={[styles.statusText, { color: test.status === "completed" ? "#16A34A" : "#EA8A0C" }]}
                    >
                      {test.status === "completed" ? "সম্পন্ন" : "চলমান"}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.myTestDetails}>
                  <View style={styles.myTestDetail}>
                    <Feather name="home" size={14} color={theme.textSecondary} />
                    <ThemedText style={[styles.myTestDetailText, { color: theme.textSecondary }]}>{test.lab}</ThemedText>
                  </View>
                  <View style={styles.myTestDetail}>
                    <Feather name="calendar" size={14} color={theme.textSecondary} />
                    <ThemedText style={[styles.myTestDetailText, { color: theme.textSecondary }]}>{test.date}</ThemedText>
                  </View>
                  {test.result ? (
                    <View style={styles.myTestDetail}>
                      <Feather name="check-circle" size={14} color="#16A34A" />
                      <ThemedText style={[styles.myTestDetailText, { color: "#16A34A" }]}>ফলাফল: {test.result}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <Pressable style={[styles.downloadButton, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="download" size={16} color={theme.primary} />
                  <ThemedText style={[styles.downloadText, { color: theme.primary }]}>
                    {test.status === "completed" ? "রিপোর্ট ডাউনলোড" : "স্ট্যাটাস দেখুন"}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </Animated.View>
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
  tabText: { fontSize: 13, fontWeight: "600" },
  content: { padding: Spacing.lg, paddingTop: 0 },
  sectionTitle: { marginBottom: Spacing.md },
  testsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  testCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  testIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xs },
  testName: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  testPrice: { fontSize: 13, fontWeight: "700" },
  testDuration: { flexDirection: "row", alignItems: "center", gap: 4 },
  testDurationText: { fontSize: 12 },
  bookButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, marginTop: Spacing.sm },
  bookButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  labCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  labHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  labAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  labInfo: { flex: 1 },
  labName: { fontSize: 15, fontWeight: "600" },
  labLocation: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  labLocationText: { fontSize: 13 },
  accreditedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md, gap: 4 },
  accreditedText: { fontSize: 11, fontWeight: "600" },
  labTests: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.md },
  testChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  testChipText: { fontSize: 12 },
  labFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md },
  labRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  labRatingText: { fontSize: 15, fontWeight: "600" },
  viewButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  viewButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  myTestCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  myTestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  myTestType: { fontSize: 16, fontWeight: "600" },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  statusText: { fontSize: 12, fontWeight: "600" },
  myTestDetails: { marginTop: Spacing.md, gap: Spacing.xs },
  myTestDetail: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  myTestDetailText: { fontSize: 14 },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  downloadText: { fontSize: 14, fontWeight: "600" },
});
