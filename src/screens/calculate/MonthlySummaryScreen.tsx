import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ResultCard, ResultRow, MoneyDisplay } from '@/offline/components/calculate/ResultCard';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

function useColors() {
  const { theme } = useTheme();
  return {
    text: theme.text,
    textSecondary: theme.textSecondary,
    background: theme.backgroundRoot,
    card: theme.card,
    border: theme.inputBorder,
    primary: theme.primary,
  };
}
import { getMonthlySummary } from '@/offline/db/ledger';
import { getCalcRecords, CalcRecord } from '@/offline/db/records';
import { t, Language, formatCurrency } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
const months = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export function MonthlySummaryScreen() {
  const tr = useTr();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalCommissions: 0,
    totalReceived: 0,
    totalPaid: 0,
    totalDue: 0,
  });
  const [calcStats, setCalcStats] = useState({
    bepariCount: 0,
    aratCount: 0,
    feedCount: 0,
    totalCalcAmount: 0,
  });

  const loadSummary = useCallback(async () => {
    const data = await getMonthlySummary(selectedYear, selectedMonth);
    setSummary(data);

    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getTime();
    const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).getTime();

    const records = await getCalcRecords({
      fromDate: startOfMonth,
      toDate: endOfMonth,
      archived: false,
    });

    let bepariCount = 0;
    let aratCount = 0;
    let feedCount = 0;
    let totalCalcAmount = 0;

    for (const record of records) {
      if (record.record_type === 'BEPARI') bepariCount++;
      else if (record.record_type === 'ARAT') aratCount++;
      else if (record.record_type === 'FEED') feedCount++;

      try {
        const outputs = JSON.parse(record.outputs_json);
        if (outputs.net_amount) totalCalcAmount += outputs.net_amount;
      } catch {}
    }

    setCalcStats({ bepariCount, aratCount, feedCount, totalCalcAmount });
  }, [selectedYear, selectedMonth]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const fmtCurrency = (amount: number) => formatCurrency(amount, lang);

  const changeMonth = (delta: number) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const netBalance = summary.totalSales - summary.totalPurchases - summary.totalExpenses;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.monthSelector, { backgroundColor: colors.card }]}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.monthButton}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.monthDisplay}>
            <ThemedText style={styles.monthText}>
              {months[selectedMonth - 1]} {selectedYear}
            </ThemedText>
          </View>
          <Pressable onPress={() => changeMonth(1)} style={styles.monthButton}>
            <Feather name="chevron-right" size={24} color={colors.text} />
          </Pressable>
        </View>

        <MoneyDisplay
          amount={netBalance}
          label="নেট ব্যালেন্স"
          formatCurrency={fmtCurrency}
          size="large"
        />

        <ResultCard title="খাতা সারাংশ">
          <ResultRow label={t('totalSales', lang)} value={fmtCurrency(summary.totalSales)} highlight />
          <ResultRow label={t('totalPurchases', lang)} value={fmtCurrency(summary.totalPurchases)} />
          <ResultRow label={t('totalExpenses', lang)} value={fmtCurrency(summary.totalExpenses)} />
          <ResultRow label={t('totalCommissions', lang)} value={fmtCurrency(summary.totalCommissions)} />
          <ResultRow label={t('totalDue', lang)} value={fmtCurrency(summary.totalDue)} isTotal />
        </ResultCard>

        <ResultCard title="পেমেন্ট সারাংশ">
          <ResultRow label={t('totalReceived', lang)} value={fmtCurrency(summary.totalReceived)} highlight />
          <ResultRow label={t('totalPaid', lang)} value={fmtCurrency(summary.totalPaid)} />
        </ResultCard>

        <ResultCard title="ক্যালকুলেটর সারাংশ">
          <ResultRow label="ব্যাপারী হিসাব" value={`${calcStats.bepariCount} টি`} />
          <ResultRow label="আড়ত হিসাব" value={`${calcStats.aratCount} টি`} />
          <ResultRow label="খাদ্য হিসাব" value={`${calcStats.feedCount} টি`} />
          <ResultRow label="মোট পরিমাণ" value={fmtCurrency(calcStats.totalCalcAmount)} isTotal highlight />
        </ResultCard>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#16A34A20' }]}>
            <Feather name="trending-up" size={24} color="#16A34A" />
            <ThemedText style={[styles.statValue, { color: '#16A34A' }]}>
              {fmtCurrency(summary.totalSales)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
              {tr("মোট বিক্রি")}
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DC262620' }]}>
            <Feather name="trending-down" size={24} color="#DC2626" />
            <ThemedText style={[styles.statValue, { color: '#DC2626' }]}>
              {fmtCurrency(summary.totalDue)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
              {tr("মোট বাকি")}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  monthButton: {
    padding: Spacing.xs,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xs,
  },
});
