import React from "react";
import { Pressable, View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Read out by screen readers, e.g. "Vibration". */
  accessibilityLabel?: string;
  testID?: string;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB_SIZE = 22;
const THUMB_MARGIN = 2;

export function CustomSwitch({
  value,
  onValueChange,
  disabled = false,
  style,
  accessibilityLabel,
  testID,
}: CustomSwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);
  // The track colour fades on its own short timer, so it always ends exactly on Maya green (or the
  // off grey) instead of a blend left over from the thumb's spring.
  const tint = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 120,
    });
    tint.value = withTiming(value ? 1 : 0, { duration: 220 });
  }, [value]);

  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      tint.value,
      [0, 1],
      // off: Maya muted blue-grey (the old pale-green track was Farmers green); on: Maya green
      ["#A9C2DC", "#00BB77"]
    );
    return { backgroundColor };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const translateX = progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN * 2);
    return {
      transform: [{ translateX }],
    };
  });

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={style}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      testID={testID}
    >
      <Animated.View style={[styles.track, trackAnimatedStyle, disabled && styles.disabled]}>
        <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
    paddingHorizontal: THUMB_MARGIN,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
  },
});
