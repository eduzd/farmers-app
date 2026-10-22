import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
const SCAN_FEATURES = [
  { id: "product", icon: "package", title: "পণ্য যাচাই", desc: "আসল পণ্য চিনুন" },
  { id: "seller", icon: "user-check", title: "বিক্রেতা যাচাই", desc: "বিশ্বস্ত বিক্রেতা" },
  { id: "payment", icon: "credit-card", title: "পেমেন্ট", desc: "QR দিয়ে পেমেন্ট" },
  { id: "track", icon: "truck", title: "ট্র্যাকিং", desc: "ডেলিভারি ট্র্যাক" },
];

export default function QRScannerScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedFeature, setSelectedFeature] = useState("product");

  const handleScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.scannerSection}>
        <LinearGradient
          colors={isDark ? ["#1a1a2e", "#0f0f1a"] : ["#f0f0f0", "#e0e0e0"]}
          style={styles.scannerFrame}
        >
          <View style={[styles.scannerBox, { borderColor: theme.primary }]}>
            <View style={[styles.corner, styles.topLeft, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: theme.primary }]} />
            <Feather name="camera" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.scannerText, { color: theme.textSecondary }]}>
              {Platform.OS === "web" ? "Expo Go তে স্ক্যান করুন" : "QR কোড স্ক্যান করুন"}
            </ThemedText>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={[styles.featuresSection, { paddingBottom: insets.bottom + 20 }]}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          স্ক্যান করে কী করবেন?
        </ThemedText>
        <View style={styles.featuresGrid}>
          {SCAN_FEATURES.map((feature, index) => (
            <Animated.View key={feature.id} entering={FadeInUp.delay(index * 80).duration(400)}>
              <Pressable
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: selectedFeature === feature.id ? theme.primary + "15" : theme.card,
                    borderColor: selectedFeature === feature.id ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFeature(feature.id);
                }}
              >
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + "20" }]}>
                  <AppIcon
                    name={feature.icon as any}
                    size={24}
                    color={selectedFeature === feature.id ? theme.primary : theme.textSecondary}
                  />
                </View>
                <ThemedText style={[styles.featureTitle, { color: theme.text }]}>{feature.title}</ThemedText>
                <ThemedText style={[styles.featureDesc, { color: theme.textSecondary }]}>{feature.desc}</ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Pressable
          style={[styles.scanButton, { backgroundColor: theme.primary }]}
          onPress={handleScan}
        >
          <Feather name="camera" size={20} color="#fff" />
          <ThemedText style={styles.scanButtonText}>স্ক্যান শুরু করুন</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scannerSection: { flex: 1, justifyContent: "center", alignItems: "center" },
  scannerFrame: { width: 280, height: 280, borderRadius: BorderRadius["2xl"], justifyContent: "center", alignItems: "center" },
  scannerBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  corner: { position: "absolute", width: 30, height: 30, borderWidth: 3 },
  topLeft: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  topRight: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  bottomLeft: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  bottomRight: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },
  scannerText: { marginTop: Spacing.md, fontSize: 14 },
  featuresSection: { padding: Spacing.lg },
  sectionTitle: { marginBottom: Spacing.md },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  featureCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  featureIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 14, fontWeight: "600" },
  featureDesc: { fontSize: 12, textAlign: "center" },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  scanButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
