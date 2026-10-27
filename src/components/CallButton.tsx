import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/MayaText";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

interface CallButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  label?: string;
}

export function CallButton({
  onPress,
  disabled = false,
  size = "medium",
  label,
}: CallButtonProps) {
  const handlePress = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const buttonSize = {
    small: 36,
    medium: 44,
    large: 56,
  }[size];

  const iconSize = {
    small: 18,
    medium: 22,
    large: 28,
  }[size];

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
          disabled && styles.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Feather name="phone" size={iconSize} color="white" />
      </Pressable>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  button: {
    backgroundColor: "#00BB77",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00BB77",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabled: {
    backgroundColor: "#7A8CA3",
    shadowOpacity: 0,
  },
  label: {
    fontSize: 12,
    color: "#7A8CA3",
    marginTop: 4,
  },
});
