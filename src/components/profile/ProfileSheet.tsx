import React from "react";
import { Modal, View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/icons/AppIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, FontFamily } from "@/constants/theme";

/**
 * The slide-up panel behind a profile's three-dot button. Same shape as the app's other
 * slide-up menus: rounded top, grab handle, a title, and it scrolls when the list is long.
 */
export function ProfileSheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" testID={testID ? `${testID}-backdrop` : undefined} />
        <View
          testID={testID}
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundRoot, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            Platform.OS === "web" ? ({ maxWidth: 640, width: "100%", alignSelf: "center" } as any) : null,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          {title ? (
            <View style={styles.titleRow}>
              <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {title}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" testID={testID ? `${testID}-close` : undefined}>
                <AppIcon name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** One row in a profile sheet: icon, words, optional trailing text. */
export function SheetRow({
  icon,
  label,
  sub,
  onPress,
  danger,
  busy,
  testID,
  right,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  busy?: boolean;
  testID?: string;
  right?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const color = danger ? theme.error || "#E5484D" : theme.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSecondary }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? "rgba(229,72,77,0.10)" : theme.backgroundSecondary }]}>
        {busy ? <ActivityIndicator size="small" color={color} /> : <AppIcon name={icon as any} size={18} color={danger ? color : theme.link || theme.text} />}
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.rowLabel, { color }]}>{label}</ThemedText>
        {sub ? <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>{sub}</ThemedText> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", paddingTop: Spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  title: { fontSize: 17, lineHeight: 24, fontFamily: FontFamily.bold, flex: 1 },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, lineHeight: 20, fontFamily: FontFamily.medium },
  rowSub: { fontSize: 13, lineHeight: 18, marginTop: 1 },
});

export default ProfileSheet;
