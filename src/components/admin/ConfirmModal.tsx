import React from "react";
import { Feather } from "@expo/vector-icons";
import { ConfirmSheet, type ConfirmTone } from "@/components/ConfirmSheet";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  tone?: ConfirmTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Controlled confirm dialog; renders the shared Farmers bottom sheet. */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "নিশ্চিত করুন",
  cancelText = "বাতিল",
  confirmColor,
  icon,
  tone,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Older callers pass a colour: green means a positive action, anything else (default red) a destructive one.
  const green = confirmColor && /^#(16A34A|22C55E|1E7F4F|2FA36B)/i.test(confirmColor);
  const resolvedTone: ConfirmTone = tone || (green ? "primary" : "danger");
  return (
    <ConfirmSheet
      visible={visible}
      title={title}
      message={message}
      tone={resolvedTone}
      icon={icon}
      loading={isLoading}
      onRequestClose={onCancel}
      buttons={[
        { text: cancelText, style: "cancel", onPress: onCancel },
        { text: confirmText, style: resolvedTone === "danger" ? "destructive" : "default", onPress: onConfirm },
      ]}
    />
  );
}
