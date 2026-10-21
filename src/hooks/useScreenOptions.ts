import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/hooks/useTheme";
import { FontFamily } from "@/constants/theme";

interface UseScreenOptionsParams {
  transparent?: boolean;
}

/** Shared header + transition styling for every stack screen. */
export function useScreenOptions({
  transparent = false,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  return {
    headerTitleAlign: "left",
    headerTransparent: transparent,
    headerBlurEffect: transparent ? (isDark ? "dark" : "light") : undefined,
    headerTintColor: theme.text,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    headerTitleStyle: {
      fontFamily: FontFamily.bold,
      fontSize: 18,
      color: theme.text,
    },
    headerStyle: {
      backgroundColor: theme.backgroundRoot,
    },
    animation: Platform.OS === "android" ? "slide_from_right" : "default",
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
}
