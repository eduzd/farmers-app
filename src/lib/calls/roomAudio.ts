// Voice room sound on phones: react-native-webrtc plays remote audio by itself, so this only
// puts the phone in call-audio mode with the loudspeaker on (a room is listened to like a radio).
import InCallManager from "react-native-incall-manager";

export const roomAudio = {
  start() {
    try {
      InCallManager.start({ media: "audio", auto: false } as any);
      InCallManager.setForceSpeakerphoneOn(true);
      InCallManager.setKeepScreenOn(true);
    } catch {}
  },
  setSpeaker(on: boolean) {
    try {
      InCallManager.setForceSpeakerphoneOn(on);
    } catch {}
  },
  play(_peerId: string, _stream: any) {},
  stopPeer(_peerId: string) {},
  stop() {
    try {
      InCallManager.setKeepScreenOn(false);
      InCallManager.stop();
    } catch {}
  },
};
