import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

interface VoiceCallScreenProps {
  visible: boolean;
  status: "idle" | "calling" | "ringing" | "connected" | "ended";
  remoteUserName: string | null;
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onEndCall?: () => void;
  onToggleMute?: () => void;
  onToggleSpeaker?: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceCallScreen({
  visible,
  status,
  remoteUserName,
  duration,
  isMuted,
  isSpeakerOn,
  onAccept,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
}: VoiceCallScreenProps) {
  const insets = useSafeAreaInsets();
  const pulseScale = useSharedValue(1);
  const ringRotation = useSharedValue(0);
  const [isOnHold, setIsOnHold] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [isBluetoothOn, setIsBluetoothOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);

  useEffect(() => {
    if (status === "ringing" || status === "calling") {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );

      ringRotation.value = withRepeat(
        withSequence(
          withTiming(12, { duration: 80 }),
          withTiming(-12, { duration: 80 }),
          withTiming(12, { duration: 80 }),
          withTiming(-12, { duration: 80 }),
          withTiming(0, { duration: 80 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        false
      );

      if (status === "ringing") {
        const interval = setInterval(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }, 2000);
        return () => clearInterval(interval);
      }
    } else {
      pulseScale.value = withTiming(1);
      ringRotation.value = withTiming(0);
    }
  }, [status, pulseScale, ringRotation]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const getStatusText = () => {
    switch (status) {
      case "calling":
        return "কল করা হচ্ছে...";
      case "ringing":
        return "ইনকামিং কল";
      case "connected":
        if (isOnHold) return "হোল্ডে আছে";
        return formatDuration(duration);
      default:
        return "";
    }
  };

  const handleAccept = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAccept?.();
  };

  const handleReject = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onReject?.();
  };

  const handleEndCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onEndCall?.();
  };

