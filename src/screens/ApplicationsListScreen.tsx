import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ApplicationsListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { applications } = useAuthStore();
  const { language } = useI18n();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "#16A34A";
      case "rejected":
        return "#DC2626";
      default:
        return "#EA8A0C";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "approved":
        return "#16A34A20";
      case "rejected":
        return "#DC262620";
      default:
        return "#EA8A0C20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return "check-circle";
      case "rejected":
        return "x-circle";
      default:
        return "clock";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return language === "bn" ? "অনুমোদিত" : "Approved";
      case "rejected":
        return language === "bn" ? "প্রত্যাখ্যাত" : "Rejected";
      default:
        return language === "bn" ? "অপেক্ষমান" : "Pending";
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {applications.length > 0 ? (
        <View style={[styles.applicationsContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {applications.map((app, index) => (
            <Pressable
              key={app.id}
              style={({ pressed }) => [
                styles.applicationItem,
                index < applications.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.inputBorder },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("ApplicationDetail", { application: app });
              }}
            >
              <View style={styles.applicationInfo}>
                <View
                  style={[
                    styles.applicationIcon,
                    { backgroundColor: app.type === "welfare" ? "#1D4ED820" : "#0D47A120" },
                  ]}
                >
                  <Feather
                    name={app.type === "welfare" ? "award" : "globe"}
                    size={22}
                    color={app.type === "welfare" ? "#1D4ED8" : "#0D47A1"}
                  />
                </View>
                <View style={styles.applicationDetails}>
                  <ThemedText style={[styles.applicationTitle, { color: theme.text }]}>
                    {app.type === "welfare"
                      ? language === "bn"
                        ? "মৎস্য কল্যাণ সমিতি"
                        : "Fish Welfare Association"
                      : language === "bn"
                      ? "ইন্টারন্যাশনাল মৎস্য সামিট"
                      : "International Fish Summit"}
                  </ThemedText>
                  <ThemedText style={[styles.applicationNumber, { color: theme.textSecondary }]}>
                    {app.applicationNumber}
                  </ThemedText>
                  <ThemedText style={[styles.applicationDate, { color: theme.textSecondary }]}>
                    {language === "bn" ? "তারিখ: " : "Date: "}
                    {new Date(app.appliedAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US")}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.applicationItemRight}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(app.status) }]}>
                  <Feather name={getStatusIcon(app.status) as any} size={14} color={getStatusColor(app.status)} />
                  <ThemedText style={[styles.statusText, { color: getStatusColor(app.status) }]}>
                    {getStatusLabel(app.status)}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.card }]}>
            <Feather name="file-text" size={40} color={theme.textSecondary} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            {language === "bn" ? "কোনো আবেদন নেই" : "No Applications"}
          </ThemedText>
          <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
            {language === "bn"
              ? "আপনি এখনো কোনো সদস্যপদের জন্য আবেদন করেননি"
              : "You haven't applied for any membership yet"}
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  applicationsContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  applicationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  applicationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  applicationIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  applicationDetails: {
    flex: 1,
  },
  applicationTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  applicationNumber: {
    fontSize: 13,
    marginBottom: 2,
  },
  applicationDate: {
    fontSize: 12,
  },
  applicationItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing["3xl"],
    alignItems: "center",
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
