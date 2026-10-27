import React from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput } from '@/components/MayaText';
import { Feather } from '@/components/icons/Feather';
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
  };
}

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const colors = useColors();

  return (
    <Pressable
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? '#FFFFFF' : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

export function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={18} color={colors.textSecondary} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')}>
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface FilterBarProps {
  filters: { key: string; label: string }[];
  selectedFilter: string;
  onFilterChange: (key: string) => void;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
}

export function FilterBar({
  filters,
  selectedFilter,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
}: FilterBarProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      {onSearchChange !== undefined && searchValue !== undefined ? (
        <SearchBar
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
        />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipContainer}
        contentContainerStyle={styles.chipContent}
      >
        {filters.map((filter) => (
          <FilterChip
            key={filter.key}
            label={filter.label}
            selected={selectedFilter === filter.key}
            onPress={() => onFilterChange(filter.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.sizes.md,
  },
  chipContainer: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
});
