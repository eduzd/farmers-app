import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/MayaText';
import { Feather } from '@/components/icons/Feather';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

import { AppIcon } from "@/components/icons/AppIcon";
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
    success: theme.success,
    warning: '#B25E09',
  };
}

interface HistoryCardProps {
  title: string;
  subtitle?: string;
  date: string;
  amount?: string;
  status?: 'PAID' | 'PARTIAL' | 'DUE';
  type?: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
}

export function HistoryCard({
  title,
  subtitle,
  date,
  amount,
  status,
  type,
  onPress,
  icon = 'file-text',
}: HistoryCardProps) {
  const colors = useColors();

  const getStatusColor = () => {
    switch (status) {
      case 'PAID':
        return colors.success;
      case 'PARTIAL':
        return colors.warning;
      case 'DUE':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'PAID':
        return 'পরিশোধিত';
      case 'PARTIAL':
        return 'আংশিক';
      case 'DUE':
        return 'বাকি';
      default:
        return '';
    }
  };

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
        <AppIcon name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {type ? (
            <View style={[styles.typeBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.typeText, { color: colors.textSecondary }]}>{type}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={[styles.date, { color: colors.textTertiary }]}>{date}</Text>
          {status ? (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusLabel()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {amount ? (
        <Text style={[styles.amount, { color: colors.text }]}>{amount}</Text>
      ) : null}
      <Feather name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  typeText: {
    fontSize: Typography.sizes.xs,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  date: {
    fontSize: Typography.sizes.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
  },
  amount: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginRight: Spacing.sm,
  },
});
