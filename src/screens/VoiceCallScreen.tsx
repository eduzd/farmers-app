import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Animated,
  Linking,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ExpoFileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

type CallState = "idle" | "connecting" | "ready" | "listening" | "processing" | "speaking";

const GREETINGS = [
  "আসসালামু আলাইকুম ভাই! কৃষি ভাই বলছি। কি সাহায্য করতে পারি?",
  "সালাম ভাই! বলুন, কি জানতে চান আজ?",
  "হ্যালো ভাই! কৃষি বিষয়ে কি সাহায্য লাগবে?",
  "আদাব ভাই! কি নিয়ে কথা বলব আজ?",
];

const ACKNOWLEDGMENTS = [
  "হ্যাঁ ভাই",
  "বলুন ভাই", 
  "জ্বি",
  "আচ্ছা ভাই",
  "হুঁ ভাই",
  "বুঝলাম ভাই",
];

export default function VoiceCallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  
  const [callState, setCallState] = useState<CallState>("idle");
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isCallActiveRef = useRef(false);
  const conversationCountRef = useRef(0);

  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, []);

  useEffect(() => {
    if (isCallActive && (callState === "listening" || callState === "speaking")) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.stagger(200, [
          Animated.sequence([
            Animated.timing(waveAnim1, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(waveAnim1, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim2, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(waveAnim2, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim3, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(waveAnim3, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
    }
  }, [isCallActive, callState]);

  const cleanupAll = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    try { Speech.stop(); } catch (e) {}
    if (soundRef.current) {
      try { soundRef.current.stopAsync(); soundRef.current.unloadAsync(); } catch (e) {}
      soundRef.current = null;
    }
    if (recordingRef.current) {
      try { recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
      recordingRef.current = null;
    }
  }, []);

  const cachedVoiceRef = useRef<{ voice: Speech.Voice | null; checked: boolean }>({ voice: null, checked: false });

  const getMaleVoice = async (): Promise<Speech.Voice | null> => {
    if (cachedVoiceRef.current.checked) {
      return cachedVoiceRef.current.voice;
    }
    
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      
      const isMale = (v: Speech.Voice) => {
        const n = (v.name || "").toLowerCase();
        const id = (v.identifier || "").toLowerCase();
        return n.includes("male") || n.includes("purus") || n.includes("hemant") || 
               n.includes("ravi") || id.includes("male") || id.includes("-m-");
      };
      
      let voice = voices.find(v => v.language?.startsWith("bn") && isMale(v));
      if (!voice) voice = voices.find(v => v.language?.startsWith("bn"));
      if (!voice) voice = voices.find(v => v.language?.startsWith("hi") && isMale(v));
      if (!voice) voice = voices.find(v => v.language?.startsWith("hi"));
      
      cachedVoiceRef.current = { voice: voice || null, checked: true };
      console.log("Cached voice:", voice?.name, voice?.language);
      return voice || null;
    } catch {
      cachedVoiceRef.current = { voice: null, checked: true };
      return null;
    }
  };

  const speakWithNativeTTS = async (text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      try {
        await Speech.stop();
      } catch {}
      
      const voice = await getMaleVoice();
      
      const ttsOptions: Speech.SpeechOptions = {
        language: voice?.language || "bn-BD",
        voice: voice?.identifier,
        pitch: 0.85,
        rate: 1.15,
        onDone: () => resolve(),
        onError: () => resolve(),
        onStopped: () => resolve(),
      };
      
      try {
        Speech.speak(text, ttsOptions);
      } catch {
        Speech.speak(text, { language: "bn-BD", pitch: 0.85, rate: 1.15, onDone: () => resolve() });
      }
      
      setTimeout(resolve, 12000);
    });
  };

  const speakText = async (text: string): Promise<void> => {
    console.log("Starting TTS for:", text.substring(0, 50));
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      playThroughEarpieceAndroid: false,
    });
    
    await speakWithNativeTTS(text);
    return;
  };

  const getRandomGreeting = () => {
    return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  };

  const startCall = async () => {
    if (Platform.OS === "web") {
      Alert.alert("মোবাইল প্রয়োজন", "ভয়েস কল শুধুমাত্র মোবাইল ফোনে Expo Go অ্যাপে কাজ করে।");
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("মাইক্রোফোন", "ভয়েস কলের জন্য মাইক্রোফোন অনুমতি দিন।", [
          { text: "বাতিল" },
          { text: "সেটিংস", onPress: () => { try { Linking.openSettings(); } catch(e){} } },
        ]);
        return;
      }
    } catch (e) {
      console.log("Permission error:", e);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setCallDuration(0);
    setTranscript("");
    setAiResponse("");
    setCallState("connecting");
    conversationCountRef.current = 0;

    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    const greeting = getRandomGreeting();
    setAiResponse(greeting);
    setCallState("speaking");
    
    await speakText(greeting);
    
    if (isCallActiveRef.current) {
      setCallState("ready");
    }
  };

  const endCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setCallState("idle");
    cleanupAll();
  }, [cleanupAll]);

  const startListening = async () => {
    if (!isCallActiveRef.current || callState !== "ready") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCallState("listening");
    setTranscript("");

    try {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
        recordingRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("Recording started");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

    } catch (error) {
      console.log("Recording start error:", error);
      setCallState("ready");
    }
  };

  const stopListening = async () => {
    if (!recordingRef.current) {
      setCallState("ready");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCallState("processing");

    try {
      const recording = recordingRef.current;
      recordingRef.current = null;

      console.log("Stopping recording...");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        console.log("No recording URI");
        setCallState("ready");
        return;
      }

      console.log("Reading recorded audio from:", uri);
      const audioBase64 = await ExpoFileSystem.readAsStringAsync(uri, {
        encoding: ExpoFileSystem.EncodingType.Base64,
      });
      console.log("Audio read success, length:", audioBase64.length);

      if (audioBase64.length < 1000) {
        console.log("Audio too short");
        setCallState("ready");
        return;
      }

      console.log("Sending to STT API...");
      const sttResponse = await fetch(
        new URL("/api/voice-to-text", getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            audioBase64, 
            mimeType: Platform.OS === "ios" ? "audio/m4a" : "audio/mp4" 
          }),
        }
      );

      if (!sttResponse.ok) {
        console.log("STT failed with status:", sttResponse.status);
        setCallState("ready");
        return;
      }

      const sttData = await sttResponse.json();
      const userText = sttData.transcript?.trim();
      console.log("Transcript:", userText);

      if (!userText) {
        console.log("No transcript received");
        setCallState("ready");
        return;
      }

      setTranscript(userText);
      conversationCountRef.current += 1;

      const acknowledgmentsList = ACKNOWLEDGMENTS.join(", ");
      
      console.log("Getting AI response...");
      const chatResponse = await fetch(
        new URL("/api/ai-chat", getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: userText, 
            context: "voice_call",
            systemPrompt: `তুমি "কৃষি ভাই" - গ্রামের বড় ভাইয়ের মতো কৃষি বিশেষজ্ঞ।
- খুব সংক্ষেপে উত্তর দাও, শুধু ১-২ বাক্য
- "ভাই" সম্বোধন ব্যবহার কর তবে প্রতিবার না
- উত্তর শুরুতে বিভিন্ন শব্দ ব্যবহার কর যেমন: ${acknowledgmentsList}
- একই শব্দ বারবার বলো না, পরিবর্তন কর
- সরাসরি উত্তর দাও, ভূমিকা বা শেষকথা বাদ দাও
- মাছ চাষ, ধান চাষ, সবজি চাষ, গবাদি পশু পালন সম্পর্কে পরামর্শ দাও`
          }),
        }
      );

      let aiText = "দুঃখিত ভাই, বুঝতে পারলাম না। আবার বলুন।";
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        aiText = chatData.response || aiText;
      }

      console.log("AI Response:", aiText);
      setAiResponse(aiText);
      setCallState("speaking");
      
      await speakText(aiText);
      
      if (isCallActiveRef.current) {
        setCallState("ready");
      }

    } catch (error) {
      console.log("Processing error:", error);
      setCallState("ready");
    }
  };

  const handleMicTap = () => {
    if (callState === "ready") {
      startListening();
    } else if (callState === "listening") {
      stopListening();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (callState) {
      case "connecting": return "কানেক্ট হচ্ছে...";
      case "ready": return "মাইক ট্যাপ করে বলুন";
      case "listening": return "শুনছি...";
      case "processing": return "বুঝছি...";
      case "speaking": return "কৃষি ভাই বলছে...";
      default: return "কল করুন";
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#0a1628" : "#f0f7ff" }]}>
        <LinearGradient
          colors={isDark ? ["#0a1628", "#1a365d", "#0a1628"] : ["#e0f2ff", "#bae6fd", "#e0f2ff"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.content}>
          <View style={[styles.avatarOuter, { backgroundColor: theme.primary + "20" }]}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Feather name="smartphone" size={40} color="#FFFFFF" />
            </View>
          </View>
          <ThemedText style={styles.assistantName}>কৃষি ভাই</ThemedText>
          <ThemedText style={[styles.webMessage, { color: theme.textSecondary }]}>
            ভয়েস কল শুধুমাত্র মোবাইল ফোনে{'\n'}Expo Go অ্যাপে কাজ করে।
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0a1628" : "#f0f7ff" }]}>
      <LinearGradient
        colors={isDark 
          ? ["#0a1628", "#1e3a5f", "#0a1628"] 
          : ["#e0f2ff", "#bae6fd", "#e0f2ff"]
        }
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable 
          style={[styles.backButton, { backgroundColor: theme.card + "80" }]} 
          onPress={() => { endCall(); navigation.goBack(); }}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        {isCallActive ? (
          <View style={[styles.durationBadge, { backgroundColor: theme.success + "20" }]}>
            <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
            <ThemedText style={[styles.durationText, { color: theme.success }]}>
              {formatDuration(callDuration)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <View style={styles.avatarSection}>
          {isCallActive && (callState === "listening" || callState === "speaking") ? (
            <Animated.View style={[
              styles.pulseRing,
              {
                backgroundColor: callState === "listening" ? "#DC2626" : theme.primary,
                opacity: 0.15,
                transform: [{ scale: pulseAnim }],
              },
            ]} />
          ) : null}
          <View style={[styles.avatarOuter, { 
            backgroundColor: isCallActive 
              ? (callState === "listening" ? "#DC262620" : theme.primary + "20")
              : theme.primary + "15"
          }]}>
            <View style={[
              styles.avatar,
              { 
                backgroundColor: isCallActive 
                  ? (callState === "listening" ? "#DC2626" : theme.primary)
                  : theme.primary 
              },
            ]}>
              {callState === "listening" ? (
                <View style={styles.waveContainer}>
                  <Animated.View style={[styles.waveBar, { 
                    backgroundColor: "#fff",
                    transform: [{ scaleY: Animated.add(0.3, Animated.multiply(waveAnim1, 0.7)) }]
                  }]} />
                  <Animated.View style={[styles.waveBar, styles.waveBarTall, { 
                    backgroundColor: "#fff",
                    transform: [{ scaleY: Animated.add(0.3, Animated.multiply(waveAnim2, 0.7)) }]
                  }]} />
                  <Animated.View style={[styles.waveBar, { 
                    backgroundColor: "#fff",
                    transform: [{ scaleY: Animated.add(0.3, Animated.multiply(waveAnim3, 0.7)) }]
                  }]} />
                </View>
              ) : callState === "speaking" ? (
                <Feather name="volume-2" size={44} color="#FFFFFF" />
              ) : callState === "processing" || callState === "connecting" ? (
                <Feather name="loader" size={44} color="#FFFFFF" />
              ) : (
                <Feather name="headphones" size={44} color="#FFFFFF" />
              )}
            </View>
          </View>
        </View>

        <ThemedText style={styles.assistantName}>কৃষি ভাই</ThemedText>
        <ThemedText style={[styles.assistantDesc, { color: theme.textSecondary }]}>
          আপনার কৃষি পরামর্শদাতা
        </ThemedText>

        <View style={[styles.statusPill, { 
          backgroundColor: callState === "listening" 
            ? "#DC262615" 
            : callState === "speaking" 
              ? theme.primary + "15"
              : theme.textSecondary + "15"
        }]}>
          <ThemedText style={[styles.statusText, { 
            color: callState === "listening" 
              ? "#DC2626" 
              : callState === "speaking"
                ? theme.primary
                : theme.textSecondary
          }]}>
            {getStatusText()}
          </ThemedText>
        </View>

        {transcript ? (
          <View style={[styles.messageCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.messageHeader}>
              <View style={[styles.messageAvatar, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="user" size={14} color={theme.textSecondary} />
              </View>
              <ThemedText style={[styles.messageLabel, { color: theme.textSecondary }]}>আপনি</ThemedText>
            </View>
            <ThemedText style={styles.messageText}>{transcript}</ThemedText>
          </View>
        ) : null}

        {aiResponse && (callState === "speaking" || callState === "processing") ? (
          <View style={[styles.messageCard, styles.aiMessageCard, { 
            backgroundColor: theme.primary + "10", 
            borderColor: theme.primary + "30" 
          }]}>
            <View style={styles.messageHeader}>
              <View style={[styles.messageAvatar, { backgroundColor: theme.primary }]}>
                <Feather name="headphones" size={14} color="#fff" />
              </View>
              <ThemedText style={[styles.messageLabel, { color: theme.primary }]}>কৃষি ভাই</ThemedText>
            </View>
            <ThemedText style={styles.messageText}>{aiResponse}</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {!isCallActive ? (
          <Pressable 
            style={({ pressed }) => [
              styles.startCallButton, 
              { backgroundColor: theme.success, transform: [{ scale: pressed ? 0.95 : 1 }] }
            ]} 
            onPress={startCall}
          >
            <Feather name="phone" size={28} color="#FFFFFF" />
            <ThemedText style={styles.startCallText}>কল শুরু করুন</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.activeCallControls}>
            {(callState === "ready" || callState === "listening") ? (
              <Pressable 
                style={({ pressed }) => [
                  styles.micButton, 
                  { 
                    backgroundColor: callState === "listening" ? "#DC2626" : theme.primary,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  }
                ]} 
                onPress={handleMicTap}
              >
                <Feather 
                  name={callState === "listening" ? "mic-off" : "mic"} 
                  size={36} 
                  color="#FFFFFF" 
                />
              </Pressable>
            ) : (
              <View style={[styles.micButton, { backgroundColor: theme.textSecondary + "40" }]}>
                <Feather name="loader" size={36} color={theme.textSecondary} />
              </View>
            )}
            <Pressable 
              style={({ pressed }) => [
                styles.endCallButton, 
                { backgroundColor: "#DC2626", transform: [{ scale: pressed ? 0.95 : 1 }] }
              ]} 
              onPress={endCall}
            >
              <Feather name="phone-off" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
        
        <ThemedText style={[styles.callHint, { color: theme.textSecondary }]}>
          {!isCallActive 
            ? "কৃষি বিষয়ে যেকোনো প্রশ্ন করুন" 
            : callState === "listening" 
              ? "বলা শেষে মাইক ট্যাপ করুন" 
              : callState === "ready"
                ? "মাইক ট্যাপ করে কথা বলুন"
                : ""}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22,
    alignItems: "center", 
    justifyContent: "center",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    paddingHorizontal: Spacing.xl,
  },
  avatarSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  pulseRing: { 
    position: "absolute", 
    width: 180, 
    height: 180, 
    borderRadius: 90,
  },
  avatarOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { 
    width: 110, 
    height: 110, 
    borderRadius: 55, 
    alignItems: "center", 
    justifyContent: "center",
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
  },
  waveBar: {
    width: 6,
    height: 24,
    borderRadius: 3,
  },
  waveBarTall: {
    height: 36,
  },
  assistantName: { 
    fontSize: 26, 
    fontWeight: "700", 
    marginBottom: Spacing.xs,
  },
  assistantDesc: {
    fontSize: 15,
    marginBottom: Spacing.lg,
  },
  statusPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  statusText: { 
    fontSize: 14, 
    fontWeight: "500",
  },
  messageCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  aiMessageCard: {},
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  messageLabel: { 
    fontSize: 12, 
    fontWeight: "600",
  },
  messageText: { 
    fontSize: 15, 
    lineHeight: 22,
  },
  controls: { 
    alignItems: "center", 
    paddingTop: Spacing.xl,
  },
  startCallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  startCallText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  activeCallControls: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: Spacing["2xl"], 
    marginBottom: Spacing.md,
  },
  micButton: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    alignItems: "center", 
    justifyContent: "center",
  },
  endCallButton: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    alignItems: "center", 
    justifyContent: "center",
  },
  callHint: { 
    fontSize: 14,
    textAlign: "center",
  },
  webMessage: { 
    fontSize: 16, 
    textAlign: "center", 
    marginTop: Spacing.lg, 
    paddingHorizontal: Spacing.xl, 
    lineHeight: 24,
  },
});
