import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AuthShell, AuthDivider, FormError } from "@/components/AuthShell";
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";
import { Button, TextField } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { FontFamily, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import {
  firebaseErrorMessage,
  firebaseSignOut,
  googleSignInAvailable,
} from "@/lib/firebaseSignIn";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const COPY = {
  en: {
    title: "Create account",
    subtitle: "Join farmers, buyers and experts across Bangladesh",
    google: "Continue with Google",
    or: "or sign up with email",
    name: "Full name",
    namePh: "Your full name",
    email: "Email",
    emailPh: "you@example.com",
    password: "Password",
    passwordPh: "At least 6 characters",
    create: "Create account",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    missing: "Please fill in all fields",
    short: "Password must be at least 6 characters",
    failed: "Sign-up failed. Please try again.",
    back: "Back",
    verifyTitle: "Verify your email",
    verifySubtitle: "Your account is created. Confirm your email to start.",
  },
  bn: {
    title: "অ্যাকাউন্ট খুলুন",
    subtitle: "সারা দেশের কৃষক, ক্রেতা ও বিশেষজ্ঞদের সাথে যোগ দিন",
    google: "Google দিয়ে চালিয়ে যান",
    or: "অথবা ইমেইল দিয়ে",
    name: "পূর্ণ নাম",
    namePh: "আপনার পূর্ণ নাম",
    email: "ইমেইল",
    emailPh: "you@example.com",
    password: "পাসওয়ার্ড",
    passwordPh: "কমপক্ষে ৬ অক্ষর",
    create: "অ্যাকাউন্ট খুলুন",
    haveAccount: "আগে থেকেই অ্যাকাউন্ট আছে?",
    signIn: "সাইন ইন",
    missing: "সব ঘর পূরণ করুন",
    short: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
    failed: "নিবন্ধন হয়নি। আবার চেষ্টা করুন।",
    back: "ফিরে যান",
    verifyTitle: "ইমেইল যাচাই করুন",
    verifySubtitle: "অ্যাকাউন্ট খোলা হয়েছে। শুরু করতে ইমেইল নিশ্চিত করুন।",
  },
};

export default function SignupScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { signUpWithEmail, signInWithGoogle } = useAuthStore();
  const { language } = useI18n();
  const lang = language === "bn" ? "bn" : "en";
  const t = COPY[lang];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const showError = (message: string) => {
    setErrorMessage(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) return showError(t.missing);
    if (password.length < 6) return showError(t.short);

    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await signUpWithEmail(name.trim(), email.trim(), password);
      if (result.needsVerification) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVerifyEmail(result.email || email.trim());
      } else if (!result.success) {
        showError(
          result.firebaseError
            ? firebaseErrorMessage(result.firebaseError, lang)
            : result.error || t.failed,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setErrorMessage("");
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        showError(
          result.firebaseError
            ? firebaseErrorMessage(result.firebaseError, lang)
            : result.error || t.failed,
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const leaveVerify = () => {
    firebaseSignOut();
    setVerifyEmail(null);
    setPassword("");
  };

  if (verifyEmail) {
    return (
      <AuthShell
        title={t.verifyTitle}
        subtitle={t.verifySubtitle}
        icon="mail"
        onBack={leaveVerify}
        backLabel={t.back}
      >
        <VerifyEmailPanel
          email={verifyEmail}
          lang={lang}
          onCancel={leaveVerify}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      icon="user-plus"
      onBack={() => navigation.goBack()}
      backLabel={t.back}
      footer={
        <View style={styles.row}>
          <ThemedText muted>{t.haveAccount}</ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Login")}
            hitSlop={8}
            accessibilityRole="link"
          >
            <ThemedText
              style={{ color: theme.primary, fontFamily: FontFamily.bold }}
            >
              {t.signIn}
            </ThemedText>
          </Pressable>
        </View>
      }
    >
      {googleSignInAvailable ? (
        <>
          <Button
            title={t.google}
            variant="outline"
            icon="globe"
            onPress={handleGoogle}
            loading={googleLoading}
            testID="button-google-signup"
          />
          <AuthDivider label={t.or} />
        </>
      ) : null}
      <TextField
        label={t.name}
        icon="user"
        placeholder={t.namePh}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        testID="input-name-signup"
      />
      <TextField
        label={t.email}
        icon="mail"
        placeholder={t.emailPh}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        testID="input-email-signup"
      />
      <TextField
        label={t.password}
        icon="lock"
        placeholder={t.passwordPh}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSignup}
        returnKeyType="go"
        testID="input-password-signup"
        right={
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            accessibilityLabel={
              showPassword ? "Hide password" : "Show password"
            }
          >
            <AppIcon
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={theme.textTertiary}
            />
          </Pressable>
        }
      />
      <FormError message={errorMessage} />
      <Button
        title={t.create}
        onPress={handleSignup}
        loading={isLoading}
        size="lg"
        testID="button-create-account"
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
});
