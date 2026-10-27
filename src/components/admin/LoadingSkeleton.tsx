import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { MayaRadius } from "@/constants/mayaTheme";

interface LoadingSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function LoadingSkeleton({
  width = "100%",
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
}: LoadingSkeletonProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.textSecondary,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function StatCardSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <LoadingSkeleton width={40} height={40} borderRadius={MayaRadius.md} />
      <LoadingSkeleton
        width={80}
        height={28}
        style={{ marginTop: Spacing.sm }}
      />
      <LoadingSkeleton
        width={60}
        height={14}
        style={{ marginTop: Spacing.xs }}
      />
    </View>
  );
}

export function UserRowSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.userRow,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <LoadingSkeleton width={44} height={44} borderRadius={22} />
      <View style={styles.userInfo}>
        <LoadingSkeleton width={120} height={16} />
        <LoadingSkeleton
          width={80}
          height={12}
          style={{ marginTop: Spacing.xs }}
        />
      </View>
      <LoadingSkeleton width={60} height={28} borderRadius={MayaRadius.md} />
    </View>
  );
}

export function ContentRowSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.contentRow,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <View style={{ flex: 1 }}>
        <LoadingSkeleton width="80%" height={16} />
        <LoadingSkeleton
          width="60%"
          height={12}
          style={{ marginTop: Spacing.xs }}
        />
      </View>
      <LoadingSkeleton width={24} height={24} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: MayaRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: MayaRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: MayaRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
});
