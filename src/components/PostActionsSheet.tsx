import React, { useEffect, useState } from "react";
import { View, StyleSheet, Modal, Pressable, TextInput, Alert, ActivityIndicator, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Feather } from "@/components/icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { Spacing, BorderRadius, FontFamily } from "@/constants/theme";
import { deleteServerPost, editServerPost, reportServerPost, setUserRelation } from "@/lib/feedApi";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { AppIcon } from "@/components/icons/AppIcon";
export interface PostActionsTarget {
  id: string;
  content: string;
  /** true when the post lives on the server (false = only on this phone). */
  shared?: boolean;
  isSaved?: boolean;
  author: { id?: string; name: string; initials?: string };
}

interface Props {
  visible: boolean;
  post: PostActionsTarget | null;
  onClose: () => void;
  onToggleSave: () => void;
  onDeleted: (postId: string) => void;
  onEdited: (postId: string, content: string) => void;
  /** The author was muted or blocked: hide their posts. */
  onAuthorHidden: (authorId: string, kind: "mute" | "block") => void;
}

const REASONS: { id: string; en: string; bn: string }[] = [
  { id: "spam", en: "Spam", bn: "স্প্যাম" },
  { id: "scam", en: "Scam or fraud", bn: "প্রতারণা" },
  { id: "misinformation", en: "False information", bn: "ভুল তথ্য" },
  { id: "harassment", en: "Harassment or bullying", bn: "হয়রানি" },
  { id: "hate_speech", en: "Hate speech", bn: "ঘৃণাসূচক কথা" },
  { id: "violence", en: "Violence", bn: "সহিংসতা" },
  { id: "inappropriate", en: "Inappropriate content", bn: "অনুপযুক্ত কনটেন্ট" },
  { id: "copyright", en: "Copyright", bn: "কপিরাইট" },
  { id: "other", en: "Something else", bn: "অন্য কিছু" },
];

type Mode = "menu" | "report" | "edit";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Height the edit sheet needs besides the text box: handle, title, Save button, padding,
 *  plus a strip of backdrop left showing above the sheet. */
const EDIT_CHROME = 180;
/** Same for the report sheet around its scrolling list. */
const REPORT_CHROME = 64;
/** The three-dot menu on a post: Edit / Delete for your own post; Save, Report, Mute, Block and
 *  Request quote for someone else's. Every action is saved on the server before it says so. */
