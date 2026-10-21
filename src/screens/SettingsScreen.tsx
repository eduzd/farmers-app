import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { CustomSwitch } from "@/components/CustomSwitch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { PROFILE_BADGES } from "@/constants/profileBadges";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarOption, AVATAR_OPTIONS, NotionFace } from "@/components/AvatarPicker";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { fetchAbout, isLocalPhoto, removeAvatar, saveAbout, saveProfileDetails, uploadAvatar } from "@/lib/profileApi";
import { useI18n, Language } from "@/lib/i18n";
import { useThemeStore, ThemePreference } from "@/lib/themeStore";
import { ModalBottomInset } from "@/components/ModalBottomInset";

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
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [editName, setEditName] = useState(user?.name || "");
  const [editUsername, setEditUsername] = useState(user?.username || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [editLocation, setEditLocation] = useState(user?.location || "");
  const [editBio, setEditBio] = useState(user?.bio || "");
  const [editCategory, setEditCategory] = useState(user?.farmingCategory || "");
  const [editAvatar, setEditAvatar] = useState(user?.avatar);
  const [editAvatarId, setEditAvatarId] = useState(user?.avatarId);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const token = useAuthStore((s) => s.token);
  const route = useRoute<any>();

  const openEditProfile = () => {
    setEditName(user?.name || "");
    setEditUsername(user?.username || "");
    setEditPhone(user?.phone || "");
    setEditLocation(user?.location || "");
    setEditBio(user?.bio || "");
    setEditCategory(user?.farmingCategory || "");
    setEditAvatar(user?.avatar);
    setEditAvatarId(user?.avatarId);
    setShowEditProfileModal(true);
    // Bio and location saved on the server (e.g. from another phone) win.
    if (token) {
      void fetchAbout().then((a) => {
        if (!a) return;
        if (a.bio) setEditBio(a.bio);
        if (a.location) setEditLocation(a.location);
      });
    }
  };

  // Profile page "Edit profile" opens this form straight away.
  useEffect(() => {
    if (route.params?.openEditProfile) {
      openEditProfile();
      navigation.setParams?.({ openEditProfile: undefined } as any);
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

  const pickFrom = async (source: "camera" | "library") => {
    if (Platform.OS !== "web") {
      const perm = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(t("settings.permissionRequired"), t("settings.photoLibraryAccess"));
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) {
      setEditAvatar(result.assets[0].uri);
      setEditAvatarId(undefined);
    }
  };

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const bn = language === "bn";
    if (Platform.OS === "web") {
      await pickFrom("library");
      return;
    }
    const buttons: any[] = [
      { text: bn ? "ছবি তুলুন" : "Take photo", onPress: () => void pickFrom("camera") },
      { text: bn ? "গ্যালারি থেকে" : "Choose from gallery", onPress: () => void pickFrom("library") },
    ];
    if (editAvatar) {
      buttons.push({ text: bn ? "ছবি সরান" : "Remove photo", style: "destructive", onPress: () => setEditAvatar(undefined) });
    }
    buttons.push({ text: bn ? "বাতিল" : "Cancel", style: "cancel" });
    Alert.alert(bn ? "প্রোফাইল ছবি" : "Profile picture", undefined, buttons);
  };

  const handleSelectAvatar = (avatar: AvatarOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditAvatarId(avatar.id);
    setEditAvatar(undefined);
    setShowAvatarPicker(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert(t("settings.required"), t("settings.pleaseEnterName"));
      return;
    }

    if (savingProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Signed in: save to the server first, so the photo and details show for everyone.
    let avatarToSave = editAvatar;
    if (token) {
      setSavingProfile(true);
      try {
        if (editAvatar && isLocalPhoto(editAvatar)) {
          avatarToSave = await uploadAvatar(editAvatar);
        } else if (!editAvatar && user?.avatar && !isLocalPhoto(user.avatar)) {
          await removeAvatar();
        }
        await saveProfileDetails({
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
          farmingCategory: editCategory || undefined,
        });
        await saveAbout({ bio: editBio.trim(), location: editLocation.trim() });
      } catch (e: any) {
        setSavingProfile(false);
        Alert.alert(language === "bn" ? "সেভ হয়নি" : "Couldn't save", e?.message || "Try again.");
        return;
      }
      setSavingProfile(false);
    }

    const selectedAvatarData = editAvatarId ? AVATAR_OPTIONS.find(a => a.id === editAvatarId) : null;

    const initials = selectedAvatarData 
      ? selectedAvatarData.initials 
      : editName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2);

    await updateProfile({
      name: editName.trim(),
      username: editUsername.trim() || undefined,
      initials,
      phone: editPhone.trim() || undefined,
      location: editLocation.trim() || undefined,
      bio: editBio.trim() || undefined,
      avatar: avatarToSave,
      avatarId: editAvatarId,
      avatarColor: selectedAvatarData?.backgroundColor,
      farmingCategory: editCategory || undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditProfileModal(false);
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
              <Feather name={themePreference === "dark" ? "moon" : themePreference === "light" ? "sun" : "smartphone"} size={20} color={theme.iconDefault || theme.text} />
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

          <View style={[styles.divider, { backgroundColor: theme.inputBorder }]} />

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Feather name="bell" size={20} color={theme.iconDefault || theme.text} />
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
                {t("profile.notifications")}
              </ThemedText>
            </View>
            <CustomSwitch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("settings.support")}
        </ThemedText>

        <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.settingItem}
            onPress={() => navigation.navigate("Support")}
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
              <Feather name="log-out" size={20} color="#DC2626" />
              <ThemedText style={[styles.settingLabel, { color: "#DC2626" }]}>
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
                  <Feather name={option.icon as any} size={20} color={theme.text} />
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

      <Modal
        visible={showEditProfileModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <KeyboardAvoidingView style={styles.editModalKeyboard} behavior="padding" keyboardVerticalOffset={0}>
          <View style={[styles.editModalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
            <View style={[styles.editModalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.editModalHeader}>
              <ThemedText type="h4" style={[styles.modalTitle, { color: theme.text }]}>
                {t("settings.editProfile")}
              </ThemedText>
              <Pressable onPress={() => setShowEditProfileModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.editModalScroll}>
              <View style={styles.editAvatarSection}>
                <View style={styles.currentAvatarRow}>
                  <UserAvatar
                    initials={editAvatarId ? AVATAR_OPTIONS.find(a => a.id === editAvatarId)?.initials || user?.initials || "U" : user?.initials || "U"}
                    avatar={editAvatar}
                    avatarId={editAvatarId}
                    avatarColor={editAvatarId ? AVATAR_OPTIONS.find(a => a.id === editAvatarId)?.backgroundColor : user?.avatarColor}
                    size="large"
                  />
                  <View style={styles.avatarActions}>
                    <Pressable 
                      style={[styles.avatarActionButton, { backgroundColor: theme.primary }]}
                      onPress={handlePickImage}
                    >
                      <Feather name="camera" size={16} color={theme.white} />
                      <ThemedText style={styles.avatarActionText}>{language === "bn" ? "ছবি আপলোড" : "Upload Photo"}</ThemedText>
                    </Pressable>
                    <Pressable 
                      style={[styles.avatarActionButton, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: theme.inputBorder }]}
                      onPress={() => setShowAvatarPicker(!showAvatarPicker)}
                    >
                      <Feather name="grid" size={16} color={theme.text} />
                      <ThemedText style={[styles.avatarActionText, { color: theme.text }]}>{language === "bn" ? "অ্যাভাটার বাছাই" : "Choose Avatar"}</ThemedText>
                    </Pressable>
                  </View>
                </View>

                {showAvatarPicker ? (
                  <View style={styles.avatarPickerSection}>
                    <ThemedText type="small" style={[styles.editLabel, { color: theme.text, marginBottom: Spacing.sm }]}>
                      {language === "bn" ? "একটি অ্যাভাটার বাছাই করুন" : "Choose an Avatar"}
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScrollRow}>
                      {AVATAR_OPTIONS.map((avatar) => {
                        const isSelected = editAvatarId === avatar.id;
                        return (
                          <Pressable
                            key={avatar.id}
                            style={[
                              styles.avatarPickerItem,
                              isSelected && { borderColor: theme.primary, borderWidth: 3 },
                            ]}
                            onPress={() => handleSelectAvatar(avatar)}
                          >
                            <NotionFace avatar={avatar} size={52} animated={isSelected} />
                            {isSelected ? (
                              <View style={[styles.avatarCheckmark, { backgroundColor: theme.primary }]}>
                                <Feather name="check" size={10} color={theme.white} />
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View style={styles.editInputContainer}>
                <ThemedText type="small" style={[styles.editLabel, { color: theme.text }]}>
                  {t("settings.fullName")} *
                </ThemedText>
                <TextInput
                  style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t("settings.enterName")}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.editInputContainer}>
                <ThemedText type="small" style={[styles.editLabel, { color: theme.text }]}>
                  {t("settings.username")}
                </ThemedText>
                <TextInput
                  style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  value={editUsername}
                  onChangeText={(text) => setEditUsername(text.replace(/\s/g, "").toLowerCase())}
                  placeholder={t("settings.enterUsername")}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.editInputContainer}>
                <ThemedText type="small" style={[styles.editLabel, { color: theme.text }]}>
                  {t("settings.phone")}
                </ThemedText>
                <TextInput
                  style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={t("settings.enterPhone")}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.editInputContainer}>
                <ThemedText type="small" style={[styles.editLabel, { color: theme.text }]}>
                  {t("settings.location")}
                </ThemedText>
                <TextInput
                  style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder={t("settings.enterLocation")}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.editInputContainer}>
                <ThemedText type="small" style={[styles.editLabel, { color: theme.text }]}>
                  {t("settings.farmingCategory")}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {FARMING_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.editCategoryChip,
                        {
                          backgroundColor: editCategory === cat.id ? theme.primary : theme.backgroundDefault,
                          borderColor: editCategory === cat.id ? theme.primary : theme.inputBorder,
                        },
                      ]}
                      onPress={() => setEditCategory(editCategory === cat.id ? "" : cat.id)}
                    >
                      <MaterialCommunityIcons
                        name={PROFILE_BADGES[cat.id].icon}
                        size={16}
                        color={editCategory === cat.id ? theme.white : PROFILE_BADGES[cat.id].color}
                      />
                      <ThemedText
                        style={[
                          styles.editCategoryLabel,
                          { color: editCategory === cat.id ? theme.white : theme.text },
                        ]}
                      >
                        {cat.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.editInputContainer}>
                <ThemedText type="small" style={[styles.editLabel, { color: theme.text }]}>
                  {t("settings.bio")}
                </ThemedText>
                <TextInput
                  style={[styles.editInput, styles.editTextArea, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder }]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder={t("settings.tellAboutYourself")}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.editModalFooter}>
              <Pressable
                style={[styles.cancelButton, { borderColor: theme.inputBorder }]}
                onPress={() => setShowEditProfileModal(false)}
              >
                <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>
                  {t("common.cancel")}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.saveButton, { backgroundColor: theme.primary, opacity: savingProfile ? 0.7 : 1 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                testID="save-profile"
              >
                {savingProfile ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <ThemedText style={[styles.saveButtonText, { color: theme.white }]}>
                    {t("settings.saveProfile")}
                  </ThemedText>
                )}
              </Pressable>
            </View>
            <ModalBottomInset avoidKeyboard={false} />
          </View>
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
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
    marginBottom: Spacing.sm,
  },
  editInput: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
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
    borderTopColor: "#E0E0E0",
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
