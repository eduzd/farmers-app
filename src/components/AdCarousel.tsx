import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
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
  /** Button text; empty hides the button. */
  cta: string;
  colors: [string, string];
  /** Optional picture shown on the right of the card (admin ads). */
  image?: string;
  /** Leave out for a card that opens nothing. */
  onPress?: () => void;
};

/** Above this many cards the dots turn into a small "3 / 12" counter so they never overflow. */
export const MAX_DOTS = 8;

/** Dots for a few cards, a compact counter for many. Shared by Home and Connect. */
export function CarouselDots({ count, index, testID }: { count: number; index: number; testID?: string }) {
  const { theme } = useTheme();
  if (count < 2) return null;
  if (count > MAX_DOTS) {
    return (
      <View style={styles.dots} testID={testID}>
        <View style={[styles.counter, { backgroundColor: theme.backgroundTertiary }]}>
          <ThemedText style={[styles.counterText, { color: theme.text }]}>{`${index + 1} / ${count}`}</ThemedText>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.dots} testID={testID}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i === index ? theme.primary : theme.backgroundTertiary, width: i === index ? 18 : 6 }]} />
      ))}
    </View>
  );
}

/**
 * Full-width promo / ad cards that slide on their own every 4 seconds (paused for 5 seconds
 * after a touch), with dots. Same card shape as the home carousel. Measures its own width,
 * so it works inside padded lists.
 */
export function AdCarousel({ cards, testID = "ad-carousel", loading = false }: { cards: AdCard[]; testID?: string; loading?: boolean }) {
  const { theme } = useTheme();
  const isFocused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [slide, setSlide] = useState(0);
  const ref = useRef<ScrollView>(null);
  const slideRef = useRef(0);
  const lastTouch = useRef(0);
  const gap = Spacing.md;
  const step = width + gap;
  const cardKeys = cards.map((c) => c.key).join("|");

  // A new set of cards (admin added/removed ads): start again from the first one.
  useEffect(() => {
    slideRef.current = 0;
    setSlide(0);
    ref.current?.scrollTo({ x: 0, animated: false });
  }, [cardKeys]);

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
      {width && !loading && cards.length ? (
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
              disabled={!c.onPress}
              accessibilityRole={c.onPress ? "button" : "image"}
              accessibilityLabel={`${c.title}. ${c.subtitle}`}
              style={({ pressed }) => [{ width, opacity: pressed ? 0.92 : 1 }]}
            >
              <LinearGradient colors={c.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                <View style={styles.decor} />
                {c.image ? (
                  <Image source={{ uri: c.image }} style={styles.image} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
                ) : null}
                <View style={styles.icon}>
                  <AppIcon name={c.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, justifyContent: "flex-end", paddingRight: c.image ? 96 : 0 }}>
                  <ThemedText type="h4" style={styles.title} numberOfLines={1}>
                    {c.title}
                  </ThemedText>
                  <ThemedText type="small" style={styles.subtitle} numberOfLines={2}>
                    {c.subtitle}
                  </ThemedText>
                </View>
                {c.cta ? (
                  <View style={styles.cta}>
                    <ThemedText style={styles.ctaText} numberOfLines={1}>{c.cta}</ThemedText>
                    {c.onPress ? <Feather name="arrow-right" size={14} color="#0F1A14" /> : null}
                  </View>
                ) : null}
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]} />
      )}
      {!loading ? <CarouselDots count={cards.length} index={Math.min(slide, Math.max(0, cards.length - 1))} testID={`${testID}-dots`} /> : null}
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
  image: { position: "absolute", right: Spacing.lg, bottom: Spacing.lg, width: 84, height: 84, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)" },
  counter: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 },
  counterText: { fontSize: 11.5, lineHeight: 16, fontWeight: "700" },
});
