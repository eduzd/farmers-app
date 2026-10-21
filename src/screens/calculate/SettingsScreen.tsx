import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { InputRow } from '@/offline/components/calculate/InputRow';
import { ModuleCard } from '@/offline/components/calculate/ModuleCard';
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
import { getSetting, setSetting, getSettings } from '@/offline/db/database';
import { shareBackup } from '@/offline/db/backup';
import { defaultStepRuleSettings } from '@/offline/utils/calculations/bepari';
import { t, Language } from '@/offline/i18n/translations';

import { tr, useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
export function SettingsScreen() {
  const tr = useTr();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const lang: Language = useI18n((st) => st.language) as Language;

  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [targetWeight, setTargetWeight] = useState(defaultStepRuleSettings.target_avg_weight_kg.toString());
  const [basePrice, setBasePrice] = useState(defaultStepRuleSettings.base_price_per_kg.toString());
  const [stepGrams, setStepGrams] = useState(defaultStepRuleSettings.step_grams.toString());
  const [stepPriceChange, setStepPriceChange] = useState(defaultStepRuleSettings.step_price_change.toString());
  const [commissionPercent, setCommissionPercent] = useState('5');
  const [enablePermanentDelete, setEnablePermanentDelete] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getSettings();
    if (settings.language) setLanguage(settings.language);
    if (settings.targetWeight) setTargetWeight(settings.targetWeight);
    if (settings.basePrice) setBasePrice(settings.basePrice);
    if (settings.stepGrams) setStepGrams(settings.stepGrams);
    if (settings.stepPriceChange) setStepPriceChange(settings.stepPriceChange);
    if (settings.commissionPercent) setCommissionPercent(settings.commissionPercent);
    if (settings.enablePermanentDelete) setEnablePermanentDelete(settings.enablePermanentDelete === 'true');
  };

  const saveSetting = async (key: string, value: string) => {
    await setSetting(key, value);
  };

  const handleExportBackup = async () => {
    try {
      await shareBackup();
    } catch (error) {
      Alert.alert('ত্রুটি', 'ব্যাকআপ এক্সপোর্ট করতে সমস্যা হয়েছে');
    }
  };

  const handleImportBackup = () => {
    Alert.alert(
      'ব্যাকআপ ইমপোর্ট',
      'JSON ফাইল সিলেক্ট করতে ফাইল ম্যানেজার ব্যবহার করুন।\n\nবর্তমানে এই ফিচার ডেভেলপমেন্টে আছে।',
      [{ text: 'ঠিক আছে' }]
    );
  };

  const togglePermanentDelete = () => {
    if (!enablePermanentDelete) {
      Alert.alert(
        'সতর্কতা',
        'স্থায়ী মুছে ফেলা সক্রিয় করলে ডাটা স্থায়ীভাবে মুছে যাবে। আপনি কি নিশ্চিত?',
        [
          { text: 'বাতিল', style: 'cancel' },
          {
            text: 'হ্যাঁ, সক্রিয় করুন',
            style: 'destructive',
            onPress: () => {
              setEnablePermanentDelete(true);
              saveSetting('enablePermanentDelete', 'true');
            },
          },
        ]
      );
    } else {
      setEnablePermanentDelete(false);
      saveSetting('enablePermanentDelete', 'false');
    }
  };

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
        <ThemedText style={styles.sectionTitle}>{t('language', lang)}</ThemedText>
        
        <View style={styles.languageRow}>
          <Pressable
            style={[
              styles.languageOption,
              { backgroundColor: language === 'bn' ? colors.primary : colors.card },
            ]}
            onPress={() => {
              setLanguage('bn');
              saveSetting('language', 'bn');
                useI18n.getState().setLanguage('bn');
            }}
          >
            <ThemedText style={[styles.languageText, { color: language === 'bn' ? '#FFFFFF' : colors.text }]}>
              {tr("বাংলা")}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.languageOption,
              { backgroundColor: language === 'en' ? colors.primary : colors.card },
            ]}
            onPress={() => {
              setLanguage('en');
              saveSetting('language', 'en');
                useI18n.getState().setLanguage('en');
            }}
          >
            <ThemedText style={[styles.languageText, { color: language === 'en' ? '#FFFFFF' : colors.text }]}>
              {tr("English")}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.sectionTitle}>{tr("ব্যাপারী মূল্য সেটিংস")}</ThemedText>

        <InputRow
          label={t('targetWeight', lang)}
          value={targetWeight}
          onChangeText={(text) => {
            setTargetWeight(text);
            saveSetting('targetWeight', text);
          }}
          keyboardType="decimal-pad"
          placeholder="1.50"
          suffix="কেজি"
        />

        <InputRow
          label={t('basePrice', lang)}
          value={basePrice}
          onChangeText={(text) => {
            setBasePrice(text);
            saveSetting('basePrice', text);
          }}
          keyboardType="decimal-pad"
          placeholder="300"
          suffix="৳"
        />

        <InputRow
          label={t('stepGrams', lang)}
          value={stepGrams}
          onChangeText={(text) => {
            setStepGrams(text);
            saveSetting('stepGrams', text);
          }}
          keyboardType="numeric"
          placeholder="100"
          suffix="গ্রাম"
        />

        <InputRow
          label={t('stepPriceChange', lang)}
          value={stepPriceChange}
          onChangeText={(text) => {
            setStepPriceChange(text);
            saveSetting('stepPriceChange', text);
          }}
          keyboardType="decimal-pad"
          placeholder="5"
          suffix="৳"
        />

        <ThemedText style={styles.sectionTitle}>{tr("আড়ত সেটিংস")}</ThemedText>

        <InputRow
          label={`${t('commission', lang)} (%)`}
          value={commissionPercent}
          onChangeText={(text) => {
            setCommissionPercent(text);
            saveSetting('commissionPercent', text);
          }}
          keyboardType="decimal-pad"
          placeholder="5"
          suffix="%"
        />

        <ThemedText style={styles.sectionTitle}>{t('backup', lang)}</ThemedText>

        <ModuleCard
          title={t('exportData', lang)}
          subtitle="JSON ফরম্যাটে সব ডাটা এক্সপোর্ট করুন"
          icon="download"
          iconColor="#16A34A"
          onPress={handleExportBackup}
        />

        <ModuleCard
          title={t('importData', lang)}
          subtitle="JSON ব্যাকআপ থেকে ডাটা ইমপোর্ট করুন"
          icon="upload"
          iconColor="#2563EB"
          onPress={handleImportBackup}
        />

        <ThemedText style={styles.sectionTitle}>{tr("ডাটা নিরাপত্তা")}</ThemedText>

        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingTitle}>{tr("স্থায়ী মুছে ফেলা")}</ThemedText>
            <ThemedText style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
              {tr("সক্রিয় করলে আর্কাইভ করা ডাটা স্থায়ীভাবে মুছে ফেলা যাবে")}
            </ThemedText>
          </View>
          <Switch
            value={enablePermanentDelete}
            onValueChange={togglePermanentDelete}
            trackColor={{ false: colors.border, true: colors.error }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
          <Feather name="info" size={18} color={colors.primary} />
          <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
            {tr("ডিফল্টভাবে সব ডাটা আর্কাইভ করা হয়, মুছে ফেলা হয় না। এটি আপনার ডাটা সুরক্ষিত রাখে।")}
          </ThemedText>
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
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    opacity: 0.6,
  },
  languageRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  languageOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  languageText: {
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
  },
});
