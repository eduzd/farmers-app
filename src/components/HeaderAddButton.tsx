import React, { useLayoutEffect } from "react";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";

/**
 * Puts a round "+" action in the stack header (replaces floating buttons that covered list text).
 * Call inside a stack screen: useHeaderAddButton(() => setOpen(true), "New poll").
 */
export function useHeaderAddButton(onPress: () => void, label: string, icon: keyof typeof Feather.glyphMap = "plus") {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.primary,
            marginRight: 4,
          }}
        >
          <Feather name={icon} size={20} color="#FFFFFF" />
        </Pressable>
      ),
    });
  }, [navigation, label, theme.primary]);
}
