import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

import { tr, useTr } from "@/lib/tr";
interface CostItem {
  id: string;
  name: string;
  amount: string;
}

export default function ProfitCalculatorScreen() {
  const tr = useTr();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [costs, setCosts] = useState<CostItem[]>([
    { id: '1', name: 'বীজ/চারা', amount: '' },
    { id: '2', name: 'সার', amount: '' },
    { id: '3', name: 'কীটনাশক', amount: '' },
    { id: '4', name: 'শ্রমিক খরচ', amount: '' },
    { id: '5', name: 'সেচ/পানি', amount: '' },
    { id: '6', name: 'পরিবহন', amount: '' },
  ]);
  
  const [salesAmount, setSalesAmount] = useState('');
  const [productionAmount, setProductionAmount] = useState('');
  const [productionUnit, setProductionUnit] = useState('কেজি');

  const updateCost = (id: string, amount: string) => {
    setCosts(prev => prev.map(c => c.id === id ? { ...c, amount } : c));
  };

  const addCostItem = () => {
    setCosts(prev => [...prev, { id: Date.now().toString(), name: 'অন্যান্য', amount: '' }]);
  };

  const removeCostItem = (id: string) => {
    if (costs.length > 1) {
      setCosts(prev => prev.filter(c => c.id !== id));
    }
  };

  const results = useMemo(() => {
    const totalCost = costs.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const sales = parseFloat(salesAmount) || 0;
    const production = parseFloat(productionAmount) || 0;
    
    const profit = sales - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const costPerUnit = production > 0 ? totalCost / production : 0;
    const pricePerUnit = production > 0 ? sales / production : 0;
    
    return {
      totalCost,
      sales,
      profit,
      profitPercent,
      costPerUnit,
      pricePerUnit,
      isProfit: profit >= 0,
    };
  }, [costs, salesAmount, productionAmount]);

  const formatTaka = (n: number) => `৳${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

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
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    sectionTitle: {
      fontSize: Typography.sizes.md,
      fontWeight: '600',
      color: theme.text,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    addButtonText: {
      fontSize: Typography.sizes.sm,
      color: theme.primary,
      fontWeight: '500',
    },
    costCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    costRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    costLabel: {
      flex: 1,
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    costInput: {
      width: 120,
      fontSize: Typography.sizes.md,
      color: theme.text,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      textAlign: 'right',
    },
    deleteButton: {
      padding: Spacing.xs,
    },
    salesCard: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    inputGroup: {
      gap: Spacing.xs,
    },
    inputLabel: {
      fontSize: Typography.sizes.sm,
      color: theme.textSecondary,
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    salesInput: {
      flex: 1,
      fontSize: Typography.sizes.lg,
      color: theme.text,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    unitSelector: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.xs,
    },
    unitButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
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
    resultsCard: {
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    profitCard: {
      backgroundColor: '#16A34A',
    },
    lossCard: {
      backgroundColor: '#DC2626',
    },
    resultMain: {
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    resultLabel: {
      fontSize: Typography.sizes.sm,
      color: 'rgba(255,255,255,0.8)',
    },
    resultValue: {
      fontSize: 32,
      fontWeight: '700',
      color: '#fff',
    },
    resultPercent: {
      fontSize: Typography.sizes.md,
      color: 'rgba(255,255,255,0.9)',
      marginTop: Spacing.xs,
    },
    resultDetails: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    detailLabel: {
      fontSize: Typography.sizes.sm,
      color: 'rgba(255,255,255,0.8)',
    },
    detailValue: {
      fontSize: Typography.sizes.sm,
      fontWeight: '600',
      color: '#fff',
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{tr("লাভ-ক্ষতি হিসাব")}</Text>
        <Text style={styles.subtitle}>{tr("আপনার কৃষি ব্যবসার মুনাফা নির্ণয় করুন")}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{tr("খরচ সমূহ")}</Text>
          <Pressable style={styles.addButton} onPress={addCostItem}>
            <Feather name="plus-circle" size={16} color={theme.primary} />
            <Text style={styles.addButtonText}>{tr("যোগ করুন")}</Text>
          </Pressable>
        </View>
        <View style={styles.costCard}>
          {costs.map((cost, index) => (
            <View key={cost.id} style={styles.costRow}>
              <Text style={styles.costLabel}>{cost.name}</Text>
              <TextInput
                style={styles.costInput}
                value={cost.amount}
                onChangeText={(v) => updateCost(cost.id, v)}
                keyboardType="numeric"
                placeholder={tr("৳0")}
                placeholderTextColor={theme.textSecondary}
              />
              {index > 5 ? (
                <Pressable style={styles.deleteButton} onPress={() => removeCostItem(cost.id)}>
                  <Feather name="x" size={18} color={theme.error} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr("উৎপাদন ও বিক্রয়")}</Text>
        <View style={styles.salesCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{tr("মোট উৎপাদন")}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.salesInput}
                value={productionAmount}
                onChangeText={setProductionAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
              />
              <View style={styles.unitSelector}>
                {['কেজি', 'মণ', 'টন'].map(unit => (
                  <Pressable
                    key={unit}
                    style={[styles.unitButton, productionUnit === unit && styles.unitButtonActive]}
                    onPress={() => setProductionUnit(unit)}
                  >
                    <Text style={[styles.unitButtonText, productionUnit === unit && styles.unitButtonTextActive]}>
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{tr("মোট বিক্রয় মূল্য (টাকা)")}</Text>
            <TextInput
              style={styles.salesInput}
              value={salesAmount}
              onChangeText={setSalesAmount}
              keyboardType="numeric"
              placeholder={tr("৳0")}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>
      </View>

      {results.sales > 0 || results.totalCost > 0 ? (
        <View style={[styles.resultsCard, results.isProfit ? styles.profitCard : styles.lossCard]}>
          <View style={styles.resultMain}>
            <Text style={styles.resultLabel}>{results.isProfit ? 'মোট লাভ' : 'মোট ক্ষতি'}</Text>
            <Text style={styles.resultValue}>{formatTaka(Math.abs(results.profit))}</Text>
            {results.totalCost > 0 ? (
              <Text style={styles.resultPercent}>
                ({results.profitPercent.toFixed(1)}%)
              </Text>
            ) : null}
          </View>
          
          <View style={styles.resultDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{tr("মোট খরচ")}</Text>
              <Text style={styles.detailValue}>{formatTaka(results.totalCost)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{tr("মোট বিক্রয়")}</Text>
              <Text style={styles.detailValue}>{formatTaka(results.sales)}</Text>
            </View>
            {results.costPerUnit > 0 ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>প্রতি {productionUnit} খরচ</Text>
                <Text style={styles.detailValue}>{formatTaka(results.costPerUnit)}</Text>
              </View>
            ) : null}
            {results.pricePerUnit > 0 ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>প্রতি {productionUnit} বিক্রয়</Text>
                <Text style={styles.detailValue}>{formatTaka(results.pricePerUnit)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
