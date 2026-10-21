import React from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Spacer for the bottom of a bottom-sheet modal. Modals are drawn edge to edge
 * (behind the phone's navigation bar / home indicator), so this extends the
 * sheet's own background under the system bar and keeps its buttons above it.
 *
 * Android modals do not resize for the keyboard, so while the keyboard is open
 * the spacer grows to the keyboard's height: the sheet rises and its fields and
 * Save button stay visible above the keyboard. Pass avoidKeyboard={false} when
 * the sheet is already inside a KeyboardAvoidingView.
 */
export function ModalBottomInset({ avoidKeyboard = true }: { avoidKeyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const { height } = useReanimatedKeyboardAnimation();
  const bottom = insets.bottom;

  const animatedStyle = useAnimatedStyle(() => {
    const keyboard = avoidKeyboard ? -height.value : 0;
    return { height: Math.max(bottom, keyboard) };
  }, [bottom, avoidKeyboard]);

  return <Animated.View pointerEvents="none" style={animatedStyle} />;
}

export default ModalBottomInset;
