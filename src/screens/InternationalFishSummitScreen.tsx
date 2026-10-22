import React, { useState, useEffect } from "react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { getApiUrl } from "@/lib/query-client";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FormData {
  name: string;
  phone: string;
  email: string;
  organization: string;
  nidNumber: string;
  photoUri: string | null;
  nidUri: string | null;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  organization?: string;
  nidNumber?: string;
  photo?: string;
  nid?: string;
}

const SUMMIT_BENEFITS = [
  { iconBn: "🌍", iconEn: "🌍", titleBn: "আন্তর্জাতিক নেটওয়ার্কিং", titleEn: "International Networking", descBn: "বিশ্বের মৎস্য বিশেষজ্ঞদের সাথে যোগাযোগ", descEn: "Connect with fish experts worldwide" },
  { iconBn: "📚", iconEn: "📚", titleBn: "প্রশিক্ষণ ও কর্মশালা", titleEn: "Training & Workshops", descBn: "আধুনিক মৎস্য চাষ কৌশল শিখুন", descEn: "Learn modern fish farming techniques" },
  { iconBn: "🏆", iconEn: "🏆", titleBn: "সার্টিফিকেট", titleEn: "Certificate", descBn: "আন্তর্জাতিক স্বীকৃত সার্টিফিকেট পান", descEn: "Get internationally recognized certificate" },
  { iconBn: "💰", iconEn: "💰", titleBn: "বিনিয়োগ সুযোগ", titleEn: "Investment Opportunities", descBn: "বিশ্বব্যাপী বিনিয়োগকারীদের সাথে সংযোগ", descEn: "Connect with global investors" },
];

