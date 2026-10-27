import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, Animated } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";

/**
 * "View as buyer" from the Farmers Admin app. The product page and the shop page open as they are for buyers,
 * with this bar on top. In preview every button that would buy, save, follow, message or call only shows a
 * short note, so an admin looking at a product never adds to a cart, sends anything or changes data.
 */
export type BuyerPreviewInfo = { reasons?: string[]; leftOut?: number; kind?: "product" | "shop" };

export function readPreview(params: any): BuyerPreviewInfo | null {
  const p = params?.preview;
  if (!p) return null;
  return typeof p === "object" ? p : {};
}

function reasonText(r: string, bn: boolean) {
  switch (r) {
    case "hidden": return bn ? "অ্যাডমিন পণ্যটি লুকিয়ে রেখেছেন" : "the product is hidden";
    case "inactive": return bn ? "পণ্যটি বন্ধ আছে" : "the product is switched off";
    case "storeSuspended": return bn ? "দোকানটি স্থগিত" : "the shop is suspended";
    default: return r;
  }
}

export function BuyerPreviewBar({ info, onClose, topInset = 0 }: { info: BuyerPreviewInfo; onClose: () => void; topInset?: number }) {
  const { theme } = useTheme();
  const bn = useI18n().language === "bn";
  const reasons = info.reasons || [];
  return (
    <View testID="buyer-preview-bar" style={[styles.bar, { paddingTop: topInset + 8, backgroundColor: theme.primary }]}>
      <View style={styles.row}>
        <View style={styles.eye}><Feather name="eye" size={16} color="#fff" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText style={styles.title} numberOfLines={1}>{bn ? "ক্রেতার চোখে প্রিভিউ" : "Buyer preview"}</ThemedText>
          <ThemedText style={styles.sub} numberOfLines={2}>
            {bn ? "ক্রেতারা ঠিক এভাবেই দেখেন। এখানে বোতাম চাপলে কিছু হবে না।" : "This is exactly what buyers see. Buttons don't do anything here."}
          </ThemedText>
        </View>
        <Pressable testID="buyer-preview-close" onPress={onClose} hitSlop={8} accessibilityRole="button"
          accessibilityLabel={bn ? "প্রিভিউ বন্ধ করুন" : "Close preview"}
          style={({ pressed }) => [styles.close, { opacity: pressed ? 0.75 : 1 }]}>
          <ThemedText style={[styles.closeText, { color: theme.primary }]}>{bn ? "বন্ধ" : "Done"}</ThemedText>
        </Pressable>
      </View>
      {reasons.length ? (
        <View testID="buyer-preview-warning" style={styles.warn}>
          <Feather name="alert-triangle" size={13} color="#B25E09" />
          <ThemedText style={styles.warnText}>
            {bn
              ? `ক্রেতারা এখন এটা দেখতে পাচ্ছেন না: ${reasons.map((r) => reasonText(r, true)).join(", ")}।`
              : `Buyers can't see this right now: ${reasons.map((r) => reasonText(r, false)).join(", ")}.`}
          </ThemedText>
        </View>
      ) : info.leftOut ? (
        <View testID="buyer-preview-leftout" style={styles.warn}>
          <Feather name="eye-off" size={13} color="#B25E09" />
          <ThemedText style={styles.warnText}>
            {bn ? `${info.leftOut}টি লুকানো বা বন্ধ পণ্য ক্রেতারা দেখেন না, তাই এখানে নেই।` : `${info.leftOut} hidden or switched-off product${info.leftOut === 1 ? "" : "s"} not shown, as buyers don't see them.`}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** A short note that floats above the bottom of the screen when a button is tapped in preview. */
export function usePreviewNote(bottom = 96) {
  const bn = useI18n().language === "bn";
  const [text, setText] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((what?: string) => {
    const base = bn ? "প্রিভিউতে এটা চালু নেই" : "Turned off in preview";
    setText(what ? `${base}: ${what}` : base);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: false }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setText(null));
    }, 2200);
  }, [bn, fade]);
  const node = text ? (
    <Animated.View pointerEvents="none" testID="buyer-preview-note" style={[styles.note, { bottom, opacity: fade }]}>
      <Feather name="eye" size={14} color="#fff" />
      <ThemedText style={styles.noteText} numberOfLines={2}>{text}</ThemedText>
    </Animated.View>
  ) : null;
  return { show, node };
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingBottom: 10, zIndex: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", maxWidth: 920, alignSelf: "center" },
  eye: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontWeight: "800", fontSize: 14 },
  sub: { color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 16 },
  close: { backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 14, height: 32, alignItems: "center", justifyContent: "center" },
  closeText: { fontWeight: "800", fontSize: 13 },
  warn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#FFF1DE", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, width: "100%", maxWidth: 920, alignSelf: "center" },
  warnText: { color: "#B25E09", fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 16 },
  note: { position: "absolute", left: 16, right: 16, alignSelf: "center", maxWidth: 480, marginHorizontal: "auto" as any, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(15,23,42,0.92)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, zIndex: 50 },
  noteText: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1 },
});
