// The app's live connection (/ws/chat) and in-app voice calls over WebRTC.
//
// The socket signs in with the user's token. It carries new direct messages straight to
// open chats, and the call set-up messages. The voice itself goes phone to phone with
// WebRTC (see src/lib/calls/rtc.ts and rtc.web.ts); the server only introduces the two
// phones (server/calls.ts).
//
// Call flow:
//   caller: startCall -> mic -> call_initiate -> call_ringing -> (callee accepts) call_accepted
//           -> offer -> answer -> connected
//   callee: incoming_call (ring) -> accept -> mic -> call_accept -> offer -> answer -> connected
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Platform, Vibration } from "react-native";
import { getApiUrl, getWsUrl } from "@/lib/query-client";
import { useAuthStore } from "@/lib/authStore";
import { emitLiveDm, emitLiveReaction } from "@/lib/dmApi";
import { rtcSupported, createPeer, getMicrophone, attachRemoteStream, detachRemoteStream, callAudio } from "@/lib/calls/rtc";
import { CallOverlay } from "@/components/CallOverlay";

export type CallPhase = "idle" | "outgoing" | "ringing" | "incoming" | "connecting" | "connected" | "ended";

export interface CallUi {
  phase: CallPhase;
  outgoing: boolean;
  callId: string | null;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  peerOnline?: boolean;
  connectedAt?: number;
  endReason?: string;
  muted: boolean;
  speaker: boolean;
}

interface VoiceCallContextValue {
  isConnected: boolean;
  call: CallUi | null;
  /** Start an in-app voice call to another Farmers user (their user id). */
  startCall: (peerId: string, peerName: string, peerAvatar?: string | null, opts?: { support?: boolean }) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

interface Props {
  children: React.ReactNode;
  userId: string;
  userName: string;
}

const CONNECT_TIMEOUT_MS = 30000;
const DISCONNECT_GRACE_MS = 12000;

function newRef() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function VoiceCallProvider({ children, userId }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [call, setCallState] = useState<CallUi | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const authedRef = useRef(false);
  const callRef = useRef<CallUi | null>(null);
  const rtc = useRef<{
    pc: any;
    local: any;
    remoteSet: boolean;
    pending: any[];
    clientRef: string | null;
    connectTimer: ReturnType<typeof setTimeout> | null;
    dropTimer: ReturnType<typeof setTimeout> | null;
    ringTimer: ReturnType<typeof setTimeout> | null;
    clearTimer: ReturnType<typeof setTimeout> | null;
  }>({ pc: null, local: null, remoteSet: false, pending: [], clientRef: null, connectTimer: null, dropTimer: null, ringTimer: null, clearTimer: null });
  const iceCache = useRef<{ at: number; servers: any[] } | null>(null);
  // A call hung up before the server gave it an id: end it as soon as the id arrives.
  const cancelledRefs = useRef<Set<string>>(new Set());

  const setCall = useCallback((next: CallUi | null | ((c: CallUi | null) => CallUi | null)) => {
    const value = typeof next === "function" ? (next as any)(callRef.current) : next;
    callRef.current = value;
    setCallState(value);
  }, []);

  const send = useCallback((msg: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && authedRef.current) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const waitForSocket = useCallback(async (ms: number) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (wsRef.current?.readyState === WebSocket.OPEN && authedRef.current) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }, []);

  const getIceServers = useCallback(async () => {
    if (iceCache.current && Date.now() - iceCache.current.at < 10 * 60 * 1000) return iceCache.current.servers;
    const fallback = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(new URL("/api/calls/ice-servers", getApiUrl()).toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json();
      const servers = Array.isArray(j?.iceServers) && j.iceServers.length ? j.iceServers : fallback;
      iceCache.current = { at: Date.now(), servers };
      return servers;
    } catch {
      return fallback;
    }
  }, []);

  /** Close the connection, stop the microphone and sounds. */
  const teardownMedia = useCallback(() => {
    const r = rtc.current;
    for (const t of [r.connectTimer, r.dropTimer, r.ringTimer]) if (t) clearTimeout(t);
    r.connectTimer = r.dropTimer = r.ringTimer = null;
    try {
      r.local?.getTracks?.().forEach((t: any) => t.stop());
    } catch {}
    try {
      r.pc?.close?.();
    } catch {}
    r.pc = null;
    r.local = null;
    r.remoteSet = false;
    r.pending = [];
    r.clientRef = null;
    detachRemoteStream();
    callAudio.stopAll();
    try {
      Vibration.cancel();
    } catch {}
  }, []);

  /** End the call on this phone and show why for a moment. */
  const finish = useCallback(
    (reason: string, opts: { silent?: boolean } = {}) => {
      teardownMedia();
      const r = rtc.current;
      if (r.clearTimer) clearTimeout(r.clearTimer);
      if (opts.silent || !callRef.current) {
        setCall(null);
        return;
      }
      setCall((c) => (c ? { ...c, phase: "ended", endReason: reason } : null));
      r.clearTimer = setTimeout(() => {
        r.clearTimer = null;
        if (callRef.current?.phase === "ended") setCall(null);
      }, 2200);
    },
    [setCall, teardownMedia],
  );

  const markConnected = useCallback(() => {
    const r = rtc.current;
    if (r.connectTimer) clearTimeout(r.connectTimer);
    r.connectTimer = null;
    if (r.dropTimer) clearTimeout(r.dropTimer);
    r.dropTimer = null;
    callAudio.stopRingback();
    setCall((c) => (c && c.phase !== "ended" ? { ...c, phase: "connected", connectedAt: c.connectedAt || Date.now() } : c));
  }, [setCall]);

  /** Build the WebRTC connection with the microphone already open. */
  const buildPeer = useCallback(
    async (peerId: string, callId: string) => {
      const servers = await getIceServers();
      const pc = createPeer({ iceServers: servers });
      const r = rtc.current;
      r.pc = pc;
      r.remoteSet = false;
      r.pending = [];
      r.local?.getTracks?.().forEach((t: any) => pc.addTrack(t, r.local));
      pc.addEventListener("icecandidate", (e: any) => {
        const c = e?.candidate;
        if (!c || !c.candidate) return;
        send({
          type: "webrtc_ice_candidate",
          callId,
          targetUserId: peerId,
          candidate: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex },
        });
      });
      pc.addEventListener("track", (e: any) => {
        const stream = e?.streams?.[0];
        if (stream) attachRemoteStream(stream);
      });
      const onState = () => {
        if (rtc.current.pc !== pc) return;
        const s = pc.connectionState || pc.iceConnectionState;
        const ice = pc.iceConnectionState;
        if (s === "connected" || ice === "connected" || ice === "completed") {
          markConnected();
        } else if (s === "failed" || ice === "failed") {
          send({ type: "call_end", callId });
          finish("connection_failed");
        } else if (s === "disconnected" || ice === "disconnected") {
          if (!rtc.current.dropTimer) {
            rtc.current.dropTimer = setTimeout(() => {
              rtc.current.dropTimer = null;
              if (rtc.current.pc !== pc) return;
              const now = pc.connectionState || pc.iceConnectionState;
              if (now !== "connected" && pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") {
                send({ type: "call_end", callId });
                finish("connection_lost");
              }
            }, DISCONNECT_GRACE_MS);
          }
        }
      };
      pc.addEventListener("connectionstatechange", onState);
      pc.addEventListener("iceconnectionstatechange", onState);
      if (r.connectTimer) clearTimeout(r.connectTimer);
      r.connectTimer = setTimeout(() => {
        if (rtc.current.pc === pc && callRef.current?.phase === "connecting") {
          send({ type: "call_end", callId });
          finish("connection_failed");
        }
      }, CONNECT_TIMEOUT_MS);
      return pc;
    },
    [finish, getIceServers, markConnected, send],
  );

