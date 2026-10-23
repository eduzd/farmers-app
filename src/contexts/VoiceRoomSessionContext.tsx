// Keeps the voice room session alive above the navigator, so the room screen can be minimized into a floating
// bubble while the person keeps listening (and talking) and moves around the rest of the app.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { Palette, Shadows } from "@/constants/theme";
import { useI18n } from "@/lib/i18n";
import { navigationRef } from "@/lib/navigationRef";
import { useVoiceRoom } from "@/lib/voiceRoom/useVoiceRoom";
import { onStage, voiceReasonText } from "@/lib/voiceRoomApi";

type VR = ReturnType<typeof useVoiceRoom>;

export interface VoiceRoomSession {
  /** The room the person is in, or null. */
  roomId: string | null;
  minimized: boolean;
  preview: any;
  vr: VR;
  /** Enter (or re-open) a room's full screen. Switching rooms leaves the old one. */
  open: (roomId: string, preview?: any) => void;
  /** Collapse to the floating bubble; the room keeps running. */
  minimize: () => void;
  /** Fully out of the room (after leave / end, or when it ended). */
  close: () => void;
}

const Ctx = createContext<VoiceRoomSession | null>(null);

export function useVoiceRoomSession() {
  return useContext(Ctx);
}

const useNative = Platform.OS !== "web";

export function VoiceRoomSessionProvider({ children }: { children: React.ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const vr = useVoiceRoom(roomId);

  const open = useCallback((id: string, p?: any) => {
    setRoomId(id);
    if (p) setPreview(p);
    setMinimized(false);
  }, []);
  const minimize = useCallback(() => setMinimized(true), []);
  const close = useCallback(() => {
    setRoomId(null);
    setMinimized(false);
    setPreview(null);
  }, []);

  const value = useMemo<VoiceRoomSession>(
    () => ({ roomId, minimized, preview, vr, open, minimize, close }),
    [roomId, minimized, preview, vr, open, minimize, close],
  );

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {roomId && minimized ? <FloatingRoomBubble session={value} /> : null}
      </View>
    </Ctx.Provider>
  );
}

const SIZE = 64;
const EDGE = 10;

