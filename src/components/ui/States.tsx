import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle, StyleProp, ActivityIndicator } from "react-native";
import { Feather } from "@/components/icons/Feather";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
interface StateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Friendly empty list placeholder with an optional call to action. */
export function EmptyState({ icon = "inbox", title, message, actionLabel, onAction, style }: StateProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
        <AppIcon name={icon} size={28} color={theme.primary} />
      </View>
      <ThemedText type="h4" style={styles.center}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" muted style={[styles.center, styles.message]}>
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} size="sm" variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

/** Error placeholder with retry. */
export function ErrorState({ icon = "wifi-off", title, message, actionLabel, onAction, style }: StateProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.error + "18" }]}>
        <AppIcon name={icon} size={28} color={theme.error} />
      </View>
      <ThemedText type="h4" style={styles.center}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" muted style={[styles.center, styles.message]}>
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} size="sm" variant="outline" icon="refresh-cw" style={styles.action} />
      ) : null}
    </View>
  );
}

export function LoadingState({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <ActivityIndicator color={theme.primary} size="large" />
      {label ? (
        <ThemedText type="small" muted style={styles.message}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Shimmering placeholder block used while content loads. */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = BorderRadius.xs,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundTertiary }, animated, style]}
    />
  );
}

/** Skeleton shaped like a feed post card. */
export function PostSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[styles.postSkeleton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.row}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="45%" />
          <Skeleton width="25%" height={10} />
        </View>
      </View>
      <Skeleton height={12} style={{ marginTop: Spacing.lg }} />
      <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
      <Skeleton height={160} radius={BorderRadius.md} style={{ marginTop: Spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing["2xl"],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  center: { textAlign: "center" },
  message: { marginTop: Spacing.xs, maxWidth: 300 },
  action: { marginTop: Spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  postSkeleton: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
});
