import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

/**
 * Bottom padding for a bar pinned to the bottom of the screen (chat composer,
 * comment box, action footer).
 *
 * The app is drawn edge to edge, so the bottom of every screen sits behind the
 * phone's navigation bar (3-button bar or gesture handle).
 * - Keyboard closed: the bar keeps the navigation-bar height plus `extra`, so its
 *   controls sit just above the system bar and its background fills under it.
 * - Keyboard open: the keyboard already covers the navigation bar, so only
 *   `extra` is kept and the bar sits right on top of the keyboard.
 *
 * `follow`: also slide the bar up with the keyboard. Use it for a bar that is
 * NOT inside a KeyboardAvoidingView. Bars inside one are already lifted by it.
 */
export function useKeyboardAwareBottomPadding(
  extra: number,
  options: { follow?: boolean; min?: number } = {},
) {
  const { follow = false, min = extra } = options;
  const insets = useSafeAreaInsets();
  const { height, progress } = useReanimatedKeyboardAnimation();
  const closed = Math.max(insets.bottom + extra, min);

  return useAnimatedStyle(() => {
    const paddingBottom = interpolate(progress.value, [0, 1], [closed, extra], Extrapolation.CLAMP);
    if (!follow) return { paddingBottom };
    // height is 0 when closed and -keyboardHeight when open
    return { paddingBottom, transform: [{ translateY: height.value }] };
  }, [closed, extra, follow]);
}

export default useKeyboardAwareBottomPadding;
