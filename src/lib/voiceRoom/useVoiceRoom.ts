// Being in a voice room: joins over the chat socket, keeps the room state, chat and reactions,
// runs the voice (RoomMesh) and gives the screen every action the person's role allows.
import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalVoiceCall } from "@/contexts/VoiceCallContext";
import { useAuthStore } from "@/lib/authStore";
import type { VoiceChatMessage, VoiceMember, VoiceRoomState } from "@/lib/voiceRoomApi";
import { RoomMesh } from "@/lib/voiceRoom/mesh";

export type RoomStatus = "connecting" | "live" | "ended" | "removed" | "elsewhere" | "error";
export type RoomNotice =
  | { kind: "invited"; by: string }
  | { kind: "on_stage"; by: string }
  | { kind: "off_stage"; by: string }
  | { kind: "muted_by"; by: string }
  | { kind: "hand_declined" }
  | { kind: "made_moderator"; by: string }
  | { kind: "hand_raised"; name: string; userId: string }
  | { kind: "error"; reason: string };

export interface FloatingReaction {
  id: string;
  emoji: string;
  userId: string;
}

/** roomId null = not in a room (the session provider keeps this hook mounted for the whole app). */
export function useVoiceRoom(roomId: string | null) {
  const { isConnected, sendRoom, subscribeRoom, getIceServers } = (useOptionalVoiceCall() || {}) as any;
  const myId = String((useAuthStore((s: any) => s.user) as any)?.id || "");
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [reason, setReason] = useState<string>("");
  const [room, setRoom] = useState<VoiceRoomState | null>(null);
  const [chat, setChat] = useState<VoiceChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [notice, setNotice] = useState<RoomNotice | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const meshRef = useRef<RoomMesh | null>(null);
  const statusRef = useRef<RoomStatus>("connecting");
  const joinedOnce = useRef(false);
  // Which room the state below belongs to (it is reset when the room changes).
  const [stateFor, setStateFor] = useState<string | null>(roomId);

  const setSt = (s: RoomStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const send = useCallback(
    (msg: any) => {
      if (!roomId) return false;
      const okSent = sendRoom ? sendRoom({ ...msg, roomId }) : false;
      if (!okSent) setNotice({ kind: "error", reason: "offline" });
      return okSent;
    },
    [sendRoom, roomId],
  );

  const mesh = useCallback(() => {
    if (!meshRef.current && myId && roomId) {
      meshRef.current = new RoomMesh(
        roomId as string,
        myId,
        (m) => (sendRoom ? sendRoom(m) : false),
        () => getIceServers(),
        (r) => setNotice({ kind: "error", reason: r }),
      );
    }
    return meshRef.current;
  }, [roomId, myId, sendRoom, getIceServers]);

  const stopMesh = () => {
    meshRef.current?.close();
    meshRef.current = null;
  };

  // A new room (or none): start from a clean state.
  useEffect(() => {
    statusRef.current = "connecting";
    setStatus("connecting");
    setReason("");
    setRoom(null);
    setChat([]);
    setReactions([]);
    setNotice(null);
    setPendingInvite(null);
    joinedOnce.current = false;
    setStateFor(roomId);
  }, [roomId]);

  useEffect(() => {
    if (!subscribeRoom || !roomId) return;
    const off = subscribeRoom((m: any) => {
      if (m.type === "vr__ready") {
        // (Re)connected: join or re-join.
        if (statusRef.current === "connecting" || statusRef.current === "live") sendRoom?.({ type: "vr_join", roomId });
        return;
      }
      if (m.roomId && m.roomId !== roomId) return;
      switch (m.type) {
        case "vr_joined":
          joinedOnce.current = true;
          setSt("live");
          setRoom(m.room);
          if (Array.isArray(m.chat)) setChat(m.chat);
          mesh()?.update(m.room);
          break;
        case "vr_state":
          if (statusRef.current !== "live") break;
          setRoom(m.room);
          mesh()?.update(m.room);
          break;
        case "vr_signal":
          void meshRef.current?.onSignal(m.from, m.key, m.data);
          break;
        case "vr_chat_msg":
          setChat((c) => [...c.slice(-149), m.message]);
          break;
        case "vr_chat_deleted":
          setChat((c) => c.filter((x) => x.id !== m.messageId));
          break;
        case "vr_reaction": {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setReactions((r) => [...r.slice(-14), { id, emoji: m.emoji, userId: m.userId }]);
          setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2600);
          break;
        }
        case "vr_ended":
          setReason(m.reason || "ended");
          setSt("ended");
          stopMesh();
          break;
        case "vr_removed":
          setReason("removed");
          setSt("removed");
          stopMesh();
          break;
        case "vr_left":
          if (m.reason === "joined_elsewhere") {
            setReason("joined_elsewhere");
            setSt("elsewhere");
            stopMesh();
          }
          break;
        case "vr_invited":
          setPendingInvite(m.by || "");
          break;
        case "vr_on_stage":
          setNotice({ kind: "on_stage", by: m.by });
          break;
        case "vr_off_stage":
          setNotice({ kind: "off_stage", by: m.by });
          break;
        case "vr_muted_by":
          meshRef.current?.setLocalMute(true);
          setNotice({ kind: "muted_by", by: m.by });
          break;
        case "vr_hand_declined":
          setNotice({ kind: "hand_declined" });
          break;
        case "vr_made_moderator":
          setNotice({ kind: "made_moderator", by: m.by });
          break;
        case "vr_hand_raised":
          setNotice({ kind: "hand_raised", name: m.name, userId: m.userId });
          break;
        case "vr_error":
          if (m.request === "vr_join") {
            setReason(m.reason || "error");
            setSt(m.reason === "removed" ? "removed" : m.reason === "ended" ? "ended" : "error");
            stopMesh();
          } else if (m.reason !== "slow_down" || m.request === "vr_chat") {
            setNotice({ kind: "error", reason: m.reason });
          }
          break;
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeRoom, roomId, mesh]);

  // Join once the socket is up.
  useEffect(() => {
    if (roomId && isConnected && statusRef.current === "connecting") sendRoom?.({ type: "vr_join", roomId });
  }, [isConnected, roomId, sendRoom]);

  // Leave when the room changes or the session closes (not when the screen is minimized).
  useEffect(() => {
    return () => {
      if (roomId && statusRef.current === "live") sendRoom?.({ type: "vr_leave", roomId });
      stopMesh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const me: VoiceMember | undefined = room?.members.find((m) => m.userId === myId);

  const actions = {
    raiseHand: (up: boolean) => send({ type: "vr_hand", up }),
    setMuted: (muted: boolean) => {
      meshRef.current?.setLocalMute(muted);
      send({ type: "vr_mute", muted });
    },
    accept: (userId: string) => send({ type: "vr_accept", userId }),
    reject: (userId: string) => send({ type: "vr_reject", userId }),
    invite: (userId: string) => send({ type: "vr_invite", userId }),
    answerInvite: (accept: boolean) => {
      setPendingInvite(null);
      send({ type: "vr_invite_reply", accept });
    },
    toAudience: (userId?: string) => send({ type: "vr_to_audience", userId }),
    muteOther: (userId: string) => send({ type: "vr_host_mute", userId }),
    makeModerator: (userId: string) => send({ type: "vr_make_moderator", userId }),
    removeModerator: (userId: string) => send({ type: "vr_remove_moderator", userId }),
    removeFromRoom: (userId: string) => send({ type: "vr_remove", userId }),
    setStageLimit: (limit: number) => send({ type: "vr_stage_limit", limit }),
    sendChat: (text: string) => send({ type: "vr_chat", text }),
    deleteChat: (messageId: string) => send({ type: "vr_chat_delete", messageId }),
    setChatOn: (on: boolean) => send({ type: "vr_chat_toggle", on }),
    react: (emoji: string) => send({ type: "vr_react", emoji }),
    leave: () => {
      if (roomId && statusRef.current === "live") sendRoom?.({ type: "vr_leave", roomId });
      setSt("ended");
      setReason("left");
      stopMesh();
    },
    end: () => send({ type: "vr_end" }),
    setSpeaker: (on: boolean) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/lib/calls/roomAudio").roomAudio.setSpeaker(on);
    },
  };

  return {
    roomId: stateFor,
    status,
    reason,
    room,
    me,
    myId,
    chat,
    reactions,
    notice,
    clearNotice: () => setNotice(null),
    pendingInvite,
    isConnected: !!isConnected,
    actions,
  };
}
