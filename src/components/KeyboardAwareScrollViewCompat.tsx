import { Platform, ScrollView, ScrollViewProps } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import React, { forwardRef } from "react";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps & {
  bottomOffset?: number;
};

/**
 * KeyboardAwareScrollView that works across all devices.
 * Falls back to ScrollView on web with manual keyboard handling.
 * A ref passed in reaches the scroll view, so screens can call scrollTo().
 */
export const KeyboardAwareScrollViewCompat = forwardRef<any, Props>(function KeyboardAwareScrollViewCompat(
  {
    children,
    keyboardShouldPersistTaps = "handled",
    bottomOffset = 150,
    ...props
  },
  ref,
) {
  if (Platform.OS === "web") {
    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      ref={ref}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      bottomOffset={bottomOffset}
      enabled={true}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
});
