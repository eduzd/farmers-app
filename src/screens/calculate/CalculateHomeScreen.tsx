import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModuleCard, ShortcutMenu } from '@/offline/components/calculate/ModuleCard';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/theme';
import { t, Language } from '@/offline/i18n/translations';
import { SyncIndicator } from '@/offline/components/SyncIndicator';
import { useSyncContext } from '@/offline/providers/SyncProvider';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
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

export function CalculateHomeScreen() {
  const tr = useTr();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 50, y: 200 });
  const lang: Language = useI18n((st) => st.language) as Language;
  // Bangla when Bangla is chosen, English when English is chosen.
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  const { isOnline, pendingCount } = useSyncContext();

  const shortcuts = [
    { label: L('ব্যাপারী ক্যালকুলেটর', 'Bepari calculator'), onPress: () => navigation.navigate('CalculateBepari'), icon: 'dollar-sign' as const },
    { label: L('আড়ত ক্যালকুলেটর', 'Arat calculator'), onPress: () => navigation.navigate('CalculateArat'), icon: 'percent' as const },
    { label: L('খাদ্য ক্যালকুলেটর', 'Feed calculator'), onPress: () => navigation.navigate('CalculateFeed'), icon: 'box' as const },
    { label: L('খাতা', 'Ledger'), onPress: () => navigation.navigate('CalculateLedger'), icon: 'book' as const },
    { label: L('সেটিংস', 'Settings'), onPress: () => navigation.navigate('CalculateSettings'), icon: 'settings' as const },
  ];

  const handleLongPress = useCallback(() => {
    setMenuVisible(true);
  }, []);

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
        <View style={styles.headerRow}>
          <ThemedText style={styles.sectionTitle}>{L('ক্যালকুলেটর', 'Calculators')}</ThemedText>
          <SyncIndicator />
        </View>
        
        <ModuleCard
          title={t('bepariCalculator', lang)}
          subtitle={L('বিক্রি হিসাব, ওজন, দাম নির্ধারণ', 'Sales, weight and pricing')}
          icon="dollar-sign"
          iconColor="#00BB77"
          onPress={() => navigation.navigate('CalculateBepari')}
          onLongPress={handleLongPress}
        />

        <ModuleCard
          title={t('aratCalculator', lang)}
          subtitle={L('আড়ত কমিশন, ফি, ট্যাক্স হিসাব', 'Commission, fees and tax')}
          icon="percent"
          iconColor="#2E96EF"
          onPress={() => navigation.navigate('CalculateArat')}
        />

        <ModuleCard
          title={t('feedCalculator', lang)}
          subtitle={L('মাসিক খাদ্য পরিমাণ ও খরচ', 'Monthly feed amount and cost')}
          icon="box"
          iconColor="#B25E09"
          onPress={() => navigation.navigate('CalculateFeed')}
        />

        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{L('হিসাব খাতা', 'Ledger')}</ThemedText>

        <ModuleCard
          title={t('ledger', lang)}
          subtitle={L('বেপারী/পাইকার হিসাব, বাকি', 'Trader accounts and dues')}
          icon="book"
          iconColor="#3D38D0"
          onPress={() => navigation.navigate('CalculateLedger')}
        />

        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{L('রিপোর্ট', 'Reports')}</ThemedText>

        <ModuleCard
          title={t('history', lang)}
          subtitle={L('সব হিসাব দেখুন', 'See all records')}
          icon="clock"
          iconColor="#FF4BB7"
          onPress={() => navigation.navigate('CalculateHistory')}
        />

        <ModuleCard
          title={t('monthlySummary', lang)}
          subtitle={L('মাসিক সারাংশ ও রিপোর্ট', 'Monthly summary and reports')}
          icon="bar-chart-2"
          iconColor="#39B1FE"
          onPress={() => navigation.navigate('CalculateMonthlySummary')}
        />

        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{L('অন্যান্য', 'Other')}</ThemedText>

        <ModuleCard
          title={t('settings', lang)}
          subtitle={L('মূল্য নির্ধারণ, ব্যাকআপ', 'Rates and backup')}
          icon="settings"
          iconColor="#7A8CA3"
          onPress={() => navigation.navigate('CalculateSettings')}
        />
      </ScrollView>

      <ShortcutMenu
        visible={menuVisible}
        items={shortcuts}
        onClose={() => setMenuVisible(false)}
        position={menuPosition}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
});
