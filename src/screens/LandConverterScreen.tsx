import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@/components/icons/Feather';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

const UNITS = [
  { id: 'bigha', name: 'বিঘা', nameBn: 'বিঘা', toSqMeter: 1337.804 },
  { id: 'katha', name: 'কাঠা', nameBn: 'কাঠা', toSqMeter: 66.89 },
  { id: 'shotok', name: 'শতক', nameBn: 'শতক', toSqMeter: 40.4686 },
  { id: 'acre', name: 'একর', nameBn: 'একর', toSqMeter: 4046.86 },
  { id: 'hectare', name: 'হেক্টর', nameBn: 'হেক্টর', toSqMeter: 10000 },
  { id: 'sqft', name: 'বর্গফুট', nameBn: 'বর্গফুট', toSqMeter: 0.0929 },
  { id: 'sqmeter', name: 'বর্গমিটার', nameBn: 'বর্গমিটার', toSqMeter: 1 },
];

export default function LandConverterScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [inputValue, setInputValue] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('bigha');

  const conversions = useMemo(() => {
    const value = parseFloat(inputValue) || 0;
    const fromUnit = UNITS.find(u => u.id === selectedUnit);
    if (!fromUnit || value === 0) return UNITS.map(u => ({ ...u, value: 0 }));
    
    const sqMeters = value * fromUnit.toSqMeter;
    return UNITS.map(u => ({
      ...u,
      value: sqMeters / u.toSqMeter,
    }));
  }, [inputValue, selectedUnit]);

  const formatNumber = (num: number) => {
    if (num === 0) return '0';
    if (num < 0.01) return num.toExponential(2);
    if (num < 1) return num.toFixed(4);
    if (num < 100) return num.toFixed(2);
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

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
      marginBottom: Spacing.xl,
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
    inputSection: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    inputLabel: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
      marginBottom: Spacing.sm,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    textInput: {
      flex: 1,
      fontSize: Typography.sizes["2xl"],
      fontWeight: '600',
      color: theme.text,
      backgroundColor: theme.backgroundRoot,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      textAlign: 'center',
    },
    unitSelector: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    unitSelectorText: {
      fontSize: Typography.sizes.md,
      fontWeight: '600',
      color: '#fff',
    },
    unitsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    unitChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundRoot,
      borderWidth: 1,
      borderColor: theme.border,
    },
    unitChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    unitChipText: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    unitChipTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    resultsSection: {
      gap: Spacing.sm,
    },
    resultCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultCardActive: {
      backgroundColor: theme.primary + '20',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    resultLabel: {
      fontSize: Typography.sizes.md,
      color: theme.textSecondary,
    },
    resultLabelActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    resultValue: {
      fontSize: Typography.sizes.lg,
      fontWeight: '600',
      color: theme.text,
    },
    resultValueActive: {
      color: theme.primary,
    },
    infoCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginTop: Spacing.lg,
    },
    infoTitle: {
      fontSize: Typography.sizes.md,
      fontWeight: '600',
      color: theme.text,
      marginBottom: Spacing.sm,
    },
    infoText: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
      lineHeight: 20,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>জমি পরিমাপ</Text>
        <Text style={styles.subtitle}>বিভিন্ন একক রূপান্তর করুন</Text>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>পরিমাণ লিখুন</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      <View style={styles.unitsGrid}>
        {UNITS.map(unit => (
          <Pressable
            key={unit.id}
            style={[
              styles.unitChip,
              selectedUnit === unit.id && styles.unitChipSelected,
            ]}
            onPress={() => setSelectedUnit(unit.id)}
          >
            <Text
              style={[
                styles.unitChipText,
                selectedUnit === unit.id && styles.unitChipTextSelected,
              ]}
            >
              {unit.nameBn}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultsSection}>
        {conversions.map(conv => (
          <View
            key={conv.id}
            style={[
              styles.resultCard,
              selectedUnit === conv.id && styles.resultCardActive,
            ]}
          >
            <Text
              style={[
                styles.resultLabel,
                selectedUnit === conv.id && styles.resultLabelActive,
              ]}
            >
              {conv.nameBn}
            </Text>
            <Text
              style={[
                styles.resultValue,
                selectedUnit === conv.id && styles.resultValueActive,
              ]}
            >
              {formatNumber(conv.value)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>বাংলাদেশের জমি পরিমাপ</Text>
        <Text style={styles.infoText}>
          ১ বিঘা = ২০ কাঠা = ৩৩ শতক{'\n'}
          ১ একর = ৩ বিঘা (প্রায়) = ১০০ শতক{'\n'}
          ১ হেক্টর = ২.৪৭ একর = ৭.৪৭ বিঘা
        </Text>
      </View>
    </ScrollView>
  );
}
