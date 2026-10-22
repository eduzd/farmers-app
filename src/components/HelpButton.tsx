import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet, apiPost, isLoggedIn } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

/** Unread admin replies in the user's Help chat (re-checks every 30 s once signed in). */
export function useSupportUnread(): [number, (n: number) => void] {
  const [unread, setUnread] = useState(0);
  const token = useAuthStore((s) => (s.isAuthenticated ? s.token : null));
  useEffect(() => {
    let alive = true;
    if (!token) { setUnread(0); return; }
    const check = () => apiGet("/api/support/unread").then((r) => alive && setUnread(Number(r?.unread || 0))).catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [token]);
  return [unread, setUnread];
}

/** Floating Help button (bottom right): opens the chat with the Farmers admins. */
export function HelpFab({ bottom = 16, testID = "help-fab" }: { bottom?: number; testID?: string }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const [unread, setUnread] = useSupportUnread();
  const label = language === "bn" ? "সাহায্য" : "Help";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={language === "bn" ? "সাহায্য: অ্যাডমিনের সাথে চ্যাট" : "Help: chat with the Farmers team"}
      onPress={() => { setUnread(0); navigation.navigate("SupportChat"); }}
      style={({ pressed }) => ({
        position: "absolute", right: 16, bottom, height: 52, paddingHorizontal: 18, borderRadius: 26,
        flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1,
        shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
      })}
    >
      <Feather name="message-circle" size={20} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{label}</Text>
      {unread ? <View testID={`${testID}-unread`} style={{ position: "absolute", top: 4, right: 6, width: 11, height: 11, borderRadius: 6, backgroundColor: "#DC2626", borderWidth: 2, borderColor: theme.primary }} /> : null}
    </Pressable>
  );
}

/** Header Help button: a small popup to message the Farmers admins, or open the full conversation. */
export default function HelpButton({ color, size = 40 }: { color?: string; size?: number }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const L = (en: string, bn: string) => (language === "bn" ? bn : en);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unread, setUnread] = useSupportUnread();

  const openChat = () => {
    setOpen(false);
    setUnread(0);
    navigation.navigate("SupportChat");
  };
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (!isLoggedIn()) { setErr(L("Please sign in first so the team can reply to you.", "আগে সাইন ইন করুন, যাতে টিম আপনাকে উত্তর দিতে পারে।")); return; }
    setBusy(true); setErr(null);
    try {
      await apiPost("/api/support/messages", { body, clientId: `h-${Date.now()}` });
      setText("");
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || L("Couldn't send. Try again.", "পাঠানো যায়নি। আবার চেষ্টা করুন।"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        testID="help-button"
        accessibilityRole="button"
        accessibilityLabel={L("Help", "সাহায্য")}
        onPress={() => { setSent(false); setErr(null); unread ? openChat() : setOpen(true); }}
        hitSlop={6}
        style={({ pressed }) => ({
          width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
          backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder, borderWidth: StyleSheet.hairlineWidth,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Feather name="help-circle" size={size * 0.48} color={color || theme.iconDefault || theme.text} />
        {unread ? <View testID="help-unread" style={{ position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: "#DC2626", borderWidth: 1.5, borderColor: theme.backgroundRoot }} /> : null}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }} onPress={() => setOpen(false)}>
            <Pressable onPress={() => {}} style={{ backgroundColor: theme.card, borderRadius: 18, padding: 18, gap: 12, width: "100%", maxWidth: 420, alignSelf: "center" }} testID="help-popup">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.primary + "20", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="life-buoy" size={19} color={theme.primary} />
                </View>
                <Text style={{ flex: 1, color: theme.text, fontWeight: "800", fontSize: 17 }}>{L("Need help?", "সাহায্য দরকার?")}</Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}><Feather name="x" size={20} color={theme.textSecondary} /></Pressable>
              </View>
              {sent ? (
                <>
                  <Text style={{ color: theme.text }}>{L("Sent. An admin will reply in your Help chat.", "পাঠানো হয়েছে। অ্যাডমিন আপনার সাহায্য চ্যাটে উত্তর দেবেন।")}</Text>
                  <Pressable testID="help-open-chat" onPress={openChat} style={{ height: 44, borderRadius: 12, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{L("Open chat", "চ্যাট খুলুন")}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={{ color: theme.textSecondary, fontSize: 13.5 }}>{L("Send a message to the Farmers team. We reply in the app.", "ফার্মার্স টিমকে মেসেজ পাঠান। আমরা অ্যাপে উত্তর দেই।")}</Text>
                  <TextInput
                    testID="help-input"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={2000}
                    placeholder={L("Describe your problem or question", "আপনার সমস্যা বা প্রশ্ন লিখুন")}
                    placeholderTextColor={theme.textTertiary}
                    style={{ minHeight: 96, maxHeight: 180, textAlignVertical: "top", borderRadius: 12, padding: 12, backgroundColor: theme.backgroundSecondary, color: theme.text, fontSize: 14.5, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
                  />
                  {err ? <Text style={{ color: "#B91C1C", fontSize: 13 }}>{err}</Text> : null}
                  <Pressable testID="help-send" onPress={send} disabled={busy || !text.trim()} style={{ height: 44, borderRadius: 12, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", opacity: busy || !text.trim() ? 0.5 : 1 }}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{L("Send to admin", "অ্যাডমিনকে পাঠান")}</Text>}
                  </Pressable>
                  <Pressable testID="help-view-chat" onPress={openChat} style={{ alignItems: "center", paddingVertical: 4 }}>
                    <Text style={{ color: theme.primary, fontWeight: "700" }}>{L("View my conversation", "আমার কথোপকথন দেখুন")}</Text>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
