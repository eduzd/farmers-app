import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  Platform,
  Modal,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  ActionSheetIOS,
  ActivityIndicator,
  AppState,
  Linking,
  Animated as RNAnimated,
  Text,
} from "react-native";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import Animated from "react-native-reanimated";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useIsOnline } from "@/lib/liveStatus";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@/lib/authStore";
import { refreshUnreadCounts } from "@/lib/liveStatus";
import {
  fetchMessages,
  fetchReactions,
  setReaction as saveReaction,
  clearReaction,
  sendText,
  sendVoice,
  sendImage,
  rememberLocalPhoto,
  fetchContact,
  newClientId,
  onLiveDm,
  onLiveReaction,
  type DmReaction,
  rememberLocalVoice,
  type DmMessage,
} from "@/lib/dmApi";
import { useVoiceRecorder, type FinishedRecording } from "@/hooks/useVoiceRecorder";
import { VoiceMessagePlayer, formatVoiceTime } from "@/components/VoiceMessagePlayer";
import { ChatPhoto } from "@/components/ChatPhoto";
import { PhotoViewer } from "@/components/PhotoViewer";
import * as ImageManipulator from "expo-image-manipulator";

import { useOptionalVoiceCall } from "@/contexts/VoiceCallContext";
import { tr, useTr } from "@/lib/tr";

import { AppIcon } from "@/components/icons/AppIcon";
type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;

interface Message {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
  type: "text" | "voice" | "image";
  duration?: number;
  durationMs?: number;
  mediaId?: string | null;
  localUri?: string; // my own recording, before/after upload
  imageUri?: string; // my own photo on this phone, before/after upload
  photo?: { base64: string; mime: string; width?: number; height?: number }; // what gets uploaded
  width?: number;
  height?: number;
  replyTo?: { id: string; text: string; isMe: boolean };
  reactions?: string[];
  superReact?: boolean;
  seen?: boolean;
  createdAt?: string; // server time; missing while my message is still sending
  clientId?: string;
  status?: "sending" | "sent" | "failed";
}

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 120;