  const flushCandidates = useCallback(async () => {
    const r = rtc.current;
    const list = r.pending;
    r.pending = [];
    for (const c of list) {
      try {
        await r.pc?.addIceCandidate(c);
      } catch {}
    }
  }, []);

  // ---------------------------------------------------------------- actions

  const startCall = useCallback(
    async (peerId: string, peerName: string, peerAvatar?: string | null, opts?: { support?: boolean }) => {
      if (!peerId || peerId === userId) return;
      if (callRef.current && callRef.current.phase !== "ended") return;
      if (!rtcSupported) {
        Alert.alert("Calls", "This browser can't make calls. Use the Farmers app on your phone.");
        return;
      }
      if (rtc.current.clearTimer) clearTimeout(rtc.current.clearTimer);
      const clientRef = newRef();
      rtc.current.clientRef = clientRef;
      setCall({ phase: "outgoing", outgoing: true, callId: null, peerId, peerName, peerAvatar, muted: false, speaker: false });
      try {
        rtc.current.local = await getMicrophone();
      } catch (e: any) {
        finish(e?.code === "MIC_DENIED" ? "mic_denied" : "mic_error");
        return;
      }
      if (rtc.current.clientRef !== clientRef) return; // hung up meanwhile
      void getIceServers();
      if (!(await waitForSocket(8000))) {
        finish("offline_self");
        return;
      }
      if (rtc.current.clientRef !== clientRef) return;
      callAudio.startCall(true);
      send({ type: "call_initiate", calleeId: peerId, clientRef, ...(opts?.support ? { support: true } : {}) });
    },
    [finish, getIceServers, send, setCall, userId, waitForSocket],
  );

