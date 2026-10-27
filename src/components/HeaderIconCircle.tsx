import React from "react";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";

/**
 * Title-bar icon button in the Market style (white circle, 1px pale-blue border, navy 20px icon).
 * Pass the icon as children. Default 44px like the Market bell and cart; screens with four
 * header actions use 40px so the page title still has room.
 */
export function HeaderIconCircle({
  children,
  onPress,
  accessibilityLabel,
  size = 44,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  size?: number;
  testID?: string;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={4}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
