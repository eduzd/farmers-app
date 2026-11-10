import React, { useEffect } from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing, cancelAnimation } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@/components/icons/Feather";
import { Text } from "@/components/MayaText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";

/** Shared look for the AI pages (AI help chat, disease detector, AI call), in the Maya palette. */

export const useBn = () => useI18n((s) => s.language) === "bn";

export function aiGradient(isDark: boolean): [string, string, string] {
  return isDark ? ["#0B1F4D", "#173A8A", "#2F6FE4"] : ["#0A1F44", "#1C3F94", "#3D7BF2"];
}

/** A soft glowing orb: Krishi AI's face. `active` makes it breathe faster (listening / speaking). */
export function AiOrb({ size = 72, active = false, icon = "zap", color }: { size?: number; active?: boolean; icon?: any; color?: string }) {
  const { theme, isDark } = useTheme();
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);
  useEffect(() => {
    const d = active ? 700 : 1800;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: d, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: d, easing: Easing.inOut(Easing.quad) })), -1);
    ring.value = 0;
    ring.value = withRepeat(withTiming(1, { duration: active ? 1300 : 2600, easing: Easing.out(Easing.quad) }), -1);
    return () => { cancelAnimation(pulse); cancelAnimation(ring); };
  }, [active]);
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * (active ? 0.07 : 0.035) }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.55 }] }));
  const tint = color || (isDark ? "#5B9BFF" : theme.primary);
  return (
    <View style={{ width: size * 1.6, height: size * 1.6, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: tint }, halo]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }, core]}>
        <LinearGradient colors={["#7FB2FF", tint, "#0A1F44"]} start={{ x: 0.15, y: 0.1 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name={icon} size={size * 0.4} color="#fff" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** Three bouncing dots: the AI is thinking. */
export function TypingDots({ color }: { color?: string }) {
  const { theme } = useTheme();
  const c = color || theme.textSecondary;
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => <Dot key={i} delay={i * 160} color={c} />)}
    </View>
  );
}
function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1));
    return () => cancelAnimation(v);
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.65, transform: [{ translateY: -3 * v.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, s]} />;
}

/** Live sound bars for the AI call. */
export function SoundBars({ active, color = "#fff", bars = 5, height = 26 }: { active: boolean; color?: string; bars?: number; height?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height }}>
      {Array.from({ length: bars }).map((_, i) => <Bar key={i} i={i} active={active} color={color} height={height} />)}
    </View>
  );
}
function Bar({ i, active, color, height }: { i: number; active: boolean; color: string; height: number }) {
  const v = useSharedValue(0.25);
  useEffect(() => {
    if (active) v.value = withDelay(i * 90, withRepeat(withSequence(withTiming(1, { duration: 260 + i * 40 }), withTiming(0.25, { duration: 260 + i * 30 })), -1));
    else { cancelAnimation(v); v.value = withTiming(0.25, { duration: 200 }); }
    return () => cancelAnimation(v);
  }, [active]);
  const s = useAnimatedStyle(() => ({ height: Math.max(4, height * v.value) }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color }, s]} />;
}

/** Light markdown for AI answers: **bold**, bullet lines and numbered lines. */
export function RichText({ text, color, size = 15 }: { text: string; color: string; size?: number }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  return (
    <View style={{ gap: 3 }}>
      {lines.map((raw, i) => {
        const line = raw.replace(/^#{1,6}\s*/, "");
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        const body = bullet ? bullet[1] : num ? num[2] : line;
        const parts = body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const content = (
          <Text style={{ color, fontSize: size, lineHeight: size * 1.5, flex: bullet || num ? 1 : undefined }}>
            {parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <Text key={j} style={{ fontWeight: "700", color }}>{p.slice(2, -2)}</Text> : p.replace(/\*/g, ""))}
          </Text>
        );
        if (bullet || num) {
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 2 }}>
              <Text style={{ color, fontSize: size, lineHeight: size * 1.5, fontWeight: "700", minWidth: num ? 18 : 10 }}>{num ? `${num[1]}.` : "•"}</Text>
              {content}
            </View>
          );
        }
        return <View key={i}>{content}</View>;
      })}
    </View>
  );
}

/** A calm banner for "AI isn't set up yet" and similar notes. */
export function AiNotice({ text, tone = "info", style, testID }: { text: string; tone?: "info" | "warn" | "error"; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { theme } = useTheme();
  const c = tone === "error" ? theme.error : tone === "warn" ? theme.warning : theme.primary;
  return (
    <View testID={testID} style={[styles.notice, { backgroundColor: c + "14", borderColor: c + "33" }, style]}>
      <Feather name={tone === "info" ? "info" : "alert-circle"} size={16} color={c} />
      <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19, flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 14, borderWidth: 1 },
});
