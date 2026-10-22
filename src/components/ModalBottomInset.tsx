import React from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWebKeyboardInset } from "@/hooks/useWebKeyboardInset";

/**
 * Spacer for the bottom of a bottom-sheet modal. Modals are drawn edge to edge
 * (behind the phone's navigation bar / home indicator), so this extends the
 * sheet's own background under the system bar and keeps its buttons above it.
 *
 * Android modals do not resize for the keyboard, so while the keyboard is open
 * the spacer grows to the keyboard's height: the sheet rises and its fields and
 * Save button stay visible above the keyboard. Pass avoidKeyboard={false} when
 * the sheet is already inside a KeyboardAvoidingView.
 *
 * On mobile web the same happens through the browser's visual viewport.
 */
export function ModalBottomInset({ avoidKeyboard = true }: { avoidKeyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const { height } = useReanimatedKeyboardAnimation();
  const webKeyboard = useWebKeyboardInset();
  const bottom = insets.bottom;

  const animatedStyle = useAnimatedStyle(() => {
    const keyboard = avoidKeyboard ? Math.max(-height.value, webKeyboard) : 0;
    return { height: Math.max(bottom, keyboard) };
  }, [bottom, avoidKeyboard, webKeyboard]);

  return <Animated.View pointerEvents="none" style={animatedStyle} />;
}

export default ModalBottomInset;
