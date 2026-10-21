import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MAX_APP_WIDTH, isWebFrame } from "@/lib/webFrame";
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
} from "@expo-google-fonts/hind-siliguri";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WebAlertHost } from "@/components/WebAlertHost";
import { useThemeStore } from "@/lib/themeStore";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/lib/authStore";
import { useCommunityStore } from "@/lib/communityStore";
import { useI18n } from "@/lib/i18n";
import { VoiceCallProvider } from "@/contexts/VoiceCallContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SyncProvider } from "@/offline/providers/SyncProvider";

SplashScreen.preventAutoHideAsync();

export const navigationRef = createNavigationContainerRef<any>();
if (Platform.OS === "web" && typeof window !== "undefined") {
  // Exposed for automated UI testing (Playwright) and debugging on web.
  (window as any).__nav = navigationRef;
  (window as any).__i18n = useI18n;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });
  const { theme, isDark } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: theme.primary,
      background: theme.backgroundRoot,
      card: theme.backgroundDefault,
      text: theme.text,
      border: theme.divider,
      notification: theme.error,
    },
  };
  
  const { loadPreference } = useThemeStore();
  const { loadUser, user, isAuthenticated } = useAuthStore();
  const { loadCommunities } = useCommunityStore();

  useEffect(() => {
    loadPreference();
    loadUser();
    loadCommunities();
    // restore the saved Bangla/English choice (was never loaded on start)
    useI18n.getState().loadLanguage();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const renderNavigation = () => {
    if (isAuthenticated && user && user.id) {
      return (
        <VoiceCallProvider userId={user.id} userName={user.name || user.username || "User"}>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <RootStackNavigator />
          </NavigationContainer>
        </VoiceCallProvider>
      );
    }
    return (
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <RootStackNavigator />
      </NavigationContainer>
    );
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={[styles.root, isWebFrame && { backgroundColor: isDark ? "#0B120E" : "#E3E9E4" }]}>
            <View style={[styles.frame, { backgroundColor: theme.backgroundRoot }]}>
            <KeyboardProvider>
              <SyncProvider>
                <NotificationProvider>
                  {renderNavigation()}
                </NotificationProvider>
              </SyncProvider>
              <StatusBar style={isDark ? "light" : "dark"} />
              <WebAlertHost />
            </KeyboardProvider>
            </View>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  frame: isWebFrame
    ? {
        flex: 1,
        width: "100%",
        maxWidth: MAX_APP_WIDTH,
        alignSelf: "center",
        overflow: "hidden",
        // soft edge so the column reads as the app on wide screens
        boxShadow: "0 0 24px rgba(0,0,0,0.08)",
      } as any
    : { flex: 1 },
});
