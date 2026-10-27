import React from "react";
import { Pressable, StyleSheet, View, ViewStyle, StyleProp } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Shadows, Spacing } from "@/constants/theme";
import { useThemeScope } from "@/contexts/ThemeScope";
import { MayaRadius } from "@/constants/mayaTheme";

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  testID?: string;
}

/** Surface for grouped content: hairline border, soft shadow, 18pt radius. */
export function Card({ children, onPress, style, padded = true, elevated = false, testID }: CardProps) {
  const { theme } = useTheme();
  const maya = useThemeScope() === "maya";
  const base = [
    styles.card,
    { backgroundColor: theme.card, borderColor: theme.cardBorder },
    padded && styles.padded,
    // Maya cards are flat: a 1px hairline and 12px corners, a shadow only when lifted.
    maya ? { borderWidth: 1, borderRadius: MayaRadius.lg } : null,
    maya ? (elevated ? Shadows.small : null) : elevated ? Shadows.medium : Shadows.small,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: {
    padding: Spacing.lg,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
