import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useCompanyStore } from "@/lib/companyStore";
import { useAuthStore } from "@/lib/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useI18n } from "@/lib/i18n";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const COMPANY_CATEGORIES = [
  { id: "seeds", label: "বীজ ও চারা", icon: "sun" },
  { id: "fertilizer", label: "সার ও কীটনাশক", icon: "droplet" },
  { id: "equipment", label: "কৃষি যন্ত্রপাতি", icon: "tool" },
  { id: "feed", label: "পশু খাদ্য", icon: "package" },
  { id: "medicine", label: "পশু ওষুধ", icon: "heart" },
  { id: "organic", label: "অর্গানিক পণ্য", icon: "zap" },
  { id: "dairy", label: "দুগ্ধ প্রক্রিয়াজাতকরণ", icon: "coffee" },
  { id: "fish", label: "মাছ চাষ সামগ্রী", icon: "anchor" },
  { id: "poultry", label: "পোল্ট্রি সামগ্রী", icon: "feather" },
  { id: "other", label: "অন্যান্য", icon: "grid" },
];

const PAYMENT_METHODS = [
  { id: "cash", label: "ক্যাশ অন ডেলিভারি", icon: "dollar-sign" },
  { id: "bkash", label: "বিকাশ", icon: "smartphone" },
  { id: "nagad", label: "নগদ", icon: "smartphone" },
  { id: "rocket", label: "রকেট", icon: "smartphone" },
  { id: "bank", label: "ব্যাংক ট্রান্সফার", icon: "credit-card" },
];