/** The round floating bubble shown while a room is minimized. Drag it anywhere; it snaps to the nearest side. */
function FloatingRoomBubble({ session }: { session: VoiceRoomSession }) {
  const { vr, roomId } = session;
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const bn = language === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const last = useRef({ x: 0, y: 0 });
  const placed = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;

  const state = vr.roomId === roomId ? vr : null;
  const room = state?.room || null;
  const me = state?.me;
  const isHost = me?.role === "host";
  const onStageMe = !!me && onStage(me.role);
  const muted = !!me?.muted;
  const host = room?.members.find((m) => m.role === "host");
  const face = host || room?.members.find((m) => onStage(m.role)) || null;
  const speaking = (room?.members || []).filter((m) => onStage(m.role) && !m.muted && m.online).length > 0;
  const people = room?.members.length || 0;

  // The room ended (or the person was removed) while minimized: tell them and drop the bubble.
  useEffect(() => {
    if (!state) return;
    if (state.status === "ended" || state.status === "removed" || state.status === "elsewhere" || state.status === "error") {
      const text = state.reason === "left" ? "" : voiceReasonText(state.reason || "ended", bn);
      session.close();
      if (text) Alert.alert(L("Voice room", "ভয়েস রুম"), text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, friction: 6, tension: 80, useNativeDriver: useNative }).start();
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
    );
    loop.start();
    return () => loop.stop();
  }, [appear, pulse]);

  const bounds = useCallback(
    () => ({
      minX: EDGE,
      maxX: Math.max(EDGE, area.w - SIZE - EDGE),
      minY: insets.top + 60,
      maxY: Math.max(insets.top + 60, area.h - SIZE - insets.bottom - 96),
    }),
    [area, insets],
  );

  // First placement: right side, a little above the bottom tab bar.
  useEffect(() => {
    if (!area.w || !area.h) return;
    const b = bounds();
    if (!placed.current) {
      placed.current = true;
      last.current = { x: b.maxX, y: b.maxY - 40 };
    } else {
      last.current = { x: Math.min(Math.max(last.current.x, b.minX), b.maxX), y: Math.min(Math.max(last.current.y, b.minY), b.maxY) };
    }
    pos.setValue(last.current);
  }, [area, bounds, pos]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          pos.setOffset(last.current);
          pos.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_e, g) => {
          pos.flattenOffset();
          const b = bounds();
          const x = last.current.x + g.dx;
          const y = Math.min(Math.max(last.current.y + g.dy, b.minY), b.maxY);
          const snapX = x + SIZE / 2 < area.w / 2 ? b.minX : b.maxX;
          last.current = { x: snapX, y };
          Animated.spring(pos, { toValue: last.current, friction: 7, tension: 60, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => {
          pos.flattenOffset();
          Animated.spring(pos, { toValue: last.current, useNativeDriver: false }).start();
        },
      }),
    [area, bounds, pos],
  );

  const expand = () => {
    if (!roomId) return;
    if (navigationRef.isReady()) navigationRef.navigate("VoiceRoom", { roomId, room: session.preview || undefined });
  };

  const confirm = (title: string, body: string, yes: string, onYes: () => void) => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${body}`)) onYes();
      return;
    }
    Alert.alert(title, body, [
      { text: L("Cancel", "বাতিল"), style: "cancel" },
      { text: yes, style: "destructive", onPress: onYes },
    ]);
  };

  const leave = () => {
    if (!state) return session.close();
    if (isHost && state.status === "live") {
      confirm(
        L("End the room?", "রুম শেষ করবেন?"),
        L("You're the host, so the room ends for everyone.", "আপনি হোস্ট, তাই সবার জন্য রুম শেষ হবে।"),
        L("End room", "শেষ করুন"),
        () => {
          state.actions.end();
          session.close();
        },
      );
      return;
    }
    confirm(L("Leave the room?", "রুম ছাড়বেন?"), room?.title || "", L("Leave", "ছাড়ুন"), () => {
      state.actions.leave();
      session.close();
    });
  };

  const toggleMic = () => {
    if (!state || !onStageMe) return;
    state.actions.setMuted(!muted);
  };

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {area.w ? (
        <Animated.View
          {...responder.panHandlers}
          style={[styles.wrap, { transform: [...pos.getTranslateTransform(), { scale: appear }] }]}
          testID="vr-bubble"
        >
          {/* pulse halo while someone on stage can talk */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                opacity: speaking ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }) : 0,
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
              },
            ]}
          />
          <Pressable
            onPress={expand}
            onLongPress={leave}
            style={({ pressed }) => [styles.bubble, Shadows.large, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityRole="button"
            accessibilityLabel={L(`Open voice room ${room?.title || ""}`, `ভয়েস রুম খুলুন ${room?.title || ""}`)}
            accessibilityHint={L("Long press to leave", "ছাড়তে চেপে ধরে রাখুন")}
          >
            <LinearGradient colors={[Palette.leafLight, Palette.leafDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
              {face ? (
                <UserAvatar name={face.name} avatar={face.avatar || undefined} size={SIZE - 12} presence={null} />
              ) : (
                <Feather name="mic" size={26} color="#FFFFFF" />
              )}
            </LinearGradient>
          </Pressable>

          {/* LIVE tag */}
          <View pointerEvents="none" style={styles.liveTag}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveText}>{state?.status === "live" ? (bn ? "লাইভ" : "LIVE") : "…"}</ThemedText>
          </View>

          {/* Leave (×) */}
          <Pressable onPress={leave} hitSlop={8} style={styles.closeBtn} accessibilityLabel={isHost ? L("End room", "রুম শেষ করুন") : L("Leave room", "রুম ছাড়ুন")} testID="vr-bubble-leave">
            <Feather name="x" size={11} color="#FFFFFF" />
          </Pressable>

          {/* Mic (on stage) or listener badge */}
          <Pressable
            onPress={toggleMic}
            disabled={!onStageMe}
            hitSlop={8}
            style={[styles.micBtn, { backgroundColor: onStageMe ? (muted ? "#E5484D" : "#FFFFFF") : "#FFFFFF" }]}
            accessibilityLabel={onStageMe ? (muted ? L("Unmute", "আনমিউট") : L("Mute", "মিউট")) : L("Listening", "শুনছেন")}
            testID="vr-bubble-mic"
          >
            <Feather name={onStageMe ? (muted ? "mic-off" : "mic") : "headphones"} size={12} color={onStageMe && muted ? "#FFFFFF" : Palette.leaf} />
          </Pressable>

          {state?.pendingInvite != null ? <View pointerEvents="none" style={styles.inviteDot} /> : null}

          {people ? (
            <View pointerEvents="none" style={styles.countPill}>
              <Feather name="users" size={9} color="#FFFFFF" />
              <ThemedText style={styles.countText}>{bn ? people.toLocaleString("bn-BD") : people}</ThemedText>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, top: 0, width: SIZE, height: SIZE + 14, alignItems: "center", zIndex: 999, elevation: 30 },
  halo: { position: "absolute", top: 0, width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: Palette.leafLight },
  bubble: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, borderColor: "#FFFFFF", overflow: "hidden", backgroundColor: Palette.leaf },
  gradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  liveTag: {
    position: "absolute",
    top: -6,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E5484D",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFFFFF" },
  liveText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.4, lineHeight: 12 },
  closeBtn: {
    position: "absolute",
    top: 2,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(20,30,25,0.85)",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    position: "absolute",
    top: SIZE - 22,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Palette.leafSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteDot: { position: "absolute", top: 2, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: Palette.harvest, borderWidth: 2, borderColor: "#FFFFFF" },
  countPill: {
    position: "absolute",
    top: SIZE - 4,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(20,30,25,0.85)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", lineHeight: 14 },
});
