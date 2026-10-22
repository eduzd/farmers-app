import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  TextInput,
  FlatList,
  ScrollView,
  Platform,
  Alert,
  Modal,
  ActionSheetIOS,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from "react-native";
import Animated from "react-native-reanimated";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useVoiceRecorder, type FinishedRecording } from "@/hooks/useVoiceRecorder";
import { VoiceMessagePlayer, formatVoiceTime } from "@/components/VoiceMessagePlayer";
import { ChatPhoto } from "@/components/ChatPhoto";
import { PhotoViewer } from "@/components/PhotoViewer";
import { AppIcon } from "@/components/icons/AppIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { useSupportStatus } from "@/components/HelpButton";
import {
  fetchSupportThread,
  sendSupportText,
  sendSupportPhoto,
  sendSupportVoice,
  newClientId,
  rememberLocalPhoto,
  fetchAdminSupportThread,
  sendAdminSupportText,
  sendAdminSupportPhoto,
  sendAdminSupportVoice,
  type SupportMessage,
} from "@/lib/dmApi";
import { chatStyles as styles } from "@/screens/ChatScreen";

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 120;
const POLL_MS = 5000;

/** Ready-made messages the user can tap to send (they are sent as the user's own message). */
const QUICK_MESSAGES: { en: string; bn: string }[] = [
  { en: "I need help with my order", bn: "আমার অর্ডার নিয়ে সাহায্য দরকার" },
  { en: "My fish are dying, please help", bn: "আমার মাছ মারা যাচ্ছে, সাহায্য করুন" },
  { en: "I have a payment problem", bn: "পেমেন্টে সমস্যা হচ্ছে" },
  { en: "I want to talk to an expert", bn: "আমি একজন বিশেষজ্ঞের সাথে কথা বলতে চাই" },
  { en: "I can't sign in to my account", bn: "আমি অ্যাকাউন্টে সাইন ইন করতে পারছি না" },
  { en: "I want to advertise on Farmers", bn: "আমি Farmers-এ বিজ্ঞাপন দিতে চাই" },
  { en: "Something in the app isn't working", bn: "অ্যাপের একটি জিনিস কাজ করছে না" },
];

/** Ready-made replies for the admin side of the same conversation. */
const ADMIN_QUICK: { en: string; bn: string }[] = [
  { en: "Hello! How can we help you?", bn: "হ্যালো! আমরা কীভাবে সাহায্য করতে পারি?" },
  { en: "Thanks, we're checking this now.", bn: "ধন্যবাদ, আমরা এখনই দেখছি।" },
  { en: "Please send a photo of the problem.", bn: "সমস্যার একটি ছবি পাঠান।" },
  { en: "Your order is on the way.", bn: "আপনার অর্ডার পথে আছে।" },
  { en: "An expert will call you soon.", bn: "একজন বিশেষজ্ঞ শীঘ্রই আপনাকে কল করবেন।" },
  { en: "Is there anything else we can help with?", bn: "আর কিছুতে সাহায্য লাগবে?" },
];

/** Admin mode: the Farmers Admin app opens the same chat screen for one user's conversation. */
export type SupportChatAdmin = {
  threadId: string;
  userName: string;
  userAvatar?: string | null;
  onBack: () => void;
  onOpenUser?: () => void;
  headerRight?: React.ReactNode;
  onChanged?: () => void;
  /** Called with the conversation's details (user, status) each time it loads. */
  onMeta?: (t: NonNullable<Awaited<ReturnType<typeof fetchAdminSupportThread>>["thread"]>) => void;
};

type Item = {
  id: string;
  clientId: string | null;
  kind: "text" | "image" | "voice";
  text: string;
  mediaId?: string | null;
  localUri?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  fromAdmin: boolean;
  createdAt: string;
  status?: "sending" | "failed";
  replyTo?: { id: string; text: string; fromAdmin: boolean } | null;
  // what to upload again on "Tap to retry"
  photo?: { base64: string; mime: string; width?: number; height?: number };
};

