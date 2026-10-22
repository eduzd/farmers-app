import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AuthShell, AuthDivider, FormError } from "@/components/AuthShell";
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
import { VerifyEmailPanel } from "@/components/VerifyEmailPanel";

import { AppIcon } from "@/components/icons/AppIcon";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const COPY = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to connect with farmers, buyers and experts",
    google: "Continue with Google",
    or: "or sign in with email",
    email: "Email",
    emailPh: "you@example.com",
    password: "Password",
    passwordPh: "Your password",
    signIn: "Sign in",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    missing: "Please enter email and password",
    failed: "Login failed. Please try again.",
    back: "Back",
    verifyTitle: "Verify your email",
    verifySubtitle: "One more step before you can sign in",
  },
  bn: {
    title: "আবার স্বাগতম",
    subtitle: "কৃষক, ক্রেতা ও বিশেষজ্ঞদের সাথে যুক্ত হতে সাইন ইন করুন",
    google: "Google দিয়ে চালিয়ে যান",
    or: "অথবা ইমেইল দিয়ে",
    email: "ইমেইল",
    emailPh: "you@example.com",
    password: "পাসওয়ার্ড",
    passwordPh: "আপনার পাসওয়ার্ড",
    signIn: "সাইন ইন",
    noAccount: "অ্যাকাউন্ট নেই?",
    signUp: "নিবন্ধন করুন",
    missing: "ইমেইল ও পাসওয়ার্ড দিন",
    failed: "লগইন হয়নি। আবার চেষ্টা করুন।",
    back: "ফিরে যান",
    verifyTitle: "ইমেইল যাচাই করুন",
    verifySubtitle: "সাইন ইন করার আগে আর একটি ধাপ",
  },
};

export default function LoginScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { signInWithEmail, signInWithGoogle } = useAuthStore();
  const { language } = useI18n();
  const lang = language === "bn" ? "bn" : "en";
  const t = COPY[lang];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(t.missing);
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await signInWithEmail(email.trim(), password);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result.needsVerification) {
        setVerifyEmail(result.email || email.trim());
      } else {
        setErrorMessage(
          result.firebaseError
            ? firebaseErrorMessage(result.firebaseError, lang)
            : result.error || t.failed,
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || t.failed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setErrorMessage("");
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrorMessage(
          result.firebaseError
            ? firebaseErrorMessage(result.firebaseError, lang)
            : result.error || t.failed,
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (verifyEmail) {
    return (
      <AuthShell
        title={t.verifyTitle}
        subtitle={t.verifySubtitle}
        icon="mail"
        onBack={() => {
          firebaseSignOut();
          setVerifyEmail(null);
        }}
        backLabel={t.back}
      >
        <VerifyEmailPanel
          email={verifyEmail}
          lang={lang}
          onCancel={() => {
            firebaseSignOut();
            setVerifyEmail(null);
            setPassword("");
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      icon="log-in"
      onBack={() => navigation.goBack()}
      backLabel={t.back}
      footer={
        <View style={styles.row}>
          <ThemedText muted>{t.noAccount}</ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Signup")}
            hitSlop={8}
            accessibilityRole="link"
          >
            <ThemedText
              style={{ color: theme.primary, fontFamily: FontFamily.bold }}
            >
              {t.signUp}
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
            testID="button-google-signin"
          />
          <AuthDivider label={t.or} />
        </>
      ) : null}
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
        testID="input-email"
      />
      <TextField
        label={t.password}
        icon="lock"
        placeholder={t.passwordPh}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={handleLogin}
        returnKeyType="go"
        testID="input-password"
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
        title={t.signIn}
        onPress={handleLogin}
        loading={isLoading}
        size="lg"
        testID="button-signin"
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
});
