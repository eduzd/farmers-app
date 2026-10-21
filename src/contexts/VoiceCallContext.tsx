import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { getWsUrl } from "@/lib/query-client";
import { Platform, Alert, AppState } from "react-native";
import { useAuthStore } from "@/lib/authStore";
import { emitLiveDm } from "@/lib/dmApi";
import { VoiceCallScreen } from "@/components/VoiceCallScreen";

interface CallState {
  callId: string | null;
  status: "idle" | "calling" | "ringing" | "connected" | "ended";
  remoteUserId: string | null;
  remoteUserName: string | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  duration: number;
}

interface VoiceCallContextType {
  callState: CallState;
  initiateCall: (calleeId: string, calleeName: string) => void;
  isConnected: boolean;
}

const VoiceCallContext = createContext<VoiceCallContextType | null>(null);

interface VoiceCallProviderProps {
  children: ReactNode;
  userId: string;
  userName: string;
}

export function VoiceCallProvider({ children, userId, userName }: VoiceCallProviderProps) {
  const [callState, setCallState] = useState<CallState>({
    callId: null,
    status: "idle",
    remoteUserId: null,
    remoteUserName: null,
    isMuted: false,
    isSpeakerOn: false,
    duration: 0,
  });

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setCallState({
      callId: null,
      status: "idle",
      remoteUserId: null,
      remoteUserName: null,
      isMuted: false,
      isSpeakerOn: false,
      duration: 0,
    });
  }, []);

  const startDurationTimer = useCallback(() => {
    durationIntervalRef.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  const createPeerConnection = useCallback(async (targetUserId: string, callId: string) => {
    if (Platform.OS !== "web") {
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "webrtc_ice_candidate",
            callId,
            targetUserId,
            candidate: event.candidate,
          })
        );
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(console.error);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        cleanup();
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (error) {
      console.error("Failed to get audio stream:", error);
      Alert.alert("Error", "Could not access microphone");
      cleanup();
      return null;
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [cleanup]);

  useEffect(() => {
    // Live socket: new direct messages appear at once (chats also poll, so this is a bonus),
    // and call signalling. It signs in with the account token, and reconnects when the
    // phone changes network or the server restarts.
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    let ws: WebSocket;

    const connect = () => {
      if (stopped) return;
      const token = useAuthStore.getState().getToken();
      if (!token) return;
      ws = new WebSocket(`${getWsUrl()}/ws/chat`);
      wsRef.current = ws;
      ws.onopen = () => {
        attempts = 0;
        setIsConnected(true);
        ws.send(JSON.stringify({ type: "auth", token }));
        if (keepAlive) clearInterval(keepAlive);
        keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };
      ws.onclose = () => {
        setIsConnected(false);
        if (keepAlive) clearInterval(keepAlive);
        keepAlive = null;
        if (stopped) return;
        attempts += 1;
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts, 5)));
      };
      ws.onerror = () => {
        setIsConnected(false);
      };
      ws.onmessage = (event) => handleMessage(event);
    };

    const handleMessage = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "dm":
            if (message.data) emitLiveDm(message.data);
            break;

          case "incoming_call":
            setCallState({
              callId: message.callId,
              status: "ringing",
              remoteUserId: message.callerId,
              remoteUserName: message.callerName || "Unknown",
              isMuted: false,
              isSpeakerOn: false,
              duration: 0,
            });
            break;

          case "call_ringing":
            setCallState((prev) => ({
              ...prev,
              callId: message.callId,
              status: "calling",
            }));
            break;

          case "call_accepted":
            setCallState((prev) => ({ ...prev, status: "connected" }));
            startDurationTimer();

            if (Platform.OS === "web" && callState.remoteUserId) {
              const pc = await createPeerConnection(callState.remoteUserId, message.callId);
              if (pc) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                ws.send(
                  JSON.stringify({
                    type: "webrtc_offer",
                    callId: message.callId,
                    targetUserId: callState.remoteUserId,
                    offer,
                  })
                );
              }
            }
            break;

          case "call_rejected":
          case "call_ended":
          case "call_failed":
            cleanup();
            if (message.type === "call_failed" && message.reason === "user_offline") {
              Alert.alert("Call Failed", "User is currently offline");
            }
            break;

          case "webrtc_offer":
            if (peerConnectionRef.current && message.offer) {
              await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(message.offer)
              );
              const answer = await peerConnectionRef.current.createAnswer();
              await peerConnectionRef.current.setLocalDescription(answer);

              ws.send(
                JSON.stringify({
                  type: "webrtc_answer",
                  callId: message.callId,
                  targetUserId: message.fromUserId,
                  answer,
                })
              );
            }
            break;

          case "webrtc_answer":
            if (peerConnectionRef.current && message.answer) {
              await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(message.answer)
              );
            }
            break;

          case "webrtc_ice_candidate":
            if (peerConnectionRef.current && message.candidate) {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );
            }
            break;
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    connect();
    const appSub = AppState.addEventListener("change", (st) => {
      // Back in front: reconnect straight away instead of waiting for the back-off.
      if (st === "active" && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        if (retry) clearTimeout(retry);
        attempts = 0;
        connect();
      }
    });

    return () => {
      stopped = true;
      appSub.remove();
      if (retry) clearTimeout(retry);
      if (keepAlive) clearInterval(keepAlive);
      try {
        wsRef.current?.close();
      } catch {}
      cleanup();
    };
  }, [userId, cleanup, startDurationTimer, createPeerConnection]);

  const initiateCall = useCallback(
    (calleeId: string, calleeName: string) => {
      if (!wsRef.current || callState.status !== "idle") {
        if (callState.status !== "idle") {
          Alert.alert("Call in Progress", "Please end the current call first");
        }
        return;
      }

      setCallState({
        callId: null,
        status: "calling",
        remoteUserId: calleeId,
        remoteUserName: calleeName,
        isMuted: false,
        isSpeakerOn: false,
        duration: 0,
      });

      wsRef.current.send(
        JSON.stringify({
          type: "call_initiate",
          calleeId,
          callerName: userName,
        })
      );

      if (Platform.OS === "web") {
        createPeerConnection(calleeId, "pending");
      }
    },
    [callState.status, userName, createPeerConnection]
  );

  const acceptCall = useCallback(async () => {
    if (!wsRef.current || !callState.callId) return;

    wsRef.current.send(
      JSON.stringify({
        type: "call_accept",
        callId: callState.callId,
      })
    );

    setCallState((prev) => ({ ...prev, status: "connected" }));
    startDurationTimer();

    if (Platform.OS === "web" && callState.remoteUserId && callState.callId) {
      await createPeerConnection(callState.remoteUserId, callState.callId);
    }
  }, [callState.callId, callState.remoteUserId, createPeerConnection, startDurationTimer]);

  const rejectCall = useCallback(() => {
    if (!wsRef.current || !callState.callId) return;

    wsRef.current.send(
      JSON.stringify({
        type: "call_reject",
        callId: callState.callId,
      })
    );

    cleanup();
  }, [callState.callId, cleanup]);

  const endCall = useCallback(() => {
    if (!wsRef.current || !callState.callId) return;

    wsRef.current.send(
      JSON.stringify({
        type: "call_end",
        callId: callState.callId,
      })
    );

    cleanup();
  }, [callState.callId, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setCallState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setCallState((prev) => ({ ...prev, isSpeakerOn: !prev.isSpeakerOn }));
  }, []);

  return (
    <VoiceCallContext.Provider value={{ callState, initiateCall, isConnected }}>
      {children}
      <VoiceCallScreen
        visible={callState.status !== "idle"}
        status={callState.status}
        remoteUserName={callState.remoteUserName}
        duration={callState.duration}
        isMuted={callState.isMuted}
        isSpeakerOn={callState.isSpeakerOn}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEndCall={endCall}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
      />
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCallContext() {
  const context = useContext(VoiceCallContext);
  return context;
}
