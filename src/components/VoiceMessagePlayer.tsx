/**
 * Play/pause control for one voice message: button, progress line, and time.
 * Only one voice message plays at a time; starting another stops the first.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { ThemedText } from "@/components/ThemedText";
import { voicePlaybackUri } from "@/lib/dmApi";

type Handle = { stop: () => void };
let nowPlaying: Handle | null = null;

export function formatVoiceTime(ms: number) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  mediaId?: string | null;
  localUri?: string | null;
  durationMs?: number | null;
  isMe: boolean;
  tint: string; // icon / progress colour on the bubble
  trackColor: string;
  textColor: string;
  onLongPress?: () => void;
}

export function VoiceMessagePlayer({ mediaId, localUri, durationMs, isMe, tint, trackColor, textColor, onLongPress }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(durationMs || 0);
  const native = useRef<AudioPlayer | null>(null);
  const web = useRef<HTMLAudioElement | null>(null);
  const handle = useRef<Handle>({ stop: () => {} });
  const mounted = useRef(true);

  useEffect(() => {
    if (durationMs && !total) setTotal(durationMs);
  }, [durationMs, total]);

  const release = () => {
    try {
      native.current?.remove();
    } catch {}
    native.current = null;
    if (web.current) {
      web.current.pause();
      web.current.src = "";
    }
    web.current = null;
  };

  handle.current.stop = () => {
    try {
      native.current?.pause();
      web.current?.pause();
    } catch {}
    if (mounted.current) setState((s) => (s === "playing" ? "paused" : s));
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (nowPlaying === handle.current) nowPlaying = null;
      release();
    };
  }, []);

  const claim = () => {
    if (nowPlaying && nowPlaying !== handle.current) nowPlaying.stop();
    nowPlaying = handle.current;
  };

  const load = async () => {
    const uri = localUri || (mediaId ? await voicePlaybackUri(mediaId) : null);
    if (!uri) throw new Error("no audio");
    if (Platform.OS === "web") {
      const a = new (globalThis as any).Audio(uri) as HTMLAudioElement;
      a.ontimeupdate = () => mounted.current && setPos(a.currentTime * 1000);
      a.onloadedmetadata = () => {
        if (isFinite(a.duration) && a.duration > 0 && mounted.current) setTotal(a.duration * 1000);
      };
      a.onended = () => {
        if (!mounted.current) return;
        setState("idle");
        setPos(0);
      };
      a.onerror = () => mounted.current && setState("error");
      web.current = a;
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    const p = createAudioPlayer({ uri }, { updateInterval: 200 });
    p.addListener("playbackStatusUpdate", (s) => {
      if (!mounted.current) return;
      if (s.duration && s.duration > 0) setTotal(s.duration * 1000);
      setPos((s.currentTime || 0) * 1000);
      if (s.didJustFinish) {
        setState("idle");
        setPos(0);
        p.pause();
        p.seekTo(0).catch(() => {});
      }
    });
    native.current = p;
  };

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (state === "loading") return;
    if (state === "playing") {
      native.current?.pause();
      web.current?.pause();
      setState("paused");
      return;
    }
    try {
      if (!native.current && !web.current) {
        setState("loading");
        await load();
        if (!mounted.current) return release();
      }
      claim();
      if (web.current) await web.current.play();
      else native.current?.play();
      setState("playing");
    } catch (e) {
      console.warn("[voice] playback failed", e);
      release();
      if (mounted.current) setState("error");
    }
  };

  const shown = state === "playing" || state === "paused" ? pos : total;
  const progress = total > 0 ? Math.min(1, pos / total) : 0;
  const icon = state === "playing" ? "pause" : state === "error" ? "rotate-cw" : "play";

  return (
    <Pressable
      style={styles.row}
      onPress={toggle}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={state === "playing" ? "Pause voice message" : "Play voice message"}
    >
      <View style={[styles.button, { borderColor: tint }]}>
        {state === "loading" ? <ActivityIndicator size="small" color={tint} /> : <Feather name={icon} size={16} color={tint} style={icon === "play" ? { marginLeft: 2 } : undefined} />}
      </View>
      <View style={styles.middle}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View style={[styles.fill, { backgroundColor: tint, width: `${progress * 100}%` }]} />
        </View>
        <ThemedText style={[styles.time, { color: textColor }]}>
          {state === "error" ? "Couldn't play. Tap to retry" : formatVoiceTime(shown)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minWidth: 180, gap: 10 },
  button: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, gap: 4 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  time: { fontSize: 12 },
});
