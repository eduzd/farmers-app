import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { InputRow } from '@/offline/components/calculate/InputRow';
import { ResultCard, ResultRow, MoneyDisplay } from '@/offline/components/calculate/ResultCard';
import { StickyActionBar } from '@/offline/components/calculate/StickyActionBar';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, Typography } from '@/constants/theme';

function useColors() {
  const { theme } = useTheme();
  return {
    text: theme.text,
    textSecondary: theme.textSecondary,
    background: theme.backgroundRoot,
    card: theme.card,
    border: theme.inputBorder,
    primary: theme.primary,
    error: theme.error,
  };
}
import { calculateFeed, FeedInputs, FeedOutputs, defaultFeedSettings } from '@/offline/utils/calculations/feed';
import { saveCalcRecord } from '@/offline/db/records';
import { saveDraft, getDraft, deleteDraft } from '@/offline/db/drafts';
import { t, Language, formatCurrency, formatWeight, formatNumber } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
export function FeedCalculatorScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const [fishCount, setFishCount] = useState('');
  const [avgWeightKg, setAvgWeightKg] = useState('');
  const [feedRatePercent, setFeedRatePercent] = useState(defaultFeedSettings.feed_rate_percent_per_day.toString());
  const [daysInMonth, setDaysInMonth] = useState(defaultFeedSettings.days_in_month.toString());
  const [wastagePercent, setWastagePercent] = useState(defaultFeedSettings.wastage_percent.toString());
  const [bagSizeKg, setBagSizeKg] = useState(defaultFeedSettings.bag_size_kg.toString());
  const [bagPrice, setBagPrice] = useState('');
  const [morningPercent, setMorningPercent] = useState(defaultFeedSettings.morning_percent.toString());
  const [results, setResults] = useState<FeedOutputs | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadDraft();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft('feed', { fishCount, avgWeightKg, feedRatePercent, daysInMonth, wastagePercent, bagSizeKg, bagPrice, morningPercent, notes });
    }, 1000);
    return () => clearTimeout(timer);
  }, [fishCount, avgWeightKg, feedRatePercent, daysInMonth, wastagePercent, bagSizeKg, bagPrice, morningPercent, notes]);

  const loadDraft = async () => {
    const draft = await getDraft('feed');
    if (draft) {
      if (draft.fishCount) setFishCount(draft.fishCount);
      if (draft.avgWeightKg) setAvgWeightKg(draft.avgWeightKg);
      if (draft.feedRatePercent) setFeedRatePercent(draft.feedRatePercent);
      if (draft.daysInMonth) setDaysInMonth(draft.daysInMonth);
      if (draft.wastagePercent) setWastagePercent(draft.wastagePercent);
      if (draft.bagSizeKg) setBagSizeKg(draft.bagSizeKg);
      if (draft.bagPrice) setBagPrice(draft.bagPrice);
      if (draft.morningPercent) setMorningPercent(draft.morningPercent);
      if (draft.notes) setNotes(draft.notes);
    }
  };

  const calculate = useCallback(() => {
    const inputs: FeedInputs = {
      fish_count: parseInt(fishCount) || 0,
      avg_weight_kg: parseFloat(avgWeightKg) || 0,
      feed_rate_percent_per_day: parseFloat(feedRatePercent) || 0,
      days_in_month: parseInt(daysInMonth) || 30,
      wastage_percent: parseFloat(wastagePercent) || 0,
      bag_size_kg: parseFloat(bagSizeKg) || 25,
      bag_price: parseFloat(bagPrice) || 0,
      morning_percent: parseFloat(morningPercent) || 40,
    };

    const outputs = calculateFeed(inputs);
    setResults(outputs);
  }, [fishCount, avgWeightKg, feedRatePercent, daysInMonth, wastagePercent, bagSizeKg, bagPrice, morningPercent]);

  const handleSave = async () => {
    if (!results) {
      Alert.alert('ত্রুটি', 'প্রথমে হিসাব করুন');
      return;
    }

    const inputs: FeedInputs = {
      fish_count: parseInt(fishCount) || 0,
      avg_weight_kg: parseFloat(avgWeightKg) || 0,
      feed_rate_percent_per_day: parseFloat(feedRatePercent) || 0,
      days_in_month: parseInt(daysInMonth) || 30,
      wastage_percent: parseFloat(wastagePercent) || 0,
      bag_size_kg: parseFloat(bagSizeKg) || 25,
      bag_price: parseFloat(bagPrice) || 0,
      morning_percent: parseFloat(morningPercent) || 40,
    };

    try {
      await saveCalcRecord('FEED', inputs, results, { notes, language: lang });
      await deleteDraft('feed');
      Alert.alert('সফল', 'হিসাব সংরক্ষিত হয়েছে', [
        { text: 'ঠিক আছে', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('ত্রুটি', 'সংরক্ষণে সমস্যা হয়েছে');
    }
  };

  const handleReset = () => {
    Alert.alert('রিসেট', 'সব তথ্য মুছে ফেলতে চান?', [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'রিসেট',
        style: 'destructive',
        onPress: () => {
          setFishCount('');
          setAvgWeightKg('');
          setFeedRatePercent(defaultFeedSettings.feed_rate_percent_per_day.toString());
          setDaysInMonth(defaultFeedSettings.days_in_month.toString());
          setWastagePercent(defaultFeedSettings.wastage_percent.toString());
          setBagSizeKg(defaultFeedSettings.bag_size_kg.toString());
          setBagPrice('');
          setMorningPercent(defaultFeedSettings.morning_percent.toString());
          setResults(null);
          setNotes('');
          deleteDraft('feed');
        },
      },
    ]);
  };

  const fmtCurrency = (amount: number) => formatCurrency(amount, lang);
  const fmtWeight = (kg: number) => formatWeight(kg, lang);
  const fmtNum = (num: number) => formatNumber(num, lang);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.md, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        bottomOffset={100}
      >
        <ThemedText style={styles.sectionTitle}>{tr("মাছের তথ্য")}</ThemedText>

        <InputRow
          label={t('fishCount', lang)}
          value={fishCount}
          onChangeText={setFishCount}
          keyboardType="numeric"
          placeholder="0"
          suffix="পিস"
        />

        <InputRow
          label={t('avgWeightKg', lang)}
          value={avgWeightKg}
          onChangeText={setAvgWeightKg}
          keyboardType="decimal-pad"
          placeholder="0.00"
          suffix="কেজি"
        />

        <ThemedText style={styles.sectionTitle}>{tr("খাদ্য সেটিংস")}</ThemedText>

        <InputRow
          label={t('feedRatePercent', lang)}
          value={feedRatePercent}
          onChangeText={setFeedRatePercent}
          keyboardType="decimal-pad"
          placeholder="3"
          suffix="%"
        />

        <InputRow
          label={t('daysInMonth', lang)}
          value={daysInMonth}
          onChangeText={setDaysInMonth}
          keyboardType="numeric"
          placeholder="30"
          suffix="দিন"
        />

        <InputRow
          label={`${t('wastage', lang)} (%)`}
          value={wastagePercent}
          onChangeText={setWastagePercent}
          keyboardType="decimal-pad"
          placeholder="5"
          suffix="%"
        />

        <InputRow
          label={t('bagSize', lang)}
          value={bagSizeKg}
          onChangeText={setBagSizeKg}
          keyboardType="decimal-pad"
          placeholder="25"
          suffix="কেজি"
        />

        <InputRow
          label={t('bagPrice', lang)}
          value={bagPrice}
          onChangeText={setBagPrice}
          keyboardType="decimal-pad"
          placeholder="0"
          suffix="৳"
        />

        <InputRow
          label={`${t('morningFeed', lang)} (%)`}
          value={morningPercent}
          onChangeText={setMorningPercent}
          keyboardType="decimal-pad"
          placeholder="40"
          suffix="%"
        />

        <InputRow
          label={t('notes', lang)}
          value={notes}
          onChangeText={setNotes}
          placeholder={tr("অতিরিক্ত তথ্য...")}
        />

        {results ? (
          <View style={styles.resultsSection}>
            <ThemedText style={styles.sectionTitle}>{tr("ফলাফল")}</ThemedText>

            <ResultCard title="বায়োমাস">
              <ResultRow label={t('fishCount', lang)} value={results.fish_count.toString()} />
              <ResultRow label={t('avgWeightKg', lang)} value={fmtWeight(results.avg_weight_kg)} />
              <ResultRow label={t('biomass', lang)} value={fmtWeight(results.biomass)} highlight />
            </ResultCard>

            <ResultCard title="দৈনিক খাদ্য">
              <ResultRow label={t('feedRate', lang)} value={`${results.feed_rate_percent}%`} />
              <ResultRow label={t('dailyFeed', lang)} value={fmtWeight(results.daily_feed_kg)} highlight />
              <ResultRow label={t('morningFeed', lang)} value={fmtWeight(results.morning_feed_kg)} />
              <ResultRow label={t('eveningFeed', lang)} value={fmtWeight(results.evening_feed_kg)} />
            </ResultCard>

            <ResultCard title="মাসিক খাদ্য">
              <ResultRow label={t('monthlyFeed', lang)} value={fmtWeight(results.monthly_feed_kg)} />
              <ResultRow label={t('wastage', lang)} value={fmtWeight(results.wastage_kg)} />
              <ResultRow label="মোট (অপচয় সহ)" value={fmtWeight(results.total_feed_with_wastage_kg)} highlight />
              <ResultRow label={t('totalBags', lang)} value={`${results.total_bags} বস্তা`} isTotal />
            </ResultCard>

            {results.total_cost > 0 ? (
              <MoneyDisplay
                amount={results.total_cost}
                label={t('totalCost', lang)}
                formatCurrency={fmtCurrency}
                size="large"
              />
            ) : null}
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <StickyActionBar
        actions={[
          { label: t('reset', lang), onPress: handleReset, variant: 'secondary', icon: 'refresh-cw' },
          { label: results ? t('save', lang) : t('calculateAction', lang), onPress: results ? handleSave : calculate, variant: 'primary', icon: results ? 'save' : 'check' },
        ]}
      />
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
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
    opacity: 0.6,
  },
  resultsSection: {
    marginTop: Spacing.md,
  },
});
