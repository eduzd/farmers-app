import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Palette } from "@/constants/theme";

/**
 * Farmers confirmation / approval sheet.
 *
 * One look for every "are you sure?" moment in the app and the admin
 * dashboard: it slides up from the bottom, lands with a soft spring bounce,
 * and gives a light haptic tap on each button. It replaces the browser's
 * window.confirm box and the plain system Alert for app-owned confirmations.
 *
 * Use it three ways:
 *   - `await askConfirm({ title, message, confirmText, cancelText, tone })`
 *     resolves true only when the user taps the confirm button.
 *   - `<ConfirmSheet visible ... />` as a controlled component.
 *   - On the web, `Alert.alert(...)` is routed here too (see WebAlertHost).
 */

export type ConfirmTone = "primary" | "danger" | "warning" | "send";

export type SheetButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: ConfirmTone;
  icon?: keyof typeof Feather.glyphMap;
  /** Buttons in Alert order. The last non-cancel button is the main action. */
  buttons: SheetButton[];
  /** Tap outside / Escape / Android back. Not called while loading. */
  onRequestClose?: () => void;
  /** Shows a spinner on the main action and locks every button. */
  loading?: boolean;
  /** Called after the slide-down animation finishes. */
  onHidden?: () => void;
  dismissable?: boolean;
  testID?: string;
};

const TONES: Record<ConfirmTone, { colors: [string, string]; solid: string; icon: keyof typeof Feather.glyphMap }> = {
  primary: { colors: [Palette.leafLight, Palette.leafDark], solid: Palette.leaf, icon: "check-circle" },
  send: { colors: [Palette.leafLight, Palette.leafDark], solid: Palette.leaf, icon: "send" },
  warning: { colors: ["#F6A93B", Palette.sun], solid: Palette.sun, icon: "alert-circle" },
  danger: { colors: ["#F05252", "#B91C1C"], solid: Palette.clay, icon: "alert-triangle" },
};

const DANGER_WORDS = /(delete|remove|ban|reject|suspend|turn off|cancel this|end|kick|block|disable|মুছ|সরান|নিষিদ্ধ|ব্যান|বাতিল|স্থগিত|বন্ধ|শেষ)/i;
const SEND_WORDS = /(send|post|publish|broadcast|পাঠান|পোস্ট|প্রকাশ)/i;

/** Pick a tone from the action word when the caller didn't name one. */
export function inferTone(confirmText: string): ConfirmTone {
  if (SEND_WORDS.test(confirmText)) return "send";
  if (DANGER_WORDS.test(confirmText)) return "danger";
  return "primary";
}

/** A light, tasteful tap. Never throws, does nothing where unsupported. */
export function tapHaptic(kind: "light" | "medium" | "warning" = "light") {
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav && typeof nav.vibrate === "function") nav.vibrate(kind === "light" ? 8 : 14);
      return;
    }
    if (kind === "warning") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    else void Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    /* haptics are a nicety */
  }
}

