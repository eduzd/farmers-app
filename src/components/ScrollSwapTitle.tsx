import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, { SharedValue, useAnimatedStyle, interpolate } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { mayaPageTitleFont } from "@/constants/mayaTheme";

// Market title style; text with Bangla letters uses Hind Siliguri Bold (Anton has no Bengali glyphs).
const titleFont = (s: string) => mayaPageTitleFont(/[\u0980-\u09FF]/.test(s || "") ? "bn" : "en", "stack");

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
      <Animated.Text numberOfLines={1} style={[styles.text, titleFont(title), { color: theme.text }, first]}>
        {title}
      </Animated.Text>
      <Animated.Text numberOfLines={1} style={[styles.text, titleFont(swapTo), styles.overlay, { color: theme.text }, second]}>
        {swapTo}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 34, justifyContent: "center", overflow: "hidden", maxWidth: 230 },
  text: { fontWeight: "400" },
  overlay: { position: "absolute", left: 0, right: 0 },
});

export default ScrollSwapTitle;
