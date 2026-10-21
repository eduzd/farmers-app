import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Shadows } from "@/constants/theme";
import {
  CompanyProfileScreen,
  CompanyProductsScreen,
  CompanyChatScreen,
  CompanyReviewsScreen,
  CompanyOrdersScreen,
} from "@/screens/company";

export type CompanyTabParamList = {
  CompanyProfile: undefined;
  CompanyProducts: undefined;
  CompanyOrders: undefined;
  CompanyChat: undefined;
  CompanyReviews: undefined;
};

const Tab = createBottomTabNavigator<CompanyTabParamList>();

export default function CompanyTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = "home";

          switch (route.name) {
            case "CompanyProfile":
              iconName = "briefcase";
              break;
            case "CompanyProducts":
              iconName = "package";
              break;
            case "CompanyOrders":
              iconName = "clipboard";
              break;
            case "CompanyChat":
              iconName = "message-circle";
              break;
            case "CompanyReviews":
              iconName = "star";
              break;
          }

          return <Feather name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "PlusJakartaSans_500Medium",
          marginTop: -2,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: Platform.OS === "ios" ? "transparent" : theme.card,
          borderTopWidth: 0,
          elevation: 0,
          ...Shadows.medium,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.card }]} />
          ),
      })}
    >
      <Tab.Screen
        name="CompanyProfile"
        component={CompanyProfileScreen}
        options={{ tabBarLabel: "প্রোফাইল" }}
      />
      <Tab.Screen
        name="CompanyProducts"
        component={CompanyProductsScreen}
        options={{ tabBarLabel: "পণ্য" }}
      />
      <Tab.Screen
        name="CompanyOrders"
        component={CompanyOrdersScreen}
        options={{ tabBarLabel: "অর্ডার" }}
      />
      <Tab.Screen
        name="CompanyChat"
        component={CompanyChatScreen}
        options={{ tabBarLabel: "চ্যাট" }}
      />
      <Tab.Screen
        name="CompanyReviews"
        component={CompanyReviewsScreen}
        options={{ tabBarLabel: "রিভিউ" }}
      />
    </Tab.Navigator>
  );
}
