import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/icons/AppIcon";
import { useTheme } from "@/hooks/useTheme";
import { useTr } from "@/lib/tr";
import { useI18n } from "@/lib/i18n";
import { Spacing, BorderRadius, FontFamily } from "@/constants/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  onViewProfile: () => void;
}

type Item = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  danger?: boolean;
  /** Draw a thin line above this row. */
  dividerBefore?: boolean;
  onPress?: () => void;
};

/** The chat header's three-dot menu. It slides up from the bottom and looks exactly like the
 *  three-dot menu on a feed post (PostActionsSheet): same backdrop, rounded top, handle and rows. */
export function ChatOptionsSheet({ visible, onClose, onViewProfile }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tr = useTr();
  const bn = useI18n((s) => s.language) === "bn";

  const items: Item[] = [
    { key: "profile", icon: "user", label: tr("View Profile"), onPress: () => { onClose(); onViewProfile(); } },
    { key: "search", icon: "search", label: tr("Search in Conversation") },
    { key: "mute", icon: "bell-off", label: tr("Mute Notifications") },
    { key: "report", icon: "flag", label: tr("Report") },
    { key: "block", icon: "slash", label: tr("Block"), danger: true },
    { key: "delete", icon: "trash-2", label: tr("Delete Chat"), danger: true, dividerBefore: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={bn ? "বন্ধ" : "Close"} testID="chat-options-backdrop" />
      <View testID="chat-options-sheet" style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        {items.map((it) => (
          <React.Fragment key={it.key}>
            {it.dividerBefore ? <View style={[styles.divider, { backgroundColor: theme.divider }]} /> : null}
            <Pressable
              onPress={it.onPress}
              accessibilityRole="button"
              testID={`chat-menu-${it.key}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSecondary }]}
            >
              <AppIcon name={it.icon} size={20} color={it.danger ? theme.error : theme.text} />
              <ThemedText style={[styles.rowText, { color: it.danger ? theme.error : theme.text }]} numberOfLines={1}>
                {it.label}
              </ThemedText>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </Modal>
  );
}

// Same measurements as PostActionsSheet so the two menus match.
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md },
  rowText: { flex: 1, fontSize: 16, lineHeight: 24, fontFamily: FontFamily.medium },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs, marginHorizontal: Spacing.sm },
});

export default ChatOptionsSheet;
