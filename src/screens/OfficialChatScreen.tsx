import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { Spacing, FontFamily } from "@/constants/theme";

export type OfficialAccount = {
  id: string; nameEn: string; nameBn: string; aboutEn: string; aboutBn: string; icon: string; color: string; verified: boolean;
  unread?: number; last?: OfficialMessage | null;
};
export type OfficialMessage = { id: string; accountId: string; title: string; body: string; toAll: boolean; createdAt: string };

/** Round avatar for an official account: its icon on its colour, with the blue verified tick. */
export function OfficialAvatar({ account, size = 52 }: { account: Pick<OfficialAccount, "icon" | "color">; size?: number }) {
  const icon = (account.icon in Feather.glyphMap ? account.icon : "check-circle") as keyof typeof Feather.glyphMap;
  const tick = Math.max(14, Math.round(size * 0.36));
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: account.color || "#2E96EF", alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={Math.round(size * 0.46)} color="#fff" />
      </View>
      <View style={{ position: "absolute", right: -2, bottom: -2, width: tick, height: tick, borderRadius: tick / 2, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <VerifiedTick size={tick - 3} />
      </View>
    </View>
  );
}

/** The blue verified badge shown next to an official account's name. */
export function VerifiedTick({ size = 15 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#1D9BF0", alignItems: "center", justifyContent: "center" }}>
      <Feather name="check" size={Math.max(8, Math.round(size * 0.68))} color="#fff" />
    </View>
  );
}

function when(iso: string, bn: boolean) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * One official account's chat (Farmers Official, Safety...). Read-only: only the admins write here,
 * so instead of a message box the bottom says who can send. Opened from Chats and from notifications.
 */
export default function OfficialChatScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { language } = useI18n();
  const bn = language === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const accountId = String(route.params?.account || "official");
  const [account, setAccount] = useState<OfficialAccount | null>(null);
  const [messages, setMessages] = useState<OfficialMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<{ account: OfficialAccount; messages: OfficialMessage[] }>(`/api/official/messages?account=${encodeURIComponent(accountId)}`)
      .then((r) => {
        setAccount(r.account);
        setMessages(r.messages || []);
        setError(null);
      })
      .catch((e) => setError(e?.message || "Error"));
  }, [accountId]);
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load])
  );

  const name = account ? (bn ? account.nameBn : account.nameEn) : L("Official", "অফিসিয়াল");
  const about = account ? (bn ? account.aboutBn : account.aboutEn) : "";
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Main"));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]} testID="official-chat">
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: theme.divider }]}>
        <Pressable onPress={back} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={L("Back", "পিছনে")} testID="official-back">
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        {account ? <OfficialAvatar account={account} size={38} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <ThemedText style={{ fontFamily: FontFamily.bold, fontSize: 16, flexShrink: 1 }} numberOfLines={1} testID="official-name">{name}</ThemedText>
            {account ? <VerifiedTick size={15} /> : null}
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {L("Official account", "অফিসিয়াল অ্যাকাউন্ট")}
          </ThemedText>
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={theme.textTertiary} />
          <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: 8 }}>
            {L("This official account isn't available.", "এই অফিসিয়াল অ্যাকাউন্টটি এখন পাওয়া যাচ্ছে না।")}
          </ThemedText>
        </View>
      ) : !messages ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center", flexGrow: 1 }}
          ListHeaderComponent={
            account ? (
              <View style={styles.intro}>
                <OfficialAvatar account={account} size={64} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <ThemedText style={{ fontFamily: FontFamily.bold, fontSize: 17 }}>{name}</ThemedText>
                  <VerifiedTick size={17} />
                </View>
                {about ? <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: 4 }}>{about}</ThemedText> : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: 24 }}>{L("No messages yet", "এখনও কোনো মেসেজ নেই")}</ThemedText>
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }} testID={`official-msg-${item.id}`}>
              {account ? <OfficialAvatar account={account} size={28} /> : null}
              <View style={[styles.bubble, { backgroundColor: theme.backgroundSecondary }]}>
                {item.title ? <ThemedText style={{ fontFamily: FontFamily.bold, fontSize: 15, marginBottom: 3 }}>{item.title}</ThemedText> : null}
                <ThemedText selectable style={{ fontSize: 15, lineHeight: 22 }}>{item.body}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textTertiary, marginTop: 6, alignSelf: "flex-end" }}>{when(item.createdAt, bn)}</ThemedText>
              </View>
            </View>
          )}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.divider }]} testID="official-readonly">
        <Feather name="lock" size={14} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary, flexShrink: 1, textAlign: "center" }}>
          {L(`Only ${name} can send messages here`, `শুধু ${name} এখানে মেসেজ পাঠাতে পারে`)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: Spacing.md, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  intro: { alignItems: "center", paddingVertical: 12, marginBottom: 4 },
  bubble: { flexShrink: 1, maxWidth: "86%", borderRadius: 18, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