  const accept = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.phase !== "incoming" || !c.callId) return;
    const callId = c.callId;
    callAudio.stopRingtone();
    try {
      Vibration.cancel();
    } catch {}
    setCall({ ...c, phase: "connecting" });
    try {
      rtc.current.local = await getMicrophone();
    } catch (e: any) {
      send({ type: "call_reject", callId });
      finish(e?.code === "MIC_DENIED" ? "mic_denied" : "mic_error");
      return;
    }
    if (callRef.current?.callId !== callId) return;
    try {
      await buildPeer(c.peerId, callId);
    } catch {
      send({ type: "call_reject", callId });
      finish("connection_failed");
      return;
    }
    callAudio.startCall(false);
    if (!send({ type: "call_accept", callId })) finish("offline_self");
  }, [buildPeer, finish, send, setCall]);

  const reject = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.callId) send({ type: "call_reject", callId: c.callId });
    finish("declined_by_me", { silent: true });
  }, [finish, send]);

  const hangup = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.phase === "ended") {
      finish("", { silent: true });
      return;
    }
    if (c.callId) send({ type: "call_end", callId: c.callId });
    else if (rtc.current.clientRef) cancelledRefs.current.add(rtc.current.clientRef);
    finish(c.phase === "connected" ? "hangup" : "cancelled");
  }, [finish, send]);

  const toggleMute = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const muted = !c.muted;
    try {
      rtc.current.local?.getAudioTracks?.().forEach((t: any) => (t.enabled = !muted));
    } catch {}
    setCall({ ...c, muted });
  }, [setCall]);

  const toggleSpeaker = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const speaker = !c.speaker;
    callAudio.setSpeaker(speaker);
    setCall({ ...c, speaker });
  }, [setCall]);

  // ---------------------------------------------------------------- socket

  const handleMessage = useCallback(
    async (message: any) => {
      const r = rtc.current;
      const c = callRef.current;
      switch (message?.type) {
        case "dm":
          if (message.data) emitLiveDm(message.data);
          return;

        case "dm_reaction":
          if (message.data?.messageId) emitLiveReaction(message.data);
          return;

        case "call_ringing": {
          if (message.clientRef && cancelledRefs.current.has(message.clientRef)) {
            cancelledRefs.current.delete(message.clientRef);
            send({ type: "call_end", callId: message.callId });
            return;
          }
          if (!c || !c.outgoing || message.clientRef !== r.clientRef) return;
          setCall({ ...c, callId: message.callId, phase: "ringing", peerOnline: !!message.calleeOnline, peerName: c.peerName || message.calleeName, peerAvatar: c.peerAvatar || message.calleeAvatar });
          return;
        }

        case "call_failed": {
          if (!c || !c.outgoing || (message.clientRef && message.clientRef !== r.clientRef)) return;
          finish(String(message.reason || "failed"));
          return;
        }

        case "incoming_call": {
          if (c && c.phase !== "ended") {
            // Already showing this call (e.g. delivered again after reconnecting).
            if (c.callId === message.callId) return;
            // On another call: the server normally stops this; say busy just in case.
            send({ type: "call_reject", callId: message.callId });
            return;
          }
          if (r.clearTimer) clearTimeout(r.clearTimer);
          setCall({
            phase: "incoming",
            outgoing: false,
            callId: message.callId,
            peerId: String(message.callerId),
            peerName: String(message.callerName || "Farmers user"),
            peerAvatar: message.callerAvatar || null,
            muted: false,
            speaker: false,
          });
          callAudio.startRingtone();
          if (Platform.OS !== "web") {
            try {
              Vibration.vibrate([0, 800, 1200], true);
            } catch {}
          }
          if (Platform.OS === "web" || AppState.currentState === "active") send({ type: "call_ack", callId: message.callId });
          const left = Math.max(5000, Number(message.expiresInMs) || 45000);
          r.ringTimer = setTimeout(() => {
            if (callRef.current?.callId === message.callId && callRef.current?.phase === "incoming") finish("missed", { silent: true });
          }, left + 2000);
          return;
        }

        case "call_accepted": {
          if (!c || !c.outgoing || c.callId !== message.callId) return;
          setCall({ ...c, phase: "connecting" });
          callAudio.stopRingback();
          try {
            const pc = await buildPeer(c.peerId, c.callId!);
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
            await pc.setLocalDescription(offer);
            send({ type: "webrtc_offer", callId: c.callId, targetUserId: c.peerId, offer: { type: offer.type, sdp: offer.sdp } });
          } catch {
            send({ type: "call_end", callId: c.callId });
            finish("connection_failed");
          }
          return;
        }

        case "webrtc_offer": {
          if (!c || c.callId !== message.callId || !r.pc) return;
          try {
            await r.pc.setRemoteDescription(message.offer);
            r.remoteSet = true;
            await flushCandidates();
            const answer = await r.pc.createAnswer();
            await r.pc.setLocalDescription(answer);
            send({ type: "webrtc_answer", callId: c.callId, targetUserId: c.peerId, answer: { type: answer.type, sdp: answer.sdp } });
          } catch {
            send({ type: "call_end", callId: c.callId });
            finish("connection_failed");
          }
          return;
        }

        case "webrtc_answer": {
          if (!c || c.callId !== message.callId || !r.pc) return;
          try {
            await r.pc.setRemoteDescription(message.answer);
            r.remoteSet = true;
            await flushCandidates();
          } catch {
            send({ type: "call_end", callId: c.callId });
            finish("connection_failed");
          }
          return;
        }

        case "webrtc_ice_candidate": {
          if (!c || c.callId !== message.callId || !message.candidate) return;
          if (r.pc && r.remoteSet) {
            try {
              await r.pc.addIceCandidate(message.candidate);
            } catch {}
          } else {
            r.pending.push(message.candidate);
          }
          return;
        }

        case "call_rejected": {
          if (!c || c.callId !== message.callId) return;
          finish("declined");
          return;
        }

        case "call_answered_elsewhere": {
          if (!c || c.callId !== message.callId) return;
          finish("answered_elsewhere", { silent: true });
          return;
        }

        case "call_ended": {
          if (!c || c.callId !== message.callId || c.phase === "ended") return;
          const reason = String(message.reason || "hangup");
          // A call I never answered just stops ringing.
          finish(reason, { silent: c.phase === "incoming" });
          return;
        }
      }
    },
    [buildPeer, finish, flushCandidates, send, setCall],
  );

  const handlerRef = useRef(handleMessage);
  handlerRef.current = handleMessage;

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let keepAlive: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (stopped) return;
      const token = useAuthStore.getState().token;
      if (!token) {
        retry = setTimeout(connect, 3000);
        return;
      }
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${getWsUrl()}/ws/chat`);
      } catch {
        retry = setTimeout(connect, 5000);
        return;
      }
      wsRef.current = ws;
      authedRef.current = false;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
        if (keepAlive) clearInterval(keepAlive);
        keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };
      ws.onmessage = (event: any) => {
        let message: any;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.type === "auth_success") {
          authedRef.current = true;
          attempts = 0;
          setIsConnected(true);
          return;
        }
        if (message.type === "auth_failed") {
          authedRef.current = false;
          setIsConnected(false);
          return;
        }
        void handlerRef.current(message);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          authedRef.current = false;
        }
        setIsConnected(false);
        if (keepAlive) clearInterval(keepAlive);
        keepAlive = null;
        if (stopped) return;
        attempts += 1;
        retry = setTimeout(connect, Math.min(15000, 800 * 2 ** Math.min(attempts, 5)));
      };
      ws.onerror = () => {
        setIsConnected(false);
      };
    };

    connect();
    const appSub = AppState.addEventListener("change", (st) => {
      if (st !== "active") return;
      // Back in front: reconnect straight away instead of waiting for the back-off.
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        if (retry) clearTimeout(retry);
        attempts = 0;
        connect();
      }
      const c = callRef.current;
      if (c?.phase === "incoming" && c.callId) send({ type: "call_ack", callId: c.callId });
    });

    return () => {
      stopped = true;
      appSub.remove();
      if (retry) clearTimeout(retry);
      if (keepAlive) clearInterval(keepAlive);
      const c = callRef.current;
      if (c?.callId && c.phase !== "ended") send({ type: c.phase === "incoming" ? "call_reject" : "call_end", callId: c.callId });
      teardownMedia();
      callRef.current = null;
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
      authedRef.current = false;
    };
  }, [userId, send, teardownMedia]);

  const value = useMemo<VoiceCallContextValue>(
    () => ({ isConnected, call, startCall, accept, reject, hangup, toggleMute, toggleSpeaker }),
    [isConnected, call, startCall, accept, reject, hangup, toggleMute, toggleSpeaker],
  );

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      <CallOverlay
        call={call}
        onAccept={accept}
        onReject={reject}
        onHangup={hangup}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
      />
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCallContext() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCallContext must be used inside VoiceCallProvider");
  return ctx;
}

/** Same as useVoiceCallContext, but returns null outside the provider (signed out). */
export function useOptionalVoiceCall() {
  return useContext(VoiceCallContext);
}
