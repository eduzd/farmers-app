import React from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "নিশ্চিত করুন",
  cancelText = "বাতিল",
  confirmColor,
  icon = "alert-triangle",
  iconColor,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { theme } = useTheme();
  const buttonColor = confirmColor || "#DC2626";
  const iconClr = iconColor || buttonColor;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.container, { backgroundColor: theme.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[styles.iconContainer, { backgroundColor: iconClr + "15" }]}
          >
            <AppIcon name={icon} size={32} color={iconClr} />
          </View>

          <ThemedText type="h3" style={[styles.title, { color: theme.text }]}>
            {title}
          </ThemedText>

          <ThemedText
            type="body"
            style={[styles.message, { color: theme.textSecondary }]}
          >
            {message}
          </ThemedText>

          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: theme.backgroundDefault },
              ]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <ThemedText style={{ color: theme.text }}>{cancelText}</ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: buttonColor },
              ]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {confirmText}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {},
  confirmButton: {},
});
