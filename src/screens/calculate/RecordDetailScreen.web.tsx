// Web keeps this calculator as it was; the phone app uses RecordDetailScreen.tsx (save / edit / saved list).
// Both share the 3-second pause after typing (hooks/useRowAutoAdvance).
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons/Feather';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ResultCard, ResultRow, BreakdownItem } from '@/offline/components/calculate/ResultCard';
import { StickyActionBar } from '@/offline/components/calculate/StickyActionBar';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

function useColors() {
  const { theme } = useTheme();
  return {
    text: theme.text,
    textSecondary: theme.textSecondary,
    textTertiary: theme.iconSecondary,
    background: theme.backgroundRoot,
    card: theme.card,
    border: theme.inputBorder,
    primary: theme.primary,
    error: theme.error,
  };
}
import { getCalcRecord, CalcRecord, archiveRecord, getRecordVersions, CalcRecordVersion } from '@/offline/db/records';
import { t, Language, formatCurrency, formatWeight } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
type RouteParams = {
  params: { id: string };
};

const recordTypeLabels = {
  BEPARI: { bn: 'ব্যাপারী ক্যালকুলেটর', en: 'Bepari Calculator' },
  ARAT: { bn: 'আড়ত ক্যালকুলেটর', en: 'Arat Calculator' },
  FEED: { bn: 'খাদ্য ক্যালকুলেটর', en: 'Feed Calculator' },
  FERTILIZER: { bn: 'সার ক্যালকুলেটর', en: 'Fertilizer Calculator' },
  PROFIT: { bn: 'লাভ-ক্ষতি ক্যালকুলেটর', en: 'Profit Calculator' },
  FEED_TOOL: { bn: 'পশু খাদ্য ক্যালকুলেটর', en: 'Animal Feed Calculator' },
  LOAN: { bn: 'ঋণ ক্যালকুলেটর', en: 'Loan Calculator' },
  INSURANCE: { bn: 'বীমা ক্যালকুলেটর', en: 'Insurance Calculator' },
};