export function PostActionsSheet({ visible, post, onClose, onToggleSave, onDeleted, onEdited, onAuthorHidden }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const bn = useI18n((s) => s.language) === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const me = useAuthStore((s) => s.user);
  const getToken = useAuthStore((s) => s.getToken);
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [editText, setEditText] = useState("");

  // The sheet rises above the keyboard (ModalBottomInset at its bottom). The text box and the
  // report list shrink to the room left between the keyboard and the top of the screen, so the
  // whole sheet, title and Save button included, stays in view while typing. A long post
  // scrolls inside the box, which keeps the cursor visible.
  const { height: windowHeight } = useWindowDimensions();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  // On the web, useWindowDimensions already follows the visible part of the page (react-native-web
  // reads visualViewport), so the keyboard is out of windowHeight there and isn't subtracted again.
  const topInset = insets.top;
  const bottomInset = insets.bottom;
  const editInputStyle = useAnimatedStyle(() => {
    const below = Math.max(bottomInset, -keyboardHeight.value);
    const room = windowHeight - topInset - below - EDIT_CHROME;
    const maxHeight = Math.max(72, room);
    return { maxHeight, minHeight: Math.min(120, maxHeight) };
  }, [windowHeight, topInset, bottomInset]);
  const reportListStyle = useAnimatedStyle(() => {
    const below = Math.max(bottomInset, -keyboardHeight.value);
    const room = windowHeight - topInset - below - REPORT_CHROME;
    return { maxHeight: Math.min(520, Math.max(160, room)) };
  }, [windowHeight, topInset, bottomInset]);

  useEffect(() => {
    if (visible) {
      setMode("menu");
      setReason(null);
      setDetails("");
      setEditText(post?.content ?? "");
      setBusy(false);
    }
  }, [visible, post?.id]);

  if (!post) return null;
  const isOwn = !post.shared || (!!me?.id && post.author.id === me.id);
  const serverPost = !!post.shared;

  const needToken = (): string | null => {
    const token = getToken();
    if (!token || !me) {
      Alert.alert(L("Sign in first", "আগে সাইন ইন করুন"), L("You need an account to do this.", "এটি করতে অ্যাকাউন্ট লাগবে।"));
      return null;
    }
    return token;
  };
  const fail = (e: unknown) =>
    Alert.alert(L("Couldn't do that", "করা গেল না"), e instanceof Error && e.message ? e.message : L("Check your connection and try again.", "ইন্টারনেট দেখে আবার চেষ্টা করুন।"));

  const confirmDelete = () => {
    Alert.alert(L("Delete this post?", "পোস্টটি মুছবেন?"), L("It will be removed for everyone. This can't be undone.", "সবার কাছ থেকে মুছে যাবে। ফেরত আনা যাবে না।"), [
      { text: L("Cancel", "বাতিল"), style: "cancel" },
      {
        text: L("Delete", "মুছুন"),
        style: "destructive",
        onPress: async () => {
          if (!serverPost) {
            onDeleted(post.id);
            onClose();
            return;
          }
          const token = needToken();
          if (!token) return;
          setBusy(true);
          try {
            await deleteServerPost(token, post.id);
            onDeleted(post.id);
            onClose();
          } catch (e) {
            fail(e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text) return;
    if (!serverPost) {
      onEdited(post.id, text);
      onClose();
      return;
    }
    const token = needToken();
    if (!token) return;
    setBusy(true);
    try {
      const saved = await editServerPost(token, post.id, text);
      onEdited(post.id, saved);
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    if (!reason) return;
    const token = needToken();
    if (!token) return;
    setBusy(true);
    try {
      const r = await reportServerPost(token, post.id, reason, details.trim() || undefined);
      onClose();
      Alert.alert(
        r.alreadyReported ? L("Already reported", "আগেই রিপোর্ট করেছেন") : L("Report sent", "রিপোর্ট পাঠানো হয়েছে"),
        r.alreadyReported ? L("You reported this post before. Our team will review it.", "আপনি আগেই এই পোস্টটি রিপোর্ট করেছেন। আমাদের টিম দেখবে।") : L("Thanks. Our team will review this post.", "ধন্যবাদ। আমাদের টিম পোস্টটি দেখবে।"),
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const relation = (kind: "mute" | "block") => {
    const authorId = post.author.id;
    if (!authorId) return;
    const title = kind === "mute" ? L(`Mute ${post.author.name}?`, `${post.author.name}-কে মিউট করবেন?`) : L(`Block ${post.author.name}?`, `${post.author.name}-কে ব্লক করবেন?`);
    const body =
      kind === "mute"
        ? L("You won't see their posts in your feed. They won't be told.", "তাঁর পোস্ট আপনার ফিডে আর দেখাবে না। তিনি জানবেন না।")
        : L("You won't see each other's posts and can't message each other.", "আপনারা কেউ কারও পোস্ট দেখবেন না, মেসেজও করতে পারবেন না।");
    Alert.alert(title, body, [
      { text: L("Cancel", "বাতিল"), style: "cancel" },
      {
        text: kind === "mute" ? L("Mute", "মিউট") : L("Block", "ব্লক"),
        style: "destructive",
        onPress: async () => {
          const token = needToken();
          if (!token) return;
          setBusy(true);
          try {
            await setUserRelation(token, kind, authorId, true);
            onAuthorHidden(authorId, kind);
            onClose();
          } catch (e) {
            fail(e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const requestQuote = () => {
    if (!post.author.id) return;
    if (!needToken()) return;
    const excerpt = post.content.trim().replace(/\s+/g, " ").slice(0, 120);
    const draft = bn
      ? `আসসালামু আলাইকুম, আপনার পোস্টটি দেখলাম${excerpt ? `: "${excerpt}"` : ""}। দাম, পরিমাণ আর ডেলিভারির বিস্তারিত জানাবেন?`
      : `Hi, I saw your post${excerpt ? `: "${excerpt}"` : ""}. Could you send me a quote with price, quantity and delivery details?`;
    onClose();
    navigation.navigate("Chat", { conversationId: post.author.id, userName: post.author.name, userInitials: post.author.initials || "", draft });
  };

  type Item = { key: string; icon: keyof typeof Feather.glyphMap; label: string; danger?: boolean; onPress: () => void };
  const items: Item[] = isOwn
    ? [
        { key: "edit", icon: "edit-2", label: L("Edit post", "পোস্ট এডিট করুন"), onPress: () => setMode("edit") },
        { key: "delete", icon: "trash-2", label: L("Delete post", "পোস্ট মুছুন"), danger: true, onPress: confirmDelete },
      ]
    : [
        { key: "save", icon: "bookmark", label: post.isSaved ? L("Unsave post", "সেভ থেকে সরান") : L("Save post", "পোস্ট সেভ করুন"), onPress: () => { onToggleSave(); onClose(); } },
        { key: "quote", icon: "file-text", label: L("Request quote", "দাম জানতে চান"), onPress: requestQuote },
        { key: "mute", icon: "volume-x", label: L(`Mute ${post.author.name}`, `${post.author.name}-কে মিউট করুন`), onPress: () => relation("mute") },
        { key: "block", icon: "slash", label: L(`Block ${post.author.name}`, `${post.author.name}-কে ব্লক করুন`), danger: true, onPress: () => relation("block") },
        { key: "report", icon: "flag", label: L("Report post", "পোস্ট রিপোর্ট করুন"), danger: true, onPress: () => needToken() && setMode("report") },
      ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} accessibilityLabel={L("Close", "বন্ধ")} />
      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: Spacing.md }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        {mode === "menu" ? (
          items.map((it) => (
            <Pressable
              key={it.key}
              onPress={it.onPress}
              disabled={busy}
              accessibilityRole="button"
              testID={`post-menu-${it.key}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSecondary }]}
            >
              <AppIcon name={it.icon} size={20} color={it.danger ? theme.error : theme.text} />
              <ThemedText style={[styles.rowText, { color: it.danger ? theme.error : theme.text }]} numberOfLines={1}>
                {it.label}
              </ThemedText>
            </Pressable>
          ))
        ) : mode === "report" ? (
          <Animated.ScrollView style={reportListStyle} keyboardShouldPersistTaps="handled">
            <ThemedText style={[styles.title, { color: theme.text }]}>{L("Why are you reporting this post?", "কেন রিপোর্ট করছেন?")}</ThemedText>
            {REASONS.map((r) => (
              <Pressable key={r.id} testID={`report-reason-${r.id}`} onPress={() => setReason(r.id)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSecondary }]}>
                <AppIcon name={reason === r.id ? "check-circle" : "circle"} size={20} color={reason === r.id ? theme.primary : theme.textSecondary} />
                <ThemedText style={[styles.rowText, { color: theme.text }]}>{bn ? r.bn : r.en}</ThemedText>
              </Pressable>
            ))}
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={L("Add details (optional)", "বিস্তারিত লিখুন (ঐচ্ছিক)")}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={1000}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundRoot }]}
            />
            <Pressable testID="report-send" onPress={sendReport} disabled={!reason || busy} style={[styles.primaryBtn, { backgroundColor: theme.error, opacity: !reason || busy ? 0.5 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>{L("Send report", "রিপোর্ট পাঠান")}</ThemedText>}
            </Pressable>
          </Animated.ScrollView>
        ) : (
          <View>
            <ThemedText style={[styles.title, { color: theme.text }]}>{L("Edit post", "পোস্ট এডিট করুন")}</ThemedText>
            <AnimatedTextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              scrollEnabled
              autoFocus
              maxLength={5000}
              testID="edit-post-input"
              accessibilityLabel={L("Edit post", "পোস্ট এডিট করুন")}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundRoot }, editInputStyle]}
            />
            <Pressable testID="edit-post-save" onPress={saveEdit} disabled={!editText.trim() || busy} style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: !editText.trim() || busy ? 0.5 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryText}>{L("Save", "সেভ করুন")}</ThemedText>}
            </Pressable>
          </View>
        )}
        <ModalBottomInset />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md },
  rowText: { flex: 1, fontSize: 16, lineHeight: 24, fontFamily: FontFamily.medium },
  title: { fontSize: 17, lineHeight: 26, fontFamily: FontFamily.semibold, marginVertical: Spacing.sm },
  input: { borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 15, minHeight: 72, textAlignVertical: "top", marginTop: Spacing.sm },
  primaryBtn: { marginTop: Spacing.md, height: 48, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 16, lineHeight: 22, fontFamily: FontFamily.semibold },
});

export default PostActionsSheet;
