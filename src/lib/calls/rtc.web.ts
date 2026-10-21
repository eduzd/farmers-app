// Browser side of in-app calls: the browser's own WebRTC, an <audio> element for the other
// person's voice, and a soft beep for ringing.
export const rtcSupported =
  typeof window !== "undefined" && typeof (window as any).RTCPeerConnection === "function" && !!navigator?.mediaDevices?.getUserMedia;

export function createPeer(config: { iceServers: any[] }): any {
  return new (window as any).RTCPeerConnection(config);
}

export async function getMicrophone(): Promise<any> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err: any) {
    const e: any = new Error("Microphone permission was not given");
    e.code = err?.name === "NotAllowedError" ? "MIC_DENIED" : "MIC_ERROR";
    throw e;
  }
}

let audioEl: HTMLAudioElement | null = null;

export function attachRemoteStream(stream: any) {
  if (typeof document === "undefined") return;
  if (!audioEl) {
    audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    (audioEl as any).playsInline = true;
    audioEl.setAttribute("data-farmers-call", "remote");
    document.body.appendChild(audioEl);
  }
  audioEl.srcObject = stream;
  void audioEl.play().catch(() => {});
}

export function detachRemoteStream() {
  if (audioEl) {
    try {
      audioEl.pause();
    } catch {}
    audioEl.srcObject = null;
    audioEl.remove();
    audioEl = null;
  }
}

let ctx: AudioContext | null = null;
let beepTimer: ReturnType<typeof setInterval> | null = null;

function beepPattern(freqs: number[], everyMs: number) {
  stopBeeps();
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    const play = () => {
      if (!ctx) return;
      const t = ctx.currentTime;
      freqs.forEach((f, i) => {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.45);
        g.gain.exponentialRampToValueAtTime(0.15, t + i * 0.45 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.45 + 0.4);
        o.connect(g).connect(ctx!.destination);
        o.start(t + i * 0.45);
        o.stop(t + i * 0.45 + 0.42);
      });
    };
    play();
    beepTimer = setInterval(play, everyMs);
  } catch {}
}

function stopBeeps() {
  if (beepTimer) clearInterval(beepTimer);
  beepTimer = null;
}

export const callAudio = {
  startRingtone() {
    beepPattern([660, 880], 2500);
  },
  stopRingtone() {
    stopBeeps();
  },
  startCall(outgoing: boolean) {
    if (outgoing) beepPattern([440], 3000);
  },
  stopRingback() {
    stopBeeps();
  },
  setSpeaker(_on: boolean) {},
  stopAll() {
    stopBeeps();
  },
};
