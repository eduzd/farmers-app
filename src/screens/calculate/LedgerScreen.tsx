import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { HistoryCard } from '@/offline/components/calculate/HistoryCard';
import { FilterBar } from '@/offline/components/calculate/FilterBar';
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
import { getLedgerTransactions, LedgerTransaction, TxnType, PaymentStatus } from '@/offline/db/ledger';
import { t, Language, formatCurrency } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
const txnTypeLabels: Record<TxnType, { bn: string; en: string; icon: keyof typeof Feather.glyphMap }> = {
  SALE: { bn: 'বিক্রি', en: 'Sale', icon: 'trending-up' },
  PURCHASE: { bn: 'ক্রয়', en: 'Purchase', icon: 'trending-down' },
  RECEIVED: { bn: 'প্রাপ্ত', en: 'Received', icon: 'arrow-down-circle' },
  PAID: { bn: 'প্রদত্ত', en: 'Paid', icon: 'arrow-up-circle' },
  EXPENSE: { bn: 'খরচ', en: 'Expense', icon: 'minus-circle' },
  COMMISSION: { bn: 'কমিশন', en: 'Commission', icon: 'percent' },
  DUE_ADJUST: { bn: 'বাকি সমন্বয়', en: 'Due Adjust', icon: 'refresh-cw' },
  OTHER: { bn: 'অন্যান্য', en: 'Other', icon: 'file-text' },
};

export function LedgerScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const filters = [
    { key: 'ALL', label: 'সব' },
    { key: 'SALE', label: 'বিক্রি' },
    { key: 'PURCHASE', label: 'ক্রয়' },
    { key: 'DUE', label: 'বাকি' },
    { key: 'PAID', label: 'পরিশোধিত' },
  ];

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const filterOptions: any = { archived: false };
      
      if (selectedFilter !== 'ALL') {
        if (selectedFilter === 'DUE' || selectedFilter === 'PAID') {
          filterOptions.status = selectedFilter as PaymentStatus;
        } else {
          filterOptions.txnType = selectedFilter as TxnType;
        }
      }

      if (searchQuery) {
        filterOptions.search = searchQuery;
      }

      const data = await getLedgerTransactions(filterOptions);
      setTransactions(data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedFilter, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const renderItem = ({ item }: { item: LedgerTransaction }) => {
    const typeInfo = txnTypeLabels[item.txn_type];
    return (
      <HistoryCard
        title={item.party_name || typeInfo.bn}
        subtitle={item.fish_type || item.notes}
        date={formatDate(item.created_at)}
        amount={formatCurrency(item.gross_amount, lang)}
        status={item.status}
        type={typeInfo.bn}
        icon={typeInfo.icon}
        onPress={() => navigation.navigate('CalculateLedgerEntry', { id: item.id })}
      />
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="book" size={48} color={colors.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        {tr("কোন হিসাব নেই")}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        {tr("নতুন হিসাব যোগ করতে + বাটন চাপুন")}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: Spacing.md }}>
        <FilterBar
          filters={filters}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="পার্টি, মাছ খুঁজুন..."
        />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + Spacing.lg }]}
        onPress={() => navigation.navigate('CalculateLedgerEntry', { id: null })}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
