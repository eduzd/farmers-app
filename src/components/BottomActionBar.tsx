import React, { ReactNode } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { Spacing } from "@/constants/theme";

interface BottomActionBarProps {
  children: ReactNode;
  style?: ViewStyle;
  showBorder?: boolean;
}

/**
 * Action bar pinned to the bottom of a screen. Sits just above the phone's
 * navigation bar, and rides on top of the keyboard while it is open.
 * Uses the keyboard-controller values (the app's KeyboardProvider) rather than
 * Reanimated's own keyboard listener, which conflicts with it on Android.
 */
export function BottomActionBar({
  children,
  style,
  showBorder = true,
}: BottomActionBarProps) {
  const { theme } = useTheme();
  const animatedStyle = useKeyboardAwareBottomPadding(Spacing.md, { follow: true });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.white,
          borderTopColor: showBorder ? theme.inputBorder : "transparent",
        },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
});
