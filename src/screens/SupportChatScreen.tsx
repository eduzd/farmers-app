import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api";

import { ChatIcon } from "@/components/icons/ChatIcon";
/** The signed-in user's own conversation with Farmers admins (Help). */
export default function SupportChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { language } = useI18n();
  const L = (en: string, bn: string) => (language === "bn" ? bn : en);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet("/api/support/thread");
      setMsgs(r?.messages || []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]));

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await apiPost("/api/support/messages", { body, clientId });
      setText("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Couldn't send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} behavior={Platform.OS === "ios" ? "padding" : undefined} testID="support-chat">
      <View style={{ paddingTop: insets.top, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 8 }}>
          <Pressable onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Main"))} hitSlop={8} style={{ padding: 8 }} testID="support-back">
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}>
            <Feather name="life-buoy" size={19} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }} numberOfLines={1}>{L("Farmers Support", "ফার্মার্স সাপোর্ট")}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{L("Our team replies here", "আমাদের টিম এখানে উত্তর দেবে")}</Text>
          </View>
        </View>
      </View>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8, flexGrow: 1 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 30 }} /> : null}
        {!loading && !msgs.length ? (
          <View style={{ alignItems: "center", paddingTop: 40, gap: 10, paddingHorizontal: 20 }}>
            <ChatIcon size={34} color={theme.textTertiary} />
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15, textAlign: "center" }}>{L("How can we help?", "আমরা কীভাবে সাহায্য করতে পারি?")}</Text>
            <Text style={{ color: theme.textSecondary, textAlign: "center" }}>{L("Write your question below. An admin will reply in this chat.", "নিচে আপনার প্রশ্ন লিখুন। অ্যাডমিন এই চ্যাটে উত্তর দেবেন।")}</Text>
          </View>
        ) : null}
        {msgs.map((m) => {
          const mine = !m.fromAdmin;
          return (
            <View key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <View style={{ backgroundColor: mine ? theme.primary : theme.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: mine ? 0 : 1, borderColor: theme.cardBorder }}>
                <Text style={{ color: mine ? "#fff" : theme.text, fontSize: 14.5 }}>{m.body}</Text>
              </View>
              <Text style={{ color: theme.textTertiary, fontSize: 10.5, marginTop: 2, textAlign: mine ? "right" : "left" }}>
                {mine ? "" : `${L("Farmers Support", "ফার্মার্স সাপোর্ট")} · `}{new Date(m.createdAt).toLocaleString()}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      {err ? <Text style={{ color: "#B91C1C", paddingHorizontal: 14, paddingBottom: 6 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: theme.card }}>
        <TextInput
          testID="support-input"
          value={text}
          onChangeText={setText}
          placeholder={L("Write a message…", "মেসেজ লিখুন…")}
          placeholderTextColor={theme.textTertiary}
          multiline
          maxLength={2000}
          style={{ flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary, color: theme.text, fontSize: 14.5, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
        />
        <Pressable testID="support-send" onPress={send} disabled={busy || !text.trim()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", opacity: busy || !text.trim() ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
