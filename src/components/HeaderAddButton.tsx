import React, { useLayoutEffect } from "react";
import { Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";

import { AppIcon } from "@/components/icons/AppIcon";
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
          // Same title-bar icon button as the Market bell and cart.
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            marginRight: 4,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <AppIcon name={icon} size={20} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, label, theme.card, theme.cardBorder, theme.text]);
}
