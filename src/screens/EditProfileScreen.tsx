import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Platform } from "react-native";
import { TextInput } from "@/components/MayaText";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@/components/icons/Feather";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarOption, AVATAR_OPTIONS, NotionFace } from "@/components/AvatarPicker";
import { PROFILE_BADGES } from "@/constants/profileBadges";
import { darkTone } from "@/constants/mayaTheme";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { fetchAbout, isLocalPhoto, removeAvatar, saveAbout, saveProfileDetails, uploadAvatar } from "@/lib/profileApi";
import { useI18n } from "@/lib/i18n";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_IDS = [
  ["crops", "settings.cropsFarming"],
  ["vegetables", "settings.vegetables"],
  ["fruits", "settings.fruits"],
  ["dairy", "settings.dairyFarming"],
  ["poultry", "settings.poultry"],
  ["fish", "settings.fishFarming"],
  ["livestock", "settings.livestock"],
  ["organic", "settings.organicFarming"],
  ["mixed", "settings.mixedFarming"],
] as const;

/**
 * Edit profile on a full page of its own (back arrow + the app's standard title), opened from the
 * profile's "Edit profile" button, the three-dot options page and Settings. Photo or avatar, name,
 * username, phone, area, farming type and bio; Save stays at the bottom of the screen.
 */
