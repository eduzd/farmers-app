import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * Plays a clip the server sent as base64 (AI voice answers, admin voice previews).
 * Web: an <audio> element on a data URL. Phone: written to the cache folder, then played with expo-audio.
 * Only one clip plays at a time. Resolves when the clip ends or is stopped.
 */
let current: { stop: () => void } | null = null;

export function stopAiAudio() {
  current?.stop();
  current = null;
}

export async function playBase64Audio(base64: string, mime = "audio/mpeg"): Promise<void> {
  stopAiAudio();
  if (Platform.OS === "web") {
    return new Promise<void>((resolve) => {
      const a = new (globalThis as any).Audio(`data:${mime};base64,${base64}`);
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      a.onended = finish;
      a.onerror = finish;
      current = { stop: () => { try { a.pause(); } catch {} finish(); } };
      a.play().catch(finish);
    });
  }
  const ext = mime.includes("wav") ? "wav" : "mp3";
  const uri = `${FileSystem.cacheDirectory}ai-voice-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  return new Promise<void>((resolve) => {
    let p: AudioPlayer | null = createAudioPlayer({ uri }, { updateInterval: 250 });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { p?.pause(); p?.remove(); } catch {}
      p = null;
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      resolve();
    };
    p.addListener("playbackStatusUpdate", (s: any) => { if (s?.didJustFinish) finish(); });
    current = { stop: finish };
    try { p.play(); } catch { finish(); }
    // safety net: never hang the call if the player never reports the end
    setTimeout(finish, 90_000);
  });
}
