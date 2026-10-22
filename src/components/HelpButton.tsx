import React, { useEffect } from "react";
import { Text, Pressable, StyleSheet, AppState } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { create } from "zustand";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { CountBadge } from "@/components/CountBadge";
import { ChatIcon } from "@/components/icons/ChatIcon";

/**
 * Support (Help chat) status shared by every Help button: how many admin replies the user
 * hasn't read yet, and whether a Farmers admin has the app open right now.
 */
export const useSupportStatus = create<{ unread: number; adminsOnline: boolean | null; set: (p: { unread?: number; adminsOnline?: boolean | null }) => void }>((set) => ({
  unread: 0,
  adminsOnline: null,
  set: (p) => set(p),
}));

export async function refreshSupportStatus() {
  const st = useAuthStore.getState() as any;
  if (!st.isAuthenticated || !st.token) {
    useSupportStatus.getState().set({ unread: 0, adminsOnline: null });
    return;
  }
  try {
    const r = await apiGet("/api/support/unread");
    useSupportStatus.getState().set({ unread: Number(r?.unread || 0), adminsOnline: typeof r?.adminsOnline === "boolean" ? r.adminsOnline : null });
  } catch {
    // keep the last answer; no guess
  }
}

/** Unread admin replies in the user's Help chat (re-checks every 15 s while the app is open). */
export function useSupportUnread(): [number, (n: number) => void] {
  const unread = useSupportStatus((s) => s.unread);
  const token = useAuthStore((s) => (s.isAuthenticated ? s.token : null));
  useEffect(() => {
    if (!token) {
      useSupportStatus.getState().set({ unread: 0, adminsOnline: null });
      return;
    }
    refreshSupportStatus();
    const t = setInterval(() => {
      if (AppState.currentState !== "background") refreshSupportStatus();
    }, 15000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refreshSupportStatus());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [token]);
  return [unread, (n: number) => useSupportStatus.getState().set({ unread: n })];
}

/** Floating Help button (bottom right): opens the Support chat. Shows how many admin replies are unread. */
export function HelpFab({ bottom = 16, testID = "help-fab" }: { bottom?: number; testID?: string }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const [unread] = useSupportUnread();
  const label = language === "bn" ? "সাহায্য" : "Help";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? language === "bn" ? `সাপোর্ট চ্যাট, ${unread}টি নতুন উত্তর` : `Support chat, ${unread} new ${unread === 1 ? "reply" : "replies"}`
          : language === "bn" ? "সাপোর্ট চ্যাট" : "Support chat"
      }
      onPress={() => navigation.navigate("SupportChat")}
      style={({ pressed }) => ({
        position: "absolute", right: 16, bottom, height: 52, paddingHorizontal: 18, borderRadius: 26,
        flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1,
        shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
      })}
    >
      <ChatIcon size={20} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{label}</Text>
      <CountBadge count={unread} style={{ top: -6, right: -4 }} testID={`${testID}-unread`} />
    </Pressable>
  );
}

/** Header Help button (question mark): goes straight to the Support chat, with the unread reply count on it. */
export default function HelpButton({ color, size = 40 }: { color?: string; size?: number }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const [unread] = useSupportUnread();
  return (
    <Pressable
      testID="help-button"
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? language === "bn" ? `সাপোর্ট, ${unread}টি নতুন উত্তর` : `Support, ${unread} new ${unread === 1 ? "reply" : "replies"}`
          : language === "bn" ? "সাপোর্ট" : "Support"
      }
      onPress={() => navigation.navigate("SupportChat")}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder, borderWidth: StyleSheet.hairlineWidth,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name="help-circle" size={size * 0.48} color={color || theme.iconDefault || theme.text} />
      <CountBadge count={unread} style={{ top: -4, right: -6 }} testID="help-unread" />
    </Pressable>
  );
}
