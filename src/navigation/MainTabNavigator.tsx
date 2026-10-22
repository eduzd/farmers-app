import React from "react";
import { createBottomTabNavigator, BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
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

export type MainTabParamList = {
  Community: undefined;
  Connect: undefined;
  Market: undefined;
  Chats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useI18n();
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
      height: Platform.OS === "web" ? 68 : undefined,
      paddingTop: 6,
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
      fontSize: 11,
      marginTop: 2,
    },
  };

  const renderIcon =
    (name: keyof typeof Feather.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View style={[styles.iconPill, focused && { backgroundColor: theme.primarySoft }]}>
        <Feather name={name} size={20} color={color} />
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
              <HomeIcon size={20} color={color} />
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
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: theme.primarySoft }]}>
              <ChatIcon size={20} color={color} />
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
              <ProfileIcon size={20} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 48,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadge: {
    top: -5,
    left: 27,
  },
});
