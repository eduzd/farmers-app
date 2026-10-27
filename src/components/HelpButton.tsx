import React, { useEffect } from "react";
import { Pressable, StyleSheet, AppState } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { create } from "zustand";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { CountBadge } from "@/components/CountBadge";
import { HeadsetIcon } from "@/components/icons/HeadsetIcon";

/** maya.net floating help button: mint square, 14px corners, thin white border, soft shadow. */
export const MAYA_HELP_MINT = "#D8FFF2";

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

/**
 * Floating Help button (bottom right): opens the Support chat. Shows how many admin replies are unread.
 * Looks like maya.net's "Need help?" button: a mint (#D8FFF2) rounded square (14px corners, 1px white
 * border, 0 8px 16px rgba(0,0,0,.06) shadow) with a black-outline headset. Icon only, like Maya.
 * Maya's phone size: 50x50, 24px icon, 24px from the right. The app is at most 640px wide on the web
 * (lib/webFrame), so it never reaches Maya's 90px desktop size.
 * `bottom` is where the button would sit right above the tab bar; Maya's 24px gap replaces the old 16px.
 */
export function HelpFab({ bottom = 16, testID = "help-fab" }: { bottom?: number; testID?: string }) {
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const [unread] = useSupportUnread();
  const box = 50;
  const icon = 24;
  const inset = 24;
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
        position: "absolute", right: inset, bottom: bottom - 16 + inset, width: box, height: box, borderRadius: 14,
        alignItems: "center", justifyContent: "center", backgroundColor: MAYA_HELP_MINT,
        borderWidth: 1, borderColor: "#FFFFFF", opacity: pressed ? 0.85 : 1,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <HeadsetIcon size={icon} testID={`${testID}-icon`} />
      <CountBadge count={unread} style={{ top: -6, right: -6 }} testID={`${testID}-unread`} />
    </Pressable>
  );
}

/** Header Help button (question mark): goes straight to the Support chat, with the unread reply count on it. */
export default function HelpButton({ color, size = 40, header = false }: { color?: string; size?: number; header?: boolean }) {
  // header: the title-bar look, identical to the Market bell and cart (44px circle, 1px border, 20px icon).
  if (header) size = 44;
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
        backgroundColor: header ? theme.card : theme.backgroundDefault, borderColor: theme.cardBorder, borderWidth: header ? 1 : StyleSheet.hairlineWidth,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name="help-circle" size={header ? 20 : size * 0.48} color={color || (header ? theme.text : theme.iconDefault) || theme.text} />
      <CountBadge count={unread} style={{ top: -4, right: -6 }} testID="help-unread" />
    </Pressable>
  );
}
