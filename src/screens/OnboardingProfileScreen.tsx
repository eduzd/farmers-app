import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { PROFILE_BADGES } from "@/constants/profileBadges";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { AvatarPicker, AvatarOption, AVATAR_OPTIONS } from "@/components/AvatarPicker";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

import { tr, useTr } from "@/lib/tr";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FARMING_CATEGORIES = [
  { id: "crops", label: "Crops Farming" },
  { id: "vegetables", label: "Vegetables" },
  { id: "fruits", label: "Fruits" },
  { id: "dairy", label: "Dairy Farming" },
  { id: "poultry", label: "Poultry" },
  { id: "fish", label: "Fish Farming" },
  { id: "livestock", label: "Livestock" },
  { id: "organic", label: "Organic Farming" },
  { id: "mixed", label: "Mixed Farming" },
];

export default function OnboardingProfileScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, updateProfile, completeOnboarding } = useAuthStore();
  const { t } = useI18n();

  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectAvatar = (avatarOption: AvatarOption) => {
    setSelectedAvatarId(avatarOption.id);
    setAvatar(undefined);
  };

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to upload a profile picture.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
      setSelectedAvatarId(undefined);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
  };

  const handleComplete = async () => {
    if (!name.trim()) {
      Alert.alert(tr("Required"), tr("Please enter your name"));
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const selectedAvatarData = selectedAvatarId ? AVATAR_OPTIONS.find(a => a.id === selectedAvatarId) : null;
    
    const initials = selectedAvatarData 
      ? selectedAvatarData.initials 
      : name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2);

    await updateProfile({
      name: name.trim(),
      username: username.trim() || undefined,
      initials,
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      bio: bio.trim() || undefined,
      avatar,
      avatarId: selectedAvatarId,
      avatarColor: selectedAvatarData?.backgroundColor,
      farmingCategory: selectedCategory || undefined,
    });
    await completeOnboarding();

    setIsLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientEnd]}
        locations={[0, 0.3]}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
            onPress={handleSkip}
          >
            <ThemedText style={styles.skipText}>{t("common.skip")}</ThemedText>
          </Pressable>
        </View>

        <KeyboardAwareScrollViewCompat
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing["3xl"] },
          ]}
        >
          <View style={styles.titleSection}>
            <ThemedText style={styles.title}>{t("onboarding.setupProfile")}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {tr("Complete your profile to connect with the farming community")}
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: theme.white }]}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.text }]}>
              {tr("প্রোফাইল অ্যাভাটার")}
            </ThemedText>
            
            <AvatarPicker
              selectedAvatar={selectedAvatarId}
              onSelectAvatar={handleSelectAvatar}
            />

            <View style={styles.orDivider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
              <ThemedText style={[styles.orText, { color: theme.textSecondary }]}>{tr("অথবা")}</ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
            </View>

            <Pressable style={styles.avatarSection} onPress={handlePickImage}>
              <View style={[styles.avatarContainer, { borderColor: theme.primary }]}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="camera" size={32} color={theme.textSecondary} />
                  </View>
                )}
                <View style={[styles.cameraButton, { backgroundColor: theme.primary }]}>
                  <Feather name="camera" size={14} color={theme.white} />
                </View>
              </View>
              <ThemedText style={[styles.avatarHint, { color: theme.primary }]}>
                {tr("নিজের ছবি আপলোড করুন")}
              </ThemedText>
            </Pressable>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {tr("Full Name *")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder },
                ]}
                placeholder={tr("Enter your full name")}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {tr("Username")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder },
                ]}
                placeholder={tr("@username")}
                placeholderTextColor={theme.textSecondary}
                value={username}
                onChangeText={(text) => setUsername(text.replace(/\s/g, "").toLowerCase())}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {t("onboarding.phone")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder },
                ]}
                placeholder={tr("+880 1XXX-XXXXXX")}
                placeholderTextColor={theme.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {t("onboarding.location")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder },
                ]}
                placeholder={tr("City, Country")}
                placeholderTextColor={theme.textSecondary}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {tr("Farming Category")}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContainer}
              >
                {FARMING_CATEGORIES.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selectedCategory === category.id ? theme.primary : theme.backgroundDefault,
                        borderColor: selectedCategory === category.id ? theme.primary : theme.inputBorder,
                      },
                    ]}
                    onPress={() => handleCategorySelect(category.id)}
                  >
                    <MaterialCommunityIcons
                      name={PROFILE_BADGES[category.id].icon}
                      size={16}
                      color={selectedCategory === category.id ? theme.white : PROFILE_BADGES[category.id].color}
                    />
                    <ThemedText
                      style={[
                        styles.categoryLabel,
                        { color: selectedCategory === category.id ? theme.white : theme.text },
                      ]}
                    >
                      {category.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {t("onboarding.bio")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.inputBorder },
                ]}
                placeholder={tr("Tell us about yourself and your farming experience...")}
                placeholderTextColor={theme.textSecondary}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.completeButton,
                { backgroundColor: theme.primary },
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <>
                  <ThemedText style={[styles.completeButtonText, { color: theme.white }]}>
                    {tr("Complete Profile")}
                  </ThemedText>
                  <Feather name="check" size={20} color={theme.white} />
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAwareScrollViewCompat>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  skipButton: {
    padding: Spacing.sm,
  },
  skipButtonPressed: {
    opacity: 0.7,
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  titleSection: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "PlusJakartaSans_400Regular",
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    overflow: "visible",
    position: "relative",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 47,
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 47,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarHint: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  sectionLabel: {
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: Spacing.md,
    fontSize: 14,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    paddingHorizontal: Spacing.md,
    fontSize: 13,
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "center",
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  categoriesContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