export default function InternationalFishSummitScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { language } = useI18n();
  const isBn = language === "bn";

  const submitApplication = useAuthStore((state) => state.submitApplication);

  const [step, setStep] = useState<"info" | "form" | "payment" | "submitting" | "success">("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    organization: "",
    nidNumber: "",
    photoUri: null,
    nidUri: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = isBn ? "নাম প্রয়োজন" : "Name is required";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = isBn ? "ফোন নম্বর প্রয়োজন" : "Phone number is required";
    } else if (!/^01[3-9]\d{8}$/.test(formData.phone.trim())) {
      newErrors.phone = isBn ? "সঠিক ফোন নম্বর দিন" : "Enter a valid phone number";
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = isBn ? "সঠিক ইমেইল দিন" : "Enter a valid email";
    }

    if (!formData.nidNumber.trim()) {
      newErrors.nidNumber = isBn ? "জাতীয় পরিচয়পত্র নম্বর প্রয়োজন" : "NID number is required";
    } else if (formData.nidNumber.trim().length < 10) {
      newErrors.nidNumber = isBn ? "সঠিক NID নম্বর দিন" : "Enter a valid NID number";
    }

    if (!formData.photoUri) {
      newErrors.photo = isBn ? "ছবি আপলোড করুন" : "Please upload your photo";
    }

    if (!formData.nidUri) {
      newErrors.nid = isBn ? "জাতীয় পরিচয়পত্র আপলোড করুন" : "Please upload your NID";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async (type: "photo" | "nid") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === "photo" ? [1, 1] : [16, 10],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === "photo") {
        setFormData((prev) => ({ ...prev, photoUri: result.assets[0].uri }));
        setErrors((prev) => ({ ...prev, photo: undefined }));
      } else {
        setFormData((prev) => ({ ...prev, nidUri: result.assets[0].uri }));
        setErrors((prev) => ({ ...prev, nid: undefined }));
      }
    }
  };

  const handleProceedToPayment = () => {
    if (validateForm()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep("payment");
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentMethod) {
      Alert.alert(
        isBn ? "পেমেন্ট পদ্ধতি নির্বাচন করুন" : "Select Payment Method",
        isBn ? "অনুগ্রহ করে একটি পেমেন্ট পদ্ধতি নির্বাচন করুন" : "Please select a payment method"
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    const newApplicationNumber = `APP-IFS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    setApplicationNumber(newApplicationNumber);

    if (paymentMethod === "bkash") {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/bkash/create-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 2500,
            paymentType: "summit",
            userId: formData.phone,
          }),
        });

        const data = await response.json();

        if (data.success && data.bkashURL) {
          const result = await WebBrowser.openBrowserAsync(data.bkashURL);
          
          if (result.type === "cancel") {
            Alert.alert(
              isBn ? "পেমেন্ট বাতিল" : "Payment Cancelled",
              isBn ? "আপনি পেমেন্ট বাতিল করেছেন" : "You cancelled the payment"
            );
            setIsSubmitting(false);
            return;
          }

          try {
            const executeResponse = await fetch(`${apiUrl}/api/bkash/execute-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentID: data.paymentID }),
            });
            const executeData = await executeResponse.json();
            
            if (executeData.success && executeData.transactionId) {
              setTransactionId(executeData.transactionId);
            }
          } catch (execError) {
            console.error("Execute payment error:", execError);
          }

          setIsSubmitting(false);
          setStep("submitting");
          setSubmissionProgress(0);
        } else {
          Alert.alert(
            isBn ? "পেমেন্ট ত্রুটি" : "Payment Error",
            data.error || (isBn ? "পেমেন্ট শুরু করতে ব্যর্থ হয়েছে" : "Failed to initiate payment")
          );
          setIsSubmitting(false);
        }
      } catch (error) {
        console.error("bKash payment error:", error);
        Alert.alert(
          isBn ? "ত্রুটি" : "Error",
          isBn ? "পেমেন্ট প্রক্রিয়ায় সমস্যা হয়েছে" : "There was an issue with the payment process"
        );
        setIsSubmitting(false);
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubmitting(false);
      setStep("submitting");
      setSubmissionProgress(0);
    }
  };

  useEffect(() => {
    if (step === "submitting") {
      const interval = setInterval(() => {
        setSubmissionProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(async () => {
              try {
                await submitApplication({
                  type: "summit",
                  applicationNumber,
                  name: formData.name,
                  phone: formData.phone,
                  email: formData.email || undefined,
                  organization: formData.organization || undefined,
                  nidNumber: formData.nidNumber,
                  photoUri: formData.photoUri || undefined,
                  nidUri: formData.nidUri || undefined,
                  paymentMethod: paymentMethod || "",
                  amount: 2500,
                  transactionId: transactionId || undefined,
                });
                setStep("success");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                console.error("Failed to submit application:", error);
              }
            }, 500);
            return 100;
          }
          return prev + 10;
        });
      }, 300);

      return () => clearInterval(interval);
    }
  }, [step, applicationNumber, formData, paymentMethod, transactionId, submitApplication]);

  const renderInfoStep = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerCard, { backgroundColor: "#0D47A1" }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.15)", "transparent"]}
          style={styles.headerGradient}
        />
        <Feather name="globe" size={48} color="#FFFFFF" />
        <ThemedText style={styles.headerTitle}>
          {isBn ? "ইন্টারন্যাশনাল মৎস্য সামিট" : "International Fish Summit"}
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          {isBn ? "বিশ্বের সাথে সংযুক্ত হন" : "Connect with the World"}
        </ThemedText>
        <View style={styles.dateBadge}>
          <Feather name="calendar" size={14} color="#FFFFFF" />
          <ThemedText style={styles.dateText}>
            {isBn ? "১৫-১৭ মার্চ ২০২৬" : "March 15-17, 2026"}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {isBn ? "সামিট সম্পর্কে" : "About the Summit"}
        </ThemedText>
        <ThemedText style={[styles.descriptionText, { color: theme.textSecondary }]}>
          {isBn
            ? "ইন্টারন্যাশনাল মৎস্য সামিট হল বিশ্বের বৃহত্তম মৎস্য সম্মেলন যেখানে ৫০+ দেশের মৎস্য বিশেষজ্ঞ, গবেষক, এবং উদ্যোক্তারা একত্রিত হন। এটি মৎস্য শিল্পে নতুন প্রযুক্তি, টেকসই চাষ পদ্ধতি এবং বাজার সম্প্রসারণের সুযোগ নিয়ে আলোচনা করার একটি অনন্য প্ল্যাটফর্ম।"
            : "The International Fish Summit is the world's largest fisheries conference where fish experts, researchers, and entrepreneurs from 50+ countries come together. It is a unique platform to discuss new technologies, sustainable farming methods, and market expansion opportunities in the fisheries industry."}
        </ThemedText>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {isBn ? "সদস্যদের সুবিধা" : "Member Benefits"}
        </ThemedText>
        {SUMMIT_BENEFITS.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={styles.benefitEmoji}>{benefit.iconBn}</ThemedText>
            </View>
            <View style={styles.benefitContent}>
              <ThemedText style={[styles.benefitTitle, { color: theme.text }]}>
                {isBn ? benefit.titleBn : benefit.titleEn}
              </ThemedText>
              <ThemedText style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                {isBn ? benefit.descBn : benefit.descEn}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.priceCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
        <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
          {isBn ? "রেজিস্ট্রেশন ফি" : "Registration Fee"}
        </ThemedText>
        <ThemedText style={[styles.priceAmount, { color: theme.primary }]}>৳ ২,৫০০</ThemedText>
        <ThemedText style={[styles.priceNote, { color: theme.textSecondary }]}>
          {isBn ? "সীমিত সময়ের অফার" : "Limited time offer"}
        </ThemedText>
      </View>

      <Pressable
        style={[styles.submitButton, { backgroundColor: theme.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setStep("form");
        }}
      >
        <ThemedText style={styles.submitButtonText}>
          {isBn ? "এখনই জয়েন করুন" : "Join Now"}
        </ThemedText>
        <Feather name="arrow-right" size={20} color="#FFFFFF" />
      </Pressable>
    </ScrollView>
  );

  const renderFormStep = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {isBn ? "ব্যক্তিগত তথ্য" : "Personal Information"}
        </ThemedText>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "পূর্ণ নাম" : "Full Name"} *
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: errors.name ? "#DC2626" : theme.inputBorder,
              },
            ]}
            placeholder={isBn ? "আপনার পূর্ণ নাম লিখুন" : "Enter your full name"}
            placeholderTextColor={theme.textSecondary}
            value={formData.name}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, name: text }));
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
          />
          {errors.name ? (
            <ThemedText style={styles.errorText}>{errors.name}</ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "মোবাইল নম্বর" : "Mobile Number"} *
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: errors.phone ? "#DC2626" : theme.inputBorder,
              },
            ]}
            placeholder="01XXXXXXXXX"
            placeholderTextColor={theme.textSecondary}
            value={formData.phone}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, phone: text }));
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            keyboardType="phone-pad"
            maxLength={11}
          />
          {errors.phone ? (
            <ThemedText style={styles.errorText}>{errors.phone}</ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "ইমেইল" : "Email"}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: errors.email ? "#DC2626" : theme.inputBorder,
              },
            ]}
            placeholder={isBn ? "আপনার ইমেইল" : "Your email"}
            placeholderTextColor={theme.textSecondary}
            value={formData.email}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, email: text }));
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email ? (
            <ThemedText style={styles.errorText}>{errors.email}</ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "প্রতিষ্ঠান/খামারের নাম" : "Organization/Farm Name"}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.inputBorder,
              },
            ]}
            placeholder={isBn ? "প্রতিষ্ঠানের নাম" : "Organization name"}
            placeholderTextColor={theme.textSecondary}
            value={formData.organization}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, organization: text }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "জাতীয় পরিচয়পত্র নম্বর" : "National ID Number"} *
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: errors.nidNumber ? "#DC2626" : theme.inputBorder,
              },
            ]}
            placeholder={isBn ? "আপনার NID নম্বর লিখুন" : "Enter your NID number"}
            placeholderTextColor={theme.textSecondary}
            value={formData.nidNumber}
            onChangeText={(text) => {
              setFormData((prev) => ({ ...prev, nidNumber: text }));
              if (errors.nidNumber) setErrors((prev) => ({ ...prev, nidNumber: undefined }));
            }}
            keyboardType="number-pad"
          />
          {errors.nidNumber ? (
            <ThemedText style={styles.errorText}>{errors.nidNumber}</ThemedText>
          ) : null}
        </View>
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {isBn ? "ডকুমেন্ট আপলোড" : "Document Upload"}
        </ThemedText>

        <View style={styles.uploadSection}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "আপনার ছবি" : "Your Photo"} *
          </ThemedText>
          <Pressable
            style={[
              styles.uploadBox,
              {
                backgroundColor: theme.backgroundRoot,
                borderColor: errors.photo ? "#DC2626" : theme.inputBorder,
              },
            ]}
            onPress={() => pickImage("photo")}
          >
            {formData.photoUri ? (
              <Image source={{ uri: formData.photoUri }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Feather name="camera" size={32} color={theme.textSecondary} />
                <ThemedText style={[styles.uploadText, { color: theme.textSecondary }]}>
                  {isBn ? "ছবি আপলোড করুন" : "Upload Photo"}
                </ThemedText>
              </View>
            )}
          </Pressable>
          {errors.photo ? (
            <ThemedText style={styles.errorText}>{errors.photo}</ThemedText>
          ) : null}
        </View>

        <View style={styles.uploadSection}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {isBn ? "জাতীয় পরিচয়পত্র" : "National ID Card"} *
          </ThemedText>
          <Pressable
            style={[
              styles.uploadBox,
              styles.nidUploadBox,
              {
                backgroundColor: theme.backgroundRoot,
                borderColor: errors.nid ? "#DC2626" : theme.inputBorder,
              },
            ]}
            onPress={() => pickImage("nid")}
          >
            {formData.nidUri ? (
              <Image source={{ uri: formData.nidUri }} style={styles.uploadedNid} contentFit="contain" />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Feather name="credit-card" size={32} color={theme.textSecondary} />
                <ThemedText style={[styles.uploadText, { color: theme.textSecondary }]}>
                  {isBn ? "NID আপলোড করুন" : "Upload NID"}
                </ThemedText>
              </View>
            )}
          </Pressable>
          {errors.nid ? (
            <ThemedText style={styles.errorText}>{errors.nid}</ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.backButton, { borderColor: theme.inputBorder }]}
          onPress={() => setStep("info")}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
          <ThemedText style={[styles.backButtonText, { color: theme.text }]}>
            {isBn ? "পিছনে" : "Back"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.nextButton, { backgroundColor: theme.primary }]}
          onPress={handleProceedToPayment}
        >
          <ThemedText style={styles.nextButtonText}>
            {isBn ? "পেমেন্টে যান" : "Proceed to Payment"}
          </ThemedText>
          <Feather name="arrow-right" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderPaymentStep = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {isBn ? "রেজিস্ট্রেশন ফি" : "Registration Fee"}
        </ThemedText>

        <View style={[styles.feeCard, { backgroundColor: theme.primary + "10" }]}>
          <ThemedText style={[styles.feeAmount, { color: theme.primary }]}>৳ ২,৫০০</ThemedText>
          <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>
            {isBn ? "সামিট রেজিস্ট্রেশন ফি" : "Summit Registration Fee"}
          </ThemedText>
        </View>

        <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
          {isBn ? "পেমেন্ট পদ্ধতি নির্বাচন করুন" : "Select Payment Method"}
        </ThemedText>

        {[
          { id: "bkash", name: "bKash", color: "#E2136E" },
          { id: "nagad", name: "Nagad", color: "#F6921E" },
          { id: "rocket", name: "Rocket", color: "#8C3494" },
          { id: "bank", name: isBn ? "ব্যাংক ট্রান্সফার" : "Bank Transfer", color: "#1D4ED8" },
        ].map((method) => (
          <Pressable
            key={method.id}
            style={[
              styles.paymentOption,
              {
                backgroundColor: theme.backgroundRoot,
                borderColor: paymentMethod === method.id ? method.color : theme.inputBorder,
                borderWidth: paymentMethod === method.id ? 2 : 1,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPaymentMethod(method.id);
            }}
          >
            <View style={[styles.paymentIcon, { backgroundColor: method.color }]}>
              <ThemedText style={styles.paymentIconText}>
                {method.name.charAt(0)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.paymentName, { color: theme.text }]}>
              {method.name}
            </ThemedText>
            {paymentMethod === method.id ? (
              <Feather name="check-circle" size={22} color={method.color} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.backButton, { borderColor: theme.inputBorder }]}
          onPress={() => setStep("form")}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
          <ThemedText style={[styles.backButtonText, { color: theme.text }]}>
            {isBn ? "পিছনে" : "Back"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.payButton,
            { backgroundColor: paymentMethod ? theme.primary : theme.textSecondary },
          ]}
          onPress={handlePaymentSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <ThemedText style={styles.payButtonText}>
                {isBn ? "পেমেন্ট করুন" : "Pay Now"}
              </ThemedText>
              <Feather name="check" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderSubmittingStep = () => (
    <View style={[styles.successContainer, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.successCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={[styles.verifyingIcon, { backgroundColor: theme.primary + "10" }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
        <ThemedText style={[styles.successTitle, { color: theme.text }]}>
          {isBn ? "আবেদন জমা হচ্ছে..." : "Submitting Application..."}
        </ThemedText>
        <ThemedText style={[styles.successMessage, { color: theme.textSecondary }]}>
          {isBn
            ? "অনুগ্রহ করে অপেক্ষা করুন। আপনার আবেদন জমা হচ্ছে।"
            : "Please wait. Your application is being submitted."}
        </ThemedText>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.inputBorder }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${submissionProgress}%` },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
            {submissionProgress}%
          </ThemedText>
        </View>
        <View style={styles.verifyingSteps}>
          <View style={styles.verifyStep}>
            <AppIcon
              name={submissionProgress >= 30 ? "check-circle" : "circle"}
              size={18}
              color={submissionProgress >= 30 ? "#16A34A" : theme.textSecondary}
            />
            <ThemedText style={[styles.verifyStepText, { color: submissionProgress >= 30 ? theme.text : theme.textSecondary }]}>
              {isBn ? "পেমেন্ট গ্রহণ করা হয়েছে" : "Payment received"}
            </ThemedText>
          </View>
          <View style={styles.verifyStep}>
            <AppIcon
              name={submissionProgress >= 60 ? "check-circle" : "circle"}
              size={18}
              color={submissionProgress >= 60 ? "#16A34A" : theme.textSecondary}
            />
            <ThemedText style={[styles.verifyStepText, { color: submissionProgress >= 60 ? theme.text : theme.textSecondary }]}>
              {isBn ? "তথ্য যাচাই করা হচ্ছে" : "Verifying information"}
            </ThemedText>
          </View>
          <View style={styles.verifyStep}>
            <AppIcon
              name={submissionProgress >= 100 ? "check-circle" : "circle"}
              size={18}
              color={submissionProgress >= 100 ? "#16A34A" : theme.textSecondary}
            />
            <ThemedText style={[styles.verifyStepText, { color: submissionProgress >= 100 ? theme.text : theme.textSecondary }]}>
              {isBn ? "আবেদন জমা হচ্ছে" : "Submitting application"}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={[styles.successContainer, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.successCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={[styles.successIcon, { backgroundColor: "#16A34A10" }]}>
          <Feather name="check-circle" size={60} color="#16A34A" />
        </View>
        <ThemedText style={[styles.successTitle, { color: theme.text }]}>
          {isBn ? "আবেদন জমা হয়েছে!" : "Application Submitted!"}
        </ThemedText>
        <ThemedText style={[styles.successMessage, { color: theme.textSecondary }]}>
          {isBn
            ? "আপনার আবেদন সফলভাবে জমা হয়েছে। এডমিন রিভিউ করার পর আপনার রেজিস্ট্রেশন সক্রিয় হবে এবং প্রোফাইলে ব্যাজ দেখা যাবে।"
            : "Your application has been submitted successfully. After admin review, your registration will be activated and a badge will appear on your profile."}
        </ThemedText>
        <View style={[styles.membershipCard, { backgroundColor: "#EA8A0C10" }]}>
          <View style={styles.badgePreview}>
            <View style={[styles.pendingBadge, { backgroundColor: "#EA8A0C" }]}>
              <Feather name="clock" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={[styles.badgeText, { color: "#EA8A0C" }]}>
              {isBn ? "রিভিউ অপেক্ষমান" : "Pending Review"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.membershipLabel, { color: theme.textSecondary }]}>
            {isBn ? "আবেদন নম্বর" : "Application Number"}
          </ThemedText>
          <ThemedText style={[styles.membershipNumber, { color: "#EA8A0C" }]}>
            {applicationNumber}
          </ThemedText>
        </View>
        <Pressable
          style={[styles.doneButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={styles.doneButtonText}>
            {isBn ? "সম্পন্ন" : "Done"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {step === "info" && renderInfoStep()}
      {step === "form" && renderFormStep()}
      {step === "payment" && renderPaymentStep()}
      {step === "submitting" && renderSubmittingStep()}
      {step === "success" && renderSuccessStep()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    alignItems: "center",
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginTop: Spacing.md,
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginTop: Spacing.xs,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  dateText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  formCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitEmoji: {
    fontSize: 20,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  benefitDesc: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  priceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  priceNote: {
    fontSize: 12,
    marginTop: Spacing.xs,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  uploadSection: {
    marginBottom: Spacing.md,
  },
  uploadBox: {
    height: 150,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  nidUploadBox: {
    height: 120,
  },
  uploadPlaceholder: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  uploadText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
  },
  uploadedNid: {
    width: "100%",
    height: "100%",
  },
  submitButton: {
    height: 54,
    borderRadius: BorderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  backButton: {
    flex: 1,
    height: 54,
    borderRadius: BorderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  nextButton: {
    flex: 2,
    height: 54,
    borderRadius: BorderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  feeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  feeAmount: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  feeLabel: {
    fontSize: 14,
    marginTop: Spacing.xs,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentIconText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  paymentName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  payButton: {
    flex: 2,
    height: 54,
    borderRadius: BorderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  successCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    alignItems: "center",
    ...Shadows.medium,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  verifyingIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    width: "100%",
    marginTop: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  verifyingSteps: {
    width: "100%",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  verifyStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  verifyStepText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  badgePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badgeGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  successMessage: {
    fontSize: 15,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  membershipCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    width: "100%",
  },
  membershipLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  membershipNumber: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.xs,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  doneButton: {
    marginTop: Spacing.xl,
    height: 50,
    paddingHorizontal: Spacing.xl * 2,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
