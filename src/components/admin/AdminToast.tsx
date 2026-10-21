import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "warning" | "info";

interface AdminToastProps {
  visible: boolean;
  type: ToastType;
  message: string;
  duration?: number;
  onHide: () => void;
}

const toastConfig: Record<
  ToastType,
  { icon: keyof typeof Feather.glyphMap; color: string; bgColor: string }
> = {
  success: { icon: "check-circle", color: "#16A34A", bgColor: "#16A34A15" },
  error: { icon: "x-circle", color: "#DC2626", bgColor: "#DC262615" },
  warning: { icon: "alert-triangle", color: "#EA8A0C", bgColor: "#EA8A0C15" },
  info: { icon: "info", color: "#2563EB", bgColor: "#2563EB15" },
};

export function AdminToast({
  visible,
  type,
  message,
  duration = 3000,
  onHide,
}: AdminToastProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = toastConfig[type];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + Spacing.md,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable
        style={[
          styles.toast,
          { backgroundColor: theme.card, borderColor: config.color + "30" },
        ]}
        onPress={hideToast}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
          <Feather name={config.icon} size={18} color={config.color} />
        </View>
        <ThemedText
          style={[styles.message, { color: theme.text }]}
          numberOfLines={2}
        >
          {message}
        </ThemedText>
        <Feather name="x" size={16} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: 14,
    marginRight: Spacing.sm,
  },
});
