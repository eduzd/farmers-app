import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

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

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface StickyActionBarProps {
  actions: ActionButtonProps[];
}

export function StickyActionBar({ actions }: StickyActionBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const getButtonStyles = (variant: 'primary' | 'secondary' | 'danger' = 'primary', disabled: boolean = false) => {
    if (disabled) {
      return {
        backgroundColor: colors.border,
        textColor: colors.textTertiary,
      };
    }
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.card,
          textColor: colors.text,
        };
      case 'danger':
        return {
          backgroundColor: colors.error,
          textColor: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.primary,
          textColor: '#FFFFFF',
        };
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom || Spacing.md },
      ]}
    >
      {actions.map((action, index) => {
        const buttonStyles = getButtonStyles(action.variant, action.disabled);
        return (
          <Pressable
            key={index}
            style={[
              styles.button,
              { backgroundColor: buttonStyles.backgroundColor },
              actions.length === 1 && styles.fullWidth,
            ]}
            onPress={action.onPress}
            disabled={action.disabled}
          >
            {action.icon ? (
              <Feather name={action.icon} size={18} color={buttonStyles.textColor} style={styles.icon} />
            ) : null}
            <Text style={[styles.buttonText, { color: buttonStyles.textColor }]}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minHeight: 48,
  },
  fullWidth: {
    flex: 1,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  buttonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
});
