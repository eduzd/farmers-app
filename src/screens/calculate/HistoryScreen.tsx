import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { HistoryCard } from '@/offline/components/calculate/HistoryCard';
import { FilterBar } from '@/offline/components/calculate/FilterBar';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, Typography } from '@/constants/theme';

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
  };
}
import { getCalcRecords, CalcRecord, RecordType } from '@/offline/db/records';
import { Language, formatCurrency } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
const recordTypeLabels: Record<RecordType, { bn: string; icon: keyof typeof Feather.glyphMap }> = {
  BEPARI: { bn: 'ব্যাপারী', icon: 'dollar-sign' },
  ARAT: { bn: 'আড়ত', icon: 'percent' },
  FEED: { bn: 'খাদ্য', icon: 'box' },
};

export function HistoryScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const [records, setRecords] = useState<CalcRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const filters = [
    { key: 'ALL', label: 'সব' },
    { key: 'BEPARI', label: 'ব্যাপারী' },
    { key: 'ARAT', label: 'আড়ত' },
    { key: 'FEED', label: 'খাদ্য' },
  ];

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const filterOptions: any = { archived: false };
      
      if (selectedFilter !== 'ALL') {
        filterOptions.recordType = selectedFilter as RecordType;
      }

      if (searchQuery) {
        filterOptions.search = searchQuery;
      }

      const data = await getCalcRecords(filterOptions);
      setRecords(data);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedFilter, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getRecordAmount = (record: CalcRecord): string => {
    try {
      const outputs = JSON.parse(record.outputs_json);
      if (outputs.net_amount) {
        return formatCurrency(outputs.net_amount, lang);
      }
      if (outputs.total_cost) {
        return formatCurrency(outputs.total_cost, lang);
      }
      return '';
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: CalcRecord }) => {
    const typeInfo = recordTypeLabels[item.record_type];
    return (
      <HistoryCard
        title={item.title || typeInfo.bn}
        subtitle={item.notes}
        date={formatDate(item.created_at)}
        amount={getRecordAmount(item)}
        type={typeInfo.bn}
        icon={typeInfo.icon}
        onPress={() => navigation.navigate('CalculateRecordDetail', { id: item.id })}
      />
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="clock" size={48} color={colors.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        {tr("কোন হিসাব নেই")}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        {tr("ক্যালকুলেটর ব্যবহার করে হিসাব সংরক্ষণ করুন")}
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
          searchPlaceholder="হিসাব খুঁজুন..."
        />
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />
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
});
