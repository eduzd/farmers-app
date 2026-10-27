import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/MayaText';
import { useTheme } from '@/hooks/useTheme';
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
    success: theme.success,
  };
}

interface ResultRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  isTotal?: boolean;
}

export function ResultRow({ label, value, highlight = false, isTotal = false }: ResultRowProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.resultRow,
        isTotal && styles.totalRow,
        isTotal && { borderTopColor: colors.border },
      ]}
    >
      <Text
        style={[
          styles.resultLabel,
          { color: colors.textSecondary },
          isTotal && styles.totalLabel,
          isTotal && { color: colors.text },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.resultValue,
          { color: highlight ? colors.primary : colors.text },
          isTotal && styles.totalValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

interface ResultCardProps {
  title?: string;
  children: React.ReactNode;
}

export function ResultCard({ title, children }: ResultCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {title ? (
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

interface BreakdownItemProps {
  name: string;
  amount: number;
  isDeduction?: boolean;
  formatCurrency: (amount: number) => string;
}

export function BreakdownItem({ name, amount, isDeduction = false, formatCurrency }: BreakdownItemProps) {
  const colors = useColors();

  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownName, { color: colors.textSecondary }]}>
        {name}
      </Text>
      <Text
        style={[
          styles.breakdownAmount,
          { color: isDeduction ? colors.error : colors.success },
        ]}
      >
        {isDeduction ? '-' : '+'}{formatCurrency(amount)}
      </Text>
    </View>
  );
}

interface MoneyDisplayProps {
  amount: number;
  label: string;
  formatCurrency: (amount: number) => string;
  size?: 'normal' | 'large';
}

export function MoneyDisplay({ amount, label, formatCurrency, size = 'normal' }: MoneyDisplayProps) {
  const colors = useColors();

  return (
    <View style={styles.moneyContainer}>
      <Text style={[styles.moneyLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          size === 'large' ? styles.moneyValueLarge : styles.moneyValue,
          { color: colors.primary },
        ]}
      >
        {formatCurrency(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  resultLabel: {
    fontSize: Typography.sizes.sm,
  },
  resultValue: {
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
  },
  totalLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownName: {
    fontSize: Typography.sizes.sm,
  },
  breakdownAmount: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  moneyContainer: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  moneyLabel: {
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xs,
  },
  moneyValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  moneyValueLarge: {
    fontSize: 32,
    fontWeight: '700',
  },
});
