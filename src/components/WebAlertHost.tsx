import React, { useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

/**
 * react-native-web ships Alert.alert as a no-op, so on the web every
 * validation message, confirmation and "Saved!" popup silently did nothing.
 * This replaces Alert.alert on web with an in-app dialog that supports
 * title, message and any number of buttons (cancel / destructive styles).
 */
type AlertButton = { text?: string; onPress?: (value?: string) => void; style?: "default" | "cancel" | "destructive" };
type AlertItem = { id: number; title: string; message?: string; buttons: AlertButton[]; cancelable: boolean };

let queue: AlertItem[] = [];
let listeners: Array<(q: AlertItem[]) => void> = [];
let nextId = 1;
const emit = () => listeners.forEach((l) => l([...queue]));

if (Platform.OS === "web") {
  (Alert as any).alert = (title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => {
    const btns = buttons && buttons.length ? buttons : [{ text: "OK" }];
    queue.push({ id: nextId++, title: title ?? "", message, buttons: btns, cancelable: options?.cancelable ?? true });
    emit();
  };
}

export function WebAlertHost() {
  const { theme } = useTheme();
  const [items, setItems] = useState<AlertItem[]>(queue);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  if (Platform.OS !== "web") return null;
  const current = items[0];
  if (!current) return null;

  const close = (btn?: AlertButton) => {
    queue = queue.filter((q) => q.id !== current.id);
    emit();
    // run after the dialog closes so a follow-up Alert opens cleanly
    if (btn?.onPress) setTimeout(() => btn.onPress && btn.onPress(), 0);
  };

  const cancelBtn = current.buttons.find((b) => b.style === "cancel");
  const stacked = current.buttons.length > 2;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancelBtn)}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => current.cancelable && close(cancelBtn)}>
        <Pressable style={[styles.card, { backgroundColor: theme.backgroundDefault }]} onPress={() => {}}>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: Spacing.sm }}>
            {current.title ? <ThemedText type="h4" style={styles.title}>{current.title}</ThemedText> : null}
            {current.message ? (
              <ThemedText style={[styles.message, { color: theme.textSecondary }]}>{current.message}</ThemedText>
            ) : null}
          </ScrollView>
          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {current.buttons.map((b, i) => {
              const isCancel = b.style === "cancel";
              const isDestructive = b.style === "destructive";
              const primary = !isCancel && i === current.buttons.length - 1;
              return (
                <Pressable
                  key={i}
                  onPress={() => close(b)}
                  style={({ pressed }) => [
                    styles.btn,
                    stacked && styles.btnStacked,
                    {
                      backgroundColor: primary ? (isDestructive ? theme.error : theme.primary) : theme.backgroundSecondary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.btnText,
                      { color: primary ? "#fff" : isDestructive ? theme.error : theme.text },
                    ]}
                    numberOfLines={2}
                  >
                    {b.text || "OK"}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  card: { width: "100%", maxWidth: 380, borderRadius: BorderRadius.lg, padding: Spacing.xl },
  title: { marginBottom: Spacing.sm },
  message: { fontSize: 15, lineHeight: 22 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  buttonsStacked: { flexDirection: "column", alignItems: "stretch" },
  btn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, minWidth: 96, alignItems: "center" },
  btnStacked: { width: "100%" },
  btnText: { fontWeight: "600", textAlign: "center" },
});
