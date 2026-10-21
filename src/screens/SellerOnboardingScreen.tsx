import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useCompanyStore } from "@/lib/companyStore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STEPS = [
  { id: 1, title: "দোকানের তথ্য", icon: "info" },
  { id: 2, title: "ক্যাটাগরি", icon: "grid" },
  { id: 3, title: "যোগাযোগ", icon: "phone" },
];

const CATEGORIES = [
  { id: "seeds", label: "বীজ ও চারা", icon: "sun" },
  { id: "fertilizer", label: "সার ও কীটনাশক", icon: "droplet" },
  { id: "equipment", label: "কৃষি যন্ত্রপাতি", icon: "tool" },
  { id: "feed", label: "পশু খাদ্য", icon: "package" },
  { id: "medicine", label: "পশু ওষুধ", icon: "heart" },
  { id: "organic", label: "অর্গানিক পণ্য", icon: "feather" },
  { id: "dairy", label: "দুগ্ধ প্রক্রিয়াজাতকরণ", icon: "coffee" },
  { id: "fish", label: "মাছ চাষ সামগ্রী", icon: "anchor" },
  { id: "poultry", label: "পোল্ট্রি সামগ্রী", icon: "feather" },
  { id: "other", label: "অন্যান্য", icon: "grid" },
];

export default function SellerOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, updateProfile } = useAuthStore();
  const { createCompany } = useCompanyStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    shopName: "",
    description: "",
    category: "",
    phone: user?.phone || "",
    address: "",
    email: user?.email || "",
  });

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.shopName.trim().length >= 3 && formData.description.trim().length >= 10;
      case 2:
        return formData.category !== "";
      case 3:
        return formData.phone.trim().length >= 10 && formData.address.trim().length >= 5;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    setIsSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const initials = formData.shopName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

      await createCompany(user.id, {
        name: formData.shopName,
        description: formData.description,
        category: formData.category,
        phone: formData.phone,
        address: formData.address,
        email: formData.email,
        website: "",
        initials,
        verified: true,
        businessHours: "সকাল ৯টা - রাত ৯টা",
        returnPolicy: "৭ দিনের মধ্যে রিটার্ন গ্রহণযোগ্য",
        shippingPolicy: "সারা বাংলাদেশে ডেলিভারি",
        paymentMethods: ["cash", "bkash"],
        totalSales: 0,
        responseRate: 100,
        responseTime: "১ ঘন্টার মধ্যে",
        shipOnTime: 100,
        establishedYear: new Date().getFullYear(),
      });

      await updateProfile({ verified: true, role: "company" });

      navigation.reset({
        index: 1,
        routes: [{ name: "Main" }, { name: "CompanyDashboard" }],
      });
    } catch (error) {
      console.error("Error creating company:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor: currentStep >= step.id ? theme.primary : theme.card,
                borderColor: currentStep >= step.id ? theme.primary : theme.cardBorder,
              },
            ]}
          >
            {currentStep > step.id ? (
              <Feather name="check" size={16} color="#FFFFFF" />
            ) : (
              <ThemedText
                style={[
                  styles.stepNumber,
                  { color: currentStep >= step.id ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                {step.id}
              </ThemedText>
            )}
          </View>
          {index < STEPS.length - 1 ? (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: currentStep > step.id ? theme.primary : theme.cardBorder },
              ]}
            />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h3" style={styles.stepTitle}>
        দোকানের তথ্য দিন
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        আপনার দোকানের নাম ও বিবরণ লিখুন
      </ThemedText>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>দোকানের নাম *</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              color: theme.text,
            },
          ]}
          placeholder="যেমন: গ্রীন হার্ভেস্ট"
          placeholderTextColor={theme.textSecondary}
          value={formData.shopName}
          onChangeText={(text) => setFormData({ ...formData, shopName: text })}
        />
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>দোকানের বিবরণ *</ThemedText>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              color: theme.text,
            },
          ]}
          placeholder="আপনার দোকান সম্পর্কে কিছু লিখুন..."
          placeholderTextColor={theme.textSecondary}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h3" style={styles.stepTitle}>
        ক্যাটাগরি নির্বাচন করুন
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        আপনার দোকান কোন ধরনের পণ্য বিক্রি করে?
      </ThemedText>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((category) => (
          <Pressable
            key={category.id}
            style={[
              styles.categoryCard,
              {
                backgroundColor: formData.category === category.id ? theme.primary + "15" : theme.card,
                borderColor: formData.category === category.id ? theme.primary : theme.cardBorder,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFormData({ ...formData, category: category.id });
            }}
          >
            <Feather
              name={category.icon as any}
              size={24}
              color={formData.category === category.id ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.categoryLabel,
                { color: formData.category === category.id ? theme.primary : theme.text },
              ]}
            >
              {category.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h3" style={styles.stepTitle}>
        যোগাযোগের তথ্য
      </ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        ক্রেতারা কিভাবে আপনার সাথে যোগাযোগ করবে?
      </ThemedText>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>ফোন নম্বর *</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              color: theme.text,
            },
          ]}
          placeholder="01XXXXXXXXX"
          placeholderTextColor={theme.textSecondary}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>ঠিকানা *</ThemedText>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              color: theme.text,
            },
          ]}
          placeholder="আপনার দোকানের ঠিকানা লিখুন"
          placeholderTextColor={theme.textSecondary}
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>ইমেইল (ঐচ্ছিক)</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              color: theme.text,
            },
          ]}
          placeholder="email@example.com"
          placeholderTextColor={theme.textSecondary}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ["#1F2123", "#1F2123"] : ["#16A34A15", "#FAFAF9"]}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText type="h2">বিক্রেতা হোন</ThemedText>
          <ThemedText style={[styles.headerSubtext, { color: theme.textSecondary }]}>
            মাত্র ৩ ধাপে আপনার দোকান সেটআপ করুন
          </ThemedText>
        </View>
        {renderStepIndicator()}
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
        <Pressable
          style={[
            styles.nextButton,
            {
              backgroundColor: isStepValid() ? "#16A34A" : theme.cardBorder,
            },
          ]}
          onPress={handleNext}
          disabled={!isStepValid() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <ThemedText style={styles.nextButtonText}>
                {currentStep === 3 ? "দোকান সেটআপ করুন" : "পরবর্তী"}
              </ThemedText>
              <Feather name={currentStep === 3 ? "check" : "arrow-right"} size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginBottom: Spacing.md,
  },
  headerContent: {
    marginBottom: Spacing.xl,
  },
  headerSubtext: {
    marginTop: Spacing.xs,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  stepLine: {
    width: 60,
    height: 2,
    marginHorizontal: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  stepContent: {
    gap: Spacing.lg,
  },
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    marginBottom: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 100,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  categoryCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.small,
  },
  categoryLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    textAlign: "center",
  },
  footer: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
