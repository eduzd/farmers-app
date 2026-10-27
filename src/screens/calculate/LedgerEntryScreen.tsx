import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@/components/icons/Feather';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { InputRow } from '@/offline/components/calculate/InputRow';
import { ResultCard, ResultRow } from '@/offline/components/calculate/ResultCard';
import { StickyActionBar } from '@/offline/components/calculate/StickyActionBar';
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
    error: theme.error,
  };
}
import { saveLedgerTransaction, getLedgerTransaction, TxnType, PaymentStatus, addPayment, getPayments, LedgerPayment } from '@/offline/db/ledger';
import { t, Language, formatCurrency } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
type RouteParams = {
  params: { id: string | null };
};

const txnTypes: { key: TxnType; label: string }[] = [
  { key: 'SALE', label: 'বিক্রি' },
  { key: 'PURCHASE', label: 'ক্রয়' },
  { key: 'RECEIVED', label: 'প্রাপ্ত' },
  { key: 'PAID', label: 'প্রদত্ত' },
  { key: 'EXPENSE', label: 'খরচ' },
  { key: 'COMMISSION', label: 'কমিশন' },
  { key: 'DUE_ADJUST', label: 'বাকি সমন্বয়' },
  { key: 'OTHER', label: 'অন্যান্য' },
];