export function ConfirmSheet({
  visible,
  title,
  message,
  tone = "primary",
  icon,
  buttons,
  onRequestClose,
  loading = false,
  onHidden,
  dismissable = true,
  testID,
}: ConfirmSheetProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(0)).current; // 0 hidden, 1 shown
  const fade = useRef(new Animated.Value(0)).current;
  const lastPress = useRef(0); // double-tap guard
  const useNative = Platform.OS !== "web";
  const t = TONES[tone] || TONES.primary;
  const offscreen = Math.max(420, winH * 0.6);
  const compact = winH < 700; // short phones: smaller badge and summary

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(0);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
        // Gentle overshoot: lands, lifts a few pixels, settles.
        Animated.spring(slide, { toValue: 1, damping: 22, stiffness: 220, mass: 1, overshootClamping: false, useNativeDriver: useNative }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: useNative }),
        Animated.timing(slide, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: useNative }),
      ]).start(() => {
        setMounted(false);
        onHidden?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = useCallback(() => {
    if (loading || !dismissable) return;
    onRequestClose?.();
  }, [loading, dismissable, onRequestClose]);

  // Escape key on the web.
  useEffect(() => {
    if (Platform.OS !== "web" || !visible || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, requestClose]);

  if (!mounted) return null;

  const mainIndex = (() => {
    for (let i = buttons.length - 1; i >= 0; i--) if (buttons[i].style !== "cancel") return i;
    return buttons.length - 1;
  })();
  const stacked = buttons.length > 2 || winW < 330;
  const glyph = icon || t.icon;
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <View style={styles.root} testID={testID}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(0,0,0,0.62)" : "rgba(9,20,14,0.48)" }]}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel={buttons.find((b) => b.style === "cancel")?.text || "Close"}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          {...(Platform.OS === "web" ? ({ role: "dialog", "aria-modal": true, "aria-label": title } as any) : {})}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundDefault,
              paddingBottom: Math.max(insets.bottom, 14) + 12 + 24,
              transform: [{ translateY }],
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,26,20,0.06)",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.backgroundTertiary }]} />

          <View style={styles.header}>
            <View style={[styles.iconHalo, compact && styles.iconHaloCompact, { backgroundColor: t.solid + (isDark ? "26" : "18") }]}>
              <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.iconBadge, compact && styles.iconBadgeCompact]}>
                <Feather name={glyph} size={compact ? 22 : 26} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              {title}
            </ThemedText>
          </View>

          {message ? (
            <ScrollView style={{ maxHeight: Math.min(260, winH * (compact ? 0.26 : 0.35)) }} bounces={false}>
              <View style={[styles.summary, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.message, { color: theme.textSecondary }]}>{message}</ThemedText>
              </View>
            </ScrollView>
          ) : null}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {buttons.map((b, i) => {
              const isMain = i === mainIndex && b.style !== "cancel";
              const destructive = b.style === "destructive" || (isMain && tone === "danger");
              const label = b.text || "OK";
              const solid = destructive ? TONES.danger.solid : t.solid;
              return (
                <Pressable
                  key={`${i}-${label}`}
                  disabled={loading}
                  onPress={() => {
                    const now = Date.now();
                    if (loading || now - lastPress.current < 700) return;
                    lastPress.current = now;
                    tapHaptic(isMain ? (destructive ? "warning" : "medium") : "light");
                    b.onPress?.();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: loading, busy: loading && isMain }}
                  testID={isMain ? "confirm-sheet-ok" : b.style === "cancel" ? "confirm-sheet-cancel" : undefined}
                  style={({ pressed }) => [
                    styles.btn,
                    stacked ? styles.btnStacked : styles.btnRow,
                    isMain
                      ? { backgroundColor: solid, shadowColor: solid }
                      : { backgroundColor: theme.backgroundSecondary, borderColor: theme.backgroundTertiary, borderWidth: 1 },
                    isMain && styles.btnMainShadow,
                    { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: loading && !isMain ? 0.55 : 1 },
                  ]}
                >
                  {isMain && loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText
                      numberOfLines={2}
                      style={[styles.btnText, { color: isMain ? "#FFFFFF" : destructive ? TONES.danger.solid : theme.text }]}
                    >
                      {label}
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Imperative queue: askConfirm() and the web Alert.alert replacement.  */
/* ------------------------------------------------------------------ */

type QueueItem = {
  id: number;
  title: string;
  message?: string;
  tone: ConfirmTone;
  icon?: keyof typeof Feather.glyphMap;
  buttons: SheetButton[];
  cancelable: boolean;
  /** Which button counts as "dismiss" (backdrop, Escape, back). */
  cancelIndex: number;
};

let queue: QueueItem[] = [];
let listeners: Array<(q: QueueItem[]) => void> = [];
let nextId = 1;
const emit = () => listeners.forEach((l) => l([...queue]));

export function enqueueSheet(item: Omit<QueueItem, "id">) {
  queue.push({ ...item, id: nextId++ });
  emit();
}

export type AskConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  icon?: keyof typeof Feather.glyphMap;
};

/** Resolves true only when the confirm button is tapped. Cancel, backdrop, Escape and back all resolve false. */
export function askConfirm(o: AskConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const confirmText = o.confirmText || "OK";
    const tone = o.tone || inferTone(confirmText);
    enqueueSheet({
      title: o.title,
      message: o.message,
      tone,
      icon: o.icon,
      cancelable: true,
      cancelIndex: 0,
      buttons: [
        { text: o.cancelText || "Cancel", style: "cancel", onPress: () => done(false) },
        { text: confirmText, style: tone === "danger" ? "destructive" : "default", onPress: () => done(true) },
      ],
    });
  });
}

/** Mount once near the root of the app. */
export function ConfirmSheetHost() {
  const [items, setItems] = useState<QueueItem[]>(queue);
  const [closing, setClosing] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    listeners.push(setItems);
    setItems([...queue]);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  const current = items[0];
  if (!current) return null;

  const finish = (btn?: SheetButton) => {
    if (closing) return; // double-tap guard: the first tap wins
    pending.current = btn?.onPress || null;
    setClosing(true);
  };

  const onHidden = () => {
    const run = pending.current;
    pending.current = null;
    queue = queue.filter((q) => q.id !== current.id);
    setClosing(false);
    emit();
    // run after the sheet has gone so a follow-up sheet opens cleanly
    if (run) setTimeout(run, 0);
  };

  const cancelBtn = current.buttons[current.cancelIndex]?.style === "cancel" ? current.buttons[current.cancelIndex] : current.buttons.find((b) => b.style === "cancel");

  return (
    <ConfirmSheet
      key={current.id}
      visible={!closing}
      title={current.title}
      message={current.message}
      tone={current.tone}
      icon={current.icon}
      dismissable={current.cancelable}
      onRequestClose={() => finish(cancelBtn)}
      onHidden={onHidden}
      buttons={current.buttons.map((b) => ({ ...b, onPress: () => finish(b) }))}
      testID="confirm-sheet"
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 520,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
    // a little extra below so the spring overshoot never shows a gap
    marginBottom: -24,
  },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 18 },
  header: { alignItems: "center", marginBottom: 14 },
  iconHalo: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  iconHaloCompact: { width: 60, height: 60, borderRadius: 30, marginBottom: 10 },
  iconBadgeCompact: { width: 44, height: 44, borderRadius: 22 },
  iconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "800", textAlign: "center", letterSpacing: -0.2, paddingHorizontal: 8 },
  summary: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  message: { fontSize: 15, lineHeight: 23, textAlign: "center" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 18 },
  buttonsStacked: { flexDirection: "column-reverse" },
  btn: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  btnRow: { flex: 1 },
  btnStacked: { width: "100%" },
  btnMainShadow: { shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  btnText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
});
