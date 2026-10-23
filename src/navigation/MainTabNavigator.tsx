import React from "react";
import { createBottomTabNavigator, BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontFamily } from "@/constants/theme";

import CommunityScreen from "@/screens/CommunityScreen";
import MarketScreen from "@/screens/MarketScreen";
import ConnectScreen from "@/screens/ConnectScreen";
import ChatListScreen from "@/screens/ChatListScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useI18n } from "@/lib/i18n";
import { HomeIcon } from "@/components/icons/HomeIcon";
import { ProfileIcon } from "@/components/icons/ProfileIcon";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { CountBadge } from "@/components/CountBadge";
import { useLiveStatus, useUnreadCounts } from "@/lib/liveStatus";

import { AppIcon } from "@/components/icons/AppIcon";
export type MainTabParamList = {
  Community: undefined;
  Connect: undefined;
  /** `category` comes from a carousel ad that opens one shop category. */
  Market: { category?: string; at?: number } | undefined;
  Chats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Bottom bar sizes (a little bigger than before: icons 20 -> 23, labels 11 -> 12, bar 68 -> 74 on web).
const TAB_ICON_SIZE = 23;
const TAB_BAR_HEIGHT = Platform.OS === "web" ? 74 : 70; // plus the bottom safe area

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Keeps unread counts and online dots fresh while signed in.
  useLiveStatus();
  const unreadMessages = useUnreadCounts((s) => s.messages);

  const screenOptions: BottomTabNavigationOptions = {
    headerTitleAlign: "left",
    headerTransparent: false,
    headerShadowVisible: false,
    headerTintColor: theme.text,
    headerTitleStyle: { fontFamily: FontFamily.bold, fontSize: 20, color: theme.text },
    headerStyle: {
      backgroundColor: theme.backgroundRoot,
    },
    tabBarActiveTintColor: theme.tabIconSelected,
    tabBarInactiveTintColor: theme.tabIconDefault,
    tabBarStyle: {
      position: "absolute",
      backgroundColor: Platform.select({
        ios: "transparent",
        android: theme.backgroundDefault,
        web: theme.backgroundDefault,
      }),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
      elevation: 0,
      height: TAB_BAR_HEIGHT + insets.bottom,
      paddingTop: 7,
    },
    tabBarItemStyle: { paddingVertical: 2 },
    tabBarBackground: () =>
      Platform.OS === "ios" ? (
        <BlurView
          intensity={90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null,
    tabBarLabelStyle: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      marginTop: 3,
    },
  };

  const renderIcon =
    (name: keyof typeof Feather.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View style={[styles.iconPill, focused && { backgroundColor: theme.primarySoft }]}>
        <AppIcon name={name} size={TAB_ICON_SIZE} color={color} />
      </View>
    );

  return (
    <Tab.Navigator
      initialRouteName="Community"
      screenOptions={screenOptions}
    >
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          title: t("nav.home"),
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: theme.primarySoft }]}>
              <HomeIcon size={TAB_ICON_SIZE} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Connect"
        component={ConnectScreen}
        options={{
          title: t("nav.connect"),
          headerTitle: t("nav.connect"),
          tabBarIcon: renderIcon("users"),
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{
          title: t("nav.market"),
          headerTitle: t("market.marketplace"),
          tabBarIcon: renderIcon("shopping-bag"),
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          title: t("nav.chats"),
          headerTitle: t("chat.messages"),
          tabBarButtonTestID: "tab-chats",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: theme.primarySoft }]}>
              <ChatIcon size={TAB_ICON_SIZE} color={color} />
              {/* Sits on the icon's top-right, inside the icon row, so it never touches the label. */}
              <CountBadge count={unreadMessages} style={styles.tabBadge} testID="tab-messages-badge" />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t("nav.profile"),
          headerTitle: t("nav.profile"),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: theme.primarySoft }]}>
              <ProfileIcon size={TAB_ICON_SIZE} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 54,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadge: {
    top: -4,
    left: 31,
  },
});
