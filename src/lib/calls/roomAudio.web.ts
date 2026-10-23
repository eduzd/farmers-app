// Voice room sound in the browser: one hidden <audio> per person you hear.
const els = new Map<string, HTMLAudioElement>();

export const roomAudio = {
  start() {},
  setSpeaker(_on: boolean) {},
  play(peerId: string, stream: any) {
    if (typeof document === "undefined") return;
    let el = els.get(peerId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      (el as any).playsInline = true;
      el.setAttribute("data-farmers-voice-room", peerId);
      document.body.appendChild(el);
      els.set(peerId, el);
    }
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => {});
  },
  stopPeer(peerId: string) {
    const el = els.get(peerId);
    if (!el) return;
    try {
      el.pause();
    } catch {}
    el.srcObject = null;
    el.remove();
    els.delete(peerId);
  },
  stop() {
    for (const id of Array.from(els.keys())) roomAudio.stopPeer(id);
  },
};
