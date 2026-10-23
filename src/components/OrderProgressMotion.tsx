import React, { useEffect, useRef } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Small, one-shot animations for the order step trackers (admin order page and the buyer's order page).
 *
 * Rules:
 * - They only show what the order data already says. Nothing here changes a status or a step.
 * - A step that is done stays drawn as done; a fill only grows when the real status moved forward.
 * - Nothing loops forever: the "current step" halo pings twice and stops.
 * - With the phone's / browser's reduce-motion setting on, everything jumps straight to its end state.
 */

const EASE = Easing.out(Easing.cubic);
export const STEP_STAGGER_MS = 140;

/** Bangla digits for the step counter. */
export const bnDigits = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

/**
 * Remembers how far the tracker was on the last render, so a status change animates only the steps that
 * are new (in order), and the first view animates the done steps one after another.
 */
export function useStepStagger(reached: number) {
  const prev = useRef<number | null>(null);
  const from = prev.current ?? -1;
  useEffect(() => {
    prev.current = reached;
  }, [reached]);
  return (i: number) => Math.max(0, i - from - 1) * STEP_STAGGER_MS;
}

/**
 * A connector line / bar fill. `filled` comes from the order; the fill grows from 0 when it turns on
 * (and on first view), and is removed at once if the data says it is not done.
 */
export function StepFill({
  filled,
  color,
  delay = 0,
  horizontal = false,
  style,
  testID,
}: {
  filled: boolean;
  color: string;
  delay?: number;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce && filled ? 1 : 0);
  useEffect(() => {
    if (!filled) {
      cancelAnimation(p);
      p.value = 0;
    } else if (reduce) {
      p.value = 1;
    } else {
      p.value = withDelay(delay, withTiming(1, { duration: 420, easing: EASE }));
    }
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, reduce]);
  const a = useAnimatedStyle(() =>
    horizontal ? { width: `${p.value * 100}%` } : { height: `${p.value * 100}%` },
  );
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: 0, backgroundColor: color }, horizontal ? { bottom: 0 } : { right: 0 }, style, a]}
    />
  );
}

/**
 * Wraps a step's circle. When the step becomes done (or on first view, if it is done) it gives one soft pop.
 * The circle is never hidden: it starts at 85% size, not 0.
 */
export function StepPop({
  done,
  delay = 0,
  children,
  style,
}: {
  done: boolean;
  delay?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!done || reduce) {
      cancelAnimation(s);
      s.value = 1;
      return;
    }
    s.value = 0.85;
    s.value = withDelay(
      delay + 180,
      withSequence(withTiming(1.12, { duration: 170, easing: EASE }), withTiming(1, { duration: 190, easing: EASE })),
    );
    return () => cancelAnimation(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, reduce]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/**
 * A halo behind the current step's circle: it widens and fades twice, then stays off.
 * Runs again only when the current step really changes (`runKey`).
 */
export function CurrentHalo({ runKey, color, size, delay = 0 }: { runKey: string; color: string; size: number; delay?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!reduce) {
      t.value = withDelay(delay + 380, withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), 2, false));
    }
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, reduce]);
  const a = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 1 ? 0.35 * (1 - t.value) : 0,
    transform: [{ scale: 1 + t.value * 0.75 }],
  }));
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]}
    />
  );
}

/** Fades and slides a small piece of text in when it appears or when `runKey` changes (e.g. the "Now" pill). */
export function FadeSlideIn({
  runKey,
  delay = 0,
  children,
  style,
}: {
  runKey?: string;
  delay?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withDelay(delay, withTiming(1, { duration: 260, easing: EASE }));
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: 0.15 + 0.85 * t.value, transform: [{ translateY: (1 - t.value) * 6 }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/**
 * Thin overall progress bar. Moves from where it was to the new real value; starts from empty on first view.
 */
export function OrderProgressBar({
  fraction,
  color,
  trackColor,
  label,
  testID,
}: {
  fraction: number;
  color: string;
  trackColor: string;
  label: string;
  testID?: string;
}) {
  const reduce = useReducedMotion();
  const f = Math.max(0, Math.min(1, fraction));
  const w = useSharedValue(reduce ? f : 0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(w);
      w.value = f;
    } else {
      w.value = withTiming(f, { duration: 600, easing: EASE });
    }
    return () => cancelAnimation(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, reduce]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      style={{ height: 6, borderRadius: 3, backgroundColor: trackColor, overflow: "hidden" }}
    >
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, a]} />
    </View>
  );
}
