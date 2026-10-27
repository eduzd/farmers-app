import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { CustomSwitch } from "@/components/CustomSwitch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n, Language } from "@/lib/i18n";
import { useThemeStore, ThemePreference } from "@/lib/themeStore";
import { ModalBottomInset } from "@/components/ModalBottomInset";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  NotificationPrefs,
  setNotificationPrefs,
} from "@/lib/notificationService";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LANGUAGES = [
  { code: "en" as Language, name: "English", nativeName: "English" },
  { code: "bn" as Language, name: "Bengali", nativeName: "বাংলা" },
];

const COUNTRIES = [
  { code: "BD", name: "Bangladesh", flag: "BD" },
  { code: "IN", name: "India", flag: "IN" },
  { code: "US", name: "United States", flag: "US" },
  { code: "UK", name: "United Kingdom", flag: "UK" },
];

const getThemeOptions = (t: (key: string) => string): { value: ThemePreference; label: string; icon: string }[] => [
  { value: "light", label: t("settings.themeLight"), icon: "sun" },
  { value: "dark", label: t("settings.themeDark"), icon: "moon" },
  { value: "system", label: t("settings.themeSystem"), icon: "smartphone" },
];

const getFarmingCategories = (t: (key: string) => string) => [
  { id: "crops", label: t("settings.cropsFarming") },
  { id: "vegetables", label: t("settings.vegetables") },
  { id: "fruits", label: t("settings.fruits") },
  { id: "dairy", label: t("settings.dairyFarming") },
  { id: "poultry", label: t("settings.poultry") },
  { id: "fish", label: t("settings.fishFarming") },
  { id: "livestock", label: t("settings.livestock") },
  { id: "organic", label: t("settings.organicFarming") },
  { id: "mixed", label: t("settings.mixedFarming") },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, updateProfile } = useAuthStore();
  const { t, language, setLanguage } = useI18n();
  const { preference: themePreference, setPreference: setThemePreference } = useThemeStore();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  // Saved on this phone and sent to the server (Android pushes use a no-vibration
  // channel when vibration is off). See src/lib/notificationService.ts.
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  const token = useAuthStore((s) => s.token);
  const route = useRoute<any>();

  useEffect(() => {
    let alive = true;
    void getNotificationPrefs().then((p) => {
      if (alive) setNotifPrefs(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const changeNotifPrefs = (patch: Partial<NotificationPrefs>) => {
    setNotifPrefs((p) => ({ ...p, ...patch }));
    void setNotificationPrefs(patch, token).then(({ prefs }) => setNotifPrefs(prefs));
  };

  // Edit profile is a full page of its own.
  const openEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("EditProfile" as any);
  };

  // Old links to Settings with openEditProfile go straight to the Edit profile page.
  useEffect(() => {
    if (route.params?.openEditProfile) {
      navigation.setParams?.({ openEditProfile: undefined } as any);
      navigation.navigate("EditProfile" as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.openEditProfile]);

  const handleLanguageSelect = async (lang: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLanguage(lang);
    await updateProfile({ language: lang });
    setShowLanguageModal(false);
  };

  const handleCountrySelect = async (countryCode: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateProfile({ country: countryCode });
    setShowCountryModal(false);
  };

  const handleThemeSelect = async (pref: ThemePreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setThemePreference(pref);
    await updateProfile({ themePreference: pref });
    setShowThemeModal(false);
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: "Landing" }],
    });
  };

  const THEME_OPTIONS = getThemeOptions(t);
  const FARMING_CATEGORIES = getFarmingCategories(t);

  const currentLanguage = LANGUAGES.find((l) => l.code === language);
  const currentCountry = COUNTRIES.find((c) => c.code === user?.country);
  const currentTheme = THEME_OPTIONS.find((opt) => opt.value === themePreference);
  const currentCategory = FARMING_CATEGORIES.find((c) => c.id === user?.farmingCategory);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.section}>
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("settings.account")}
        </ThemedText>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.settingItem}
            onPress={openEditProfile}
            testID="settings-edit-profile"
          >
            <View style={styles.settingLeft}>
              <Feather name="user" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("settings.editProfile")}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("settings.appearance")}
        </ThemedText>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.settingItem}
            onPress={() => setShowThemeModal(true)}
          >
            <View style={styles.settingLeft}>
              <AppIcon name={themePreference === "dark" ? "moon" : themePreference === "light" ? "sun" : "smartphone"} size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("settings.theme")}
              </ThemedText>
            </View>
            <View style={styles.settingRight}>
              <ThemedText style={[styles.settingValue, { color: theme.textSecondary }]}>
                {currentTheme?.label}
              </ThemedText>
              <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("settings.preferences")}
        </ThemedText>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.settingItem}
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.settingLeft}>
              <Feather name="globe" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("profile.language")}
              </ThemedText>
            </View>
            <View style={styles.settingRight}>
              <ThemedText style={[styles.settingValue, { color: theme.textSecondary }]}>
                {currentLanguage?.nativeName}
              </ThemedText>
              <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <Pressable
            style={styles.settingItem}
            onPress={() => setShowCountryModal(true)}
          >
            <View style={styles.settingLeft}>
              <Feather name="map-pin" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("profile.country")}
              </ThemedText>
            </View>
            <View style={styles.settingRight}>
              <ThemedText style={[styles.settingValue, { color: theme.textSecondary }]}>
                {currentCountry?.name}
              </ThemedText>
              <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
            </View>
          </Pressable>

        </View>
      </View>

      <View style={styles.section} testID="settings-notifications">
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("settings.notificationsSection")}
        </ThemedText>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Feather name="bell" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("profile.notifications")}
              </ThemedText>
            </View>
            <CustomSwitch
              value={notifPrefs.enabled}
              onValueChange={(v) => changeNotifPrefs({ enabled: v })}
              accessibilityLabel={t("profile.notifications")}
              testID="switch-notifications"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <View style={[styles.settingItem, !notifPrefs.enabled && { opacity: 0.5 }]}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="vibrate" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("settings.vibration")}
              </ThemedText>
            </View>
            <CustomSwitch
              value={notifPrefs.vibrate}
              onValueChange={(v) => changeNotifPrefs({ vibrate: v })}
              disabled={!notifPrefs.enabled}
              accessibilityLabel={t("settings.vibration")}
              testID="switch-vibration"
            />
          </View>
        </View>
        <ThemedText
          type="small"
          style={[styles.sectionHint, { color: theme.textSecondary }]}
          testID="notifications-hint"
        >
          {notifPrefs.enabled ? t("settings.vibrationHint") : t("settings.notificationsOffHint")}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("settings.support")}
        </ThemedText>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.settingItem}
            onPress={() => navigation.navigate("SupportChat")}
          >
            <View style={styles.settingLeft}>
              <Feather name="help-circle" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("profile.helpSupport")}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <Pressable style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Feather name="info" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("profile.about")}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.iconSecondary || theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.settingItem}
            onPress={handleLogout}
          >
            <View style={styles.settingLeft}>
              <Feather name="log-out" size={20} color="#DA2F2F" />
              <ThemedText style={[styles.settingLabel, { color: "#DA2F2F" }]}>
                {t("auth.signOut")}
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.versionContainer}>
        <ThemedText style={[styles.versionText, { color: theme.textSecondary }]}>
          {t("profile.version")} 1.0.0
        </ThemedText>
      </View>

      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <ThemedText type="h4" style={[styles.modalTitle, { color: theme.text }]}>
              {t("onboarding.selectLanguage")}
            </ThemedText>

            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[
                  styles.optionItem,
                  language === lang.code && { backgroundColor: theme.backgroundDefault },
                ]}
                onPress={() => handleLanguageSelect(lang.code)}
              >
                <View>
                  <ThemedText style={[styles.optionName, { color: theme.text }]}>
                    {lang.nativeName}
                  </ThemedText>
                  <ThemedText style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                    {lang.name}
                  </ThemedText>
                </View>
                {language === lang.code ? (
                  <Feather name="check" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
            <ModalBottomInset />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCountryModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <ThemedText type="h4" style={[styles.modalTitle, { color: theme.text }]}>
              {t("onboarding.selectCountry")}
            </ThemedText>

            {COUNTRIES.map((country) => (
              <Pressable
                key={country.code}
                style={[
                  styles.optionItem,
                  user?.country === country.code && { backgroundColor: theme.backgroundDefault },
                ]}
                onPress={() => handleCountrySelect(country.code)}
              >
                <ThemedText style={[styles.optionName, { color: theme.text }]}>
                  {country.name}
                </ThemedText>
                {user?.country === country.code ? (
                  <Feather name="check" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
            <ModalBottomInset />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showThemeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <ThemedText type="h4" style={[styles.modalTitle, { color: theme.text }]}>
              {t("settings.chooseTheme")}
            </ThemedText>

            {THEME_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionItem,
                  themePreference === option.value && { backgroundColor: theme.backgroundDefault },
                ]}
                onPress={() => handleThemeSelect(option.value)}
              >
                <View style={styles.themeOption}>
                  <AppIcon name={option.icon as any} size={20} color={theme.text} />
                  <ThemedText style={[styles.optionName, { color: theme.text }]}>
                    {option.label}
                  </ThemedText>
                </View>
                {themePreference === option.value ? (
                  <Feather name="check" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
            <ModalBottomInset />
          </View>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  settingsGroup: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  settingValue: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginLeft: 52,
  },
  sectionHint: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.sm,
    fontSize: 13,
    lineHeight: 18,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  versionText: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
  },
  modalTitle: {
    marginBottom: Spacing.xl,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  optionName: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  optionSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  editModalKeyboard: {
    flex: 1,
  },
  editModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  editModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "90%",
    paddingTop: Spacing.xl,
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  editModalScroll: {
    paddingHorizontal: Spacing["2xl"],
  },
  editAvatarSection: {
    marginBottom: Spacing.xl,
  },
  currentAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  avatarActions: {
    flex: 1,
    gap: Spacing.sm,
  },
  avatarActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  avatarActionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  avatarPickerSection: {
    marginTop: Spacing.lg,
  },
  avatarScrollRow: {
    flexGrow: 0,
  },
  avatarPickerItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: Spacing.sm,
    position: "relative",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarPickerCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPickerInitials: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  avatarCheckmark: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  editAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    overflow: "visible",
    position: "relative",
  },
  editAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 38,
  },
  editAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarInitials: {
    fontSize: 24,
    fontWeight: "700",
  },
  editCameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  editInputContainer: {
    marginBottom: Spacing.lg,
  },
  editLabel: {
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
    marginBottom: Spacing.sm,
  },
  editInput: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "center",
  },
  editTextArea: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  editCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  editCategoryLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  editModalFooter: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing["2xl"],
    borderTopWidth: 1,
    borderTopColor: "#D6EAF8",
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
