import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Text } from "@/components/MayaText";
import { useTheme } from "@/hooks/useTheme";
import { badgeText } from "@/lib/liveStatus";

/** Red unread-count pill. Hidden at 0. Grows with the number ("99+" at most) and has a ring in the
 *  background colour so it stays readable over an icon. Text never scales with the system font,
 *  so it can't outgrow the pill or run into the tab labels. */
export function CountBadge({ count, style, testID }: { count: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { theme } = useTheme();
  if (!count || count < 1) return null;
  const text = badgeText(count);
  return (
    <View
      pointerEvents="none"
      testID={testID}
      accessibilityLabel={`${count} unread`}
      style={[styles.badge, { borderColor: theme.backgroundDefault, paddingHorizontal: text.length > 1 ? 4 : 0 }, style]}
    >
      <Text allowFontScaling={false} numberOfLines={1} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
  },
});

export default CountBadge;