export function LedgerEntryScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const entryId = route.params?.id;
  const isEditing = !!entryId;

  const [txnType, setTxnType] = useState<TxnType>('SALE');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [fishType, setFishType] = useState('');
  const [marketPlace, setMarketPlace] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pieces, setPieces] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<LedgerPayment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('cash');

  useEffect(() => {
    if (entryId) {
      loadEntry();
    }
  }, [entryId]);

  useEffect(() => {
    if (weightKg && ratePerKg) {
      const calculated = (parseFloat(weightKg) || 0) * (parseFloat(ratePerKg) || 0);
      setGrossAmount(calculated.toString());
    }
  }, [weightKg, ratePerKg]);

  const loadEntry = async () => {
    if (!entryId) return;
    const entry = await getLedgerTransaction(entryId);
    if (entry) {
      setTxnType(entry.txn_type);
      setPartyName(entry.party_name || '');
      setPartyPhone(entry.party_phone || '');
      setFishType(entry.fish_type || '');
      setMarketPlace(entry.market_place || '');
      setWeightKg(entry.weight_kg?.toString() || '');
      setPieces(entry.pieces?.toString() || '');
      setRatePerKg(entry.rate_per_kg?.toString() || '');
      setGrossAmount(entry.gross_amount.toString());
      setPaidNow(entry.paid_now.toString());
      setNotes(entry.notes || '');
      
      const paymentsList = await getPayments(entryId);
      setPayments(paymentsList);
    }
  };

  const calculateStatus = (): PaymentStatus => {
    const gross = parseFloat(grossAmount) || 0;
    const paid = parseFloat(paidNow) || 0;
    if (paid >= gross) return 'PAID';
    if (paid > 0) return 'PARTIAL';
    return 'DUE';
  };

  const handleSave = async () => {
    const gross = parseFloat(grossAmount) || 0;
    const paid = parseFloat(paidNow) || 0;

    if (gross <= 0) {
      Alert.alert('ত্রুটি', 'মোট মূল্য দিন');
      return;
    }

    try {
      await saveLedgerTransaction({
        id: entryId || undefined,
        txn_type: txnType,
        party_name: partyName || undefined,
        party_phone: partyPhone || undefined,
        fish_type: fishType || undefined,
        market_place: marketPlace || undefined,
        weight_kg: parseFloat(weightKg) || undefined,
        pieces: parseInt(pieces) || undefined,
        rate_per_kg: parseFloat(ratePerKg) || undefined,
        gross_amount: gross,
        paid_now: paid,
        due_amount: Math.max(0, gross - paid),
        status: calculateStatus(),
        notes: notes || undefined,
        language: lang,
      });

      Alert.alert('সফল', 'হিসাব সংরক্ষিত হয়েছে', [
        { text: 'ঠিক আছে', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('ত্রুটি', 'সংরক্ষণে সমস্যা হয়েছে');
    }
  };

  const handleAddPayment = async () => {
    if (!entryId) return;
    const amount = parseFloat(newPaymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('ত্রুটি', 'সঠিক পরিমাণ দিন');
      return;
    }

    try {
      await addPayment(entryId, amount, newPaymentMethod);
      setNewPaymentAmount('');
      setShowPaymentForm(false);
      loadEntry();
      Alert.alert('সফল', 'পেমেন্ট যোগ হয়েছে');
    } catch (error) {
      Alert.alert('ত্রুটি', 'পেমেন্ট যোগ করতে সমস্যা হয়েছে');
    }
  };

  const fmtCurrency = (amount: number) => formatCurrency(amount, lang);

  const gross = parseFloat(grossAmount) || 0;
  const paid = parseFloat(paidNow) || 0;
  const due = Math.max(0, gross - paid);

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
        <ThemedText style={styles.sectionTitle}>{tr("লেনদেনের ধরন")}</ThemedText>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
          {txnTypes.map((type) => (
            <Pressable
              key={type.key}
              style={[
                styles.typeChip,
                {
                  backgroundColor: txnType === type.key ? colors.primary : colors.card,
                  borderColor: txnType === type.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setTxnType(type.key)}
            >
              <ThemedText
                style={[
                  styles.typeChipText,
                  { color: txnType === type.key ? '#FFFFFF' : colors.text },
                ]}
              >
                {type.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <ThemedText style={styles.sectionTitle}>{tr("পার্টি তথ্য")}</ThemedText>

        <InputRow
          label={t('partyName', lang)}
          value={partyName}
          onChangeText={setPartyName}
          placeholder={tr("পার্টি/গ্রাহক নাম")}
        />

        <InputRow
          label={t('phone', lang)}
          value={partyPhone}
          onChangeText={setPartyPhone}
          keyboardType="phone-pad"
          placeholder={tr("01XXXXXXXXX")}
        />

        <InputRow
          label={t('fishType', lang)}
          value={fishType}
          onChangeText={setFishType}
          placeholder={tr("রুই, কাতলা, পাঙ্গাশ...")}
        />

        <InputRow
          label={t('marketPlace', lang)}
          value={marketPlace}
          onChangeText={setMarketPlace}
          placeholder={tr("বাজারের নাম")}
        />

        <ThemedText style={styles.sectionTitle}>{tr("পরিমাণ ও মূল্য")}</ThemedText>

        <InputRow
          label={t('weightKg', lang)}
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="0.00"
          suffix="কেজি"
        />

        <InputRow
          label={t('pieces', lang)}
          value={pieces}
          onChangeText={setPieces}
          keyboardType="numeric"
          placeholder="0"
        />

        <InputRow
          label={t('ratePerKg', lang)}
          value={ratePerKg}
          onChangeText={setRatePerKg}
          keyboardType="decimal-pad"
          placeholder="0"
          suffix="৳"
        />

        <InputRow
          label={t('grossAmount', lang)}
          value={grossAmount}
          onChangeText={setGrossAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          suffix="৳"
        />

        <ThemedText style={styles.sectionTitle}>{tr("পেমেন্ট")}</ThemedText>

        <InputRow
          label={t('paidNow', lang)}
          value={paidNow}
          onChangeText={setPaidNow}
          keyboardType="decimal-pad"
          placeholder="0"
          suffix="৳"
        />

        {gross > 0 ? (
          <ResultCard>
            <ResultRow label={t('grossAmount', lang)} value={fmtCurrency(gross)} />
            <ResultRow label={t('paidNow', lang)} value={fmtCurrency(paid)} />
            <ResultRow label={t('dueAmount', lang)} value={fmtCurrency(due)} isTotal highlight />
          </ResultCard>
        ) : null}

        {isEditing && payments.length > 0 ? (
          <View style={styles.paymentsSection}>
            <ThemedText style={styles.sectionTitle}>{tr("পেমেন্ট ইতিহাস")}</ThemedText>
            {payments.map((payment) => (
              <View key={payment.id} style={[styles.paymentRow, { backgroundColor: colors.card }]}>
                <View>
                  <ThemedText style={styles.paymentAmount}>{fmtCurrency(payment.amount)}</ThemedText>
                  <ThemedText style={[styles.paymentMeta, { color: colors.textSecondary }]}>
                    {payment.method} - {new Date(payment.created_at).toLocaleDateString()}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {isEditing && !showPaymentForm ? (
          <Pressable
            style={[styles.addPaymentButton, { borderColor: colors.primary }]}
            onPress={() => setShowPaymentForm(true)}
          >
            <Feather name="plus" size={18} color={colors.primary} />
            <ThemedText style={[styles.addPaymentText, { color: colors.primary }]}>
              {t('addPayment', lang)}
            </ThemedText>
          </Pressable>
        ) : null}

        {showPaymentForm ? (
          <View style={[styles.paymentForm, { backgroundColor: colors.card }]}>
            <InputRow
              label="পেমেন্ট পরিমাণ"
              value={newPaymentAmount}
              onChangeText={setNewPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              suffix="৳"
            />
            <View style={styles.paymentFormActions}>
              <Pressable
                style={[styles.paymentFormButton, { backgroundColor: colors.border }]}
                onPress={() => setShowPaymentForm(false)}
              >
                <ThemedText>{t('cancel', lang)}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.paymentFormButton, { backgroundColor: colors.primary }]}
                onPress={handleAddPayment}
              >
                <ThemedText style={{ color: '#FFFFFF' }}>{t('save', lang)}</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <InputRow
          label={t('notes', lang)}
          value={notes}
          onChangeText={setNotes}
          placeholder={tr("অতিরিক্ত তথ্য...")}
        />
      </KeyboardAwareScrollViewCompat>

      <StickyActionBar
        actions={[
          { label: t('save', lang), onPress: handleSave, variant: 'primary', icon: 'save' },
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
  typeScroll: {
    marginBottom: Spacing.md,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  typeChipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  paymentsSection: {
    marginTop: Spacing.md,
  },
  paymentRow: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  paymentAmount: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  paymentMeta: {
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  addPaymentText: {
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  paymentForm: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  paymentFormActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  paymentFormButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
});