export default function ChatScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  
  const userName = route.params.userName;
  const userInitials = route.params.userInitials;
  const conversationId = route.params.conversationId;
  const isWelfareMember = route.params.isWelfareMember;
  const authUser = useAuthStore((st) => st.user);
  const getToken = useAuthStore((st) => st.getToken);
  const signedIn = !!authUser && !!getToken();

  // "checking": asking the server whether this person has an account.
  // "live": real chat, messages go through the server (/api/dm).
  // "noAccount": a sample person; nothing can be sent. "guest": not signed in.
  const [mode, setMode] = useState<"checking" | "live" | "noAccount" | "guest">(() =>
    !signedIn ? "guest" : conversationId === authUser?.id ? "noAccount" : "checking"
  );
  const isLive = mode === "live";
  const [otherId, setOtherId] = useState<string>(conversationId);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]); // newest first for the inverted list
  // A draft passed in (e.g. "Request quote" from a post) is put in the box for the user to edit and send.
  const [inputText, setInputText] = useState(route.params.draft ?? "");
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  // messageId -> userId -> reaction, as stored on the server (both people see them)
  const [reactionMap, setReactionMap] = useState<Record<string, Record<string, { emoji: string; super: boolean }>>>({});
  const [superBurst, setSuperBurst] = useState<string | null>(null);
  const burstAnim = useRef(new RNAnimated.Value(0)).current;
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [calling, setCalling] = useState(false);
  const voiceCall = useOptionalVoiceCall();
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const lastServerAt = useRef<string | null>(null);
  const seenUntil = useRef<string | null>(null);
  const fetching = useRef(false);
  const otherIdRef = useRef(conversationId);
  otherIdRef.current = otherId;
  // Presence only for a real account (live chat), never for a sample or not-yet-joined contact.
  const liveOtherId = mode === "live" ? otherId : undefined;
  const otherOnline = useIsOnline(liveOtherId);

  const clock = (iso?: string | null) =>
    (iso ? new Date(iso) : new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const toMessage = (m: DmMessage): Message => ({
    id: m.id,
    text: m.kind === "voice" || m.kind === "image" ? "" : m.content,
    isMe: m.isMe,
    time: clock(m.createdAt),
    type: m.kind === "voice" ? "voice" : m.kind === "image" ? "image" : "text",
    mediaId: m.mediaId,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    durationMs: m.durationMs ?? undefined,
    createdAt: m.createdAt,
    seen: !!m.readAt,
    status: "sent",
  });

  /** Merge server messages into the list (newest first), replacing my pending copies. */
  const mergeServer = useCallback((incoming: DmMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) {
        const old = byId.get(m.id);
        const next = toMessage(m);
        // keep the local recording so my own voice message plays without a download
        if (old?.localUri) next.localUri = old.localUri;
        if (old?.imageUri) next.imageUri = old.imageUri; // my photo shows from the phone, no download
        byId.set(m.id, old ? { ...old, ...next, reactions: old.reactions } : next);
      }
      return [...byId.values()].sort((a, b) => {
        const ta = a.createdAt || "9999", tb = b.createdAt || "9999"; // unsent ones stay at the bottom
        return ta < tb ? 1 : ta > tb ? -1 : a.id < b.id ? 1 : -1;
      });
    });
  }, []);

  const applySeen = useCallback((until: string | null) => {
    if (!until || until === seenUntil.current) return;
    seenUntil.current = until;
    setMessages((prev) => prev.map((m) => (m.isMe && m.createdAt && m.createdAt <= until && !m.seen ? { ...m, seen: true } : m)));
  }, []);

  const fetchLive = useCallback(async () => {
    if (mode === "guest" || mode === "noAccount" || fetching.current) return;
    fetching.current = true;
    try {
      const page = await fetchMessages(otherIdRef.current, lastServerAt.current);
      setLoadError(false);
      if (!page.hasAccount || !page.otherId) {
        setMode("noAccount");
        return;
      }
      if (page.otherId !== otherIdRef.current) setOtherId(page.otherId);
      setMode("live");
      // Only messages that came from the server move the "since" marker, so a message
      // the other person sent while mine was in flight is never skipped.
      const newest = page.messages[page.messages.length - 1];
      if (newest) lastServerAt.current = newest.createdAt;
      mergeServer(page.messages);
      applySeen(page.seenUntil);
      // Opening the chat marks their messages read on the server, so update the Messages badge.
      if (page.messages.some((m: any) => m.senderId === page.otherId)) refreshUnreadCounts();
    } catch (e: any) {
      setLoadError(true);
      if (e?.status === 401) setMode("guest");
    } finally {
      fetching.current = false;
    }
  }, [mode, mergeServer, applySeen]);

  // Poll every 4 s while the chat is open and the app is in front; the live socket
  // (when connected) makes new messages appear at once.
  useEffect(() => {
    if (mode === "guest" || mode === "noAccount") return;
    fetchLive();
    let appActive = AppState.currentState === "active";
    const t = setInterval(() => {
      if (appActive) fetchLive();
    }, 4000);
    const sub = AppState.addEventListener("change", (s) => {
      appActive = s === "active";
      if (appActive) fetchLive();
    });
    const off = onLiveDm((m) => {
      const o = otherIdRef.current;
      if (m.senderId === o || m.recipientId === o) fetchLive();
    });
    return () => {
      clearInterval(t);
      sub.remove();
      off();
    };
  }, [mode, fetchLive]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleViewProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(tr("Profile"), `Viewing ${userName}'s profile`);
  };

  const dial = async (phone: string) => {
    const number = phone.replace(/[^\d+]/g, "");
    const url = `tel:${number}`;
    try {
      if (Platform.OS !== "web" && !(await Linking.canOpenURL(url))) throw new Error("no dialer");
      await Linking.openURL(url);
    } catch {
      Alert.alert(tr("Call"), `${userName}: ${phone}`, [{ text: "OK" }]);
    }
  };

  // The Call button opens the phone's dialer with the other person's number
  // (normal phone call from your SIM). The number comes from their shop, or from their
  // profile once you have dealt with each other (they messaged you, or you have an order).
  // Long-press on the phone button: an ordinary SIM call to their shared number.
  const handlePhoneCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mode === "guest") {
      Alert.alert(tr("Call"), tr("Please sign in to call or message people."));
      return;
    }
    if (mode === "noAccount") {
      Alert.alert(tr("Call"), `${userName} isn't on Farmers yet, so there's no number to call.`);
      return;
    }
    if (calling) return;
    setCalling(true);
    try {
      const c = await fetchContact(otherIdRef.current);
      if (c.phone) {
        Alert.alert(
          `${tr("Call")} ${c.name || userName}?`,
          `${c.phone}\n${c.phoneSource === "store" ? tr("Shop number") : tr("Phone number")} · ${tr("normal call charges from your SIM")}`,
          [
            { text: tr("Cancel"), style: "cancel" },
            { text: tr("Call"), onPress: () => dial(c.phone!) },
          ]
        );
      } else {
        Alert.alert(
          tr("No phone number"),
          `${c.name || userName} hasn't shared a phone number with you yet. Send a message or a voice message instead.`
        );
      }
    } catch (e: any) {
      Alert.alert(tr("Call"), e?.code === "OFFLINE" ? tr("No connection. Check your internet and try again.") : e?.message || tr("Couldn't get the phone number. Try again."));
    } finally {
      setCalling(false);
    }
  };

  // Phone button: an in-app voice call over the internet (WebRTC), no SIM charges.
  const handleVoiceCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mode === "guest") {
      Alert.alert(tr("Call"), tr("Please sign in to call or message people."));
      return;
    }
    if (mode === "noAccount") {
      Alert.alert(tr("Call"), `${userName} isn't on Farmers yet, so they can't get calls.`);
      return;
    }
    if (!voiceCall) {
      Alert.alert(tr("Call"), tr("Please sign in to call or message people."));
      return;
    }
    if (calling) return;
    let peerId = otherIdRef.current;
    let peerName = userName;
    let peerAvatar: string | null = null;
    // Product, shop or company chats point at the owner's account: look it up first.
    if (mode !== "live") {
      setCalling(true);
      try {
        const c: any = await fetchContact(otherIdRef.current);
        if (c?.userId) peerId = String(c.userId);
        if (c?.name) peerName = c.name;
        if (c?.avatar) peerAvatar = c.avatar;
      } catch {}
      setCalling(false);
    }
    void voiceCall.startCall(peerId, peerName, peerAvatar);
  };

  const markFailed = (id: string) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));

  /** Send (or re-send) one of my pending messages. The clientId makes retries safe. */
  const deliver = async (msg: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m)));
    try {
      const sent =
        msg.type === "voice"
          ? await sendVoice(otherIdRef.current, msg.localUri!, msg.durationMs || 0, msg.clientId!)
          : msg.type === "image"
            ? await sendImage(otherIdRef.current, msg.photo!, msg.clientId!)
            : await sendText(otherIdRef.current, msg.text, msg.clientId!);
      if (msg.type === "voice" && sent.mediaId && msg.localUri) rememberLocalVoice(sent.mediaId, msg.localUri);
      if (msg.type === "image" && sent.mediaId && msg.imageUri) rememberLocalPhoto(sent.mediaId, msg.imageUri);
      // the server id is dm-<clientId>, the same id as the pending copy
      mergeServer([sent]);
    } catch (e: any) {
      markFailed(msg.id);
      if (e?.code === "NO_ACCOUNT") setMode("noAccount");
      else if (e?.status && e.status !== 0 && e.status < 500 && e.code !== "OFFLINE") {
        Alert.alert(tr("Message not sent"), e.message || tr("Please try again."));
      }
    }
  };

  const queue = (draft: Omit<Message, "id" | "isMe" | "time" | "status" | "clientId">) => {
    const clientId = newClientId();
    const msg: Message = { ...draft, id: `dm-${clientId}`, clientId, isMe: true, time: clock(), status: "sending" } as Message;
    setMessages((prev) => [msg, ...prev]);
    deliver(msg);
  };

  const retry = (msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(tr("Message not sent"), tr("Check your connection, then try again."), [
      { text: tr("Delete"), style: "destructive", onPress: () => setMessages((p) => p.filter((m) => m.id !== msg.id)) },
      { text: tr("Try again"), onPress: () => deliver(msg) },
    ]);
  };

  const blockedReason = () =>
    mode === "guest"
      ? tr("Please sign in to send messages.")
      : mode === "noAccount"
        ? `${userName} isn't on Farmers yet, so they can't get messages.`
        : tr("Connecting… try again in a moment.");

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    if (!isLive) {
      Alert.alert(tr("Message not sent"), blockedReason());
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");
    const replyTo = replyingTo ? { id: replyingTo.id, text: replyingTo.text || (replyingTo.type === "image" ? tr("Photo") : tr("Voice message")), isMe: replyingTo.isMe } : undefined;
    setReplyingTo(null);
    queue({ text, type: "text", seen: false, replyTo });
  };

  const sendRecording = (r: FinishedRecording | null) => {
    if (!r) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    queue({ text: "", type: "voice", localUri: r.uri, durationMs: r.durationMs, seen: false });
  };

  const voice = useVoiceRecorder(sendRecording); // auto-sends when the 2-minute limit is reached
  const isRecording = voice.isRecording;

  const startRecording = async () => {
    if (!isLive) {
      Alert.alert(tr("Voice message"), blockedReason());
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await voice.start();
  };

  const stopRecording = async () => {
    const r = await voice.stop();
    if (!r) {
      Alert.alert(tr("Voice message"), tr("Hold on a little longer: the recording was too short."));
      return;
    }
    sendRecording(r);
  };

  const cancelRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    voice.cancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const myUserId = authUser?.id ? String(authUser.id) : "me";

  // My reactions that are still being saved: messageId -> what I picked (null = removed).
  // A refresh that lands before the save finishes must not wipe them off the screen.
  const pendingReactions = useRef<Map<string, { emoji: string; super: boolean } | null>>(new Map());

  /** Put one reaction (from the server, the socket or me) into the map. */
  const applyReaction = useCallback((r: DmReaction) => {
    setReactionMap((prev) => {
      const forMsg = { ...(prev[r.messageId] || {}) };
      if (r.emoji) forMsg[r.userId] = { emoji: r.emoji, super: !!r.super };
      else delete forMsg[r.userId];
      return { ...prev, [r.messageId]: forMsg };
    });
  }, []);

  /** Apply my reaction locally at once, then save it so the other person sees it too. */
  const reactTo = useCallback(
    (message: Message, emoji: string, isSuper: boolean) => {
      const current = reactionMap[message.id]?.[myUserId];
      const removing = !isSuper && current?.emoji === emoji && !current.super;
      const mine = removing ? null : { emoji, super: isSuper };
      applyReaction({ messageId: message.id, userId: myUserId, emoji: mine?.emoji ?? null, super: !!mine?.super });
      if (isSuper) {
        setSuperBurst(emoji);
        burstAnim.setValue(0);
        RNAnimated.sequence([
          RNAnimated.spring(burstAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
          RNAnimated.delay(450),
          RNAnimated.timing(burstAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(() => setSuperBurst(null));
      }
      // Only messages already on the server can carry a shared reaction.
      if (mode === "live" && message.status === "sent") {
        pendingReactions.current.set(message.id, mine);
        const call = removing ? clearReaction(message.id) : saveReaction(message.id, emoji, isSuper);
        call
          .then((saved) => {
            if (pendingReactions.current.get(message.id) === mine) pendingReactions.current.delete(message.id);
            // Skip if I already picked something newer for this message.
            if (saved && saved.messageId && !pendingReactions.current.has(message.id)) {
              applyReaction({ ...saved, userId: myUserId });
            }
          })
          .catch(() => {
            // Not saved: put back what I had before, and say so.
            if (pendingReactions.current.get(message.id) === mine) pendingReactions.current.delete(message.id);
            applyReaction({ messageId: message.id, userId: myUserId, emoji: current?.emoji ?? null, super: !!current?.super });
            Alert.alert(tr("Reaction"), tr("Couldn't save your reaction. Check your internet and try again."));
          });
      }
    },
    [reactionMap, myUserId, mode, burstAnim, applyReaction],
  );

  const handleDoubleTap = useCallback((message: Message) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === message.id && now - lastTapRef.current.time < 300) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      reactTo(message, "❤️", false);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: message.id, time: now };
    }
  }, [reactTo]);

  const handleLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedMessage(message);
    setShowReactionPicker(true);
  };

  const handleReaction = (reaction: string, isSuper = false) => {
    if (!selectedMessage) return;
    Haptics.impactAsync(isSuper ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
    reactTo(selectedMessage, reaction, isSuper);
    setShowReactionPicker(false);
    setSelectedMessage(null);
  };

  // Load reactions for the messages on screen, and refresh them while the chat is open.
  const serverIdsKey = messages
    .filter((m) => m.status === "sent")
    .slice(0, 200)
    .map((m) => m.id)
    .join(",");
  useEffect(() => {
    if (mode !== "live" || !serverIdsKey) return;
    let alive = true;
    const load = () => {
      const ids = serverIdsKey.split(",");
      fetchReactions(ids)
        .then((list) => {
          if (!alive) return;
          const asked = new Set(ids);
          setReactionMap((prev) => {
            // Keep reactions on messages the server wasn't asked about (e.g. not sent yet).
            const next: Record<string, Record<string, { emoji: string; super: boolean }>> = {};
            for (const [id, v] of Object.entries(prev)) if (!asked.has(id)) next[id] = v;
            for (const r of list) {
              if (!r.emoji) continue;
              (next[r.messageId] ||= {})[r.userId] = { emoji: r.emoji, super: !!r.super };
            }
            // My reactions still being saved win over what the server had a moment ago.
            pendingReactions.current.forEach((mine, id) => {
              const forMsg = { ...(next[id] || {}) };
              if (mine) forMsg[myUserId] = mine;
              else delete forMsg[myUserId];
              next[id] = forMsg;
            });
            return next;
          });
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    // The other person's reaction shows at once over the live connection.
    const off = onLiveReaction((r) => {
      if (!alive || !r?.messageId || !serverIdsKey.split(",").includes(r.messageId)) return;
      if (String(r.userId) === myUserId && pendingReactions.current.has(r.messageId)) return;
      applyReaction({ ...r, userId: String(r.userId) });
    });
    return () => {
      alive = false;
      clearInterval(t);
      off();
    };
  }, [mode, serverIdsKey, myUserId, applyReaction]);

  const shownMessages = useMemo(
    () =>
      messages.map((m) => {
        const r = reactionMap[m.id];
        if (!r) return m.reactions?.length ? { ...m, reactions: [] } : m;
        const list = Object.values(r);
        return { ...m, reactions: [...new Set(list.map((x) => x.emoji))], superReact: list.some((x) => x.super) };
      }),
    [messages, reactionMap],
  );

  const handleReply = () => {
    if (!selectedMessage) return;
    setReplyingTo(selectedMessage);
    setShowReactionPicker(false);
    setSelectedMessage(null);
  };

  const handleCopy = () => {
    if (!selectedMessage) return;
    Clipboard.setStringAsync(selectedMessage.text || "").catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setShowReactionPicker(false);
    setSelectedMessage(null);
  };

  const handleUnsend = () => {
    if (!selectedMessage || !selectedMessage.isMe) return;
    Alert.alert(tr("Unsend Message"), tr("Are you sure you want to unsend this message?"), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unsend",
        style: "destructive",
        onPress: () => {
          setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
          setShowReactionPicker(false);
          setSelectedMessage(null);
        },
      },
    ]);
  };

  const handleMediaButton = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["বাতিল", "ক্যামেরা", "গ্যালারি"],
          cancelButtonIndex: 0,
          title: "ছবি পাঠান",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera();
          } else if (buttonIndex === 2) {
            openGallery();
          }
        }
      );
    } else {
      setShowMediaMenu(true);
    }
  };

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(tr("অনুমতি প্রয়োজন"), tr("ক্যামেরা ব্যবহার করতে অনুমতি দিন।"));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        sendImageMessage(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert(tr("ত্রুটি"), tr("ক্যামেরা খুলতে সমস্যা হয়েছে।"));
    }
  };

  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(tr("অনুমতি প্রয়োজন"), tr("গ্যালারি ব্যবহার করতে অনুমতি দিন।"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        sendImageMessage(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert(tr("ত্রুটি"), tr("গ্যালারি খুলতে সমস্যা হয়েছে।"));
    }
  };

  /**
   * Send a photo: shrink it on the phone (longest side 1600px, JPEG) so it uploads fast on
   * mobile data, show it at once as "Sending…", then upload it to the server so the other
   * person gets it. A failed upload shows "Not sent · Tap to retry", like text.
   */
  const sendImageMessage = async (imageUri: string, w?: number, h?: number) => {
    setShowMediaMenu(false);
    if (!isLive) {
      Alert.alert(tr("Photo not sent"), blockedReason());
      return;
    }
    try {
      const longest = Math.max(w || 0, h || 0);
      const resize = longest > 1600 ? [w! >= h! ? { resize: { width: 1600 } } : { resize: { height: 1600 } }] : [];
      const out = await ImageManipulator.manipulateAsync(imageUri, resize as any, {
        compress: 0.78,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!out.base64) throw new Error("no image data");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      queue({
        text: "",
        type: "image",
        imageUri: out.uri,
        width: out.width,
        height: out.height,
        photo: { base64: out.base64, mime: "image/jpeg", width: out.width, height: out.height },
        seen: false,
      });
    } catch (e) {
      console.error("Photo prepare error:", e);
      Alert.alert(tr("Photo not sent"), tr("Couldn't open that photo. Please try another one."));
    }
  };

  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);

  const renderStatus = (item: Message, isLastInGroup: boolean) => {
    if (!item.isMe) return null;
    if (item.status === "failed") {
      return (
        <Pressable onPress={() => retry(item)} hitSlop={8} accessibilityRole="button">
          <ThemedText style={[styles.seenStatus, { color: theme.error || "#D32F2F" }]}>
            {tr("Not sent · Tap to retry")}
          </ThemedText>
        </Pressable>
      );
    }
    if (item.status === "sending") {
      return <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>{tr("Sending…")}</ThemedText>;
    }
    if (!isLastInGroup) return null;
    return (
      <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>
        {item.seen ? tr("Seen") : tr("Sent")}
      </ThemedText>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const showTime = index === messages.length - 1 || messages[index + 1].isMe !== item.isMe;
    const isLastInGroup = index === 0 || messages[index - 1].isMe !== item.isMe;

    const showAvatar = !item.isMe && isLastInGroup;

    if (item.type === "voice") {
      return (
        <Pressable
          onPress={() => handleDoubleTap(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={300}
        >
          <View style={[styles.messageRow, item.isMe ? styles.myMessageRow : styles.theirMessageRow]}>
            {!item.isMe ? (
              <View style={styles.avatarSpace}>
                {showAvatar ? (
                  <UserAvatar 
                    initials={userInitials} 
                    size="small" 
                    isWelfareMember={isWelfareMember}
                    userId={liveOtherId}
                  />
                ) : null}
              </View>
            ) : null}
            <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.theirMessage]}>
              <View style={[styles.bubbleWrapper, item.reactions && item.reactions.length > 0 && styles.bubbleWithReaction]}>
                <View
                  style={[
                    styles.voiceMessageBubble,
                    item.isMe ? { backgroundColor: theme.primary } : { backgroundColor: theme.surface },
                  ]}
                >
                  <VoiceMessagePlayer
                    mediaId={item.mediaId}
                    localUri={item.localUri}
                    durationMs={item.durationMs ?? (item.duration ? item.duration * 1000 : null)}
                    isMe={item.isMe}
                    tint={item.isMe ? theme.white : theme.primary}
                    trackColor={item.isMe ? "rgba(255,255,255,0.35)" : theme.primary + "30"}
                    textColor={item.isMe ? theme.white : theme.textSecondary}
                    onLongPress={() => handleLongPress(item)}
                  />
                </View>
                {item.reactions && item.reactions.length > 0 ? (
                  <View style={[styles.reactionsContainer, item.isMe && styles.reactionsRight, item.superReact && styles.reactionsSuper]}>
                    {item.reactions.map((r, i) => (
                      <ThemedText key={i} allowFontScaling={false} style={[styles.reactionEmoji, item.superReact && styles.reactionEmojiSuper]}>{r}</ThemedText>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.messageFooter}>
                {showTime ? (
                  <ThemedText style={[styles.messageTime, { color: theme.textSecondary }, item.isMe && styles.myTime]}>
                    {item.time}
                  </ThemedText>
                ) : null}
                {renderStatus(item, isLastInGroup)}
              </View>
            </View>
          </View>
        </Pressable>
      );
    }

    if (item.type === "image" && (item.imageUri || item.mediaId)) {
      return (
        <Pressable
          onPress={() => handleDoubleTap(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={300}
        >
          <View style={[styles.messageRow, item.isMe ? styles.myMessageRow : styles.theirMessageRow]}>
            {!item.isMe ? (
              <View style={styles.avatarSpace}>
                {showAvatar ? (
                  <UserAvatar 
                    initials={userInitials} 
                    size="small" 
                    isWelfareMember={isWelfareMember}
                    userId={liveOtherId}
                  />
                ) : null}
              </View>
            ) : null}
            <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.theirMessage]}>
              <View style={[styles.bubbleWrapper, item.reactions && item.reactions.length > 0 && styles.bubbleWithReaction]}>
                <ChatPhoto
                  localUri={item.imageUri}
                  mediaId={item.mediaId}
                  width={item.width}
                  height={item.height}
                  onOpen={(uri) => setViewerPhoto(uri)}
                  onLongPress={() => handleLongPress(item)}
                />
                {item.reactions && item.reactions.length > 0 ? (
                  <View style={[styles.reactionsContainer, item.isMe && styles.reactionsRight, item.superReact && styles.reactionsSuper]}>
                    {item.reactions.map((r, i) => (
                      <ThemedText key={i} allowFontScaling={false} style={[styles.reactionEmoji, item.superReact && styles.reactionEmojiSuper]}>{r}</ThemedText>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.messageFooter}>
                {showTime ? (
                  <ThemedText style={[styles.messageTime, { color: theme.textSecondary }, item.isMe && styles.myTime]}>
                    {item.time}
                  </ThemedText>
                ) : null}
                {renderStatus(item, isLastInGroup)}
              </View>
            </View>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={() => handleDoubleTap(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={300}
      >
        <View style={[styles.messageRow, item.isMe ? styles.myMessageRow : styles.theirMessageRow]}>
          {!item.isMe ? (
            <View style={styles.avatarSpace}>
              {showAvatar ? (
                <UserAvatar 
                  initials={userInitials} 
                  size="small" 
                  isWelfareMember={isWelfareMember}
                  userId={liveOtherId}
                />
              ) : null}
            </View>
          ) : null}
          <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.theirMessage]}>
            {item.replyTo ? (
              <View style={[styles.replyPreview, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.replyName, { color: theme.primary }]}>
                  {item.replyTo.isMe ? "You" : userName}
                </ThemedText>
                <ThemedText style={[styles.replyText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.replyTo.text}
                </ThemedText>
              </View>
            ) : null}
            <View style={[styles.bubbleWrapper, item.reactions && item.reactions.length > 0 && styles.bubbleWithReaction]}>
              <View
                style={[
                  styles.messageBubble,
                  item.isMe
                    ? [styles.myBubble, { backgroundColor: theme.primary }]
                    : [styles.theirBubble, { backgroundColor: theme.surface }],
                ]}
              >
                <ThemedText style={[styles.messageText, { color: item.isMe ? theme.white : theme.text }]}>
                  {item.text}
                </ThemedText>
              </View>
              {item.reactions && item.reactions.length > 0 ? (
                <View style={[styles.reactionsContainer, item.isMe && styles.reactionsRight, item.superReact && styles.reactionsSuper]}>
                  {item.reactions.map((r, i) => (
                    <ThemedText key={i} allowFontScaling={false} style={[styles.reactionEmoji, item.superReact && styles.reactionEmojiSuper]}>{r}</ThemedText>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.messageFooter}>
              {showTime ? (
                <ThemedText style={[styles.messageTime, { color: theme.textSecondary }, item.isMe && styles.myTime]}>
                  {item.time}
                </ThemedText>
              ) : null}
              {renderStatus(item, isLastInGroup)}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyAvatar, { backgroundColor: theme.primary }]}>
        <ThemedText style={styles.emptyAvatarText}>{userInitials}</ThemedText>
      </View>
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>{userName}</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {mode === "checking" ? tr("Loading messages…") : mode === "live" ? tr("Start a conversation") : banner}
      </ThemedText>
    </View>
  );

  const handleContentSizeChange = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const newHeight = Math.min(Math.max(e.nativeEvent.contentSize.height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
    setInputHeight(newHeight);
  };

  // Keyboard closed: sit just above the phone's navigation bar. Keyboard open:
  // sit right on top of the keyboard (KeyboardAvoidingScreen lifts the bar).
  const composerPadding = useKeyboardAwareBottomPadding(Spacing.sm);

  const headerStatus =
    mode === "live" ? (otherOnline ? tr("Online") : tr("On Farmers")) : mode === "checking" ? tr("Connecting…") : mode === "guest" ? tr("Sign in to chat") : tr("Not on Farmers yet");
  const banner =
    mode === "guest"
      ? tr("Sign in to send and receive messages.")
      : mode === "noAccount"
        ? `${userName} isn't on Farmers yet, so they can't get messages.`
        : loadError
          ? tr("Can't reach the server. Messages will update when you're back online. Tap to retry.")
          : null;

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingScreen style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.customHeader, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Pressable style={styles.headerTitleContainer} onPress={() => handleViewProfile()}>
          <View style={styles.headerAvatarContainer}>
            <UserAvatar initials={userInitials} size={36} userId={liveOtherId} />
          </View>
          <View style={styles.headerInfo}>
            <ThemedText style={[styles.headerName, { color: theme.text }]}>{userName}</ThemedText>
            <ThemedText style={[styles.headerStatus, { color: theme.textSecondary }]} numberOfLines={1}>
              {headerStatus}
            </ThemedText>
          </View>
        </Pressable>
        <View style={styles.headerRightContainer}>
          <Pressable
            style={styles.headerButton}
            onPress={handleVoiceCall}
            onLongPress={handlePhoneCall}
            accessibilityRole="button"
            accessibilityLabel={`Voice call ${userName}`}
            accessibilityHint="Long press for a normal phone call"
            testID="chat-call-button"
          >
            {calling ? <ActivityIndicator size="small" color={theme.text} /> : <Feather name="phone" size={22} color={theme.text} />}
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => setShowOptionsMenu(true)}>
            <Feather name="more-vertical" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={shownMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted={messages.length > 0}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
          messages.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <Animated.View style={[styles.bottomBar, { backgroundColor: theme.backgroundRoot }, composerPadding]}>
        {banner ? (
          <Pressable
            onPress={mode === "live" || mode === "checking" ? fetchLive : undefined}
            style={[styles.chatBanner, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}
          >
            <AppIcon name={mode === "live" || mode === "checking" ? "wifi-off" : "info"} size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.chatBannerText, { color: theme.textSecondary }]}>{banner}</ThemedText>
          </Pressable>
        ) : null}
        {replyingTo ? (
          <View style={[styles.replyBar, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}>
            <View style={styles.replyBarContent}>
              <View style={[styles.replyIndicator, { backgroundColor: theme.primary }]} />
              <View style={styles.replyInfo}>
                <ThemedText style={[styles.replyBarName, { color: theme.primary }]}>
                  Replying to {replyingTo.isMe ? "yourself" : userName}
                </ThemedText>
                <ThemedText style={[styles.replyBarText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {replyingTo.text}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} style={styles.replyCloseButton}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
        {isRecording ? (
          <View style={styles.recordingContainer}>
            <Pressable
              style={styles.iconButton}
              onPress={cancelRecording}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel voice message"
            >
              <Feather name="trash-2" size={22} color={theme.error} />
            </Pressable>
            <View style={[styles.recordingIndicator, { backgroundColor: "#DC2626" }]} />
            <ThemedText style={[styles.recordingText, { color: theme.text }]}>
              {formatVoiceTime(voice.durationMs)}
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                {voice.durationMs > 100000 ? `  ${tr("max")} 2:00` : `  ${tr("Recording…")}`}
              </ThemedText>
            </ThemedText>
            <Pressable
              style={[styles.iconButton, styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={stopRecording}
              accessibilityRole="button"
              accessibilityLabel="Send voice message"
            >
              <MaterialCommunityIcons name="send" size={20} color={theme.white} />
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.iconButton} onPress={handleMediaButton}>
              <MaterialCommunityIcons name="plus-circle-outline" size={28} color={theme.primary} />
            </Pressable>

            <View style={[styles.textInputWrapper, { backgroundColor: theme.surface }]}>
              <TextInput
                style={[styles.textInput, { color: theme.text, height: inputHeight }]}
                placeholder={tr("Type a message...")}
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onContentSizeChange={handleContentSizeChange}
                multiline
                maxLength={1000}
                onKeyPress={(e: any) => {
                  // web: Enter sends, Shift+Enter adds a new line
                  if (Platform.OS === "web" && e?.nativeEvent?.key === "Enter" && !e?.nativeEvent?.shiftKey) {
                    e.preventDefault?.();
                    handleSend();
                  }
                }}
              />
            </View>

            {inputText.trim() ? (
              <Pressable
                style={[styles.iconButton, styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={handleSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <MaterialCommunityIcons name="send" size={20} color={theme.white} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.iconButton, styles.micButton, { backgroundColor: theme.primary }]}
                onPress={startRecording}
                accessibilityRole="button"
                accessibilityLabel="Record voice message"
              >
                <MaterialCommunityIcons name="microphone" size={22} color={theme.white} />
              </Pressable>
            )}
          </>
        )}
        </View>
      </Animated.View>

      <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptionsMenu(false)}>
          <View style={[styles.optionsMenu, { backgroundColor: theme.surface }]}>
            <Pressable style={styles.optionItem} onPress={() => { handleViewProfile(); setShowOptionsMenu(false); }}>
              <Feather name="user" size={20} color={theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>{tr("View Profile")}</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem}>
              <Feather name="search" size={20} color={theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>{tr("Search in Conversation")}</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem}>
              <Feather name="bell-off" size={20} color={theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>{tr("Mute Notifications")}</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem}>
              <Feather name="flag" size={20} color={theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>{tr("Report")}</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem}>
              <Feather name="slash" size={20} color={theme.error} />
              <ThemedText style={[styles.optionText, { color: theme.error }]}>{tr("Block")}</ThemedText>
            </Pressable>
            <View style={[styles.optionDivider, { backgroundColor: theme.divider }]} />
            <Pressable style={styles.optionItem}>
              <Feather name="trash-2" size={20} color={theme.error} />
              <ThemedText style={[styles.optionText, { color: theme.error }]}>{tr("Delete Chat")}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showReactionPicker} transparent animationType="fade" onRequestClose={() => setShowReactionPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowReactionPicker(false)}>
          <View style={styles.instagramReactionContainer}>
            <View style={styles.reactionBarWrapper}>
              <View style={[styles.reactionBar, { backgroundColor: theme.white }]}>
                {REACTIONS.map((reaction) => (
                  <Pressable
                    key={reaction}
                    style={({ pressed }) => [styles.reactionItem, pressed && styles.reactionItemPressed]}
                    onPress={() => handleReaction(reaction)}
                    onLongPress={() => handleReaction(reaction, true)}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={`React ${reaction}`}
                    accessibilityHint="Hold for a super reaction"
                    testID={`reaction-${reaction}`}
                  >
                    <Text style={styles.reactionItemText} allowFontScaling={false} numberOfLines={1}>
                      {reaction}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.messageActionsMenu, { backgroundColor: theme.white }]}>
              <Pressable style={styles.menuItem} onPress={handleReply}>
                <Feather name="corner-up-left" size={22} color={theme.text} />
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{tr("Reply")}</ThemedText>
              </Pressable>
              <Pressable style={styles.menuItem}>
                <Feather name="send" size={22} color={theme.text} />
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{tr("Forward")}</ThemedText>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={handleCopy}>
                <Feather name="copy" size={22} color={theme.text} />
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{tr("Copy")}</ThemedText>
              </Pressable>
              {/* Unsend only removed it from this phone, so it's only offered for messages that never went out. */}
              {selectedMessage?.isMe && (!isLive || selectedMessage.status === "failed") ? (
                <Pressable style={styles.menuItem} onPress={handleUnsend}>
                  <Feather name="trash-2" size={22} color={theme.error} />
                  <ThemedText style={[styles.menuItemText, { color: theme.error }]}>{tr("Unsend")}</ThemedText>
                </Pressable>
              ) : selectedMessage?.isMe ? null : (
                <Pressable style={styles.menuItem}>
                  <Feather name="alert-circle" size={22} color={theme.error} />
                  <ThemedText style={[styles.menuItemText, { color: theme.error }]}>{tr("Report")}</ThemedText>
                </Pressable>
              )}
              <Pressable style={styles.menuItem} onPress={() => setShowReactionPicker(false)}>
                <Feather name="more-horizontal" size={22} color={theme.text} />
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{tr("More")}</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {superBurst ? (
        <View pointerEvents="none" style={styles.superBurstWrap}>
          <RNAnimated.Text
            allowFontScaling={false}
            style={[
              styles.superBurstEmoji,
              {
                opacity: burstAnim,
                transform: [
                  { scale: burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                  { translateY: burstAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              },
            ]}
          >
            {superBurst}
          </RNAnimated.Text>
        </View>
      ) : null}

      <PhotoViewer images={viewerPhoto ? [viewerPhoto] : []} visible={!!viewerPhoto} onClose={() => setViewerPhoto(null)} />
      <Modal visible={showMediaMenu} transparent animationType="fade" onRequestClose={() => setShowMediaMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMediaMenu(false)}>
          <View style={[styles.mediaMenuContainer, { backgroundColor: theme.surface }]}>
            <ThemedText type="h4" style={[styles.mediaMenuTitle, { color: theme.text }]}>
              {tr("ছবি পাঠান")}
            </ThemedText>
            <View style={styles.mediaMenuOptions}>
              <Pressable 
                style={[styles.mediaOption, { backgroundColor: theme.backgroundDefault }]} 
                onPress={() => { setShowMediaMenu(false); openCamera(); }}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="camera" size={24} color={theme.primary} />
                </View>
                <ThemedText style={[styles.mediaOptionText, { color: theme.text }]}>{tr("ক্যামেরা")}</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.mediaOption, { backgroundColor: theme.backgroundDefault }]} 
                onPress={() => { setShowMediaMenu(false); openGallery(); }}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: theme.success + "20" }]}>
                  <Feather name="image" size={24} color={theme.success} />
                </View>
                <ThemedText style={[styles.mediaOptionText, { color: theme.text }]}>{tr("গ্যালারি")}</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    padding: Spacing.sm,
  },
  // No line above the typing bar, and the bar shares the chat background (no colour step).
  bottomBar: {},
  headerTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.xs,
  },
  headerAvatarContainer: {
    position: "relative",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  onlineIndicator: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16A34A",
    borderWidth: 2,
  },
  headerInfo: {
    marginLeft: Spacing.sm,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  emptyListContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyAvatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
    alignItems: "flex-end",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  theirMessageRow: {
    justifyContent: "flex-start",
  },
  avatarSpace: {
    width: 28,
    marginRight: Spacing.xs,
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatarText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  messageContainer: {
    maxWidth: "80%",
  },
  bubbleWrapper: {
    position: "relative",
  },
  bubbleWithReaction: {
    marginBottom: 16,
  },
  myMessage: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  theirMessage: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: "100%",
    position: "relative",
  },
  myBubble: {
    borderRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xs,
  },
  theirBubble: {
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.xs,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: Spacing.sm,
  },
  messageTime: {
    fontSize: 11,
    marginHorizontal: Spacing.xs,
  },
  myTime: {
    textAlign: "right",
  },
  seenStatus: {
    fontSize: 11,
  },
  replyPreview: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
  },
  replyName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
  },
  reactionsContainer: {
    position: "absolute",
    bottom: -10,
    left: 6,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    minWidth: 24,
    minHeight: 24,
    paddingHorizontal: 4,
    paddingVertical: 1,
    gap: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 10,
  },
  reactionsRight: {
    left: "auto",
    right: 6,
  },
  reactionEmoji: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: true,
  },
  reactionsSuper: {
    minHeight: 32,
    minWidth: 32,
    borderRadius: 16,
    bottom: -14,
  },
  reactionEmojiSuper: {
    fontSize: 19,
    lineHeight: 28,
  },
  voiceMessageBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    minWidth: 180,
  },
  playingVoiceMessage: {
    opacity: 0.9,
  },
  voiceWaveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: "500",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  replyBarContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  replyIndicator: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  replyInfo: {
    flex: 1,
  },
  replyBarName: {
    fontSize: 13,
    fontWeight: "600",
  },
  replyBarText: {
    fontSize: 13,
  },
  replyCloseButton: {
    padding: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    minHeight: 60,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recordingText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  chatBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginBottom: 6,
    borderRadius: BorderRadius.md,
  },
  chatBannerText: {
    flex: 1,
    fontSize: 12,
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  textInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    paddingVertical: Spacing.sm,
    maxHeight: 80,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
  },
  micButton: {
    width: 40,
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  instagramReactionContainer: {
    width: "62%",
    minWidth: 236,
    maxWidth: 250,
    alignItems: "center",
  },
  reactionBarWrapper: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  reactionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  // 6 x 38 + padding = 236 wide: narrow, but each emoji gets more room than its glyph
  // (Android cuts emoji off when the line box is shorter than the font's own height).
  reactionItem: {
    width: 38,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  reactionItemPressed: {
    transform: [{ scale: 1.2 }],
  },
  reactionItemText: {
    width: 38,
    fontSize: 24,
    lineHeight: 36,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: true,
  },
  superBurstWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  superBurstEmoji: {
    fontSize: 110,
    lineHeight: 130,
    textAlign: "center",
    includeFontPadding: false,
  },
  messageActionsMenu: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  optionsMenu: {
    width: "80%",
    maxWidth: 300,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  optionText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  optionDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  imageMessageBubble: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  mediaMenuContainer: {
    width: "85%",
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  mediaMenuTitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  mediaMenuOptions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  mediaOption: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    minWidth: 100,
  },
  mediaOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  mediaOptionText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
