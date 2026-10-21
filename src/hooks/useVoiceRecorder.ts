/**
 * Record a voice message.
 * Phones (Android/iOS): expo-audio, AAC in an .m4a file, mono 64 kbps (about 0.5 MB a minute).
 * Browsers: MediaRecorder (mp4 where the browser can, otherwise webm).
 * start() asks for the microphone the first time; stop() returns the file; cancel() throws it away.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";

export const MAX_VOICE_MS = 2 * 60 * 1000;
export const MIN_VOICE_MS = 700;

const VOICE_PRESET: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 64000 },
};

export interface FinishedRecording {
  uri: string;
  durationMs: number;
}

function askForSettings(message: string) {
  Alert.alert("Microphone needed", message, [
    { text: "Not now", style: "cancel" },
    ...(Platform.OS !== "web" ? [{ text: "Open settings", onPress: () => Linking.openSettings().catch(() => {}) }] : []),
  ]);
}

export function useVoiceRecorder(onAutoStop?: (r: FinishedRecording | null) => void) {
  const recorder = useAudioRecorder(VOICE_PRESET);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false);
  const active = useRef(false);
  const autoStopRef = useRef(onAutoStop);
  autoStopRef.current = onAutoStop;
  // Browser recording
  const media = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; mime: string } | null>(null);

  const stopTicker = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };

  const finish = useCallback(
    async (keep: boolean): Promise<FinishedRecording | null> => {
      if (!active.current) return null;
      active.current = false;
      stopTicker();
      const elapsed = Date.now() - startedAt.current;
      setIsRecording(false);
      setDurationMs(0);
      let uri: string | null = null;
      if (Platform.OS === "web") {
        const m = media.current;
        media.current = null;
        if (m) {
          uri = await new Promise<string | null>((resolve) => {
            m.rec.onstop = () => {
              m.stream.getTracks().forEach((t) => t.stop());
              if (!keep || !m.chunks.length) return resolve(null);
              resolve(URL.createObjectURL(new Blob(m.chunks, { type: m.mime })));
            };
            try {
              m.rec.stop();
            } catch {
              m.stream.getTracks().forEach((t) => t.stop());
              resolve(null);
            }
          });
        }
      } else {
        try {
          await recorder.stop();
          uri = recorder.uri;
        } catch {
          uri = null;
        }
        // Back to normal playback (loudspeaker on iPhone).
        setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      }
      if (!keep || !uri) return null;
      if (elapsed < MIN_VOICE_MS) return null;
      return { uri, durationMs: Math.min(elapsed, MAX_VOICE_MS) };
    },
    [recorder]
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (busy.current || active.current) return false;
    busy.current = true;
    try {
      if (Platform.OS === "web") {
        const md: any = typeof navigator !== "undefined" ? (navigator as any).mediaDevices : null;
        if (!md?.getUserMedia || typeof (globalThis as any).MediaRecorder === "undefined") {
          Alert.alert("Voice messages", "This browser can't record audio. Use the Farmers app on your phone, or try Chrome.");
          return false;
        }
        let stream: MediaStream;
        try {
          stream = await md.getUserMedia({ audio: true });
        } catch {
          askForSettings("Allow microphone access for this site in your browser to send voice messages.");
          return false;
        }
        const MR: typeof MediaRecorder = (globalThis as any).MediaRecorder;
        const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((t) => MR.isTypeSupported?.(t)) || "";
        const rec = new MR(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        media.current = { rec, stream, chunks, mime: (rec.mimeType || mime || "audio/webm").split(";")[0] };
        rec.start(250);
      } else {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          askForSettings("Allow Farmers to use the microphone in your phone's settings to send voice messages.");
          return false;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      active.current = true;
      startedAt.current = Date.now();
      setDurationMs(0);
      setIsRecording(true);
      ticker.current = setInterval(() => {
        const ms = Date.now() - startedAt.current;
        setDurationMs(ms);
        if (ms >= MAX_VOICE_MS) {
          finish(true).then((r) => autoStopRef.current?.(r));
        }
      }, 200);
      return true;
    } catch (e) {
      console.warn("[voice] couldn't start recording", e);
      if (Platform.OS !== "web") setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      Alert.alert("Voice messages", "Couldn't start the microphone. Close other apps that are recording and try again.");
      return false;
    } finally {
      busy.current = false;
    }
  }, [recorder, finish]);

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(() => finish(false).then(() => undefined), [finish]);

  // Leaving the chat mid-recording throws the recording away and frees the mic.
  useEffect(() => () => {
    if (active.current) finish(false);
  }, [finish]);

  return { isRecording, durationMs, start, stop, cancel };
}
