import React, { ReactNode } from "react";
import { Platform, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

interface KeyboardAvoidingContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  hasHeader?: boolean;
  headerTransparent?: boolean;
}

export function KeyboardAvoidingContainer({
  children,
  style,
  hasHeader = true,
  headerTransparent = false,
}: KeyboardAvoidingContainerProps) {
  const insets = useSafeAreaInsets();
  
  let headerHeight = 0;
  try {
    headerHeight = useHeaderHeight();
  } catch {
    headerHeight = 0;
  }

  const keyboardVerticalOffset = Platform.select({
    ios: hasHeader && !headerTransparent ? headerHeight : 0,
    android: 0,
    default: 0,
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
