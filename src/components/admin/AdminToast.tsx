import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { MayaRadius } from "@/constants/mayaTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/icons/AppIcon";
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
  success: { icon: "check-circle", color: "#00BB77", bgColor: "#00BB7715" },
  error: { icon: "x-circle", color: "#DA2F2F", bgColor: "#DA2F2F15" },
  warning: { icon: "alert-triangle", color: "#B25E09", bgColor: "#B25E0915" },
  info: { icon: "info", color: "#2E96EF", bgColor: "#2E96EF15" },
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
          <AppIcon name={config.icon} size={18} color={config.color} />
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
    borderRadius: MayaRadius.lg,
    // Maya surfaces are flat: a 1px hairline instead of a drop shadow.
    borderWidth: 1,
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
