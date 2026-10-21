import { Platform, ScrollView, ScrollViewProps } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import React, { useRef } from "react";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps & {
  bottomOffset?: number;
};

/**
 * KeyboardAwareScrollView that works across all devices.
 * Falls back to ScrollView on web with manual keyboard handling.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  bottomOffset = 150,
  ...props
}: Props) {
  const scrollViewRef = useRef<ScrollView>(null);

  if (Platform.OS === "web") {
    return (
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      bottomOffset={bottomOffset}
      enabled={true}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