  const handleToggleHold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOnHold(!isOnHold);
  };

  const handleToggleKeypad = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowKeypad(!showKeypad);
  };

  const handleToggleBluetooth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsBluetoothOn(!isBluetoothOn);
  };

  const handleToggleVideo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsVideoOn(!isVideoOn);
  };

  const handleKeypadPress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!visible || status === "idle") return null;

  const keypadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <LinearGradient
        colors={["#0f172a", "#1e293b", "#334155"]}
        style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      >
        {status === "ringing" && (
          <View style={styles.incomingBadge}>
            <Feather name="phone-incoming" size={16} color="#16A34A" />
            <Text style={styles.incomingBadgeText}>ইনকামিং কল</Text>
          </View>
        )}

        <View style={styles.userSection}>
          <Animated.View style={[styles.avatarContainer, pulseStyle]}>
            <View style={styles.avatarRing}>
              <LinearGradient
                colors={status === "connected" ? ["#16A34A", "#16a34a"] : ["#2563EB", "#2563eb"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {remoteUserName?.charAt(0).toUpperCase() || "?"}
                </Text>
              </LinearGradient>
            </View>
            {status === "connected" && (
              <View style={styles.connectedIndicator}>
                <View style={styles.connectedDot} />
              </View>
            )}
          </Animated.View>

          <Text style={styles.userName}>{remoteUserName || "Unknown"}</Text>
          
          <Animated.View style={ringStyle}>
            <Text style={[
              styles.statusText,
              status === "connected" && !isOnHold && styles.statusTextConnected,
              isOnHold && styles.statusTextHold,
            ]}>
              {getStatusText()}
            </Text>
          </Animated.View>

          {status === "connected" && (
            <Text style={styles.callQuality}>HD অডিও</Text>
          )}
        </View>

        {status === "connected" && !showKeypad && (
          <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(200)}
            style={styles.controlsGrid}
          >
            <View style={styles.controlsRow}>
              <Pressable
                style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggleMute?.();
                }}
              >
                <View style={[styles.controlIconBg, isMuted && styles.controlIconBgActive]}>
                  <Feather
                    name={isMuted ? "mic-off" : "mic"}
                    size={24}
                    color={isMuted ? "#DC2626" : "white"}
                  />
                </View>
                <Text style={styles.controlLabel}>
                  {isMuted ? "আনমিউট" : "মিউট"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.controlButton, showKeypad && styles.controlButtonActive]}
                onPress={handleToggleKeypad}
              >
                <View style={[styles.controlIconBg, showKeypad && styles.controlIconBgActive]}>
                  <Feather name="grid" size={24} color="white" />
                </View>
                <Text style={styles.controlLabel}>কীপ্যাড</Text>
              </Pressable>

              <Pressable
                style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggleSpeaker?.();
                }}
              >
                <View style={[styles.controlIconBg, isSpeakerOn && styles.controlIconBgActive]}>
                  <Feather
                    name={isSpeakerOn ? "volume-2" : "volume"}
                    size={24}
                    color={isSpeakerOn ? "#16A34A" : "white"}
                  />
                </View>
                <Text style={styles.controlLabel}>
                  {isSpeakerOn ? "স্পিকার অন" : "স্পিকার"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.controlsRow}>
              <Pressable
                style={[styles.controlButton, isOnHold && styles.controlButtonActive]}
                onPress={handleToggleHold}
              >
                <View style={[styles.controlIconBg, isOnHold && styles.controlIconBgActive]}>
                  <Feather
                    name="pause"
                    size={24}
                    color={isOnHold ? "#EA8A0C" : "white"}
                  />
                </View>
                <Text style={styles.controlLabel}>
                  {isOnHold ? "রিজিউম" : "হোল্ড"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.controlButton, isVideoOn && styles.controlButtonActive]}
                onPress={handleToggleVideo}
              >
                <View style={[styles.controlIconBg, isVideoOn && styles.controlIconBgActive]}>
                  <Feather
                    name={isVideoOn ? "video" : "video-off"}
                    size={24}
                    color={isVideoOn ? "#2563EB" : "white"}
                  />
                </View>
                <Text style={styles.controlLabel}>
                  {isVideoOn ? "ভিডিও অন" : "ভিডিও"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.controlButton, isBluetoothOn && styles.controlButtonActive]}
                onPress={handleToggleBluetooth}
              >
                <View style={[styles.controlIconBg, isBluetoothOn && styles.controlIconBgActive]}>
                  <Feather
                    name="bluetooth"
                    size={24}
                    color={isBluetoothOn ? "#7C3AED" : "white"}
                  />
                </View>
                <Text style={styles.controlLabel}>
                  {isBluetoothOn ? "BT অন" : "ব্লুটুথ"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {status === "connected" && showKeypad && (
          <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(200)}
            style={styles.keypadContainer}
          >
            <Pressable style={styles.keypadClose} onPress={handleToggleKeypad}>
              <Feather name="chevron-down" size={24} color="white" />
              <Text style={styles.keypadCloseText}>কীপ্যাড বন্ধ করুন</Text>
            </Pressable>
            {keypadKeys.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    style={styles.keypadKey}
                    onPress={() => handleKeypadPress(key)}
                  >
                    <Text style={styles.keypadKeyText}>{key}</Text>
                    {key === "2" && <Text style={styles.keypadKeySubtext}>ABC</Text>}
                    {key === "3" && <Text style={styles.keypadKeySubtext}>DEF</Text>}
                    {key === "4" && <Text style={styles.keypadKeySubtext}>GHI</Text>}
                    {key === "5" && <Text style={styles.keypadKeySubtext}>JKL</Text>}
                    {key === "6" && <Text style={styles.keypadKeySubtext}>MNO</Text>}
                    {key === "7" && <Text style={styles.keypadKeySubtext}>PQRS</Text>}
                    {key === "8" && <Text style={styles.keypadKeySubtext}>TUV</Text>}
                    {key === "9" && <Text style={styles.keypadKeySubtext}>WXYZ</Text>}
                    {key === "0" && <Text style={styles.keypadKeySubtext}>+</Text>}
                  </Pressable>
                ))}
              </View>
            ))}
          </Animated.View>
        )}

        <View style={styles.actionSection}>
          {status === "ringing" ? (
            <View style={styles.incomingActions}>
              <View style={styles.incomingActionWrapper}>
                <Pressable
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={handleReject}
                >
                  <Feather name="phone-off" size={32} color="white" />
                </Pressable>
                <Text style={styles.actionLabel}>প্রত্যাখ্যান</Text>
              </View>

              <View style={styles.incomingActionWrapper}>
                <Pressable
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={handleAccept}
                >
                  <Feather name="phone" size={32} color="white" />
                </Pressable>
                <Text style={styles.actionLabel}>গ্রহণ করুন</Text>
              </View>
            </View>
          ) : status === "calling" ? (
            <View style={styles.callingActions}>
              <Pressable
                style={[styles.actionButton, styles.endCallButton]}
                onPress={handleEndCall}
              >
                <Feather name="phone-off" size={32} color="white" />
              </Pressable>
              <Text style={styles.cancelText}>বাতিল করুন</Text>
            </View>
          ) : (
            <View style={styles.connectedActions}>
              <Pressable
                style={[styles.actionButton, styles.endCallButton]}
                onPress={handleEndCall}
              >
                <Feather name="phone-off" size={32} color="white" />
              </Pressable>
              <Text style={styles.cancelText}>কল শেষ</Text>
            </View>
          )}
        </View>

        {status === "calling" && (
          <View style={styles.callingHint}>
            <Feather name="wifi" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.hintText}>
              ইন্টারনেট কলের মাধ্যমে সংযোগ করা হচ্ছে
            </Text>
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
  },
  incomingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginTop: 10,
  },
  incomingBadgeText: {
    color: "#16A34A",
    fontSize: 14,
    fontWeight: "600",
  },
  userSection: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  avatarContainer: {
    marginBottom: 24,
    position: "relative",
  },
  avatarRing: {
    padding: 4,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 56,
    fontWeight: "700",
    color: "white",
  },
  connectedIndicator: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#1e293b",
    padding: 4,
    borderRadius: 12,
  },
  connectedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#16A34A",
  },
  userName: {
    fontSize: 32,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
    textAlign: "center",
  },
  statusText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  statusTextConnected: {
    color: "#16A34A",
    fontWeight: "600",
  },
  statusTextHold: {
    color: "#EA8A0C",
    fontWeight: "600",
  },
  callQuality: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  controlsGrid: {
    width: "100%",
    paddingHorizontal: 20,
    gap: 16,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  controlButton: {
    alignItems: "center",
    width: 90,
  },
  controlButtonActive: {},
  controlIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  controlIconBgActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  controlLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  keypadContainer: {
    width: "100%",
    paddingHorizontal: 40,
    gap: 12,
  },
  keypadClose: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  keypadCloseText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keypadKey: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  keypadKeyText: {
    color: "white",
    fontSize: 32,
    fontWeight: "500",
  },
  keypadKeySubtext: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    marginTop: 2,
  },
  actionSection: {
    alignItems: "center",
    paddingBottom: 20,
  },
  incomingActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 80,
  },
  incomingActionWrapper: {
    alignItems: "center",
  },
  actionLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
  },
  callingActions: {
    alignItems: "center",
  },
  connectedActions: {
    alignItems: "center",
  },
  cancelText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  acceptButton: {
    backgroundColor: "#16A34A",
  },
  rejectButton: {
    backgroundColor: "#DC2626",
  },
  endCallButton: {
    backgroundColor: "#DC2626",
  },
  callingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
  },
  hintText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
});
