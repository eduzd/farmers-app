import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  options: FilterOption[];
  selected: string;
  onSelect: (id: string) => void;
}

export function FilterChips({ options, selected, onSelect }: FilterChipsProps) {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = selected === option.id;
        return (
          <Pressable
            key={option.id}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected
                  ? theme.primary
                  : theme.backgroundDefault,
                borderColor: isSelected ? theme.primary : theme.divider,
              },
            ]}
            onPress={() => onSelect(option.id)}
          >
            <ThemedText
              style={[
                styles.chipText,
                { color: isSelected ? "#FFFFFF" : theme.text },
              ]}
            >
              {option.label}
            </ThemedText>
            {option.count !== undefined && (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isSelected
                      ? "rgba(255,255,255,0.2)"
                      : theme.primary + "15",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.countText,
                    { color: isSelected ? "#FFFFFF" : theme.primary },
                  ]}
                >
                  {option.count}
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
