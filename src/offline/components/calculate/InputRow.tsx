import React from 'react';
import { View, TextInput, StyleSheet, Text, Pressable } from 'react-native';
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
    inputBackground: theme.backgroundSecondary,
    primary: theme.primary,
    error: theme.error,
    success: theme.success,
    warning: '#EA8A0C',
  };
}

interface InputRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad';
  suffix?: string;
  editable?: boolean;
  error?: string;
}

export function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  suffix,
  editable = true,
  error,
}: InputRowProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              color: colors.text,
              borderColor: error ? colors.error : colors.border,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          editable={editable}
        />
        {suffix ? (
          <Text style={[styles.suffix, { color: colors.textSecondary }]}>{suffix}</Text>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

interface WeightRowInputProps {
  index: number;
  weight: string;
  pieces: string;
  onWeightChange: (text: string) => void;
  onPiecesChange: (text: string) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  weightLabel: string;
  piecesLabel: string;
}

export function WeightRowInput({
  index,
  weight,
  pieces,
  onWeightChange,
  onPiecesChange,
  onRemove,
  showRemove = true,
  weightLabel,
  piecesLabel,
}: WeightRowInputProps) {
  const colors = useColors();

  return (
    <View style={styles.weightRowContainer}>
      <View style={styles.rowNumber}>
        <Text style={[styles.rowNumberText, { color: colors.textSecondary }]}>
          {index + 1}
        </Text>
      </View>
      <View style={styles.weightInputs}>
        <View style={styles.weightField}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
            {weightLabel}
          </Text>
          <TextInput
            style={[
              styles.smallInput,
              { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
            ]}
            value={weight}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={styles.weightField}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
            {piecesLabel}
          </Text>
          <TextInput
            style={[
              styles.smallInput,
              { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
            ]}
            value={pieces}
            onChangeText={onPiecesChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        {showRemove && onRemove ? (
          <Pressable onPress={onRemove} style={styles.removeButton}>
            <Feather name="x-circle" size={22} color={colors.error} />
          </Pressable>
        ) : (
          <View style={styles.removeButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.md,
  },
  suffix: {
    marginLeft: Spacing.sm,
    fontSize: Typography.sizes.md,
  },
  error: {
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xs,
  },
  weightRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rowNumber: {
    width: 28,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowNumberText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  weightInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  weightField: {
    flex: 1,
  },
  smallLabel: {
    fontSize: Typography.sizes.xs,
    marginBottom: 4,
  },
  smallInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
