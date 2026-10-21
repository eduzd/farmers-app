import React, { ReactNode } from "react";
import {
  Keyboard,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
  ViewStyle,
} from "react-native";

interface KeyboardDismissViewProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function KeyboardDismissView({
  children,
  style,
}: KeyboardDismissViewProps) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, style]}>{children}</View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
