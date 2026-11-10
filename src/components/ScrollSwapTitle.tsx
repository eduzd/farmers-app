import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { SharedValue, useAnimatedStyle, interpolate } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { mayaPageTitleFont } from "@/constants/mayaTheme";

const isBangla = (s: string) => /[\u0980-\u09FF]/.test(s || "");
// Market title style; text with Bangla letters uses Hind Siliguri Bold (Anton has no Bengali glyphs).
const titleFont = (s: string) => mayaPageTitleFont(isBangla(s) ? "bn" : "en", "stack");

// Room the header leaves for its title: the screen minus the back arrow and the side padding.
const HEADER_SIDE_SPACE = 96;
const MIN_FONT = 13;
const BOX_HEIGHT = 28;

/**
 * Font for a name that has to fit `room` px. Long names step the size down (never below 13) so the whole
 * name stays on one line; a name too long even at 13 wraps onto a second line (two 14 px lines fill the bar).
 * Widths are estimated per letter (Anton is narrow, Hind Siliguri is wider).
 */
// Bengali vowel signs, hasanta and other marks sit on a letter and take little or no width of their own.
const BN_MARK = /[\u0981-\u0983\u09BC\u09BE-\u09CD\u09D7\u09E2\u09E3]/;

function fitName(s: string, room: number) {
  const base = titleFont(s) as { fontFamily: string; fontSize: number; letterSpacing?: number };
  const bn = isBangla(s);
  // A small safety margin on each estimate so a name that only just fits is never clipped by a few px.
  const perChar = bn ? 0.62 : 0.54;
  const chars = Array.from(s || "").reduce((n, c) => n + (bn && BN_MARK.test(c) ? 0.35 : 1), 0);
  const est = (size: number) => chars * size * perChar;
  // Bangla letters reach above and below the line, so they need a taller line than Anton.
  const lh = (size: number) => Math.ceil(size * (bn ? 1.45 : 1.2));
  if (est(base.fontSize) <= room) return { style: base, lines: 1, height: BOX_HEIGHT };
  const size = Math.max(MIN_FONT, Math.floor((base.fontSize * room) / est(base.fontSize)));
  if (est(size) <= room) return { style: { ...base, fontSize: size, lineHeight: Math.max(lh(size), 18) }, lines: 1, height: BOX_HEIGHT };
  const small = bn ? 12 : MIN_FONT;
  const line = bn ? 17 : 14;
  return { style: { ...base, fontSize: small, lineHeight: line }, lines: 2, height: Math.max(BOX_HEIGHT, 2 * line) };
}

/**
 * A header title that swaps as the page scrolls: `title` (e.g. "Post") slides up and fades out
 * while `swapTo` (e.g. the author's name) slides in from below. `progress` goes 0 -> 1.
 *
 * The box is as wide as the longer of the two (an invisible copy of both sets the width), so the
 * author's full name shows, not just the first letters that fit in the width of "Post".
 */
export function ScrollSwapTitle({ title, swapTo, progress }: { title: string; swapTo: string; progress: SharedValue<number> }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const room = Math.max(140, width - HEADER_SIDE_SPACE);
  const name = fitName(swapTo, room);
  const first = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -10]) }],
  }));
  const second = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [10, 0]) }],
  }));
  return (
    <View style={[styles.box, { maxWidth: room, height: name.height }]} accessibilityRole="header">
      {/* Sizer: invisible, zero height, as wide as the wider of the two texts. */}
      <View style={styles.sizer} pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.Text numberOfLines={1} style={[styles.text, titleFont(title)]}>
          {title}
        </Animated.Text>
        <Animated.Text numberOfLines={name.lines} style={[styles.text, name.style]}>
          {swapTo}
        </Animated.Text>
      </View>
      <Animated.View style={[styles.layer, first]} pointerEvents="none">
        <Animated.Text numberOfLines={1} style={[styles.text, titleFont(title), { color: theme.text }]}>
          {title}
        </Animated.Text>
      </Animated.View>
      <Animated.View style={[styles.layer, second]} pointerEvents="none" testID="post-header-author-name">
        <Animated.Text numberOfLines={name.lines} style={[styles.text, name.style, { color: theme.text }]}>
          {swapTo}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: BOX_HEIGHT, justifyContent: "center", overflow: "hidden" },
  sizer: { height: 0, overflow: "hidden", opacity: 0 },
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
  text: { fontWeight: "400" },
});

export default ScrollSwapTitle;