export function RecordDetailScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const recordId = route.params?.id;
  const [record, setRecord] = useState<CalcRecord | null>(null);
  const [versions, setVersions] = useState<CalcRecordVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecord();
  }, [recordId]);

  const loadRecord = async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const data = await getCalcRecord(recordId);
      setRecord(data);
      const versionList = await getRecordVersions(recordId);
      setVersions(versionList);
    } catch (error) {
      console.error('Error loading record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'আর্কাইভ',
      'এই হিসাব আর্কাইভ করতে চান?',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'আর্কাইভ',
          onPress: async () => {
            await archiveRecord(recordId);
            Alert.alert('সফল', 'হিসাব আর্কাইভ করা হয়েছে', [
              { text: 'ঠিক আছে', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ]
    );
  };

  const generatePDF = async () => {
    if (!record) return;

    const outputs = JSON.parse(record.outputs_json);
    const inputs = JSON.parse(record.inputs_json);
    const typeLabel = recordTypeLabels[record.record_type];
    const date = new Date(record.created_at).toLocaleDateString('bn-BD');

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; }
          .subtitle { font-size: 14px; color: #666; }
          .section { margin: 15px 0; }
          .section-title { font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .row { display: flex; justify-content: space-between; padding: 5px 0; }
          .label { color: #666; }
          .value { font-weight: 500; }
          .total { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">{tr("ক্যালকুলেট")}</div>
          <div class="subtitle">${typeLabel.bn} - ${date}</div>
        </div>
    `;

    if (record.record_type === 'BEPARI' || record.record_type === 'ARAT') {
      htmlContent += `
        <div class="section">
          <div class="section-title">{tr("সারাংশ")}</div>
          <div class="row"><span class="label">{tr("মোট ওজন:")}</span><span class="value">${outputs.total_weight || outputs.weight_kg} কেজি</span></div>
          <div class="row"><span class="label">{tr("দর:")}</span><span class="value">৳${outputs.final_price_per_kg || outputs.rate_per_kg}</span></div>
          <div class="row"><span class="label">{tr("মোট মূল্য:")}</span><span class="value">৳${outputs.gross_amount}</span></div>
        </div>
        <div class="total">নেট: ৳${outputs.net_amount}</div>
      `;
    } else if (record.record_type === 'FEED') {
      htmlContent += `
        <div class="section">
          <div class="section-title">{tr("খাদ্য হিসাব")}</div>
          <div class="row"><span class="label">{tr("মাছের সংখ্যা:")}</span><span class="value">${outputs.fish_count}</span></div>
          <div class="row"><span class="label">{tr("দৈনিক খাদ্য:")}</span><span class="value">${outputs.daily_feed_kg?.toFixed(2)} কেজি</span></div>
          <div class="row"><span class="label">{tr("মাসিক খাদ্য:")}</span><span class="value">${outputs.total_feed_with_wastage_kg?.toFixed(2)} কেজি</span></div>
        </div>
        <div class="total">মোট বস্তা: ${outputs.total_bags}</div>
      `;
    } else if (Array.isArray(outputs.summary)) {
      const esc = (v: unknown) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
      htmlContent += `<div class="section">` +
        outputs.summary.map((row: any) => `<div class="row"><span class="label">${esc(row.label)}</span><span class="value">${esc(row.value)}</span></div>`).join('') +
        `</div>`;
    }

    htmlContent += `
        <div class="footer">{tr("অফলাইনে তৈরি - ক্যালকুলেট")}</div>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'PDF তৈরি করতে সমস্যা হয়েছে');
    }
  };

  const fmtCurrency = (amount: number) => formatCurrency(amount, lang);
  const fmtWeight = (kg: number) => formatWeight(kg, lang);

  if (loading || !record) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText style={styles.loadingText}>{t('loading', lang)}</ThemedText>
      </View>
    );
  }

  const outputs = JSON.parse(record.outputs_json);
  const inputs = JSON.parse(record.inputs_json);
  const typeLabel = recordTypeLabels[record.record_type];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.md, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.headerTitle}>{record.title || typeLabel.bn}</ThemedText>
          <ThemedText style={[styles.headerDate, { color: colors.textSecondary }]}>
            {new Date(record.created_at).toLocaleDateString('bn-BD')}
          </ThemedText>
        </View>

        {record.record_type === 'BEPARI' ? (
          <>
            <ResultCard title="সারাংশ">
              <ResultRow label={t('totalWeight', lang)} value={fmtWeight(outputs.total_weight)} />
              <ResultRow label={t('totalPieces', lang)} value={outputs.total_pieces?.toString()} />
              <ResultRow label={t('avgWeight', lang)} value={fmtWeight(outputs.avg_weight)} highlight />
              <ResultRow label={t('ratePerKg', lang)} value={fmtCurrency(outputs.final_price_per_kg)} highlight />
              <ResultRow label={t('grossAmount', lang)} value={fmtCurrency(outputs.gross_amount)} />
              <ResultRow label={t('netAmount', lang)} value={fmtCurrency(outputs.net_amount)} isTotal />
              <ResultRow label={t('perPiece', lang)} value={fmtCurrency(outputs.per_piece_net)} highlight />
            </ResultCard>
          </>
        ) : record.record_type === 'ARAT' ? (
          <>
            <ResultCard title="সারাংশ">
              <ResultRow label={t('weightKg', lang)} value={fmtWeight(outputs.weight_kg)} />
              <ResultRow label={t('ratePerKg', lang)} value={fmtCurrency(outputs.rate_per_kg)} />
              <ResultRow label={t('grossAmount', lang)} value={fmtCurrency(outputs.gross_amount)} />
              <ResultRow label={t('commission', lang)} value={fmtCurrency(outputs.commission_amount)} />
              <ResultRow label={t('netAmount', lang)} value={fmtCurrency(outputs.net_amount)} isTotal />
            </ResultCard>
          </>
        ) : record.record_type === 'FEED' ? (
          <>
            <ResultCard title="খাদ্য হিসাব">
              <ResultRow label={t('fishCount', lang)} value={outputs.fish_count?.toString()} />
              <ResultRow label={t('biomass', lang)} value={fmtWeight(outputs.biomass)} />
              <ResultRow label={t('dailyFeed', lang)} value={fmtWeight(outputs.daily_feed_kg)} />
              <ResultRow label={t('monthlyFeed', lang)} value={fmtWeight(outputs.total_feed_with_wastage_kg)} highlight />
              <ResultRow label={t('totalBags', lang)} value={`${outputs.total_bags} বস্তা`} isTotal />
              {outputs.total_cost > 0 ? (
                <ResultRow label={t('totalCost', lang)} value={fmtCurrency(outputs.total_cost)} highlight />
              ) : null}
            </ResultCard>
          </>
        ) : Array.isArray(outputs.summary) ? (
          <ResultCard title="সারাংশ">
            {outputs.summary.map((row: { label: string; value: string }, i: number) => (
              <ResultRow key={`${row.label}-${i}`} label={tr(String(row.label))} value={String(row.value)} />
            ))}
          </ResultCard>
        ) : null}

        {record.notes ? (
          <View style={[styles.notesBox, { backgroundColor: colors.card }]}>
            <ThemedText style={[styles.notesLabel, { color: colors.textSecondary }]}>
              {t('notes', lang)}
            </ThemedText>
            <ThemedText>{record.notes}</ThemedText>
          </View>
        ) : null}

        {versions.length > 0 ? (
          <View style={styles.versionsSection}>
            <ThemedText style={styles.sectionTitle}>সংস্করণ ইতিহাস ({versions.length})</ThemedText>
            {versions.slice(0, 3).map((version) => (
              <View key={version.id} style={[styles.versionRow, { backgroundColor: colors.card }]}>
                <ThemedText>সংস্করণ {version.version}</ThemedText>
                <ThemedText style={{ color: colors.textSecondary }}>
                  {new Date(version.saved_at).toLocaleDateString('bn-BD')}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <StickyActionBar
        actions={[
          { label: t('archive', lang), onPress: handleArchive, variant: 'secondary', icon: 'archive' },
          { label: t('export', lang), onPress: generatePDF, variant: 'primary', icon: 'download' },
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
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  headerDate: {
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    opacity: 0.6,
  },
  notesBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  notesLabel: {
    fontSize: Typography.sizes.xs,
    marginBottom: Spacing.xs,
  },
  versionsSection: {
    marginTop: Spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
});
