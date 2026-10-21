import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "user" | "company";
  content: string;
  messageType: "text" | "image" | "voice";
  createdAt: string;
  isMe?: boolean;
}

interface WebSocketMessage {
  type: string;
  data?: ChatMessage;
  conversationId?: string;
  userId?: string;
  isTyping?: boolean;
}

interface UseChatOptions {
  userId: string;
  conversationId: string;
  onMessage?: (message: ChatMessage) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
}

export function useChat({ userId, conversationId, onMessage, onTyping }: UseChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const apiUrl = getApiUrl();
    const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
    const host = apiUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${host}/ws/chat`;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);

        ws.send(
          JSON.stringify({
            type: "auth",
            userId,
            conversationIds: [conversationId],
          })
        );

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "auth_success":
              console.log("WebSocket authenticated");
              break;

            case "message":
            case "message_sent":
              if (message.data) {
                const chatMessage: ChatMessage = {
                  ...message.data,
                  isMe: message.data.senderId === userId,
                };
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === chatMessage.id);
                  if (exists) return prev;
                  return [...prev, chatMessage];
                });
                onMessage?.(chatMessage);
              }
              break;

            case "typing":
              if (message.userId && message.conversationId === conversationId) {
                if (message.isTyping) {
                  setTypingUsers((prev) => new Set(prev).add(message.userId!));
                } else {
                  setTypingUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(message.userId!);
                    return next;
                  });
                }
                onTyping?.(message.userId, !!message.isTyping);
              }
              break;

            case "pong":
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setIsConnecting(false);
    }
  }, [userId, conversationId, getWebSocketUrl, onMessage, onTyping]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(
    (content: string, messageType: "text" | "image" | "voice" = "text") => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not connected");
        return false;
      }

      wsRef.current.send(
        JSON.stringify({
          type: "send_message",
          conversationId,
          senderId: userId,
          senderType: "user",
          content,
          messageType,
        })
      );

      return true;
    },
    [conversationId, userId]
  );

  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          conversationId,
          isTyping,
        })
      );
    },
    [conversationId]
  );

  const joinConversation = useCallback((newConversationId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "join_conversation",
        conversationId: newConversationId,
      })
    );
  }, []);

  const leaveConversation = useCallback((oldConversationId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "leave_conversation",
        conversationId: oldConversationId,
      })
    );
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      connect();
    } else {
      const timer = setTimeout(connect, 100);
      return () => clearTimeout(timer);
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    messages,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    sendTypingStatus,
    joinConversation,
    leaveConversation,
    setMessages,
    connect,
    disconnect,
  };
}
