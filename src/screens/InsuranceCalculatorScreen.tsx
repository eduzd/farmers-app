import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
interface InsuranceResult {
  annualPremium: number;
  coverage: number;
  govtSubsidy: number;
  farmerPayable: number;
  maxClaim: number;
}

const INSURANCE_TYPES = [
  { id: "crop", name: "ফসল বীমা", rate: 2, subsidy: 50, icon: "sun", color: "#2FA36B" },
  { id: "livestock", name: "গবাদি পশু বীমা", rate: 3, subsidy: 40, icon: "heart", color: "#DC2626" },
  { id: "fishery", name: "মাছ চাষ বীমা", rate: 2.5, subsidy: 45, icon: "droplet", color: "#2563EB" },
  { id: "poultry", name: "হাঁস-মুরগি বীমা", rate: 3.5, subsidy: 35, icon: "feather", color: "#EA8A0C" },
];

const CROP_TYPES = [
  { name: "ধান (বোরো)", coverage: 40000 },
  { name: "ধান (আমন)", coverage: 35000 },
  { name: "গম", coverage: 30000 },
  { name: "সবজি", coverage: 50000 },
  { name: "ফল", coverage: 80000 },
];

export default function InsuranceCalculatorScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedType, setSelectedType] = useState(INSURANCE_TYPES[0]);
  const [landArea, setLandArea] = useState("");
  const [assetValue, setAssetValue] = useState("");
  const [result, setResult] = useState<InsuranceResult | null>(null);

  const calculateInsurance = () => {
    const area = parseFloat(landArea) || 0;
    const value = parseFloat(assetValue) || 0;

    if (area <= 0 && value <= 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let coverage = 0;
    if (selectedType.id === "crop") {
      coverage = area * 40000;
    } else {
      coverage = value;
    }

    const annualPremium = coverage * (selectedType.rate / 100);
    const govtSubsidy = annualPremium * (selectedType.subsidy / 100);
    const farmerPayable = annualPremium - govtSubsidy;
    const maxClaim = coverage * 0.8;

    setResult({
      annualPremium: Math.round(annualPremium),
      coverage: Math.round(coverage),
      govtSubsidy: Math.round(govtSubsidy),
      farmerPayable: Math.round(farmerPayable),
      maxClaim: Math.round(maxClaim),
    });
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
        <View style={[styles.iconContainer, { backgroundColor: "#7C3AED" + "20" }]}>
          <Feather name="shield" size={32} color="#7C3AED" />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>{tr("কৃষি বীমা ক্যালকুলেটর")}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {tr("ফসল ও সম্পদ রক্ষায় বীমা হিসাব করুন")}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("বীমার ধরন")}</ThemedText>
        <View style={styles.typeGrid}>
          {INSURANCE_TYPES.map((type) => (
            <Pressable
              key={type.id}
              style={[
                styles.typeCard,
                {
                  backgroundColor: selectedType.id === type.id ? type.color + "20" : theme.card,
                  borderColor: selectedType.id === type.id ? type.color : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedType(type);
                setResult(null);
              }}
            >
              <Feather name={type.icon as any} size={24} color={type.color} />
              <ThemedText style={[styles.typeName, { color: theme.text }]}>{type.name}</ThemedText>
              <ThemedText style={[styles.typeRate, { color: type.color }]}>
                প্রিমিয়াম {type.rate}%
              </ThemedText>
              <ThemedText style={[styles.typeSubsidy, { color: theme.textSecondary }]}>
                ভর্তুকি {type.subsidy}%
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
        {selectedType.id === "crop" ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("জমির পরিমাণ (বিঘা)")}</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Feather name="maximize-2" size={20} color={theme.primary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={landArea}
                onChangeText={setLandArea}
                placeholder={tr("যেমন: ৫")}
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
              <ThemedText style={[styles.unit, { color: theme.textSecondary }]}>{tr("বিঘা")}</ThemedText>
            </View>
            <View style={styles.coverageInfo}>
              <ThemedText style={[styles.coverageLabel, { color: theme.textSecondary }]}>
                {tr("প্রতি বিঘা কভারেজ:")}
              </ThemedText>
              {CROP_TYPES.map((crop, i) => (
                <ThemedText key={i} style={[styles.coverageItem, { color: theme.text }]}>
                  {crop.name}: ৳{crop.coverage.toLocaleString()}
                </ThemedText>
              ))}
            </View>
          </>
        ) : (
          <>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("সম্পদের মূল্য (টাকা)")}</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ThemedText style={[styles.currencySymbol, { color: theme.primary }]}>{tr("৳")}</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={assetValue}
                onChangeText={setAssetValue}
                placeholder={tr("যেমন: ৫০০০০০")}
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </>
        )}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300)}>
        <Pressable
          style={[styles.calculateButton, { backgroundColor: theme.primary }]}
          onPress={calculateInsurance}
        >
          <Feather name="percent" size={20} color="#fff" />
          <ThemedText style={styles.calculateButtonText}>{tr("প্রিমিয়াম হিসাব করুন")}</ThemedText>
        </Pressable>
      </Animated.View>

      {result ? (
        <Animated.View entering={FadeInUp} style={styles.resultSection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("বীমা সারসংক্ষেপ")}</ThemedText>

          <View style={styles.resultCards}>
            <View style={[styles.resultCard, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.resultLabel, { color: theme.textSecondary }]}>{tr("কভারেজ")}</ThemedText>
              <ThemedText style={[styles.resultValue, { color: theme.primary }]}>
                ৳{result.coverage.toLocaleString()}
              </ThemedText>
            </View>
            <View style={[styles.resultCard, { backgroundColor: "#2FA36B" + "15" }]}>
              <ThemedText style={[styles.resultLabel, { color: theme.textSecondary }]}>{tr("সরকারি ভর্তুকি")}</ThemedText>
              <ThemedText style={[styles.resultValue, { color: "#2FA36B" }]}>
                ৳{result.govtSubsidy.toLocaleString()}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.mainResultCard, { backgroundColor: theme.card, borderColor: theme.primary }]}>
            <View style={styles.mainResultRow}>
              <ThemedText style={[styles.mainResultLabel, { color: theme.text }]}>{tr("বার্ষিক প্রিমিয়াম")}</ThemedText>
              <ThemedText style={[styles.mainResultValue, { color: theme.textSecondary }]}>
                ৳{result.annualPremium.toLocaleString()}
              </ThemedText>
            </View>
            <View style={styles.mainResultRow}>
              <ThemedText style={[styles.mainResultLabel, { color: theme.text }]}>{tr("সরকারি ভর্তুকি")}</ThemedText>
              <ThemedText style={[styles.mainResultValue, { color: "#2FA36B" }]}>
                - ৳{result.govtSubsidy.toLocaleString()}
              </ThemedText>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
            <View style={styles.mainResultRow}>
              <ThemedText style={[styles.payableLabel, { color: theme.text }]}>{tr("আপনার পরিশোধযোগ্য")}</ThemedText>
              <ThemedText style={[styles.payableValue, { color: theme.primary }]}>
                ৳{result.farmerPayable.toLocaleString()}
              </ThemedText>
            </View>
            <View style={styles.mainResultRow}>
              <ThemedText style={[styles.mainResultLabel, { color: theme.textSecondary }]}>{tr("সর্বোচ্চ দাবি")}</ThemedText>
              <ThemedText style={[styles.mainResultValue, { color: "#EA8A0C" }]}>
                ৳{result.maxClaim.toLocaleString()}
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInUp.delay(400)} style={styles.infoSection}>
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Feather name="info" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText style={[styles.infoTitle, { color: theme.text }]}>{tr("কৃষি বীমা সুবিধা")}</ThemedText>
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              {tr("বাংলাদেশ সরকার কৃষি বীমায় ৩৫-৫০% ভর্তুকি প্রদান করে। প্রাকৃতিক দুর্যোগ, রোগ-বালাই ও অন্যান্য ক্ষতিতে ৮০% পর্যন্ত ক্ষতিপূরণ পাওয়া যায়।")}
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { alignItems: "center", marginBottom: Spacing.xl },
  iconContainer: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700", marginBottom: Spacing.xs, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center" },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  typeCard: { width: "48%", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: "center" },
  typeName: { fontSize: 13, fontWeight: "600", marginTop: Spacing.xs, textAlign: "center" },
  typeRate: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  typeSubsidy: { fontSize: 11 },
  inputContainer: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  currencySymbol: { fontSize: 20, fontWeight: "600" },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.md },
  unit: { fontSize: 14 },
  coverageInfo: { marginTop: Spacing.sm },
  coverageLabel: { fontSize: 12, marginBottom: 4 },
  coverageItem: { fontSize: 12, marginLeft: Spacing.sm },
  calculateButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm, marginBottom: Spacing.xl },
  calculateButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resultSection: { marginBottom: Spacing.xl },
  resultCards: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  resultCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center" },
  resultLabel: { fontSize: 12, marginBottom: Spacing.xs },
  resultValue: { fontSize: 18, fontWeight: "700" },
  mainResultCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 2 },
  mainResultRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs },
  mainResultLabel: { fontSize: 14 },
  mainResultValue: { fontSize: 14, fontWeight: "500" },
  divider: { height: 1, marginVertical: Spacing.sm },
  payableLabel: { fontSize: 16, fontWeight: "600" },
  payableValue: { fontSize: 20, fontWeight: "700" },
  infoSection: { marginTop: Spacing.md },
  infoCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, gap: Spacing.sm },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.xs },
  infoText: { fontSize: 12, lineHeight: 18 },
});
