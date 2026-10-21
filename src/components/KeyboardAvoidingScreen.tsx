import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

interface KeyboardAvoidingScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Space between the bottom of this screen and the bottom of the phone's
   * screen, e.g. a tab bar under it. 0 for a normal stack screen, which runs
   * all the way to the bottom edge.
   */
  bottomGap?: number;
}

/**
 * Full-height screen container that shrinks by exactly the keyboard's height,
 * so a composer bar at its bottom sits right on top of the keyboard.
 *
 * Why not KeyboardAvoidingView: it works out how much to lift from the view's
 * position relative to its parent plus `keyboardVerticalOffset`. Under the
 * native-stack header that position is reported differently on Android and
 * iOS, so passing the header height counted it twice on Android and left an
 * empty strip above the keyboard. Here the lift is simply the keyboard height
 * (minus anything below the screen), which is right on every phone.
 *
 * Pair it with useKeyboardAwareBottomPadding on the bar itself, which drops the
 * navigation-bar padding while the keyboard is open (the keyboard covers it).
 */
export function KeyboardAvoidingScreen({ children, style, bottomGap = 0 }: KeyboardAvoidingScreenProps) {
  // height: 0 when closed, -keyboardHeight when open (measured from the
  // bottom edge of the screen, navigation bar included on Android).
  const { height } = useReanimatedKeyboardAnimation();

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(-height.value - bottomGap, 0),
  }), [bottomGap]);

  return <Animated.View style={[styles.flex, style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default KeyboardAvoidingScreen;
