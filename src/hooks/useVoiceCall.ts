import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";

interface CallState {
  callId: string | null;
  status: "idle" | "calling" | "ringing" | "connected" | "ended";
  remoteUserId: string | null;
  remoteUserName: string | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  duration: number;
}

interface WebSocketMessage {
  type: string;
  callId?: string;
  callerId?: string;
  calleeId?: string;
  callerName?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  fromUserId?: string;
  reason?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useVoiceCall(userId: string, ws: WebSocket | null) {
  const [callState, setCallState] = useState<CallState>({
    callId: null,
    status: "idle",
    remoteUserId: null,
    remoteUserName: null,
    isMuted: false,
    isSpeakerOn: false,
    duration: 0,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const createPeerConnection = useCallback(async () => {
    if (Platform.OS !== "web") {
      console.log("WebRTC not fully supported on native, using audio messages");
      return null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && callState.remoteUserId) {
        ws.send(
          JSON.stringify({
            type: "webrtc_ice_candidate",
            callId: callState.callId,
            targetUserId: callState.remoteUserId,
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
      cleanup();
      return null;
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [ws, callState.callId, callState.remoteUserId, cleanup]);

  const initiateCall = useCallback(
    async (calleeId: string, calleeName: string, callerName: string) => {
      if (!ws || callState.status !== "idle") return;

      setCallState({
        callId: null,
        status: "calling",
        remoteUserId: calleeId,
        remoteUserName: calleeName,
        isMuted: false,
        isSpeakerOn: false,
        duration: 0,
      });

      ws.send(
        JSON.stringify({
          type: "call_initiate",
          calleeId,
          callerName,
        })
      );
    },
    [ws, callState.status]
  );

  const acceptCall = useCallback(async () => {
    if (!ws || !callState.callId) return;

    ws.send(
      JSON.stringify({
        type: "call_accept",
        callId: callState.callId,
      })
    );

    setCallState((prev) => ({ ...prev, status: "connected" }));
    startDurationTimer();

    if (Platform.OS === "web") {
      const pc = await createPeerConnection();
      if (pc && callState.remoteUserId) {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(
          JSON.stringify({
            type: "webrtc_answer",
            callId: callState.callId,
            targetUserId: callState.remoteUserId,
            answer,
          })
        );
      }
    }
  }, [ws, callState.callId, callState.remoteUserId, createPeerConnection, startDurationTimer]);

  const rejectCall = useCallback(() => {
    if (!ws || !callState.callId) return;

    ws.send(
      JSON.stringify({
        type: "call_reject",
        callId: callState.callId,
      })
    );

    cleanup();
  }, [ws, callState.callId, cleanup]);

  const endCall = useCallback(() => {
    if (!ws || !callState.callId) return;

    ws.send(
      JSON.stringify({
        type: "call_end",
        callId: callState.callId,
      })
    );

    cleanup();
  }, [ws, callState.callId, cleanup]);

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

  useEffect(() => {
    if (!ws) return;

    const handleMessage = async (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case "incoming_call":
            setCallState({
              callId: message.callId!,
              status: "ringing",
              remoteUserId: message.callerId!,
              remoteUserName: message.callerName || "Unknown",
              isMuted: false,
              isSpeakerOn: false,
              duration: 0,
            });
            break;

          case "call_ringing":
            setCallState((prev) => ({
              ...prev,
              callId: message.callId!,
              status: "calling",
            }));
            break;

          case "call_accepted":
            setCallState((prev) => ({ ...prev, status: "connected" }));
            startDurationTimer();

            if (Platform.OS === "web") {
              const pc = await createPeerConnection();
              if (pc && callState.remoteUserId) {
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
            cleanup();
            break;

          case "call_ended":
            cleanup();
            break;

          case "call_failed":
            cleanup();
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
        console.error("Error handling call message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, callState.remoteUserId, createPeerConnection, startDurationTimer, cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    callState,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
