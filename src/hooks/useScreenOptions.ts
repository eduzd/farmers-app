import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/hooks/useTheme";
import { mayaPageTitleFont } from "@/constants/mayaTheme";
import { useI18n } from "@/lib/i18n";

interface UseScreenOptionsParams {
  transparent?: boolean;
}

/** Shared header + transition styling for every stack screen. */
export function useScreenOptions({
  transparent = false,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();
  const language = useI18n((st) => st.language);

  return {
    headerTitleAlign: "left",
    headerTransparent: transparent,
    headerBlurEffect: transparent ? (isDark ? "dark" : "light") : undefined,
    headerTintColor: theme.text,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    // Same title style as the Market pages (Anton / Hind Siliguri Bold), one step smaller than the tabs.
    headerTitleStyle: {
      ...mayaPageTitleFont(language, "stack"),
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
