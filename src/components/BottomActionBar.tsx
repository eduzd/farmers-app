import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface BottomActionBarProps {
  children: ReactNode;
  style?: ViewStyle;
  showBorder?: boolean;
}

export function BottomActionBar({
  children,
  style,
  showBorder = true,
}: BottomActionBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const keyboard = useAnimatedKeyboard();

  const animatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === "web") {
      return {
        paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
      };
    }
    
    return {
      paddingBottom:
        keyboard.height.value > 0
          ? withTiming(Spacing.md, { duration: 150 })
          : withTiming(insets.bottom > 0 ? insets.bottom : Spacing.md, { duration: 150 }),
      transform: [
        {
          translateY: withTiming(-keyboard.height.value, { duration: 150 }),
        },
      ],
    };
  });

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
