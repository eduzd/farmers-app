import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useI18n } from "@/lib/i18n";
import { mayaPageTitleFont } from "@/constants/mayaTheme";
import { MembershipApplication } from "@/lib/authStore";

import { AppIcon } from "@/components/icons/AppIcon";
type ApplicationDetailRouteProp = RouteProp<RootStackParamList, "ApplicationDetail">;

export default function ApplicationDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<ApplicationDetailRouteProp>();
  const { language } = useI18n();
  
  const application = route.params.application;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "#00BB77";
      case "rejected":
        return "#DA2F2F";
      default:
        return "#B25E09";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return language === "bn" ? "অনুমোদিত" : "Approved";
      case "rejected":
        return language === "bn" ? "প্রত্যাখ্যাত" : "Rejected";
      default:
        return language === "bn" ? "অপেক্ষমান" : "Pending Review";
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount: number) => {
    if (language === "bn") {
      return `৳${amount.toLocaleString("bn-BD")}`;
    }
    return `৳${amount.toLocaleString()}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={[styles.headerTitle, mayaPageTitleFont(language, "stack"), { color: theme.text }]}>
          {language === "bn" ? "আবেদনের বিবরণ" : "Application Details"}
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusCard, { backgroundColor: getStatusColor(application.status) + "15", borderColor: getStatusColor(application.status) + "30" }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor(application.status) + "20" }]}>
            <AppIcon
              name={getStatusIcon(application.status) as any}
              size={32}
              color={getStatusColor(application.status)}
            />
          </View>
          <ThemedText style={[styles.statusLabel, { color: getStatusColor(application.status) }]}>
            {getStatusLabel(application.status)}
          </ThemedText>
          <ThemedText style={[styles.statusDescription, { color: theme.textSecondary }]}>
            {application.status === "pending"
              ? (language === "bn" ? "আপনার আবেদন পর্যালোচনা করা হচ্ছে" : "Your application is being reviewed")
              : application.status === "approved"
              ? (language === "bn" ? "আপনার আবেদন অনুমোদিত হয়েছে" : "Your application has been approved")
              : (language === "bn" ? "আপনার আবেদন প্রত্যাখ্যাত হয়েছে" : "Your application has been rejected")}
          </ThemedText>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeader}>
            <AppIcon
              name={application.type === "welfare" ? "award" : "globe"}
              size={24}
              color={application.type === "welfare" ? "#3D38D0" : "#202936"}
            />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              {application.type === "welfare"
                ? (language === "bn" ? "মৎস্য কল্যাণ সমিতি" : "Fish Welfare Association")
                : (language === "bn" ? "ইন্টারন্যাশনাল মৎস্য সামিট" : "International Fish Summit")}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "আবেদন নম্বর" : "Application Number"}
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {application.applicationNumber}
            </ThemedText>
          </View>

          {application.memberNumber ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "সদস্য নম্বর" : "Member Number"}
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: "#00BB77" }]}>
                {application.memberNumber}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "আবেদনের তারিখ" : "Applied On"}
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {formatDate(application.appliedAt)}
            </ThemedText>
          </View>

          {application.approvedAt ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "অনুমোদনের তারিখ" : "Approved On"}
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                {formatDate(application.approvedAt)}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Feather name="user" size={24} color={theme.primary} />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              {language === "bn" ? "আবেদনকারীর তথ্য" : "Applicant Information"}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "নাম" : "Name"}
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {application.name}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "ফোন" : "Phone"}
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {application.phone}
            </ThemedText>
          </View>

          {application.email ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "ইমেইল" : "Email"}
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                {application.email}
              </ThemedText>
            </View>
          ) : null}

          {application.organization ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "প্রতিষ্ঠান" : "Organization"}
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                {application.organization}
              </ThemedText>
            </View>
          ) : null}

          {application.nidNumber ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "জাতীয় পরিচয়পত্র নম্বর" : "NID Number"}
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                {application.nidNumber}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Feather name="credit-card" size={24} color={theme.primary} />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              {language === "bn" ? "পেমেন্ট তথ্য" : "Payment Information"}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "পরিমাণ" : "Amount"}
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.primary, fontWeight: "700" }]}>
              {formatAmount(application.amount)}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "পেমেন্ট পদ্ধতি" : "Payment Method"}
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {application.paymentMethod}
            </ThemedText>
          </View>

          {application.transactionId ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "ট্রানজেকশন আইডি" : "Transaction ID"}
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: "#00BB77", fontWeight: "600" }]}>
                {application.transactionId}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              {language === "bn" ? "পেমেন্ট যাচাই" : "Payment Verified"}
            </ThemedText>
            <View style={[styles.verifyBadge, { backgroundColor: application.paymentVerified ? "#00BB7720" : "#B25E0920" }]}>
              <AppIcon
                name={application.paymentVerified ? "check-circle" : "clock"}
                size={14}
                color={application.paymentVerified ? "#00BB77" : "#B25E09"}
              />
              <ThemedText style={[styles.verifyText, { color: application.paymentVerified ? "#00BB77" : "#B25E09" }]}>
                {application.paymentVerified
                  ? (language === "bn" ? "যাচাই হয়েছে" : "Verified")
                  : (language === "bn" ? "যাচাই বাকি" : "Pending")}
              </ThemedText>
            </View>
          </View>
        </View>

        {application.status === "pending" ? (
          <View style={[styles.noteCard, { backgroundColor: "#B25E0915", borderColor: "#B25E0930" }]}>
            <Feather name="info" size={20} color="#B25E09" />
            <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
              {language === "bn"
                ? "আপনার আবেদন অ্যাডমিন দ্বারা পর্যালোচনা করা হচ্ছে। অনুমোদনের পর আপনাকে জানানো হবে।"
                : "Your application is being reviewed by the admin. You will be notified once it is approved."}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  statusCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  statusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
    marginBottom: Spacing.xs,
  },
  statusDescription: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
  },
  infoCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    textAlign: "right",
    flex: 1,
    marginLeft: Spacing.md,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    lineHeight: 20,
  },
  verifyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  verifyText: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },
});
