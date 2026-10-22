import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, { SharedValue, useAnimatedStyle, interpolate } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

/**
 * A header title that swaps as the page scrolls: `title` (e.g. "Post") slides up and fades out
 * while `swapTo` (e.g. the author's name) slides in from below. `progress` goes 0 -> 1.
 */
export function ScrollSwapTitle({ title, swapTo, progress }: { title: string; swapTo: string; progress: SharedValue<number> }) {
  const { theme } = useTheme();
  const first = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -10]) }],
  }));
  const second = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [10, 0]) }],
  }));
  return (
    <View style={styles.box} accessibilityRole="header">
      <Animated.Text numberOfLines={1} style={[styles.text, { color: theme.text }, first]}>
        {title}
      </Animated.Text>
      <Animated.Text numberOfLines={1} style={[styles.text, styles.overlay, { color: theme.text }, second]}>
        {swapTo}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 26, justifyContent: "center", overflow: "hidden", maxWidth: 230 },
  text: { fontSize: 17, fontWeight: "700" },
  overlay: { position: "absolute", left: 0, right: 0 },
});

export default ScrollSwapTitle;