const fromServer = (m: SupportMessage): Item => ({
  id: m.id,
  clientId: m.clientId,
  kind: m.kind || "text",
  text: m.body,
  mediaId: m.mediaId,
  width: m.width,
  height: m.height,
  durationMs: m.durationMs,
  fromAdmin: m.fromAdmin,
  createdAt: m.createdAt,
  replyTo: m.replyTo || null,
});

const timeOf = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Support: the user's own chat with the Farmers admins. Looks and works like a normal chat
 * (same bubbles, same composer with the plus for photos and the mic for voice messages),
 * plus ready-made messages to tap and send.
 */
export default function SupportChatScreen() {
  return <SupportConversation />;
}

export function SupportConversation({ admin }: { admin?: SupportChatAdmin }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const bn = useI18n((s) => s.language) === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const signedIn = useAuthStore((s) => !!(s.isAuthenticated && s.token));
  const adminsOnlineUser = useSupportStatus((s) => s.adminsOnline);
  const [userOnline, setUserOnline] = useState<boolean | null>(null);
  const [adminMeta, setAdminMeta] = useState<{ name: string; avatar?: string | null } | null>(null);
  const adminsOnline = admin ? userOnline : adminsOnlineUser;
  /** My own messages sit on the right: the user's in the app, the admins' in the admin app. */
  const mine = (m: { fromAdmin: boolean }) => (admin ? m.fromAdmin : !m.fromAdmin);

  const [server, setServer] = useState<Item[]>([]);
  const [pending, setPending] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  // Hold a message for Reply / Copy, the same menu as the main chat.
  const [selected, setSelected] = useState<Item | null>(null);
  const [replyingTo, setReplyingTo] = useState<Item | null>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!useAuthStore.getState().token) {
      setLoading(false);
      return;
    }
    try {
      if (admin) {
        const a = await fetchAdminSupportThread(admin.threadId);
        if (!alive.current) return;
        const list = (a.messages || []).map(fromServer);
        setServer(list);
        const seen = new Set(list.map((m) => m.clientId).filter(Boolean));
        setPending((p) => p.filter((m) => !m.clientId || !seen.has(m.clientId)));
        setUserOnline(typeof a.thread?.userOnline === "boolean" ? a.thread.userOnline : null);
        if (a.thread) {
          setAdminMeta({ name: a.thread.userName || a.thread.userUsername || "", avatar: a.thread.userAvatar });
          admin.onMeta?.(a.thread);
        }
        setLoadError(null);
        return;
      }
      const r = await fetchSupportThread();
      if (!alive.current) return;
      const list = (r.messages || []).map(fromServer);
      setServer(list);
      const seen = new Set(list.map((m) => m.clientId).filter(Boolean));
      setPending((p) => p.filter((m) => !m.clientId || !seen.has(m.clientId)));
      // Opening the chat marks the admin's replies as read on the server.
      useSupportStatus.getState().set({ unread: 0, ...(typeof r.adminsOnline === "boolean" ? { adminsOnline: r.adminsOnline } : {}) });
      setLoadError(null);
    } catch (e: any) {
      if (alive.current) setLoadError(e?.message || "error");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [admin?.threadId]);

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      load();
      const t = setInterval(load, POLL_MS);
      return () => {
        alive.current = false;
        clearInterval(t);
      };
    }, [load]),
  );

  // newest first (the list is inverted, like the normal chat)
  const messages = useMemo(() => {
    const all = [...server, ...pending];
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [server, pending]);

  const needSignIn = () => {
    Alert.alert(L("Sign in", "সাইন ইন"), L("Please sign in first so the Farmers team can reply to you.", "আগে সাইন ইন করুন, যাতে টিম আপনাকে উত্তর দিতে পারে।"));
  };

  const upload = async (item: Item) => {
    try {
      const cid = item.clientId || newClientId();
      const tid = admin?.threadId;
      const r =
        item.kind === "image" && item.photo
          ? await (tid ? sendAdminSupportPhoto(tid, item.photo, cid) : sendSupportPhoto(item.photo, cid))
          : item.kind === "voice" && item.localUri
            ? await (tid ? sendAdminSupportVoice(tid, item.localUri, item.durationMs || 0, cid) : sendSupportVoice(item.localUri, item.durationMs || 0, cid))
            : await (tid ? sendAdminSupportText(tid, item.text, cid, item.replyTo?.id) : sendSupportText(item.text, cid, item.replyTo?.id));
      const m = fromServer(r.message);
      if (m.mediaId && item.localUri && item.kind === "image") rememberLocalPhoto(m.mediaId, item.localUri);
      setServer((s) => (s.some((x) => x.id === m.id) ? s : [...s, m]));
      setPending((p) => p.filter((x) => x.id !== item.id));
      admin?.onChanged?.();
    } catch {
      setPending((p) => p.map((x) => (x.id === item.id ? { ...x, status: "failed" } : x)));
    }
  };

  const queue = (part: Omit<Item, "id" | "clientId" | "fromAdmin" | "createdAt" | "status">) => {
    if (!signedIn) {
      needSignIn();
      return;
    }
    const cid = newClientId();
    const item: Item = { ...part, id: `local-${cid}`, clientId: cid, fromAdmin: !!admin, createdAt: new Date().toISOString(), status: "sending" };
    setPending((p) => [...p, item]);
    upload(item);
  };

  const retry = (item: Item) => {
    setPending((p) => p.map((x) => (x.id === item.id ? { ...x, status: "sending" } : x)));
    upload({ ...item, status: "sending" });
  };

  const handleSend = (preset?: string) => {
    const text = (preset ?? inputText).trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (preset === undefined) {
      setInputText("");
      setInputHeight(MIN_INPUT_HEIGHT);
    }
    const rt = replyingTo && !replyingTo.id.startsWith("local-")
      ? { id: replyingTo.id, text: replyingTo.kind === "image" ? L("Photo", "ছবি") : replyingTo.kind === "voice" ? L("Voice message", "ভয়েস মেসেজ") : replyingTo.text, fromAdmin: replyingTo.fromAdmin }
      : null;
    setReplyingTo(null);
    queue({ kind: "text", text, replyTo: rt });
  };
  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setSelected(item);
  };
  const handleReply = () => {
    if (selected) setReplyingTo(selected);
    setSelected(null);
  };
  const handleCopy = () => {
    if (selected) Clipboard.setStringAsync(selected.text || "").catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelected(null);
  };
  const quoteName = (r: { fromAdmin: boolean }) => (mine(r) ? L("You", "আপনি") : admin ? admin.userName || L("User", "ইউজার") : supportName);

  // ---- voice ----
  const sendRecording = (r: FinishedRecording | null) => {
    if (!r) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    queue({ kind: "voice", text: "", localUri: r.uri, durationMs: r.durationMs });
  };
  const voice = useVoiceRecorder(sendRecording);
  const isRecording = voice.isRecording;
  const startRecording = async () => {
    if (!signedIn) return needSignIn();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await voice.start();
  };
  const stopRecording = async () => {
    const r = await voice.stop();
    if (!r) {
      Alert.alert(L("Voice message", "ভয়েস মেসেজ"), L("Hold on a little longer: the recording was too short.", "আরেকটু লম্বা করে রেকর্ড করুন: রেকর্ডিং খুব ছোট ছিল।"));
      return;
    }
    sendRecording(r);
  };
  const cancelRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    voice.cancel();
  };

  // ---- photos (same flow as the normal chat: shrink to 1600px JPEG, show at once, upload) ----
  const sendImage = async (uri: string, w?: number, h?: number) => {
    setShowMediaMenu(false);
    if (!signedIn) return needSignIn();
    try {
      const longest = Math.max(w || 0, h || 0);
      const resize = longest > 1600 ? [w! >= h! ? { resize: { width: 1600 } } : { resize: { height: 1600 } }] : [];
      const out = await ImageManipulator.manipulateAsync(uri, resize as any, { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!out.base64) throw new Error("no image data");
      queue({
        kind: "image",
        text: "",
        localUri: out.uri,
        width: out.width,
        height: out.height,
        photo: { base64: out.base64, mime: "image/jpeg", width: out.width, height: out.height },
      });
    } catch {
      Alert.alert(L("Photo not sent", "ছবি পাঠানো হয়নি"), L("Couldn't open that photo. Please try another one.", "ছবিটি খোলা যায়নি। অন্য একটি চেষ্টা করুন।"));
    }
  };
  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(L("Permission needed", "অনুমতি প্রয়োজন"), L("Allow camera access to take a photo.", "ক্যামেরা ব্যবহার করতে অনুমতি দিন।"));
        return;
      }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      if (!r.canceled && r.assets[0]) sendImage(r.assets[0].uri, r.assets[0].width, r.assets[0].height);
    } catch {
      Alert.alert(L("Error", "ত্রুটি"), L("Couldn't open the camera.", "ক্যামেরা খুলতে সমস্যা হয়েছে।"));
    }
  };
  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(L("Permission needed", "অনুমতি প্রয়োজন"), L("Allow photo access to pick a photo.", "গ্যালারি ব্যবহার করতে অনুমতি দিন।"));
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      if (!r.canceled && r.assets[0]) sendImage(r.assets[0].uri, r.assets[0].width, r.assets[0].height);
    } catch {
      Alert.alert(L("Error", "ত্রুটি"), L("Couldn't open the gallery.", "গ্যালারি খুলতে সমস্যা হয়েছে।"));
    }
  };
  const handleMediaButton = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!signedIn) return needSignIn();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [L("Cancel", "বাতিল"), L("Camera", "ক্যামেরা"), L("Gallery", "গ্যালারি")], cancelButtonIndex: 0, title: L("Send a photo", "ছবি পাঠান") },
        (i) => (i === 1 ? openCamera() : i === 2 ? openGallery() : undefined),
      );
    } else {
      setShowMediaMenu(true);
    }
  };

  const composerPadding = useKeyboardAwareBottomPadding(Spacing.sm);
  const handleContentSizeChange = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setInputHeight(Math.min(Math.max(e.nativeEvent.contentSize.height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT));
  };

  const supportName = admin ? admin.userName || adminMeta?.name || L("User", "ব্যবহারকারী") : L("Support", "সাপোর্ট");
  const otherAvatar = admin ? admin.userAvatar || adminMeta?.avatar || undefined : undefined;
  const presence: "online" | "offline" | null = adminsOnline === null ? null : adminsOnline ? "online" : "offline";
  const headerStatus = admin
    ? presence === "online"
      ? L("Online", "অনলাইন")
      : L("Offline · they'll see it in Support", "অফলাইন · সাপোর্টে দেখতে পাবেন")
    : !signedIn
    ? L("Sign in to chat with us", "চ্যাট করতে সাইন ইন করুন")
    : presence === "online"
      ? L("Online", "অনলাইন")
      : presence === "offline"
        ? L("Offline · we'll reply here", "অফলাইন · আমরা এখানে উত্তর দেব")
        : L("Farmers team", "Farmers টিম");

  const renderStatus = (item: Item, isLastInGroup: boolean) => {
    if (!mine(item)) return null;
    if (item.status === "failed") {
      return (
        <Pressable onPress={() => retry(item)} hitSlop={8} accessibilityRole="button" testID="support-retry">
          <ThemedText style={[styles.seenStatus, { color: theme.error || "#D32F2F" }]}>{L("Not sent · Tap to retry", "পাঠানো হয়নি · আবার চেষ্টা করতে ট্যাপ করুন")}</ThemedText>
        </Pressable>
      );
    }
    if (item.status === "sending") return <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>{L("Sending…", "পাঠানো হচ্ছে…")}</ThemedText>;
    if (!isLastInGroup) return null;
    return <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>{L("Sent", "পাঠানো হয়েছে")}</ThemedText>;
  };

  const renderMessage = ({ item, index }: { item: Item; index: number }) => {
    const isMe = mine(item);
    const showTime = index === messages.length - 1 || messages[index + 1].fromAdmin !== item.fromAdmin;
    const isLastInGroup = index === 0 || messages[index - 1].fromAdmin !== item.fromAdmin;
    const showAvatar = !isMe && isLastInGroup;
    let body: React.ReactNode;
    if (item.kind === "voice" && (item.mediaId || item.localUri)) {
      body = (
        <View style={[styles.voiceMessageBubble, isMe ? { backgroundColor: theme.primary } : { backgroundColor: theme.surface }]}>
          <VoiceMessagePlayer
            mediaId={item.mediaId}
            localUri={item.localUri}
            durationMs={item.durationMs ?? null}
            isMe={isMe}
            tint={isMe ? theme.white : theme.primary}
            trackColor={isMe ? "rgba(255,255,255,0.35)" : theme.primary + "30"}
            textColor={isMe ? theme.white : theme.textSecondary}
          />
        </View>
      );
    } else if (item.kind === "image" && (item.mediaId || item.localUri)) {
      body = (
        <ChatPhoto
          localUri={item.localUri}
          mediaId={item.mediaId}
          width={item.width}
          height={item.height}
          onOpen={(uri) => setViewerPhoto(uri)}
        />
      );
    } else {
      body = (
        <View style={[styles.messageBubble, isMe ? [styles.myBubble, { backgroundColor: theme.primary }] : [styles.theirBubble, { backgroundColor: theme.surface }]]}>
          <ThemedText style={[styles.messageText, { color: isMe ? theme.white : theme.text }]}>{item.text}</ThemedText>
        </View>
      );
    }
    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]} testID={item.fromAdmin ? "support-msg-admin" : "support-msg-me"}>
        {!isMe ? (
          <View style={styles.avatarSpace}>{showAvatar ? <UserAvatar name={supportName} avatar={otherAvatar} size="small" presence={presence} /> : null}</View>
        ) : null}
        <Pressable style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]} onLongPress={() => handleLongPress(item)} delayLongPress={300} testID="support-msg-hold">
          {item.replyTo ? (
            <View style={[styles.replyPreview, { backgroundColor: theme.backgroundSecondary }]} testID="support-msg-quote">
              <ThemedText style={[styles.replyName, { color: theme.primary }]}>{quoteName(item.replyTo)}</ThemedText>
              <ThemedText style={[styles.replyText, { color: theme.textSecondary }]} numberOfLines={1}>{item.replyTo.text}</ThemedText>
            </View>
          ) : null}
          <View style={styles.bubbleWrapper}>{body}</View>
          <View style={styles.messageFooter}>
            {showTime ? <ThemedText style={[styles.messageTime, { color: theme.textSecondary }, isMe && styles.myTime]}>{timeOf(item.createdAt)}</ThemedText> : null}
            {renderStatus(item, isLastInGroup)}
          </View>
        </Pressable>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState} testID="support-empty">
      <View style={[styles.emptyAvatar, { backgroundColor: theme.primary }]}>
        <Feather name="life-buoy" size={30} color="#fff" />
      </View>
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>{supportName}</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {loading
          ? L("Loading messages…", "মেসেজ আসছে…")
          : admin
            ? L("No messages yet. Write the first one below.", "এখনো কোনো মেসেজ নেই। নিচে প্রথমটি লিখুন।")
          : !signedIn
            ? L("Sign in to chat with the Farmers team.", "Farmers টিমের সাথে চ্যাট করতে সাইন ইন করুন।")
            : L("How can we help? Tap a message below or write your own.", "আমরা কীভাবে সাহায্য করতে পারি? নিচের একটি মেসেজে ট্যাপ করুন বা নিজে লিখুন।")}
      </ThemedText>
    </View>
  );

  const banner = loadError && signedIn && !loading ? L("Can't reach the server. Tap to try again.", "সার্ভারে পৌঁছানো যাচ্ছে না। আবার চেষ্টা করতে ট্যাপ করুন।") : null;
  const showQuick = !isRecording && !inputText.trim();

  return (
    <KeyboardAvoidingScreen style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.customHeader, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]} testID="support-chat">
        <Pressable style={styles.backButton} onPress={() => (admin ? admin.onBack() : navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Main"))} testID="support-back" accessibilityRole="button" accessibilityLabel={L("Back", "পিছনে")}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Pressable style={styles.headerTitleContainer} disabled={!admin?.onOpenUser} onPress={admin?.onOpenUser} testID="support-header-user">
          <View style={styles.headerAvatarContainer}>
            <UserAvatar name={supportName} avatar={otherAvatar} size={36} presence={signedIn ? presence : null} />
          </View>
          <View style={styles.headerInfo}>
            <ThemedText style={[styles.headerName, { color: theme.text }]} numberOfLines={1} testID="support-title">{supportName}</ThemedText>
            <ThemedText style={[styles.headerStatus, { color: theme.textSecondary }]} numberOfLines={1} testID="support-status">{headerStatus}</ThemedText>
          </View>
        </Pressable>
        {admin?.headerRight ?? null}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        inverted={messages.length > 0}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[styles.listContent, { paddingTop: Spacing.md, paddingBottom: Spacing.sm }, messages.length === 0 && styles.emptyListContent]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <Animated.View style={[styles.bottomBar, { backgroundColor: theme.backgroundRoot }, composerPadding]}>
        {banner ? (
          <Pressable onPress={load} style={[styles.chatBanner, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}>
            <AppIcon name="wifi-off" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.chatBannerText, { color: theme.textSecondary }]}>{banner}</ThemedText>
          </Pressable>
        ) : null}
        {showQuick ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 2 }}
            testID="support-quick"
          >
            {(admin ? ADMIN_QUICK : QUICK_MESSAGES).map((q, i) => (
              <Pressable
                key={q.en}
                onPress={() => handleSend(bn ? q.bn : q.en)}
                accessibilityRole="button"
                accessibilityLabel={L(`Send: ${q.en}`, `পাঠান: ${q.bn}`)}
                testID={`support-quick-${i}`}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  height: 34,
                  borderRadius: 17,
                  justifyContent: "center",
                  backgroundColor: pressed ? theme.primary + "30" : theme.primary + "18",
                })}
              >
                <ThemedText style={{ color: theme.primary, fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>
                  {bn ? q.bn : q.en}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {replyingTo ? (
          <View style={[styles.replyBar, { backgroundColor: theme.surface, borderTopColor: theme.divider }]} testID="support-reply-bar">
            <View style={styles.replyBarContent}>
              <View style={[styles.replyIndicator, { backgroundColor: theme.primary }]} />
              <View style={styles.replyInfo}>
                <ThemedText style={[styles.replyBarName, { color: theme.primary }]}>{L("Replying to", "উত্তর দিচ্ছেন")} {quoteName(replyingTo)}</ThemedText>
                <ThemedText style={[styles.replyBarText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {replyingTo.kind === "image" ? L("Photo", "ছবি") : replyingTo.kind === "voice" ? L("Voice message", "ভয়েস মেসেজ") : replyingTo.text}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} style={styles.replyCloseButton} accessibilityLabel={L("Cancel reply", "উত্তর বাতিল")} testID="support-reply-cancel">
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot }]}>
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <Pressable style={styles.iconButton} onPress={cancelRecording} hitSlop={8} accessibilityRole="button" accessibilityLabel={L("Cancel voice message", "ভয়েস মেসেজ বাতিল")}>
                <Feather name="trash-2" size={22} color={theme.error} />
              </Pressable>
              <View style={[styles.recordingIndicator, { backgroundColor: "#DC2626" }]} />
              <ThemedText style={[styles.recordingText, { color: theme.text }]}>
                {formatVoiceTime(voice.durationMs)}
                <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {voice.durationMs > 100000 ? `  ${L("max", "সর্বোচ্চ")} 2:00` : `  ${L("Recording…", "রেকর্ড হচ্ছে…")}`}
                </ThemedText>
              </ThemedText>
              <Pressable style={[styles.iconButton, styles.sendButton, { backgroundColor: theme.primary }]} onPress={stopRecording} accessibilityRole="button" accessibilityLabel={L("Send voice message", "ভয়েস মেসেজ পাঠান")}>
                <MaterialCommunityIcons name="send" size={20} color={theme.white} />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable style={styles.iconButton} onPress={handleMediaButton} accessibilityRole="button" accessibilityLabel={L("Send a photo", "ছবি পাঠান")} testID="support-plus">
                <MaterialCommunityIcons name="plus-circle-outline" size={28} color={theme.primary} />
              </Pressable>
              <View style={[styles.textInputWrapper, { backgroundColor: theme.surface }]}>
                <TextInput
                  testID="support-input"
                  style={[styles.textInput, { color: theme.text, height: inputHeight }]}
                  placeholder={L("Type a message...", "মেসেজ লিখুন...")}
                  placeholderTextColor={theme.textSecondary}
                  value={inputText}
                  onChangeText={setInputText}
                  onContentSizeChange={handleContentSizeChange}
                  multiline
                  maxLength={2000}
                  onKeyPress={(e: any) => {
                    if (Platform.OS === "web" && e?.nativeEvent?.key === "Enter" && !e?.nativeEvent?.shiftKey) {
                      e.preventDefault?.();
                      handleSend();
                    }
                  }}
                />
              </View>
              {inputText.trim() ? (
                <Pressable style={[styles.iconButton, styles.sendButton, { backgroundColor: theme.primary }]} onPress={() => handleSend()} accessibilityRole="button" accessibilityLabel={L("Send message", "মেসেজ পাঠান")} testID="support-send">
                  <MaterialCommunityIcons name="send" size={20} color={theme.white} />
                </Pressable>
              ) : (
                <Pressable style={[styles.iconButton, styles.micButton, { backgroundColor: theme.primary }]} onPress={startRecording} accessibilityRole="button" accessibilityLabel={L("Record voice message", "ভয়েস মেসেজ রেকর্ড করুন")} testID="support-mic">
                  <MaterialCommunityIcons name="microphone" size={22} color={theme.white} />
                </Pressable>
              )}
            </>
          )}
        </View>
      </Animated.View>

      <PhotoViewer images={viewerPhoto ? [viewerPhoto] : []} visible={!!viewerPhoto} onClose={() => setViewerPhoto(null)} />
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View style={styles.instagramReactionContainer}>
            <View style={[styles.messageActionsMenu, { backgroundColor: theme.surface }]} testID="support-msg-menu">
              {selected && !selected.id.startsWith("local-") ? (
                <Pressable style={styles.menuItem} onPress={handleReply} testID="support-menu-reply">
                  <Feather name="corner-up-left" size={22} color={theme.text} />
                  <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{L("Reply", "উত্তর")}</ThemedText>
                </Pressable>
              ) : null}
              {selected?.kind === "text" ? (
                <Pressable style={styles.menuItem} onPress={handleCopy} testID="support-menu-copy">
                  <Feather name="copy" size={22} color={theme.text} />
                  <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{L("Copy", "কপি")}</ThemedText>
                </Pressable>
              ) : null}
              {selected?.status === "failed" ? (
                <Pressable style={styles.menuItem} onPress={() => { const it = selected; setSelected(null); if (it) retry(it); }}>
                  <Feather name="rotate-cw" size={22} color={theme.text} />
                  <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{L("Try again", "আবার চেষ্টা")}</ThemedText>
                </Pressable>
              ) : null}
              <Pressable style={styles.menuItem} onPress={() => setSelected(null)}>
                <Feather name="x" size={22} color={theme.text} />
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{L("Close", "বন্ধ")}</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
      <Modal visible={showMediaMenu} transparent animationType="fade" onRequestClose={() => setShowMediaMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMediaMenu(false)}>
          <View style={[styles.mediaMenuContainer, { backgroundColor: theme.surface }]}>
            <ThemedText type="h4" style={[styles.mediaMenuTitle, { color: theme.text }]}>{L("Send a photo", "ছবি পাঠান")}</ThemedText>
            <View style={styles.mediaMenuOptions}>
              <Pressable style={[styles.mediaOption, { backgroundColor: theme.backgroundDefault }]} onPress={() => { setShowMediaMenu(false); openCamera(); }} testID="support-camera">
                <View style={[styles.mediaOptionIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="camera" size={24} color={theme.primary} />
                </View>
                <ThemedText style={[styles.mediaOptionText, { color: theme.text }]}>{L("Camera", "ক্যামেরা")}</ThemedText>
              </Pressable>
              <Pressable style={[styles.mediaOption, { backgroundColor: theme.backgroundDefault }]} onPress={() => { setShowMediaMenu(false); openGallery(); }} testID="support-gallery">
                <View style={[styles.mediaOptionIcon, { backgroundColor: theme.success + "20" }]}>
                  <Feather name="image" size={24} color={theme.success} />
                </View>
                <ThemedText style={[styles.mediaOptionText, { color: theme.text }]}>{L("Gallery", "গ্যালারি")}</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingScreen>
  );
}
