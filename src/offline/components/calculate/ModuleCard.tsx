import React from 'react';
import { View, Text, Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  };
}

interface ModuleCardProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  badge?: string;
}

export function ModuleCard({
  title,
  subtitle,
  icon,
  iconColor,
  onPress,
  onLongPress,
  disabled = false,
  badge,
}: ModuleCardProps) {
  const colors = useColors();

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: colors.card },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
    >
      <View style={[styles.iconContainer, { backgroundColor: (iconColor || colors.primary) + '1A' }]}>
        <AppIcon name={icon} size={24} color={iconColor || colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

interface ShortcutMenuProps {
  visible: boolean;
  items: { label: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap }[];
  onClose: () => void;
  position?: { x: number; y: number };
}

export function ShortcutMenu({ visible, items, onClose, position }: ShortcutMenuProps) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <Pressable style={styles.menuOverlay} onPress={onClose}>
      <View
        style={[
          styles.menu,
          { backgroundColor: colors.card },
          position && { top: position.y, left: position.x },
        ]}
      >
        {items.map((item, index) => (
          <Pressable
            key={index}
            style={[
              styles.menuItem,
              index < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
            ]}
            onPress={() => {
              item.onPress();
              onClose();
            }}
          >
            {item.icon ? (
              <AppIcon name={item.icon} size={18} color={colors.textSecondary} style={styles.menuIcon} />
            ) : null}
            <Text style={[styles.menuText, { color: colors.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
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
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 100,
  },
  menu: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  menuIcon: {
    marginRight: Spacing.sm,
  },
  menuText: {
    fontSize: Typography.sizes.md,
  },
});
