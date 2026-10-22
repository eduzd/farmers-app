import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
export type AdCard = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  cta: string;
  colors: [string, string];
  onPress: () => void;
};

/**
 * Full-width promo / ad cards that slide on their own every 4 seconds (paused for 5 seconds
 * after a touch), with dots. Same card shape as the home carousel. Measures its own width,
 * so it works inside padded lists.
 */
export function AdCarousel({ cards, testID = "ad-carousel" }: { cards: AdCard[]; testID?: string }) {
  const { theme } = useTheme();
  const isFocused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [slide, setSlide] = useState(0);
  const ref = useRef<ScrollView>(null);
  const slideRef = useRef(0);
  const lastTouch = useRef(0);
  const gap = Spacing.md;
  const step = width + gap;

  useEffect(() => {
    if (!isFocused || cards.length < 2 || !width) return;
    const t = setInterval(() => {
      if (Date.now() - lastTouch.current < 5000) return;
      const next = (slideRef.current + 1) % cards.length;
      slideRef.current = next;
      setSlide(next);
      ref.current?.scrollTo({ x: next * step, animated: true });
    }, 4000);
    return () => clearInterval(t);
  }, [isFocused, cards.length, width, step]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!step) return;
    const i = Math.max(0, Math.min(cards.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    slideRef.current = i;
    if (i !== slide) setSlide(i);
  };
  const touch = () => {
    lastTouch.current = Date.now();
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} testID={testID}>
      {width ? (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={onScroll}
          onScrollBeginDrag={touch}
          onScrollEndDrag={touch}
          onTouchStart={touch}
          scrollEventThrottle={32}
          contentContainerStyle={{ gap }}
        >
          {cards.map((c) => (
            <Pressable
              key={c.key}
              testID={`${testID}-card-${c.key}`}
              onPress={c.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${c.title}. ${c.subtitle}`}
              style={({ pressed }) => [{ width, opacity: pressed ? 0.92 : 1 }]}
            >
              <LinearGradient colors={c.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                <View style={styles.decor} />
                <View style={styles.icon}>
                  <AppIcon name={c.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                  <ThemedText type="h4" style={styles.title} numberOfLines={1}>
                    {c.title}
                  </ThemedText>
                  <ThemedText type="small" style={styles.subtitle} numberOfLines={2}>
                    {c.subtitle}
                  </ThemedText>
                </View>
                <View style={styles.cta}>
                  <ThemedText style={styles.ctaText} numberOfLines={1}>{c.cta}</ThemedText>
                  <Feather name="arrow-right" size={14} color="#0F1A14" />
                </View>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]} />
      )}
      {cards.length > 1 ? (
        <View style={styles.dots}>
          {cards.map((c, i) => (
            <View key={c.key} style={[styles.dot, { backgroundColor: i === slide ? theme.primary : theme.backgroundTertiary, width: i === slide ? 18 : 6 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: 148, borderRadius: BorderRadius.xl, padding: Spacing.lg, overflow: "hidden" },
  decor: { position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.12)" },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF" },
  subtitle: { color: "rgba(255,255,255,0.88)" },
  cta: {
    position: "absolute", right: Spacing.lg, top: Spacing.lg, maxWidth: "55%", flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  ctaText: { color: "#0F1A14", fontSize: 12, lineHeight: 16, fontWeight: "700" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: Spacing.sm },
  dot: { height: 6, borderRadius: 3 },
});
