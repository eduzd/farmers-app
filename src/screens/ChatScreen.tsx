import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

let useAudioRecorder: any;
let AudioModule: any;
let RecordingPresets: any;

if (Platform.OS !== "web") {
  const expoAudio = require("expo-audio");
  useAudioRecorder = expoAudio.useAudioRecorder;
  AudioModule = expoAudio.AudioModule;
  RecordingPresets = expoAudio.RecordingPresets;
}

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useVoiceCallContext } from "@/contexts/VoiceCallContext";
import { useAuthStore } from "@/lib/authStore";
import { getApiUrl } from "@/lib/query-client";

import { tr, useTr } from "@/lib/tr";
// Real accounts have long server ids; the built-in sample chats use short ids.
const isRealUserId = (id?: string) => !!id && /^[0-9a-zA-Z_-]{16,}$/.test(id);

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;

interface Message {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
  type: "text" | "voice" | "image";
  duration?: number;
  audioUri?: string;
  imageUri?: string;
  replyTo?: { id: string; text: string; isMe: boolean };
  reactions?: string[];
  seen?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  { id: "1", text: "Hi! I saw your post about organic tomatoes.", isMe: false, time: "10:30 AM", type: "text", seen: true },
  { id: "2", text: "Hello! Yes, they're freshly harvested.", isMe: true, time: "10:32 AM", type: "text", seen: true },
  { id: "3", text: "What's the price per kg?", isMe: false, time: "10:33 AM", type: "text", seen: true },
  { id: "4", text: "It's ৳120 per kg. We offer discounts for bulk orders!", isMe: true, time: "10:35 AM", type: "text", seen: true },
  { id: "5", text: "That sounds great! How much for 50kg?", isMe: false, time: "10:36 AM", type: "text", seen: true },
  { id: "6", text: "For 50kg, I can offer ৳110 per kg. Total would be ৳5,500.", isMe: true, time: "10:38 AM", type: "text", seen: true },
  { id: "7", text: "Perfect! Can you deliver to my location?", isMe: false, time: "10:40 AM", type: "text", seen: true },
];

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
  
  const voiceCallContext = useVoiceCallContext();

  const [messages, setMessages] = useState<Message[]>(() => [...INITIAL_MESSAGES].reverse()); // newest first for the inverted list
  // (replaced with real messages from the server for live chats, see isLive)
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const audioPlayerRef = useRef<any>(null);
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);
  
  const audioRecorder = useAudioRecorder ? useAudioRecorder(RecordingPresets?.HIGH_QUALITY) : null;

  const userName = route.params.userName;
  const userInitials = route.params.userInitials;
  const conversationId = route.params.conversationId;
  const isWelfareMember = route.params.isWelfareMember;
  const authUser = useAuthStore((st) => st.user);
  const getToken = useAuthStore((st) => st.getToken);
  // Live chat with a real account: messages go through the server (/api/dm).
  const isLive = !!authUser && isRealUserId(conversationId) && conversationId !== authUser.id && !!getToken();
  const lastServerAt = useRef<string | null>(null);

  const toMessage = (m: any): Message => ({
    id: m.id,
    text: m.content,
    isMe: !!m.isMe,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    type: "text",
    seen: !!m.readAt,
  });

  const fetchLive = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const since = lastServerAt.current ? `?since=${encodeURIComponent(lastServerAt.current)}` : "";
    try {
      const r = await fetch(`${getApiUrl()}/api/dm/${conversationId}/messages${since}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const list: any[] = await r.json();
      if (list.length) lastServerAt.current = list[list.length - 1].createdAt;
      setMessages((prev) => {
        const base = since ? prev : [];
        const known = new Set(base.map((m) => m.id));
        const fresh = list.filter((m) => !known.has(m.id)).map(toMessage).reverse();
        return fresh.length || !since ? [...fresh, ...base] : prev;
      });
    } catch {}
  }, [conversationId, getToken]);

  useEffect(() => {
    if (!isLive) return;
    setMessages([]);
    lastServerAt.current = null;
    fetchLive();
    const t = setInterval(fetchLive, 4000);
    return () => clearInterval(t);
  }, [isLive, fetchLive]);
  const lastSeen = "Active 2m ago";
  const isOnline = true;

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.remove();
      }
    };
  }, []);

  const handleViewProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(tr("Profile"), `Viewing ${userName}'s profile`);
  };

  const handleVoiceCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (voiceCallContext) {
      voiceCallContext.initiateCall(conversationId, userName);
    } else {
      Alert.alert(tr("Voice Call"), tr("Voice calling is being set up. Please try again in a moment."));
    }
  };


  const sendLive = async (text: string) => {
    const tempId = `tmp-${Date.now()}`;
    const temp: Message = {
      id: tempId,
      text,
      isMe: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "text",
      seen: false,
    };
    setMessages((prev) => [temp, ...prev]);
    setInputText("");
    setReplyingTo(null);
    try {
      const r = await fetch(`${getApiUrl()}/api/dm/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Couldn't send the message");
      lastServerAt.current = data.createdAt;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? toMessage(data) : m)));
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
      Alert.alert(tr("Not sent"), e?.message || "Check your connection and try again.");
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLive) {
      sendLive(inputText.trim());
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isMe: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "text",
      seen: false,
      replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, isMe: replyingTo.isMe } : undefined,
    };

    setMessages((prev) => [newMessage, ...prev]);
    setInputText("");
    setReplyingTo(null);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMessage.id ? { ...m, seen: true } : m))
      );
    }, 1000);

    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        text: "Thanks for your message! I'll get back to you soon.",
        isMe: false,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "text",
        seen: true,
      };
      setMessages((prev) => [reply, ...prev]);
    }, 1500);
  };

  const startRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (Platform.OS === "web") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          webAudioChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              webAudioChunksRef.current.push(event.data);
            }
          };
          
          webMediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start();
          
          setIsRecording(true);
          setRecordingDuration(0);
          recordingDurationRef.current = 0;
          
          recordingIntervalRef.current = setInterval(() => {
            recordingDurationRef.current += 1;
            setRecordingDuration(recordingDurationRef.current);
          }, 1000);
        } catch (err) {
          console.error("Web recording error:", err);
          Alert.alert(tr("অনুমতি প্রয়োজন"), tr("ভয়েস মেসেজ রেকর্ড করতে মাইক্রোফোন অ্যাক্সেস দিন।"));
        }
        return;
      }
      
      if (!AudioModule) {
        Alert.alert(tr("ত্রুটি"), tr("এই ডিভাইসে অডিও রেকর্ডিং সম্ভব নয়।"));
        return;
      }
      
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(tr("অনুমতি প্রয়োজন"), tr("ভয়েস মেসেজ রেকর্ড করতে মাইক্রোফোন অ্যাক্সেস দিন।"));
        return;
      }

      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;

      audioRecorder?.record();

      recordingIntervalRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert(tr("ত্রুটি"), tr("রেকর্ডিং শুরু করা যায়নি। আবার চেষ্টা করুন।"));
    }
  };

  const stopRecording = async () => {
    const finalDuration = recordingDurationRef.current;
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      if (Platform.OS === "web") {
        const mediaRecorder = webMediaRecorderRef.current;
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          return new Promise<void>((resolve) => {
            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(webAudioChunksRef.current, { type: "audio/webm" });
              const audioUrl = URL.createObjectURL(audioBlob);
              
              if (finalDuration > 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                const voiceMessage: Message = {
                  id: Date.now().toString(),
                  text: "",
                  isMe: true,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  type: "voice",
                  duration: finalDuration,
                  audioUri: audioUrl,
                  seen: false,
                };
                
                setMessages((prev) => [voiceMessage, ...prev]);
              }
              
              mediaRecorder.stream.getTracks().forEach(track => track.stop());
              webMediaRecorderRef.current = null;
              webAudioChunksRef.current = [];
              setIsRecording(false);
              setRecordingDuration(0);
              recordingDurationRef.current = 0;
              resolve();
            };
            mediaRecorder.stop();
          });
        }
        setIsRecording(false);
        setRecordingDuration(0);
        recordingDurationRef.current = 0;
        return;
      }
      
      await audioRecorder?.stop();
      const uri = audioRecorder?.uri;

      if (finalDuration > 0 && uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const voiceMessage: Message = {
          id: Date.now().toString(),
          text: "",
          isMe: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "voice",
          duration: finalDuration,
          audioUri: uri,
          seen: false,
        };

        setMessages((prev) => [voiceMessage, ...prev]);
      } else if (finalDuration > 0) {
        const voiceMessage: Message = {
          id: Date.now().toString(),
          text: "",
          isMe: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "voice",
          duration: finalDuration,
          audioUri: "recorded-audio",
          seen: false,
        };

        setMessages((prev) => [voiceMessage, ...prev]);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }

    setIsRecording(false);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
  };

  const playVoiceMessage = async (message: Message) => {
    if (!message.audioUri) {
      Alert.alert(tr("Info"), tr("Audio not available"));
      return;
    }

    try {
      if (playingMessageId === message.id) {
        if (Platform.OS === "web") {
          if (audioPlayerRef.current instanceof Audio) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current = null;
          }
        } else if (audioPlayerRef.current) {
          await audioPlayerRef.current.remove();
          audioPlayerRef.current = null;
        }
        setPlayingMessageId(null);
        return;
      }

      if (Platform.OS === "web") {
        if (audioPlayerRef.current instanceof Audio) {
          audioPlayerRef.current.pause();
        }
        
        const audio = new Audio(message.audioUri);
        audioPlayerRef.current = audio;
        setPlayingMessageId(message.id);
        
        audio.onended = () => {
          setPlayingMessageId(null);
          audioPlayerRef.current = null;
        };
        
        audio.play();
        return;
      }

      if (audioPlayerRef.current) {
        await audioPlayerRef.current.remove();
      }

      if (!AudioModule) {
        Alert.alert(tr("Error"), tr("Audio playback is not available on this platform."));
        return;
      }

      const player = AudioModule.createPlayer(message.audioUri);
      audioPlayerRef.current = player;
      setPlayingMessageId(message.id);

      player.play();

      player.addListener("playbackStatusUpdate", (status: any) => {
        if (status.didJustFinish) {
          setPlayingMessageId(null);
          player.remove();
          audioPlayerRef.current = null;
        }
      });
    } catch (error) {
      console.error("Failed to play audio:", error);
      Alert.alert(tr("Error"), tr("Could not play audio"));
      setPlayingMessageId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDoubleTap = useCallback((message: Message) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === message.id && now - lastTapRef.current.time < 300) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, reactions: m.reactions?.[0] === "❤️" ? [] : ["❤️"] }
            : m
        )
      );
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: message.id, time: now };
    }
  }, []);

  const handleLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedMessage(message);
    setShowReactionPicker(true);
  };

  const handleReaction = (reaction: string) => {
    if (!selectedMessage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === selectedMessage.id
          ? {
              ...m,
              reactions: m.reactions?.[0] === reaction ? [] : [reaction],
            }
          : m
      )
    );
    setShowReactionPicker(false);
    setSelectedMessage(null);
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setReplyingTo(selectedMessage);
    setShowReactionPicker(false);
    setSelectedMessage(null);
  };

  const handleCopy = () => {
    if (!selectedMessage) return;
    Alert.alert(tr("Copied"), tr("Message copied to clipboard"));
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
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        sendImageMessage(result.assets[0].uri);
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
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        sendImageMessage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert(tr("ত্রুটি"), tr("গ্যালারি খুলতে সমস্যা হয়েছে।"));
    }
  };

  const sendImageMessage = (imageUri: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const imageMessage: Message = {
      id: Date.now().toString(),
      text: "",
      isMe: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "image",
      imageUri: imageUri,
      seen: false,
    };

    setMessages((prev) => [imageMessage, ...prev]);
    setShowMediaMenu(false);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === imageMessage.id ? { ...m, seen: true } : m))
      );
    }, 1000);
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
                  />
                ) : null}
              </View>
            ) : null}
            <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.theirMessage]}>
              <View style={[styles.bubbleWrapper, item.reactions && item.reactions.length > 0 && styles.bubbleWithReaction]}>
                <Pressable
                  style={[
                    styles.voiceMessageBubble,
                    item.isMe ? { backgroundColor: theme.primary } : { backgroundColor: theme.surface },
                    playingMessageId === item.id && styles.playingVoiceMessage,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    playVoiceMessage(item);
                  }}
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={300}
                >
                  <Feather 
                    name={playingMessageId === item.id ? "pause-circle" : "play-circle"} 
                    size={28} 
                    color={item.isMe ? theme.white : theme.primary} 
                  />
                  <View style={styles.voiceWaveform}>
                    {[...Array(12)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveformBar,
                          {
                            height: 8 + Math.random() * 12,
                            backgroundColor: item.isMe ? "rgba(255,255,255,0.6)" : theme.primary + "60",
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <ThemedText style={[styles.voiceDuration, { color: item.isMe ? theme.white : theme.textSecondary }]}>
                    {formatDuration(item.duration || 0)}
                  </ThemedText>
                </Pressable>
                {item.reactions && item.reactions.length > 0 ? (
                  <View style={[styles.reactionsContainer, item.isMe && styles.reactionsRight]}>
                    {item.reactions.map((r, i) => (
                      <ThemedText key={i} style={styles.reactionEmoji}>{r}</ThemedText>
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
                {item.isMe && isLastInGroup ? (
                  <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>
                    {item.seen ? "Seen" : "Sent"}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </View>
        </Pressable>
      );
    }

    if (item.type === "image" && item.imageUri) {
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
                  />
                ) : null}
              </View>
            ) : null}
            <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.theirMessage]}>
              <View style={[styles.bubbleWrapper, item.reactions && item.reactions.length > 0 && styles.bubbleWithReaction]}>
                <Pressable style={styles.imageMessageBubble}>
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.messageImage}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
                {item.reactions && item.reactions.length > 0 ? (
                  <View style={[styles.reactionsContainer, item.isMe && styles.reactionsRight]}>
                    {item.reactions.map((r, i) => (
                      <ThemedText key={i} style={styles.reactionEmoji}>{r}</ThemedText>
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
                {item.isMe && isLastInGroup ? (
                  <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>
                    {item.seen ? "Seen" : "Sent"}
                  </ThemedText>
                ) : null}
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
                <View style={[styles.reactionsContainer, item.isMe && styles.reactionsRight]}>
                  {item.reactions.map((r, i) => (
                    <ThemedText key={i} style={styles.reactionEmoji}>{r}</ThemedText>
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
              {item.isMe && isLastInGroup ? (
                <ThemedText style={[styles.seenStatus, { color: theme.textSecondary }]}>
                  {item.seen ? "Seen" : "Sent"}
                </ThemedText>
              ) : null}
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
        {tr("Start a conversation")}
      </ThemedText>
    </View>
  );

  const handleContentSizeChange = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const newHeight = Math.min(Math.max(e.nativeEvent.contentSize.height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
    setInputHeight(newHeight);
  };

  const bottomSafeArea = Math.max(insets.bottom - 8, 4);

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.customHeader, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Pressable style={styles.headerTitleContainer} onPress={() => handleViewProfile()}>
          <View style={styles.headerAvatarContainer}>
            <View style={[styles.headerAvatar, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.headerAvatarText}>{userInitials}</ThemedText>
            </View>
            {isOnline ? (
              <View style={[styles.onlineIndicator, { borderColor: theme.backgroundRoot }]} />
            ) : null}
          </View>
          <View style={styles.headerInfo}>
            <ThemedText style={[styles.headerName, { color: theme.text }]}>{userName}</ThemedText>
            <ThemedText style={[styles.headerStatus, { color: isOnline ? "#16A34A" : theme.textSecondary }]}>
              {isOnline ? "Active now" : lastSeen}
            </ThemedText>
          </View>
        </Pressable>
        <View style={styles.headerRightContainer}>
          <Pressable style={styles.headerButton} onPress={handleVoiceCall}>
            <Feather name="phone" size={22} color={theme.text} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => setShowOptionsMenu(true)}>
            <Feather name="more-vertical" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
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

      <View style={[styles.bottomBar, { backgroundColor: theme.white, paddingBottom: bottomSafeArea }]}>
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
              backgroundColor: theme.white,
              borderTopColor: theme.inputBorder,
            },
          ]}
        >
        {isRecording ? (
          <View style={styles.recordingContainer}>
            <View style={[styles.recordingIndicator, { backgroundColor: "#DC2626" }]} />
            <ThemedText style={[styles.recordingText, { color: theme.text }]}>
              Recording... {formatDuration(recordingDuration)}
            </ThemedText>
            <Pressable style={[styles.stopButton, { backgroundColor: "#DC2626" }]} onPress={stopRecording}>
              <MaterialCommunityIcons name="stop" size={18} color={theme.white} />
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.iconButton} onPress={handleMediaButton}>
              <MaterialCommunityIcons name="plus-circle-outline" size={28} color={theme.primary} />
            </Pressable>

            <View style={[styles.textInputWrapper, { backgroundColor: theme.backgroundRoot, borderColor: theme.inputBorder }]}>
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
              >
                <MaterialCommunityIcons name="send" size={20} color={theme.white} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.iconButton, styles.micButton, { backgroundColor: theme.primary }]}
                onPress={startRecording}
              >
                <MaterialCommunityIcons name="microphone" size={22} color={theme.white} />
              </Pressable>
            )}
          </>
        )}
        </View>
      </View>

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
                  <Pressable key={reaction} style={styles.reactionItem} onPress={() => handleReaction(reaction)}>
                    <ThemedText style={styles.reactionItemText}>{reaction}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText style={[styles.reactionHint, { color: theme.textSecondary }]}>
                {tr("Tap and hold to super react")}
              </ThemedText>
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
              {selectedMessage?.isMe ? (
                <Pressable style={styles.menuItem} onPress={handleUnsend}>
                  <Feather name="trash-2" size={22} color={theme.error} />
                  <ThemedText style={[styles.menuItemText, { color: theme.error }]}>{tr("Unsend")}</ThemedText>
                </Pressable>
              ) : (
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
    </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  backButton: {
    padding: Spacing.sm,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
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
    marginBottom: 10,
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
    bottom: -6,
    left: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    width: 20,
    height: 20,
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
    fontSize: 12,
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
    borderTopWidth: 1,
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
    borderWidth: 1,
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
    width: "85%",
    maxWidth: 320,
    alignItems: "center",
  },
  reactionBarWrapper: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  reactionBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  reactionItem: {
    padding: 4,
  },
  reactionItemText: {
    fontSize: 26,
  },
  reactionHint: {
    fontSize: 12,
    marginTop: Spacing.sm,
    textAlign: "center",
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
