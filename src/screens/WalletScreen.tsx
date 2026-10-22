import React, { useState, useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { apiGet, isLoggedIn, timeAgo } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
import { ModalBottomInset } from "@/components/ModalBottomInset";
import { AppIcon } from "@/components/icons/AppIcon";
interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: string;
  method?: string;
  status: "completed" | "pending" | "failed";
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  number?: string;
}


const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "bkash", name: "বিকাশ", icon: "smartphone", color: "#E2136E" },
  { id: "nagad", name: "নগদ", icon: "smartphone", color: "#F26522" },
  { id: "rocket", name: "রকেট", icon: "smartphone", color: "#8C3494" },
  { id: "bank", name: "ব্যাংক ট্রান্সফার", icon: "credit-card", color: "#2563EB" },
];

export default function WalletScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const { language } = useI18n();
  const navigation = useNavigation<any>();
  const [wallet, setWallet] = useState<{ balance: number; income: number; pendingIncome: number; spent: number; transactions: any[] }>({ balance: 0, income: 0, pendingIncome: 0, spent: 0, transactions: [] });
  const balance = wallet.balance;
  const [showAll, setShowAll] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn()) return;
      apiGet("/api/me/wallet").then(setWallet).catch(() => {});
    }, [])
  );
  const transactions: Transaction[] = wallet.transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    description: `${t.type === "credit" ? tr("Sale") : tr("Order")} ${String(t.id).slice(2)} · ${tr(t.status.charAt(0).toUpperCase() + t.status.slice(1))}`,
    date: timeAgo(t.date, language),
    method: t.method,
    status: t.status === "delivered" ? "completed" : t.status === "cancelled" ? "failed" : "pending",
  }));
  const gatewayMissing = () =>
    Alert.alert(
      tr("Needs live bKash"),
      tr("Adding, withdrawing and sending money needs the bKash merchant keys on the server. Your balance here is your income from delivered sales.")
    );
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const handleAddMoney = () => {
    if (!amount || !selectedMethod) {
      Alert.alert(tr("ত্রুটি"), tr("টাকার পরিমাণ এবং পেমেন্ট মেথড নির্বাচন করুন"));
      return;
    }

    setShowAddMoney(false);
    gatewayMissing();
    setAmount("");
    setSelectedMethod(null);
  };

  const handleWithdraw = () => {
    if (!amount || !selectedMethod) {
      Alert.alert(tr("ত্রুটি"), tr("টাকার পরিমাণ এবং পেমেন্ট মেথড নির্বাচন করুন"));
      return;
    }

    const withdrawAmount = parseInt(amount);
    if (withdrawAmount > balance) {
      Alert.alert(tr("ত্রুটি"), tr("পর্যাপ্ত ব্যালেন্স নেই"));
      return;
    }

    setShowWithdraw(false);
    gatewayMissing();
    setAmount("");
    setSelectedMethod(null);
  };

  const quickAmounts = [500, 1000, 2000, 5000];

  const renderTransaction = (transaction: Transaction, index: number) => (
    <Animated.View
      key={transaction.id}
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <View
        style={[
          styles.transactionCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
      >
        <View
          style={[
            styles.transactionIcon,
            {
              backgroundColor:
                transaction.type === "credit"
                  ? theme.primary + "15"
                  : "#DC262615",
            },
          ]}
        >
          <AppIcon
            name={transaction.type === "credit" ? "arrow-down-left" : "arrow-up-right"}
            size={20}
            color={transaction.type === "credit" ? theme.primary : "#DC2626"}
          />
        </View>

        <View style={styles.transactionContent}>
          <ThemedText style={[styles.transactionDesc, { color: theme.text }]}>
            {transaction.description}
          </ThemedText>
          <ThemedText style={[styles.transactionDate, { color: theme.textSecondary }]}>
            {transaction.date}
          </ThemedText>
        </View>

        <ThemedText
          style={[
            styles.transactionAmount,
            { color: transaction.type === "credit" ? theme.primary : "#DC2626" },
          ]}
        >
          {transaction.type === "credit" ? "+" : "-"}৳{transaction.amount}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderPaymentModal = (isWithdraw: boolean) => (
    <Modal
      visible={isWithdraw ? showWithdraw : showAddMoney}
      animationType="slide"
      transparent
      onRequestClose={() => {
        isWithdraw ? setShowWithdraw(false) : setShowAddMoney(false);
        setAmount("");
        setSelectedMethod(null);
      }}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            isWithdraw ? setShowWithdraw(false) : setShowAddMoney(false);
            setAmount("");
            setSelectedMethod(null);
          }}
        />
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              {isWithdraw ? "টাকা তুলুন" : "টাকা যোগ করুন"}
            </ThemedText>
            <Pressable
              onPress={() => {
                isWithdraw ? setShowWithdraw(false) : setShowAddMoney(false);
                setAmount("");
                setSelectedMethod(null);
              }}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.modalScrollContent,
              { paddingBottom: Spacing.xl },
            ]}
          >
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {tr("টাকার পরিমাণ")}
            </ThemedText>
            <View
              style={[
                styles.amountInputContainer,
                { backgroundColor: theme.backgroundRoot, borderColor: theme.inputBorder },
              ]}
            >
              <ThemedText style={[styles.currencySymbol, { color: theme.primary }]}>
                {tr("৳")}
              </ThemedText>
              <TextInput
                style={[styles.amountInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.quickAmountsRow}>
              {quickAmounts.map((qa) => (
                <Pressable
                  key={qa}
                  style={[
                    styles.quickAmountChip,
                    {
                      backgroundColor:
                        amount === qa.toString() ? theme.primary : theme.backgroundRoot,
                      borderColor:
                        amount === qa.toString() ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setAmount(qa.toString())}
                >
                  <ThemedText
                    style={[
                      styles.quickAmountText,
                      { color: amount === qa.toString() ? theme.white : theme.text },
                    ]}
                  >
                    ৳{qa}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
              {tr("পেমেন্ট মেথড")}
            </ThemedText>
            <View style={styles.methodsGrid}>
              {PAYMENT_METHODS.map((method) => (
                <Pressable
                  key={method.id}
                  style={[
                    styles.methodCard,
                    {
                      backgroundColor:
                        selectedMethod === method.id
                          ? method.color + "15"
                          : theme.backgroundRoot,
                      borderColor:
                        selectedMethod === method.id
                          ? method.color
                          : theme.inputBorder,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMethod(method.id);
                  }}
                >
                  <View
                    style={[
                      styles.methodIconContainer,
                      { backgroundColor: method.color + "20" },
                    ]}
                  >
                    <AppIcon name={method.icon as any} size={20} color={method.color} />
                  </View>
                  <ThemedText style={[styles.methodName, { color: theme.text }]}>
                    {method.name}
                  </ThemedText>
                  {selectedMethod === method.id ? (
                    <View style={[styles.checkCircle, { backgroundColor: method.color }]}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: theme.primary },
                (!amount || !selectedMethod) && styles.buttonDisabled,
              ]}
              onPress={isWithdraw ? handleWithdraw : handleAddMoney}
              disabled={!amount || !selectedMethod}
            >
              <ThemedText style={[styles.submitButtonText, { color: theme.white }]}>
                {isWithdraw ? "উত্তোলন করুন" : "টাকা যোগ করুন"}
              </ThemedText>
            </Pressable>
          </ScrollView>
          <ModalBottomInset />
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
        <ThemedText style={styles.balanceLabel}>{tr("মোট ব্যালেন্স")}</ThemedText>
        <ThemedText style={styles.balanceAmount}>৳{balance.toLocaleString()}</ThemedText>

        <View style={styles.balanceActions}>
          <Pressable
            style={styles.balanceActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddMoney(true);
            }}
          >
            <View style={styles.balanceActionIcon}>
              <Feather name="plus" size={20} color={theme.primary} />
            </View>
            <ThemedText style={styles.balanceActionText}>{tr("যোগ করুন")}</ThemedText>
          </Pressable>

          <Pressable
            style={styles.balanceActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowWithdraw(true);
            }}
          >
            <View style={styles.balanceActionIcon}>
              <Feather name="arrow-up" size={20} color={theme.primary} />
            </View>
            <ThemedText style={styles.balanceActionText}>{tr("তুলুন")}</ThemedText>
          </Pressable>

          <Pressable style={styles.balanceActionBtn} onPress={gatewayMissing}>
            <View style={styles.balanceActionIcon}>
              <Feather name="send" size={20} color={theme.primary} />
            </View>
            <ThemedText style={styles.balanceActionText}>{tr("পাঠান")}</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Feather name="trending-up" size={20} color="#2FA36B" />
          <ThemedText style={[styles.statAmount, { color: "#2FA36B" }]}>
            ৳{wallet.income.toLocaleString()}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            {tr("Income (delivered)")}
          </ThemedText>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Feather name="trending-down" size={20} color="#DC2626" />
          <ThemedText style={[styles.statAmount, { color: "#DC2626" }]}>
            ৳{wallet.spent.toLocaleString()}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            {tr("Spent on orders")}
          </ThemedText>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {tr("সাম্প্রতিক লেনদেন")}
        </ThemedText>
        <Pressable onPress={() => setShowAll(!showAll)}>
          <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>
            {showAll ? tr("Show less") : tr("সব দেখুন")}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.transactionsList}>
        {transactions.length ? (
          (showAll ? transactions : transactions.slice(0, 6)).map((transaction, index) => renderTransaction(transaction, index))
        ) : (
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.lg }]}>
            {isLoggedIn() ? tr("No transactions yet. Orders and sales will show up here.") : tr("Log in to see your transactions")}
          </ThemedText>
        )}
        {wallet.pendingIncome > 0 ? (
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary, textAlign: "center" }]}>
            {tr("Pending income")}: ৳{wallet.pendingIncome.toLocaleString()}
          </ThemedText>
        ) : null}
      </View>

      {renderPaymentModal(false)}
      {renderPaymentModal(true)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  balanceCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  balanceAmount: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "700",
    marginBottom: Spacing.xl,
  },
  balanceActions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  balanceActionBtn: {
    alignItems: "center",
  },
  balanceActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  balanceActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    ...Shadows.small,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: Spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  transactionsList: {
    gap: Spacing.sm,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: 60,
    marginBottom: Spacing.md,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "700",
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
  },
  quickAmountsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickAmountChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: "600",
  },
  methodsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  methodIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  methodName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    marginLeft: Spacing.md,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
