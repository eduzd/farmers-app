import React, { useState } from "react";
import { SaveCalcButton } from "@/components/SaveCalcButton";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
import { AppIcon } from "@/components/icons/AppIcon";
interface LoanResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  schedule: Array<{
    month: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

const LOAN_TYPES = [
  { id: "crop", name: "ফসল ঋণ", rate: 4, maxAmount: 500000 },
  { id: "equipment", name: "যন্ত্রপাতি ঋণ", rate: 7, maxAmount: 2000000 },
  { id: "livestock", name: "প্রাণিসম্পদ ঋণ", rate: 5, maxAmount: 1000000 },
  { id: "fishery", name: "মৎস্য ঋণ", rate: 4.5, maxAmount: 800000 },
  { id: "agri-business", name: "কৃষি ব্যবসা ঋণ", rate: 9, maxAmount: 5000000 },
];

export default function LoanCalculatorScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedLoanType, setSelectedLoanType] = useState(LOAN_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [tenure, setTenure] = useState("");
  const [result, setResult] = useState<LoanResult | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  const calculateLoan = () => {
    const principal = parseFloat(amount);
    const months = parseInt(tenure);
    const annualRate = selectedLoanType.rate;

    if (!principal || !months || principal <= 0 || months <= 0) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const monthlyRate = annualRate / 12 / 100;
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    const totalPayment = monthlyPayment * months;
    const totalInterest = totalPayment - principal;

    const schedule = [];
    let balance = principal;
    for (let i = 1; i <= Math.min(months, 12); i++) {
      const interest = balance * monthlyRate;
      const principalPart = monthlyPayment - interest;
      balance -= principalPart;
      schedule.push({
        month: i,
        principal: Math.round(principalPart),
        interest: Math.round(interest),
        balance: Math.max(0, Math.round(balance)),
      });
    }

    setResult({
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
      schedule,
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
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="dollar-sign" size={32} color={theme.primary} />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>{tr("কৃষি ঋণ ক্যালকুলেটর")}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {tr("সরকারি ও বেসরকারি ব্যাংকের কৃষি ঋণ হিসাব করুন")}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("ঋণের ধরন")}</ThemedText>
        <View style={styles.loanTypes}>
          {LOAN_TYPES.map((loan) => (
            <Pressable
              key={loan.id}
              style={[
                styles.loanTypeCard,
                {
                  backgroundColor: selectedLoanType.id === loan.id ? theme.primary : theme.card,
                  borderColor: selectedLoanType.id === loan.id ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedLoanType(loan);
              }}
            >
              <ThemedText
                style={[
                  styles.loanTypeName,
                  { color: selectedLoanType.id === loan.id ? theme.white : theme.text },
                ]}
              >
                {loan.name}
              </ThemedText>
              <ThemedText
                style={[
                  styles.loanTypeRate,
                  { color: selectedLoanType.id === loan.id ? theme.white : theme.primary },
                ]}
              >
                {loan.rate}% সুদ
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("ঋণের পরিমাণ")}</ThemedText>
        <View
          style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <ThemedText style={[styles.currencySymbol, { color: theme.primary }]}>{tr("৳")}</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={amount}
            onChangeText={setAmount}
            placeholder={`সর্বোচ্চ ৳${selectedLoanType.maxAmount.toLocaleString()}`}
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
          সর্বোচ্চ ঋণ সীমা: ৳{selectedLoanType.maxAmount.toLocaleString()}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300)} style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("মেয়াদ (মাস)")}</ThemedText>
        <View
          style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <Feather name="calendar" size={20} color={theme.primary} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={tenure}
            onChangeText={setTenure}
            placeholder={tr("১২ থেকে ৬০ মাস")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400)}>
        <Pressable
          style={[styles.calculateButton, { backgroundColor: theme.primary }]}
          onPress={calculateLoan}
        >
          <Feather name="percent" size={20} color="#fff" />
          <ThemedText style={styles.calculateButtonText}>{tr("হিসাব করুন")}</ThemedText>
        </Pressable>
      </Animated.View>

      {result ? (
        <Animated.View entering={FadeInUp} style={styles.resultSection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("ঋণের সারসংক্ষেপ")}</ThemedText>

          <View style={styles.resultCards}>
            <View style={[styles.resultCard, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.resultLabel, { color: theme.textSecondary }]}>
                {tr("মাসিক কিস্তি")}
              </ThemedText>
              <ThemedText style={[styles.resultValue, { color: theme.primary }]}>
                ৳{result.monthlyPayment.toLocaleString()}
              </ThemedText>
            </View>

            <View style={[styles.resultCard, { backgroundColor: "#2E96EF" + "15" }]}>
              <ThemedText style={[styles.resultLabel, { color: theme.textSecondary }]}>
                {tr("মোট সুদ")}
              </ThemedText>
              <ThemedText style={[styles.resultValue, { color: "#2E96EF" }]}>
                ৳{result.totalInterest.toLocaleString()}
              </ThemedText>
            </View>

            <View style={[styles.resultCard, { backgroundColor: "#B25E09" + "15" }]}>
              <ThemedText style={[styles.resultLabel, { color: theme.textSecondary }]}>
                {tr("মোট পরিশোধ")}
              </ThemedText>
              <ThemedText style={[styles.resultValue, { color: "#B25E09" }]}>
                ৳{result.totalPayment.toLocaleString()}
              </ThemedText>
            </View>
          </View>

          <SaveCalcButton
            recordType="LOAN"
            title={`${selectedLoanType.name} - ৳${amount}`}
            inputs={{ loanType: selectedLoanType.id, rate: selectedLoanType.rate, amount, tenure }}
            summary={[
              { label: 'ঋণের ধরন', value: `${selectedLoanType.name} (${selectedLoanType.rate}%)` },
              { label: 'ঋণের পরিমাণ', value: `৳${amount}` },
              { label: 'মেয়াদ (মাস)', value: String(tenure) },
              { label: 'মাসিক কিস্তি', value: `৳${result.monthlyPayment.toLocaleString()}` },
              { label: 'মোট সুদ', value: `৳${result.totalInterest.toLocaleString()}` },
              { label: 'মোট পরিশোধ', value: `৳${result.totalPayment.toLocaleString()}` },
            ]}
          />

          <Pressable
            style={[styles.scheduleToggle, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => setShowSchedule(!showSchedule)}
          >
            <ThemedText style={[styles.scheduleToggleText, { color: theme.text }]}>
              {tr("কিস্তির সূচি দেখুন")}
            </ThemedText>
            <AppIcon
              name={showSchedule ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>

          {showSchedule ? (
            <View style={[styles.scheduleTable, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={[styles.scheduleHeader, { borderBottomColor: theme.cardBorder }]}>
                <ThemedText style={[styles.scheduleHeaderText, { color: theme.textSecondary }]}>
                  {tr("মাস")}
                </ThemedText>
                <ThemedText style={[styles.scheduleHeaderText, { color: theme.textSecondary }]}>
                  {tr("আসল")}
                </ThemedText>
                <ThemedText style={[styles.scheduleHeaderText, { color: theme.textSecondary }]}>
                  {tr("সুদ")}
                </ThemedText>
                <ThemedText style={[styles.scheduleHeaderText, { color: theme.textSecondary }]}>
                  {tr("বাকি")}
                </ThemedText>
              </View>
              {result.schedule.map((row) => (
                <View key={row.month} style={[styles.scheduleRow, { borderBottomColor: theme.cardBorder }]}>
                  <ThemedText style={[styles.scheduleCell, { color: theme.text }]}>{row.month}</ThemedText>
                  <ThemedText style={[styles.scheduleCell, { color: theme.text }]}>
                    ৳{row.principal.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.scheduleCell, { color: "#B25E09" }]}>
                    ৳{row.interest.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.scheduleCell, { color: theme.primary }]}>
                    ৳{row.balance.toLocaleString()}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInUp.delay(500)} style={styles.infoSection}>
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Feather name="info" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText style={[styles.infoTitle, { color: theme.text }]}>
              {tr("সরকারি ভর্তুকি সুদ")}
            </ThemedText>
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              {tr("বাংলাদেশ সরকার কৃষি ঋণে ৪-৯% সুদের হার নির্ধারণ করেছে। ফসল ঋণে সর্বনিম্ন ৪% সুদ প্রযোজ্য।")}
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
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  loanTypes: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  loanTypeCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  loanTypeName: { fontSize: 13, fontWeight: "500" },
  loanTypeRate: { fontSize: 11, marginTop: 2 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  currencySymbol: { fontSize: 20, fontWeight: "600" },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.md },
  hint: { fontSize: 12, marginTop: Spacing.xs },
  calculateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  calculateButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resultSection: { marginBottom: Spacing.xl },
  resultCards: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  resultCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center" },
  resultLabel: { fontSize: 11, marginBottom: Spacing.xs },
  resultValue: { fontSize: 16, fontWeight: "700" },
  scheduleToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  scheduleToggleText: { fontSize: 14, fontWeight: "500" },
  scheduleTable: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  scheduleHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  scheduleHeaderText: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "center" },
  scheduleRow: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  scheduleCell: { flex: 1, fontSize: 12, textAlign: "center" },
  infoSection: { marginTop: Spacing.md },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.xs },
  infoText: { fontSize: 12, lineHeight: 18 },
});
