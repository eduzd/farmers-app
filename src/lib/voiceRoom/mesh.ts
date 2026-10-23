// The voice in a voice room: every person on stage sends their mic to everyone in the room
// (phone to phone, WebRTC). Listeners only receive. Two listeners are never connected.
//
// Each pair of people gets one connection, named by both people's "epoch" (it goes up when
// someone's role changes or they reconnect), so a change on stage simply replaces the
// connections of that person. The person with the smaller id makes the offer.
import { createPeer, getMicrophone } from "@/lib/calls/rtc";
import { roomAudio } from "@/lib/calls/roomAudio";
import type { VoiceMember, VoiceRoomState } from "@/lib/voiceRoomApi";
import { onStage } from "@/lib/voiceRoomApi";

type Peer = { pc: any; key: string; remoteSet: boolean; pendingIce: any[]; offerer: boolean; retried: boolean };

export class RoomMesh {
  private peers = new Map<string, Peer>();
  private mic: any = null;
  private micPending: Promise<any> | null = null;
  private state: VoiceRoomState | null = null;
  private closed = false;
  private iceServers: any[] | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private roomId: string,
    private me: string,
    private send: (msg: any) => boolean,
    private getIce: () => Promise<any[]>,
    private onMicError: (reason: string) => void,
  ) {
    roomAudio.start();
  }

  private meMember(): VoiceMember | undefined {
    return this.state?.members.find((m) => m.userId === this.me);
  }

  private pairKey(other: VoiceMember) {
    const mine = this.meMember();
    const a = `${this.me}:${mine?.epoch ?? 0}`;
    const b = `${other.userId}:${other.epoch}`;
    return this.me < other.userId ? `${a}|${b}` : `${b}|${a}`;
  }

  /** Who I should be connected to right now, with the connection's name. */
  private wanted(): Map<string, string> {
    const out = new Map<string, string>();
    const mine = this.meMember();
    if (!mine || !this.state) return out;
    const iAmOnStage = onStage(mine.role);
    for (const m of this.state.members) {
      if (m.userId === this.me || !m.online) continue;
      if (iAmOnStage || onStage(m.role)) out.set(m.userId, this.pairKey(m));
    }
    return out;
  }

  /** Called with every room state from the server. */
  update(state: VoiceRoomState) {
    this.state = state;
    this.chain = this.chain.then(() => this.sync()).catch(() => {});
  }

  private async ice() {
    if (!this.iceServers) {
      try {
        this.iceServers = await this.getIce();
      } catch {
        this.iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
      }
    }
    return this.iceServers;
  }

  private async ensureMic(want: boolean) {
    if (!want) {
      if (this.mic) {
        try {
          this.mic.getTracks().forEach((t: any) => t.stop());
        } catch {}
        this.mic = null;
      }
      return null;
    }
    if (this.mic) return this.mic;
    if (!this.micPending) {
      this.micPending = getMicrophone()
        .then((s) => {
          this.mic = s;
          return s;
        })
        .catch(() => {
          this.onMicError("mic_denied");
          return null;
        })
        .finally(() => {
          this.micPending = null;
        });
    }
    return this.micPending;
  }

  private applyMute() {
    const mine = this.meMember();
    const enabled = !!mine && onStage(mine.role) && !mine.muted;
    try {
      this.mic?.getAudioTracks().forEach((t: any) => (t.enabled = enabled));
    } catch {}
  }

  private async sync() {
    if (this.closed || !this.state) return;
    const mine = this.meMember();
    await this.ensureMic(!!mine && onStage(mine.role));
    if (this.closed) return;
    this.applyMute();
    const wanted = this.wanted();
    for (const [id, p] of Array.from(this.peers.entries())) {
      if (wanted.get(id) !== p.key) this.dropPeer(id);
    }
    for (const [id, key] of wanted) {
      if (this.peers.has(id)) continue;
      if (this.me < id) await this.makeOffer(id, key);
      // Otherwise wait for their offer.
    }
  }

  private dropPeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    try {
      p.pc.close();
    } catch {}
    roomAudio.stopPeer(id);
  }

  private async newPeer(id: string, key: string, offerer: boolean): Promise<Peer> {
    const pc: any = createPeer({ iceServers: await this.ice() });
    const peer: Peer = { pc, key, remoteSet: false, pendingIce: [], offerer, retried: false };
    pc.onicecandidate = (e: any) => {
      if (e?.candidate) this.send({ type: "vr_signal", roomId: this.roomId, userId: id, key, data: { kind: "ice", candidate: e.candidate } });
    };
    pc.ontrack = (e: any) => {
      const stream = e?.streams?.[0];
      if (stream) roomAudio.play(id, stream);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if ((st === "failed" || st === "closed") && this.peers.get(id) === peer) {
        // Try once more with a fresh connection.
        this.dropPeer(id);
        if (!this.closed && st === "failed") setTimeout(() => this.state && this.update(this.state), 1500);
      }
    };
    this.peers.set(id, peer);
    return peer;
  }

  private addMic(pc: any) {
    const track = this.mic?.getAudioTracks?.()[0];
    if (track) {
      try {
        pc.addTrack(track, this.mic);
        return true;
      } catch {}
    }
    return false;
  }

  private async makeOffer(id: string, key: string) {
    const peer = await this.newPeer(id, key, true);
    const pc = peer.pc;
    const mine = this.meMember();
    const sending = !!mine && onStage(mine.role) && this.addMic(pc);
    if (!sending) {
      try {
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch {}
    }
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      if (this.peers.get(id) !== peer) return;
      await pc.setLocalDescription(offer);
      this.send({ type: "vr_signal", roomId: this.roomId, userId: id, key, data: { kind: "offer", sdp: pc.localDescription?.sdp || offer.sdp } });
    } catch {
      this.dropPeer(id);
    }
  }

  /** A set-up message from someone in the room. */
  async onSignal(from: string, key: string, data: any) {
    if (this.closed || !data) return;
    const want = this.wanted().get(from);
    if (!want || want !== key) return; // old or not for us
    if (data.kind === "offer") {
      this.dropPeer(from);
      const peer = await this.newPeer(from, key, false);
      const pc = peer.pc;
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        peer.remoteSet = true;
        const mine = this.meMember();
        if (mine && onStage(mine.role)) {
          await this.ensureMic(true);
          this.applyMute();
          this.addMic(pc);
        }
        const answer = await pc.createAnswer();
        if (this.peers.get(from) !== peer) return;
        await pc.setLocalDescription(answer);
        this.send({ type: "vr_signal", roomId: this.roomId, userId: from, key, data: { kind: "answer", sdp: pc.localDescription?.sdp || answer.sdp } });
        for (const c of peer.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } catch {
        this.dropPeer(from);
      }
      return;
    }
    const peer = this.peers.get(from);
    if (!peer || peer.key !== key) return;
    if (data.kind === "answer" && peer.offerer && !peer.remoteSet) {
      try {
        await peer.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        peer.remoteSet = true;
        for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
      } catch {
        this.dropPeer(from);
      }
    } else if (data.kind === "ice" && data.candidate) {
      if (peer.remoteSet) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
      else peer.pendingIce.push(data.candidate);
    }
  }

  /** Mute or unmute my mic right away (the server is told separately). */
  setLocalMute(muted: boolean) {
    try {
      this.mic?.getAudioTracks().forEach((t: any) => (t.enabled = !muted));
    } catch {}
  }

  close() {
    this.closed = true;
    for (const id of Array.from(this.peers.keys())) this.dropPeer(id);
    void this.ensureMic(false);
    roomAudio.stop();
  }
}
