import React, { useState, useMemo } from 'react';
import { SaveCalcButton } from '@/components/SaveCalcButton';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@/components/icons/Feather';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

import { AppIcon } from "@/components/icons/AppIcon";
const CROPS = [
  { 
    id: 'rice_boro', 
    name: 'বোরো ধান', 
    icon: 'sun',
    fertilizers: { urea: 120, tsp: 80, mop: 70, gypsum: 60, zinc: 5 }
  },
  { 
    id: 'rice_aman', 
    name: 'আমন ধান', 
    icon: 'cloud-rain',
    fertilizers: { urea: 80, tsp: 60, mop: 40, gypsum: 45, zinc: 3 }
  },
  { 
    id: 'wheat', 
    name: 'গম', 
    icon: 'wind',
    fertilizers: { urea: 80, tsp: 60, mop: 40, gypsum: 50, zinc: 0 }
  },
  { 
    id: 'potato', 
    name: 'আলু', 
    icon: 'circle',
    fertilizers: { urea: 150, tsp: 100, mop: 120, gypsum: 50, zinc: 5 }
  },
  { 
    id: 'vegetables', 
    name: 'সবজি', 
    icon: 'feather',
    fertilizers: { urea: 100, tsp: 80, mop: 60, gypsum: 40, zinc: 3 }
  },
  { 
    id: 'jute', 
    name: 'পাট', 
    icon: 'align-center',
    fertilizers: { urea: 60, tsp: 30, mop: 30, gypsum: 0, zinc: 0 }
  },
  { 
    id: 'mustard', 
    name: 'সরিষা', 
    icon: 'star',
    fertilizers: { urea: 80, tsp: 85, mop: 40, gypsum: 70, zinc: 5 }
  },
  { 
    id: 'sugarcane', 
    name: 'আখ', 
    icon: 'bar-chart-2',
    fertilizers: { urea: 150, tsp: 85, mop: 100, gypsum: 60, zinc: 5 }
  },
];

const FERTILIZER_NAMES: Record<string, string> = {
  urea: 'ইউরিয়া',
  tsp: 'টিএসপি',
  mop: 'এমওপি',
  gypsum: 'জিপসাম',
  zinc: 'জিংক সালফেট',
};

export default function FertilizerCalculatorScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [landSize, setLandSize] = useState('1');
  const [landUnit, setLandUnit] = useState<'bigha' | 'acre'>('bigha');
  const [selectedCrop, setSelectedCrop] = useState('rice_boro');

  const results = useMemo(() => {
    const size = parseFloat(landSize) || 0;
    const crop = CROPS.find(c => c.id === selectedCrop);
    if (!crop || size === 0) return null;

    const multiplier = landUnit === 'acre' ? 3 : 1;
    const totalSize = size * multiplier;

    return Object.entries(crop.fertilizers).map(([key, value]) => ({
      name: FERTILIZER_NAMES[key],
      amount: value * totalSize,
      perBigha: value,
    }));
  }, [landSize, landUnit, selectedCrop]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    content: {
      paddingTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingBottom: insets.bottom + Spacing.xl,
    },
    header: {
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: Typography.sizes.xl,
      fontWeight: '700',
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: Typography.sizes.md,
      fontWeight: '600',
      color: theme.text,
      marginBottom: Spacing.sm,
    },
    inputCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    textInput: {
      flex: 1,
      fontSize: Typography.sizes.xl,
      fontWeight: '600',
      color: theme.text,
      backgroundColor: theme.backgroundRoot,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      textAlign: 'center',
    },
    unitToggle: {
      flexDirection: 'row',
      backgroundColor: theme.backgroundRoot,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xs,
    },
    unitButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    unitButtonActive: {
      backgroundColor: theme.primary,
    },
    unitButtonText: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    unitButtonTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    cropsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    cropChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cropChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    cropChipText: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    cropChipTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    resultsCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
    },
    resultsTitle: {
      fontSize: Typography.sizes.md,
      fontWeight: '600',
      color: theme.text,
      marginBottom: Spacing.md,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    resultRowLast: {
      borderBottomWidth: 0,
    },
    resultName: {
      fontSize: Typography.sizes.md,
      color: theme.text,
    },
    resultValue: {
      fontSize: Typography.sizes.lg,
      fontWeight: '700',
      color: theme.primary,
    },
    resultUnit: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
      fontWeight: '400',
    },
    noteCard: {
      backgroundColor: theme.primary + '15',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.md,
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    noteText: {
      flex: 1,
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
      lineHeight: 20,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>সার হিসাব</Text>
        <Text style={styles.subtitle}>জমি ও ফসল অনুযায়ী সারের পরিমাণ</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>জমির পরিমাণ</Text>
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={landSize}
              onChangeText={setLandSize}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.unitToggle}>
              <Pressable
                style={[styles.unitButton, landUnit === 'bigha' && styles.unitButtonActive]}
                onPress={() => setLandUnit('bigha')}
              >
                <Text style={[styles.unitButtonText, landUnit === 'bigha' && styles.unitButtonTextActive]}>
                  বিঘা
                </Text>
              </Pressable>
              <Pressable
                style={[styles.unitButton, landUnit === 'acre' && styles.unitButtonActive]}
                onPress={() => setLandUnit('acre')}
              >
                <Text style={[styles.unitButtonText, landUnit === 'acre' && styles.unitButtonTextActive]}>
                  একর
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ফসল নির্বাচন করুন</Text>
        <View style={styles.cropsGrid}>
          {CROPS.map(crop => (
            <Pressable
              key={crop.id}
              style={[
                styles.cropChip,
                selectedCrop === crop.id && styles.cropChipSelected,
              ]}
              onPress={() => setSelectedCrop(crop.id)}
            >
              <AppIcon 
                name={crop.icon as any} 
                size={14} 
                color={selectedCrop === crop.id ? '#fff' : theme.textSecondary} 
              />
              <Text
                style={[
                  styles.cropChipText,
                  selectedCrop === crop.id && styles.cropChipTextSelected,
                ]}
              >
                {crop.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {results && results.length > 0 ? (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>
            প্রয়োজনীয় সার ({landSize} {landUnit === 'bigha' ? 'বিঘা' : 'একর'})
          </Text>
          {results.map((r, index) => (
            <View 
              key={r.name} 
              style={[
                styles.resultRow, 
                index === results.length - 1 && styles.resultRowLast
              ]}
            >
              <Text style={styles.resultName}>{r.name}</Text>
              <Text style={styles.resultValue}>
                {r.amount.toFixed(1)} <Text style={styles.resultUnit}>কেজি</Text>
              </Text>
            </View>
          ))}
          <View style={styles.noteCard}>
            <Feather name="info" size={16} color={theme.primary} />
            <Text style={styles.noteText}>
              এই পরিমাণ একটি আনুমানিক হিসাব। মাটি পরীক্ষা করে সঠিক পরিমাণ নির্ধারণ করুন।
            </Text>
          </View>
          <SaveCalcButton
            recordType="FERTILIZER"
            title={`${CROPS.find((c) => c.id === selectedCrop)?.name ?? ''} - ${landSize} ${landUnit === 'bigha' ? 'বিঘা' : 'একর'}`}
            inputs={{ crop: selectedCrop, landSize, landUnit }}
            summary={results.map((r) => ({ label: r.name, value: `${r.amount.toFixed(1)} কেজি` }))}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
