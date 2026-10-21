// Phone (Android / iOS) side of in-app calls: WebRTC from react-native-webrtc, and call
// audio routing, ringtone and ringback from react-native-incall-manager.
import { PermissionsAndroid, Platform } from "react-native";
import { RTCPeerConnection, mediaDevices } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";

export const rtcSupported = true;

export function createPeer(config: { iceServers: any[] }): any {
  return new RTCPeerConnection(config as any);
}

export async function getMicrophone(): Promise<any> {
  if (Platform.OS === "android") {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) {
      const e: any = new Error("Microphone permission was not given");
      e.code = "MIC_DENIED";
      throw e;
    }
  }
  return mediaDevices.getUserMedia({ audio: true, video: false } as any);
}

// On phones the other person's voice plays by itself once the track arrives.
export function attachRemoteStream(_stream: any) {}
export function detachRemoteStream() {}

let audioMode: "none" | "ringtone" | "call" = "none";

export const callAudio = {
  /** Incoming call: the phone's ringtone. */
  startRingtone() {
    try {
      InCallManager.startRingtone("_DEFAULT_", [0, 800, 1200], "playback", 45);
      audioMode = "ringtone";
    } catch {}
  },
  stopRingtone() {
    try {
      InCallManager.stopRingtone();
    } catch {}
    if (audioMode === "ringtone") audioMode = "none";
  },
  /** Outgoing call or answered call: call audio mode (earpiece, proximity sensor). */
  startCall(outgoing: boolean) {
    try {
      InCallManager.start({ media: "audio", auto: true, ringback: outgoing ? "_DTMF_" : "" } as any);
      InCallManager.setKeepScreenOn(true);
      audioMode = "call";
    } catch {}
  },
  stopRingback() {
    try {
      InCallManager.stopRingback();
    } catch {}
  },
  setSpeaker(on: boolean) {
    try {
      InCallManager.setForceSpeakerphoneOn(on);
    } catch {}
  },
  stopAll() {
    try {
      InCallManager.stopRingtone();
    } catch {}
    try {
      InCallManager.stopRingback();
    } catch {}
    try {
      InCallManager.setKeepScreenOn(false);
      InCallManager.stop();
    } catch {}
    audioMode = "none";
  },
};
