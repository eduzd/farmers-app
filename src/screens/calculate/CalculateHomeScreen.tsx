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

  const { isOnline, pendingCount } = useSyncContext();

  const shortcuts = [
    { label: 'ব্যাপারী ক্যালকুলেটর', onPress: () => navigation.navigate('CalculateBepari'), icon: 'dollar-sign' as const },
    { label: 'আড়ত ক্যালকুলেটর', onPress: () => navigation.navigate('CalculateArat'), icon: 'percent' as const },
    { label: 'খাদ্য ক্যালকুলেটর', onPress: () => navigation.navigate('CalculateFeed'), icon: 'box' as const },
    { label: 'খাতা (Ledger)', onPress: () => navigation.navigate('CalculateLedger'), icon: 'book' as const },
    { label: 'সেটিংস', onPress: () => navigation.navigate('CalculateSettings'), icon: 'settings' as const },
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
          <ThemedText style={styles.sectionTitle}>{tr("ক্যালকুলেটর")}</ThemedText>
          <SyncIndicator />
        </View>
        
        <ModuleCard
          title={t('bepariCalculator', lang)}
          subtitle="বিক্রি হিসাব, ওজন, দাম নির্ধারণ"
          icon="dollar-sign"
          iconColor="#16A34A"
          onPress={() => navigation.navigate('CalculateBepari')}
          onLongPress={handleLongPress}
        />

        <ModuleCard
          title={t('aratCalculator', lang)}
          subtitle="আড়ত কমিশন, ফি, ট্যাক্স হিসাব"
          icon="percent"
          iconColor="#2563EB"
          onPress={() => navigation.navigate('CalculateArat')}
        />

        <ModuleCard
          title={t('feedCalculator', lang)}
          subtitle="মাসিক খাদ্য পরিমাণ ও খরচ"
          icon="box"
          iconColor="#EA8A0C"
          onPress={() => navigation.navigate('CalculateFeed')}
        />

        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{tr("হিসাব খাতা")}</ThemedText>

        <ModuleCard
          title={t('ledger', lang)}
          subtitle="বেপারী/পাইকার হিসাব, বাকি"
          icon="book"
          iconColor="#7C3AED"
          onPress={() => navigation.navigate('CalculateLedger')}
        />

        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{tr("রিপোর্ট")}</ThemedText>

        <ModuleCard
          title={t('history', lang)}
          subtitle="সব হিসাব দেখুন"
          icon="clock"
          iconColor="#EC4899"
          onPress={() => navigation.navigate('CalculateHistory')}
        />

        <ModuleCard
          title={t('monthlySummary', lang)}
          subtitle="মাসিক সারাংশ ও রিপোর্ট"
          icon="bar-chart-2"
          iconColor="#06B6D4"
          onPress={() => navigation.navigate('CalculateMonthlySummary')}
        />

        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{tr("অন্যান্য")}</ThemedText>

        <ModuleCard
          title={t('settings', lang)}
          subtitle="মূল্য নির্ধারণ, ব্যাকআপ"
          icon="settings"
          iconColor="#6B7280"
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
