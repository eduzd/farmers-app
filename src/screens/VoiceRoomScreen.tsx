import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  interpolate,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width } = Dimensions.get("window");

interface Speaker {
  id: string;
  name: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isHost: boolean;
  role?: string;
}

interface Listener {
  id: string;
  name: string;
  avatar: string;
  hasRaisedHand: boolean;
}

const MOCK_SPEAKERS: Speaker[] = [];

const MOCK_LISTENERS: Listener[] = [];

const SpeakerCard = ({ speaker, isLarge }: { speaker: Speaker; isLarge?: boolean }) => {
  const { theme } = useTheme();
  const pulseAnim = useSharedValue(1);
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    if (speaker.isSpeaking && !speaker.isMuted) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        true
      );
      waveAnim.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false
      );
    } else {
      pulseAnim.value = withTiming(1);
      waveAnim.value = 0;
    }
  }, [speaker.isSpeaking, speaker.isMuted]);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const waveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(waveAnim.value, [0, 0.5, 1], [0.6, 0.2, 0]),
    transform: [{ scale: interpolate(waveAnim.value, [0, 1], [1, 1.8]) }],
  }));

  const avatarSize = isLarge ? 90 : 70;
  const ringSize = avatarSize + 12;

  return (
    <Animated.View style={[styles.speakerCard, isLarge && styles.speakerCardLarge]}>
      <View style={[styles.speakerAvatarWrapper, { width: ringSize, height: ringSize }]}>
        {speaker.isSpeaking && !speaker.isMuted ? (
          <>
            <Animated.View
              style={[
                styles.speakingWave,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
                waveStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.speakingWave,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2, opacity: 0.3 },
              ]}
            />
          </>
        ) : null}
        <Animated.View
          style={[
            styles.speakerAvatarRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: speaker.isSpeaking && !speaker.isMuted ? "#2FA36B" : theme.cardBorder,
              backgroundColor: theme.card,
            },
            avatarStyle,
          ]}
        >
          <Image
            source={{ uri: speaker.avatar }}
            style={[styles.speakerAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          />
        </Animated.View>
        
        {speaker.isMuted ? (
          <View style={[styles.statusBadge, styles.mutedBadge]}>
            <Feather name="mic-off" size={10} color="#fff" />
          </View>
        ) : speaker.isSpeaking ? (
          <View style={[styles.statusBadge, styles.speakingBadge]}>
            <Feather name="mic" size={10} color="#fff" />
          </View>
        ) : null}
        
        {speaker.isHost ? (
          <View style={[styles.hostBadge]}>
            <Feather name="star" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
      
      <ThemedText style={[styles.speakerName, { color: theme.text }]} numberOfLines={1}>
        {speaker.name}
      </ThemedText>
      {speaker.role ? (
        <ThemedText style={[styles.speakerRole, { color: theme.primary }]} numberOfLines={1}>
          {speaker.role}
        </ThemedText>
      ) : speaker.isHost ? (
        <ThemedText style={[styles.speakerRole, { color: "#EA8A0C" }]}>হোস্ট</ThemedText>
      ) : null}
    </Animated.View>
  );
};

const ListenerBubble = ({ listener }: { listener: Listener }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.listenerBubble}>
      <View style={styles.listenerAvatarWrapper}>
        <Image source={{ uri: listener.avatar }} style={styles.listenerAvatar} />
        {listener.hasRaisedHand ? (
          <View style={styles.handRaisedBadge}>
            <ThemedText style={styles.handEmoji}>✋</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={[styles.listenerName, { color: theme.textSecondary }]} numberOfLines={1}>
        {listener.name.split(" ")[0]}
      </ThemedText>
    </View>
  );
};

export default function VoiceRoomScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const room = route.params?.room;
  const isHost = route.params?.isHost || false;

  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(isHost);
  const [speakers] = useState(MOCK_SPEAKERS);
  const [listeners] = useState(MOCK_LISTENERS);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMuteToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
  };

  const handleRaiseHand = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasRaisedHand(!hasRaisedHand);
  };

  const handleLeaveRoom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "রুম থেকে বের হবেন?",
      "আপনি কি নিশ্চিত?",
      [
        { text: "না", style: "cancel" },
        { text: "হ্যাঁ", style: "destructive", onPress: () => navigation.goBack() },
      ]
    );
  };

  const hostSpeaker = speakers.find(s => s.isHost);
  const otherSpeakers = speakers.filter(s => !s.isHost);
  const raisedHandCount = listeners.filter(l => l.hasRaisedHand).length;

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={[theme.primary + "15", theme.backgroundRoot, theme.backgroundRoot]}
        style={styles.gradientBg}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <View style={styles.livePillContainer}>
            <LinearGradient
              colors={["#DC2626", "#DB2777"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.livePill}
            >
              <View style={styles.liveIndicator} />
              <ThemedText style={styles.liveText}>LIVE</ThemedText>
              <ThemedText style={styles.timeText}>{formatTime(elapsedTime)}</ThemedText>
            </LinearGradient>
          </View>

          <ThemedText style={[styles.roomTitle, { color: theme.text }]}>
            {room?.title || "ধান চাষে নতুন প্রযুক্তি"}
          </ThemedText>
          <ThemedText style={[styles.roomSubtitle, { color: theme.textSecondary }]}>
            {room?.topic || "আধুনিক পদ্ধতিতে ধান চাষ কিভাবে করবেন তার বিস্তারিত আলোচনা"}
          </ThemedText>

          <View style={styles.statsContainer}>
            <View style={[styles.statItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Feather name="mic" size={16} color="#2FA36B" />
              <ThemedText style={[styles.statNumber, { color: theme.text }]}>{speakers.length}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>স্পিকার</ThemedText>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Feather name="headphones" size={16} color="#2563EB" />
              <ThemedText style={[styles.statNumber, { color: theme.text }]}>{listeners.length}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>শ্রোতা</ThemedText>
            </View>
            {raisedHandCount > 0 ? (
              <View style={[styles.statItem, { backgroundColor: "#2FA36B15", borderColor: "#2FA36B" }]}>
                <ThemedText style={styles.statEmoji}>✋</ThemedText>
                <ThemedText style={[styles.statNumber, { color: "#2FA36B" }]}>{raisedHandCount}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: "#2FA36B" }]}>হাত</ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={styles.stageSection}>
          <View style={[styles.stageBg, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.stageHeader}>
              <View style={styles.stageIcon}>
                <Feather name="mic" size={14} color="#2FA36B" />
              </View>
              <ThemedText style={[styles.stageTitle, { color: theme.text }]}>মঞ্চে</ThemedText>
            </View>

            {hostSpeaker ? (
              <View style={styles.hostSection}>
                <SpeakerCard speaker={hostSpeaker} isLarge />
              </View>
            ) : null}

            <View style={styles.speakersRow}>
              {otherSpeakers.map((speaker, index) => (
                <Animated.View key={speaker.id} entering={FadeInUp.delay(200 + index * 50)}>
                  <SpeakerCard speaker={speaker} />
                </Animated.View>
              ))}
              {isSpeaker ? (
                <Animated.View entering={FadeInUp.delay(400)}>
                  <SpeakerCard
                    speaker={{
                      id: "self",
                      name: "আপনি",
                      avatar: "https://randomuser.me/api/portraits/men/1.jpg",
                      isSpeaking: !isMuted,
                      isMuted,
                      isHost,
                    }}
                  />
                </Animated.View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.audienceSection}>
          <View style={styles.sectionHeader}>
            <Feather name="users" size={16} color="#2563EB" />
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>শ্রোতা</ThemedText>
            <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
              ({listeners.length})
            </ThemedText>
          </View>
          <View style={styles.listenersGrid}>
            {listeners.map((listener, index) => (
              <Animated.View key={listener.id} entering={FadeInUp.delay(300 + index * 30)}>
                <ListenerBubble listener={listener} />
              </Animated.View>
            ))}
            {!isSpeaker ? (
              <Animated.View entering={FadeInUp.delay(500)}>
                <ListenerBubble
                  listener={{
                    id: "self",
                    name: "আপনি",
                    avatar: "https://randomuser.me/api/portraits/men/1.jpg",
                    hasRaisedHand,
                  }}
                />
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown}
        style={[styles.controlBar, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <LinearGradient
          colors={[theme.card + "00", theme.card, theme.card]}
          style={styles.controlBarGradient}
        />
        <View style={styles.controlsRow}>
          <Pressable
            style={[styles.controlBtn, styles.leaveBtn]}
            onPress={handleLeaveRoom}
          >
            <Feather name="phone-off" size={18} color="#fff" />
            <ThemedText style={styles.controlBtnText}>বের হন</ThemedText>
          </Pressable>

          {!isSpeaker ? (
            <Pressable
              style={[
                styles.handBtn,
                hasRaisedHand && styles.handBtnActive,
              ]}
              onPress={handleRaiseHand}
            >
              <ThemedText style={styles.handBtnEmoji}>✋</ThemedText>
              <ThemedText style={[styles.handBtnText, hasRaisedHand && { color: "#fff" }]}>
                {hasRaisedHand ? "হাত নামান" : "হাত তুলুন"}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.micBtn, isMuted && styles.micBtnMuted]}
              onPress={handleMuteToggle}
            >
              <Feather name={isMuted ? "mic-off" : "mic"} size={28} color="#fff" />
            </Pressable>
          )}

          <Pressable
            style={[styles.controlBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => Haptics.selectionAsync()}
          >
            <Feather name="share-2" size={18} color={theme.text} />
            <ThemedText style={[styles.controlBtnText, { color: theme.text }]}>শেয়ার</ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradientBg: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { alignItems: "center", marginBottom: Spacing.xl },
  livePillContainer: { marginBottom: Spacing.md },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  timeText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },
  roomTitle: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: Spacing.xs },
  roomSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: Spacing.lg },
  statsContainer: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statNumber: { fontSize: 15, fontWeight: "700" },
  statLabel: { fontSize: 12 },
  statEmoji: { fontSize: 14 },
  stageSection: { marginBottom: Spacing.xl },
  stageBg: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg },
  stageHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  stageIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2FA36B15",
    alignItems: "center",
    justifyContent: "center",
  },
  stageTitle: { fontSize: 16, fontWeight: "600" },
  hostSection: { alignItems: "center", marginBottom: Spacing.lg },
  speakersRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing.lg },
  speakerCard: { alignItems: "center", width: 85 },
  speakerCardLarge: { width: 110 },
  speakerAvatarWrapper: { position: "relative", alignItems: "center", justifyContent: "center" },
  speakingWave: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#2FA36B",
  },
  speakerAvatarRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  speakerAvatar: {},
  statusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  mutedBadge: { backgroundColor: "#DC2626" },
  speakingBadge: { backgroundColor: "#2FA36B" },
  hostBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EA8A0C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  speakerName: { fontSize: 13, fontWeight: "600", marginTop: Spacing.sm, textAlign: "center" },
  speakerRole: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  audienceSection: {},
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  sectionCount: { fontSize: 14 },
  listenersGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  listenerBubble: { alignItems: "center", width: 60 },
  listenerAvatarWrapper: { position: "relative" },
  listenerAvatar: { width: 48, height: 48, borderRadius: 24 },
  handRaisedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2FA36B",
    alignItems: "center",
    justifyContent: "center",
  },
  handEmoji: { fontSize: 10 },
  listenerName: { fontSize: 11, marginTop: 4, textAlign: "center" },
  controlBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.xl,
  },
  controlBarGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  leaveBtn: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  controlBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  handBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: "#f5f5f5",
    gap: Spacing.sm,
  },
  handBtnActive: { backgroundColor: "#2FA36B" },
  handBtnEmoji: { fontSize: 18 },
  handBtnText: { fontSize: 14, fontWeight: "600", color: "#333" },
  micBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2FA36B",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#2FA36B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  micBtnMuted: { backgroundColor: "#DC2626", shadowColor: "#DC2626" },
});