export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, updateProfile } = useAuthStore();
  const token = useAuthStore((s) => s.token);
  const { t, language } = useI18n();
  const bn = language === "bn";

  const [editName, setEditName] = useState(user?.name || "");
  const [editUsername, setEditUsername] = useState(user?.username || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [editLocation, setEditLocation] = useState(user?.location || "");
  const [editBio, setEditBio] = useState(user?.bio || "");
  const [editCategory, setEditCategory] = useState(user?.farmingCategory || "");
  const [editAvatar, setEditAvatar] = useState(user?.avatar);
  const [editAvatarId, setEditAvatarId] = useState(user?.avatarId);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bio and area saved on the server (e.g. from another phone) win.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchAbout().then((a) => {
      if (!alive || !a) return;
      if (a.bio) setEditBio(a.bio);
      if (a.location) setEditLocation(a.location);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  const pickFrom = async (source: "camera" | "library") => {
    if (Platform.OS !== "web") {
      const perm =
        source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(t("settings.permissionRequired"), t("settings.photoLibraryAccess"));
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) {
      setEditAvatar(result.assets[0].uri);
      setEditAvatarId(undefined);
    }
  };

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditAvatarId(avatar.id);
    setEditAvatar(undefined);
    setShowAvatarPicker(false);
  };

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Main" as any, { screen: "Profile" });
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert(t("settings.required"), t("settings.pleaseEnterName"));
      return;
    }
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Signed in: save to the server first, so the photo and details show for everyone.
    let avatarToSave = editAvatar;
    if (token) {
      setSaving(true);
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
        setSaving(false);
        Alert.alert(bn ? "সেভ হয়নি" : "Couldn't save", e?.message || (bn ? "আবার চেষ্টা করুন।" : "Try again."));
        return;
      }
      setSaving(false);
    }

    const selected = editAvatarId ? AVATAR_OPTIONS.find((a) => a.id === editAvatarId) : null;
    const initials = selected
      ? selected.initials
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
      avatarColor: selected?.backgroundColor,
      farmingCategory: editCategory || undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    close();
  };

  const inputStyle = [styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.inputBorder }];
  const selectedAvatar = editAvatarId ? AVATAR_OPTIONS.find((a) => a.id === editAvatarId) : undefined;

  return (
    <KeyboardAvoidingView
      testID="edit-profile-page"
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {/* Photo */}
          <View style={[styles.card, styles.photoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <UserAvatar
              initials={selectedAvatar?.initials || user?.initials || "U"}
              avatar={editAvatar}
              avatarId={editAvatarId}
              avatarColor={selectedAvatar ? selectedAvatar.backgroundColor : user?.avatarColor}
              size={96}
            />
            <View style={styles.photoButtons}>
              <Pressable
                testID="edit-profile-upload"
                accessibilityRole="button"
                style={({ pressed }) => [styles.photoBtn, { backgroundColor: theme.primary }, pressed && { opacity: 0.85 }]}
                onPress={handlePickImage}
              >
                <Feather name="camera" size={16} color={theme.buttonText} />
                <ThemedText style={[styles.photoBtnText, { color: theme.buttonText }]}>{bn ? "ছবি আপলোড" : "Upload photo"}</ThemedText>
              </Pressable>
              <Pressable
                testID="edit-profile-choose-avatar"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.photoBtn,
                  { backgroundColor: theme.card, borderWidth: 1, borderColor: isDark ? theme.inputBorder : theme.text },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setShowAvatarPicker((v) => !v)}
              >
                <Feather name="grid" size={16} color={theme.text} />
                <ThemedText style={[styles.photoBtnText, { color: theme.text }]}>{bn ? "অ্যাভাটার বাছাই" : "Choose avatar"}</ThemedText>
              </Pressable>
            </View>
            {showAvatarPicker ? (
              <View style={styles.avatarPicker} testID="edit-profile-avatar-picker">
                <ThemedText style={[styles.label, { color: theme.text }]}>{bn ? "একটি অ্যাভাটার বাছাই করুন" : "Choose an avatar"}</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                  {AVATAR_OPTIONS.map((avatar) => {
                    const on = editAvatarId === avatar.id;
                    return (
                      <Pressable
                        key={avatar.id}
                        style={[styles.avatarItem, on && { borderColor: theme.primary, borderWidth: 3 }]}
                        onPress={() => handleSelectAvatar(avatar)}
                      >
                        <NotionFace avatar={avatar} size={52} animated={on} />
                        {on ? (
                          <View style={[styles.avatarCheck, { backgroundColor: theme.primary, borderColor: theme.card }]}>
                            <Feather name="check" size={10} color={theme.buttonText} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* Details */}
          <ThemedText style={[styles.groupTitle, { color: theme.textSecondary }]}>{bn ? "আপনার তথ্য" : "Your details"}</ThemedText>
          <View style={[styles.card, styles.formCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.text }]}>{t("settings.fullName")} *</ThemedText>
              <TextInput
                testID="edit-profile-name"
                style={inputStyle}
                value={editName}
                onChangeText={setEditName}
                placeholder={t("settings.enterName")}
                placeholderTextColor={theme.textTertiary || theme.textSecondary}
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.text }]}>{t("settings.username")}</ThemedText>
              <TextInput
                testID="edit-profile-username"
                style={inputStyle}
                value={editUsername}
                onChangeText={(text) => setEditUsername(text.replace(/\s/g, "").toLowerCase())}
                placeholder={t("settings.enterUsername")}
                placeholderTextColor={theme.textTertiary || theme.textSecondary}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.text }]}>{t("settings.phone")}</ThemedText>
              <TextInput
                testID="edit-profile-phone"
                style={inputStyle}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder={t("settings.enterPhone")}
                placeholderTextColor={theme.textTertiary || theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.text }]}>{t("settings.location")}</ThemedText>
              <TextInput
                testID="edit-profile-location"
                style={inputStyle}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder={t("settings.enterLocation")}
                placeholderTextColor={theme.textTertiary || theme.textSecondary}
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.text }]}>{t("settings.farmingCategory")}</ThemedText>
              <View style={styles.chips}>
                {CATEGORY_IDS.map(([id, key]) => {
                  const on = editCategory === id;
                  const badge = PROFILE_BADGES[id];
                  return (
                    <Pressable
                      key={id}
                      testID={`edit-profile-category-${id}`}
                      style={[
                        styles.chip,
                        { backgroundColor: on ? theme.primary : theme.card, borderColor: on ? theme.primary : theme.inputBorder },
                      ]}
                      onPress={() => setEditCategory(on ? "" : id)}
                    >
                      <MaterialCommunityIcons name={badge.icon} size={16} color={on ? theme.buttonText : darkTone(badge.color, isDark)} />
                      <ThemedText style={[styles.chipText, { color: on ? theme.buttonText : theme.text }]}>{t(key)}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[styles.field, { marginBottom: 0 }]}>
              <ThemedText style={[styles.label, { color: theme.text }]}>{t("settings.bio")}</ThemedText>
              <TextInput
                testID="edit-profile-bio"
                style={[...inputStyle, styles.textArea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder={t("settings.tellAboutYourself")}
                placeholderTextColor={theme.textTertiary || theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Cancel / Save stay on screen */}
      <View
        style={[
          styles.footer,
          { backgroundColor: theme.backgroundRoot, borderTopColor: theme.cardBorder, paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <View style={[styles.inner, styles.footerRow]}>
          <Pressable
            testID="edit-profile-cancel"
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerBtn, { borderWidth: 1, borderColor: isDark ? theme.inputBorder : theme.text, backgroundColor: theme.card }, pressed && { opacity: 0.85 }]}
            onPress={close}
          >
            <ThemedText style={[styles.footerBtnText, { color: theme.text }]}>{t("common.cancel")}</ThemedText>
          </Pressable>
          <Pressable
            testID="save-profile"
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerBtn, { backgroundColor: isDark ? theme.primary : theme.text, opacity: saving ? 0.7 : 1 }, pressed && { opacity: 0.85 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={[styles.footerBtnText, { color: "#FFFFFF" }]}>{t("settings.saveProfile")}</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  inner: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
  },
  photoCard: {
    alignItems: "center",
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  photoButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  photoBtnText: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
  },
  avatarPicker: {
    alignSelf: "stretch",
  },
  avatarItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarCheck: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  groupTitle: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  formCard: {
    padding: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "center",
  },
  textArea: {
    height: 110,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
    fontWeight: "500",
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    fontWeight: "600",
  },
});