export default function CompanyProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const { company, isLoading, loadCompany, createCompany, updateCompany } = useCompanyStore();
  const navigation = useNavigation<NavigationProp>();
  const { t, language } = useI18n();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    categories: [] as string[],
    address: "",
    phone: "",
    email: "",
    website: "",
    businessHours: language === "bn" ? "সকাল ৯টা - রাত ৯টা" : "9 AM - 9 PM",
    returnPolicy: language === "bn" ? "৭ দিনের মধ্যে রিটার্ন গ্রহণযোগ্য" : "Returns accepted within 7 days",
    shippingPolicy: language === "bn" ? "সারা বাংলাদেশে ডেলিভারি" : "Delivery available nationwide",
    paymentMethods: ["cash", "bkash"],
  });

  const handleViewStore = () => {
    if (company) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("StoreView", { companyId: company.id });
    }
  };

  const toggleCategory = (categoryId: string) => {
    const current = formData.categories;
    if (current.includes(categoryId)) {
      const updated = current.filter(c => c !== categoryId);
      setFormData({ 
        ...formData, 
        categories: updated,
        category: updated[0] || ""
      });
    } else {
      const updated = [...current, categoryId];
      setFormData({ 
        ...formData, 
        categories: updated,
        category: updated[0] || categoryId
      });
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadCompany(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (company) {
      const defaultBusinessHours = language === "bn" ? "সকাল ৯টা - রাত ৯টা" : "9 AM - 9 PM";
      const defaultReturnPolicy = language === "bn" ? "৭ দিনের মধ্যে রিটার্ন গ্রহণযোগ্য" : "Returns accepted within 7 days";
      const defaultShippingPolicy = language === "bn" ? "সারা বাংলাদেশে ডেলিভারি" : "Delivery available nationwide";
      
      setFormData({
        name: company.name,
        description: company.description,
        category: company.category,
        categories: company.categories || (company.category ? [company.category] : []),
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website || "",
        businessHours: company.businessHours || defaultBusinessHours,
        returnPolicy: company.returnPolicy || defaultReturnPolicy,
        shippingPolicy: company.shippingPolicy || defaultShippingPolicy,
        paymentMethods: company.paymentMethods || ["cash", "bkash"],
      });
    }
  }, [company, language]);

  const handleSave = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const saveData = {
        ...formData,
        category: formData.categories[0] || formData.category,
        categories: formData.categories,
      };

      if (company) {
        await updateCompany(saveData);
      } else {
        const initials = formData.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2);

        const responseTimeText = language === "bn" ? "১ ঘন্টার মধ্যে" : "Within 1 hour";

        await createCompany(user.id, {
          ...saveData,
          initials,
          verified: false,
          totalSales: 0,
          responseRate: 100,
          responseTime: responseTimeText,
          shipOnTime: 100,
          establishedYear: new Date().getFullYear(),
        });
      }
      setShowEditModal(false);
    } catch (error) {
      console.error("Error saving company:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePaymentMethod = (methodId: string) => {
    const current = formData.paymentMethods;
    if (current.includes(methodId)) {
      setFormData({ ...formData, paymentMethods: current.filter(m => m !== methodId) });
    } else {
      setFormData({ ...formData, paymentMethods: [...current, methodId] });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot, paddingTop: Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!company) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: Spacing.xl }]}>
        <View style={styles.emptyState}>
          <LinearGradient
            colors={[theme.primary + "30", theme.primary + "10"]}
            style={styles.emptyIcon}
          >
            <Feather name="shopping-bag" size={56} color={theme.primary} />
          </LinearGradient>
          <ThemedText type="h2" style={styles.emptyTitle}>
            {t("vendor.createStore")}
          </ThemedText>
          <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
            {t("vendor.createStoreDesc")}
          </ThemedText>
          <Pressable
            style={[styles.createButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowEditModal(true);
            }}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
            <ThemedText style={styles.createButtonText}>{t("vendor.startSelling")}</ThemedText>
          </Pressable>
          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <Feather name="shield" size={20} color={theme.primary} />
              <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>{language === "bn" ? "নিরাপদ" : "Secure"}</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <Feather name="zap" size={20} color={theme.primary} />
              <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>{language === "bn" ? "দ্রুত" : "Fast"}</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <Feather name="users" size={20} color={theme.primary} />
              <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>{language === "bn" ? "বিশ্বস্ত" : "Trusted"}</ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ 
        paddingTop: Spacing.xl,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[theme.primary, theme.primary + "CC"]}
        style={[styles.coverSection, { paddingTop: Spacing.lg }]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.storeHeaderPressable,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowEditModal(true);
          }}
        >
          <View style={styles.storeHeader}>
            <View style={[styles.storeLogo, { backgroundColor: theme.white }]}>
              <ThemedText style={[styles.logoText, { color: theme.primary }]}>
                {company.initials}
              </ThemedText>
            </View>
            <View style={styles.storeInfo}>
              <View style={styles.storeNameRow}>
                <ThemedText style={styles.storeName}>{company.name}</ThemedText>
                {company.verified ? (
                  <View style={styles.verifiedBadge}>
                    <Feather name="check" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <ThemedText style={styles.storeCategory} numberOfLines={2}>
                {(company.categories && company.categories.length > 0 
                  ? company.categories.map(catId => 
                      COMPANY_CATEGORIES.find(c => c.id === catId)?.label || catId
                    ).join(", ")
                  : COMPANY_CATEGORIES.find(c => c.id === company.category)?.label || company.category
                )}
              </ThemedText>
              <View style={styles.storeMetaRow}>
                <View style={styles.storeMetaItem}>
                  <Feather name="star" size={14} color="#F5B700" />
                  <ThemedText style={styles.storeMetaText}>
                    {company.rating.toFixed(1)} ({company.reviewsCount})
                  </ThemedText>
                </View>
                <View style={styles.storeMetaItem}>
                  <Feather name="users" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.storeMetaText}>
                    {company.followersCount} ফলোয়ার
                  </ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.editIconBadge}>
              <Feather name="edit-2" size={14} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.editHintRow}>
            <Feather name="info" size={12} color="rgba(255,255,255,0.7)" />
            <ThemedText style={styles.editHintText}>
              {language === "bn" ? "ট্যাপ করে এডিট করুন" : "Tap to edit"}
            </ThemedText>
          </View>
        </Pressable>
        
        <Pressable
          style={styles.viewStoreButton}
          onPress={handleViewStore}
        >
          <Feather name="eye" size={16} color="#FFFFFF" />
          <ThemedText style={styles.viewStoreButtonText}>
            {language === "bn" ? "স্টোর দেখুন" : "View Store"}
          </ThemedText>
        </Pressable>
      </LinearGradient>

      <View style={styles.mainContent}>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardGradient1]}>
            <View style={[styles.statIconNew, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="package" size={22} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statValue}>{company.productsCount}</ThemedText>
            <ThemedText style={styles.statLabelNew}>{t("vendor.products")}</ThemedText>
          </View>
          <View style={[styles.statCard, styles.statCardGradient2]}>
            <View style={[styles.statIconNew, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="shopping-cart" size={22} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statValue}>{company.totalSales}</ThemedText>
            <ThemedText style={styles.statLabelNew}>{t("vendor.totalSales")}</ThemedText>
          </View>
          <View style={[styles.statCard, styles.statCardGradient3]}>
            <View style={[styles.statIconNew, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="star" size={22} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statValue}>{company.rating.toFixed(1)}</ThemedText>
            <ThemedText style={styles.statLabelNew}>{t("vendor.rating")}</ThemedText>
          </View>
          <View style={[styles.statCard, styles.statCardGradient4]}>
            <View style={[styles.statIconNew, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="trending-up" size={22} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statValue}>{company.responseRate}%</ThemedText>
            <ThemedText style={styles.statLabelNew}>{language === "bn" ? "রেসপন্স" : "Response"}</ThemedText>
          </View>
        </View>

        <View style={[styles.quickActionsCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>{t("vendor.quickActions")}</ThemedText>
          <View style={styles.quickActionsRow}>
            <Pressable
              style={[styles.quickActionBtn, { backgroundColor: "#16A34A15" }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: "#16A34A" }]}>
                <Feather name="plus" size={18} color="#FFFFFF" />
              </View>
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{t("vendor.addProduct")}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickActionBtn, { backgroundColor: "#2563EB15" }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: "#2563EB" }]}>
                <Feather name="clipboard" size={18} color="#FFFFFF" />
              </View>
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{t("vendor.orders")}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickActionBtn, { backgroundColor: "#EA8A0C15" }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: "#EA8A0C" }]}>
                <Feather name="bar-chart-2" size={18} color="#FFFFFF" />
              </View>
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{language === "bn" ? "রিপোর্ট" : "Report"}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickActionBtn, { backgroundColor: "#7C3AED15" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowEditModal(true);
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: "#7C3AED" }]}>
                <Feather name="settings" size={18} color="#FFFFFF" />
              </View>
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{language === "bn" ? "সেটিংস" : "Settings"}</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.performanceSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>{language === "bn" ? "স্টোর পারফরম্যান্স" : "Store Performance"}</ThemedText>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceItem}>
              <View style={styles.performanceRow}>
                <ChatIcon size={18} color={theme.primary} />
                <ThemedText style={styles.performanceValue}>{company.responseTime}</ThemedText>
              </View>
              <ThemedText style={[styles.performanceLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "রেসপন্স টাইম" : "Response Time"}
              </ThemedText>
            </View>
            <View style={styles.performanceItem}>
              <View style={styles.performanceRow}>
                <Feather name="truck" size={18} color={theme.primary} />
                <ThemedText style={styles.performanceValue}>{company.shipOnTime}%</ThemedText>
              </View>
              <ThemedText style={[styles.performanceLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "সময়মতো শিপমেন্ট" : "On-time Shipment"}
              </ThemedText>
            </View>
            <View style={styles.performanceItem}>
              <View style={styles.performanceRow}>
                <Feather name="calendar" size={18} color={theme.primary} />
                <ThemedText style={styles.performanceValue}>
                  {new Date().getFullYear() - company.establishedYear} {language === "bn" ? "বছর" : "years"}
                </ThemedText>
              </View>
              <ThemedText style={[styles.performanceLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "ব্যবসায়ে" : "In Business"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.aboutSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>{language === "bn" ? "স্টোর সম্পর্কে" : "About Store"}</ThemedText>
          <ThemedText style={[styles.aboutText, { color: theme.text }]}>
            {company.description || (language === "bn" ? "স্টোরের বিবরণ যোগ করুন" : "Add store description")}
          </ThemedText>
          
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Feather name="map-pin" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.text }]}>
                {company.address || (language === "bn" ? "ঠিকানা যোগ করুন" : "Add address")}
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="phone" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.text }]}>
                {company.phone || (language === "bn" ? "ফোন যোগ করুন" : "Add phone")}
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="clock" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.text }]}>
                {company.businessHours}
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="mail" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.infoText, { color: theme.text }]}>
                {company.email || (language === "bn" ? "ইমেইল যোগ করুন" : "Add email")}
              </ThemedText>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.policyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowPolicyModal(true);
          }}
        >
          <View style={styles.policyHeader}>
            <View style={[styles.policyIcon, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="shield" size={20} color={theme.primary} />
            </View>
            <View style={styles.policyInfo}>
              <ThemedText type="h4">{t("vendor.policies")}</ThemedText>
              <ThemedText style={[styles.policySubtext, { color: theme.textSecondary }]}>
                {language === "bn" ? "রিটার্ন, শিপিং ও পেমেন্ট পলিসি" : "Return, shipping & payment policies"}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </View>
        </Pressable>

        <View style={[styles.paymentSection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>{t("vendor.paymentMethods")}</ThemedText>
          <View style={styles.paymentMethods}>
            {company.paymentMethods?.map((methodId) => {
              const method = PAYMENT_METHODS.find(m => m.id === methodId);
              if (!method) return null;
              return (
                <View key={methodId} style={[styles.paymentBadge, { backgroundColor: theme.primary + "15" }]}>
                  <AppIcon name={method.icon as any} size={14} color={theme.primary} />
                  <ThemedText style={[styles.paymentText, { color: theme.primary }]}>
                    {method.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <Modal
        visible={showPolicyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPolicyModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }, Platform.OS === "android" && { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={() => setShowPolicyModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h4">{t("vendor.policies")}</ThemedText>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.policyContent} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            <View style={[styles.policySection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.policySectionHeader}>
                <View style={[styles.policyIconSmall, { backgroundColor: "#16A34A20" }]}>
                  <Feather name="refresh-cw" size={18} color="#16A34A" />
                </View>
                <ThemedText type="h4">{t("vendor.returnPolicy")}</ThemedText>
              </View>
              <ThemedText style={[styles.policyText, { color: theme.text }]}>
                {company.returnPolicy}
              </ThemedText>
            </View>

            <View style={[styles.policySection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.policySectionHeader}>
                <View style={[styles.policyIconSmall, { backgroundColor: "#2563EB20" }]}>
                  <Feather name="truck" size={18} color="#2563EB" />
                </View>
                <ThemedText type="h4">{t("vendor.shippingPolicy")}</ThemedText>
              </View>
              <ThemedText style={[styles.policyText, { color: theme.text }]}>
                {company.shippingPolicy}
              </ThemedText>
            </View>

            <View style={[styles.policySection, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.policySectionHeader}>
                <View style={[styles.policyIconSmall, { backgroundColor: "#EA8A0C20" }]}>
                  <Feather name="credit-card" size={18} color="#EA8A0C" />
                </View>
                <ThemedText type="h4">{t("vendor.paymentMethods")}</ThemedText>
              </View>
              <View style={styles.paymentMethodsList}>
                {company.paymentMethods?.map((methodId) => {
                  const method = PAYMENT_METHODS.find(m => m.id === methodId);
                  if (!method) return null;
                  return (
                    <View key={methodId} style={styles.paymentMethodItem}>
                      <Feather name="check-circle" size={16} color="#16A34A" />
                      <ThemedText style={{ color: theme.text }}>{method.label}</ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }, Platform.OS === "android" && { paddingTop: insets.top + Spacing.md }]}>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h4">{company ? (language === "bn" ? "স্টোর সম্পাদনা" : "Edit Store") : (language === "bn" ? "নতুন স্টোর" : "New Store")}</ThemedText>
              <View style={{ width: 24 }} />
            </View>

            <KeyboardAwareScrollViewCompat
              style={styles.formContent}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={100}
            >
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.shopName")} *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={language === "bn" ? "আপনার স্টোরের নাম" : "Your store name"}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.description")}</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder={language === "bn" ? "আপনার স্টোর সম্পর্কে লিখুন..." : "Write about your store..."}
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {language === "bn" ? "ক্যাটাগরি * (একাধিক সিলেক্ট করুন)" : "Categories * (Select multiple)"}
              </ThemedText>
              <View style={styles.categoryGrid}>
                {COMPANY_CATEGORIES.map((cat) => {
                  const isSelected = formData.categories.includes(cat.id);
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.categoryOption,
                        { borderColor: theme.cardBorder },
                        isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => toggleCategory(cat.id)}
                    >
                      <AppIcon 
                        name={cat.icon as any} 
                        size={16} 
                        color={isSelected ? "#FFFFFF" : theme.textSecondary} 
                      />
                      <ThemedText
                        style={[
                          styles.categoryOptionText,
                          isSelected && { color: "#FFFFFF" },
                        ]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </ThemedText>
                      {isSelected ? (
                        <View style={styles.categoryCheckmark}>
                          <Feather name="check" size={12} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.address")} *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder={language === "bn" ? "সম্পূর্ণ ঠিকানা" : "Full address"}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.phone")} *</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder={language === "bn" ? "০১XXXXXXXXX" : "+1XXXXXXXXXX"}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.email")}</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="email@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.businessHours")}</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.businessHours}
                onChangeText={(text) => setFormData({ ...formData, businessHours: text })}
                placeholder={language === "bn" ? "সকাল ৯টা - রাত ৯টা" : "9 AM - 9 PM"}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.paymentMethods")}</ThemedText>
              <View style={styles.paymentOptions}>
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method.id}
                    style={[
                      styles.paymentOption,
                      { borderColor: theme.cardBorder },
                      formData.paymentMethods.includes(method.id) && { 
                        backgroundColor: theme.primary + "15", 
                        borderColor: theme.primary 
                      },
                    ]}
                    onPress={() => togglePaymentMethod(method.id)}
                  >
                    <AppIcon 
                      name={formData.paymentMethods.includes(method.id) ? "check-square" : "square"} 
                      size={18} 
                      color={formData.paymentMethods.includes(method.id) ? theme.primary : theme.textSecondary} 
                    />
                    <ThemedText style={formData.paymentMethods.includes(method.id) ? { color: theme.primary } : undefined}>
                      {method.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.returnPolicy")}</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.returnPolicy}
                onChangeText={(text) => setFormData({ ...formData, returnPolicy: text })}
                placeholder={language === "bn" ? "রিটার্ন পলিসি লিখুন..." : "Write return policy..."}
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{t("vendor.shippingPolicy")}</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.cardBorder }]}
                value={formData.shippingPolicy}
                onChangeText={(text) => setFormData({ ...formData, shippingPolicy: text })}
                placeholder={language === "bn" ? "শিপিং পলিসি লিখুন..." : "Write shipping policy..."}
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.saveButtonText}>{t("vendor.saveChanges")}</ThemedText>
                </>
              )}
            </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 24,
    fontSize: 15,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
    ...Shadows.medium,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  featuresRow: {
    flexDirection: "row",
    gap: Spacing["2xl"],
  },
  featureItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  featureText: {
    fontSize: 12,
  },
  coverSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  storeHeaderPressable: {
    width: "100%",
  },
  editIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
  editHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: Spacing.md,
  },
  editHintText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  storeLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.medium,
  },
  logoText: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  storeInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  storeName: {
    fontSize: 22,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1DA1F2",
    justifyContent: "center",
    alignItems: "center",
  },
  storeCategory: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    fontSize: 14,
  },
  storeMetaRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  storeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  storeMetaText: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  mainContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2 - Spacing.md / 2,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.small,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statCardGradient1: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },
  statCardGradient2: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  statCardGradient3: {
    backgroundColor: "#EA8A0C",
    borderColor: "#EA8A0C",
  },
  statCardGradient4: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  statIconNew: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
  },
  statLabelNew: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  quickActionsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionBtn: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  quickActionText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    textAlign: "center",
  },
  performanceSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  performanceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  performanceItem: {
    alignItems: "center",
    flex: 1,
  },
  performanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  performanceLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  aboutSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  infoList: {
    gap: Spacing.md,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  policyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  policyHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  policyInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  policySubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  paymentSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  paymentMethods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  paymentText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  policyContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  policySection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  policySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  policyIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  policyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  paymentMethodsList: {
    gap: Spacing.sm,
  },
  paymentMethodItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  formContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    marginBottom: Spacing.sm,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  textInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  categoryOptionText: {
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
  },
  paymentOptions: {
    gap: Spacing.sm,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  viewStoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    alignSelf: "center",
  },
  viewStoreButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  categoryCheckmark: {
    marginLeft: Spacing.xs,
  },
});
