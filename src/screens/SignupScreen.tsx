import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/lib/authStore";

import { tr, useTr } from "@/lib/tr";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { signup, verifyOtp, resendOtp, authConfig, loadAuthConfig } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [devCode, setDevCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadAuthConfig();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await signup(name, email, password);
      
      if (result.success) {
        if (result.requiresVerification) {
          setPendingEmail(result.email || email);
          setShowOtpScreen(true);
          setResendCooldown(60);
          if (result.verificationCode) {
            setDevCode(result.verificationCode);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => otpInputRef.current?.focus(), 300);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setErrorMessage(result.error || "Signup failed. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Signup failed. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await verifyOtp(pendingEmail, otpCode, password, name, email.split("@")[0]);
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrorMessage(result.error || "Invalid verification code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Verification failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      const result = await resendOtp(pendingEmail);
      if (result.success) {
        setResendCooldown(60);
        if (result.code) {
          setDevCode(result.code);
        }
        Alert.alert(tr("Success"), tr("A new verification code has been sent to your email"));
      } else {
        setErrorMessage(result.error || "Failed to resend code");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(tr("Google sign-up not set up"), tr("Google sign-up needs a Google OAuth client ID, which isn't configured yet. Please sign up with email and password."));
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (showOtpScreen) {
      setShowOtpScreen(false);
      setOtpCode("");
      setErrorMessage("");
    } else {
      navigation.goBack();
    }
  };

  if (showOtpScreen) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          locations={[0, 0.4]}
          style={styles.gradient}
        >
          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
              <ThemedText style={styles.backText}>{tr("Back")}</ThemedText>
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + Spacing["3xl"] },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="mail" size={32} color={theme.primary} />
              </View>

              <ThemedText type="h3" style={[styles.title, { color: theme.text }]}>
                {tr("Verify Your Email")}
              </ThemedText>
              <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
                We've sent a 6-digit code to {pendingEmail}
              </ThemedText>

              {devCode ? (
                <View style={[styles.devCodeContainer, { backgroundColor: "#FEF3C7" }]}>
                  <ThemedText style={[styles.devCodeLabel, { color: "#D97706" }]}>
                    {tr("Development Code:")}
                  </ThemedText>
                  <ThemedText style={[styles.devCode, { color: theme.text }]}>
                    {devCode}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.inputContainer}>
                <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                  {tr("Verification Code")}
                </ThemedText>
                <TextInput
                  ref={otpInputRef}
                  style={[
                    styles.input,
                    styles.otpInput,
                    {
                      backgroundColor: theme.white,
                      color: theme.text,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  placeholder={tr("Enter 6-digit code")}
                  placeholderTextColor={theme.textSecondary}
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  testID="input-otp"
                />
              </View>

              {errorMessage ? (
                <ThemedText style={[styles.errorText, { color: theme.error }]}>
                  {errorMessage}
                </ThemedText>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.signUpButton,
                  { backgroundColor: theme.primary },
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={isLoading || otpCode.length !== 6}
                testID="button-verify"
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <View style={styles.signUpButtonContent}>
                    <Feather name="check-circle" size={18} color={theme.white} />
                    <ThemedText style={[styles.signUpButtonText, { color: theme.white }]}>
                      {tr("Verify & Create Account")}
                    </ThemedText>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.resendButton,
                  pressed && styles.linkPressed,
                  resendCooldown > 0 && styles.buttonDisabled,
                ]}
                onPress={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
              >
                <ThemedText style={[styles.resendText, { color: resendCooldown > 0 ? theme.textSecondary : theme.link }]}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                </ThemedText>
              </Pressable>
            </View>
          </KeyboardAwareScrollViewCompat>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientEnd]}
        locations={[0, 0.4]}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={handleBack}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
            <ThemedText style={styles.backText}>{tr("Back")}</ThemedText>
          </Pressable>
        </View>

        <KeyboardAwareScrollViewCompat
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing["3xl"] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: theme.white }]}>
            <View style={[styles.logoContainer, { borderColor: theme.text }]}>
              <ThemedText style={[styles.logoText, { color: theme.text }]}>F</ThemedText>
            </View>

            <ThemedText type="h3" style={[styles.title, { color: theme.text }]}>
              {tr("Create Account")}
            </ThemedText>
            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              {tr("Join the premium global network for modern farmers")}
            </ThemedText>

            {authConfig?.googleAuthEnabled ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.googleButton,
                    { borderColor: theme.inputBorder },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleGoogleSignUp}
                >
                  <View style={styles.googleIconContainer}>
                    <ThemedText style={styles.googleIcon}>G</ThemedText>
                  </View>
                  <ThemedText style={[styles.googleButtonText, { color: theme.text }]}>
                    {tr("Continue with Google")}
                  </ThemedText>
                </Pressable>

                <View style={styles.dividerContainer}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.inputBorder }]} />
                  <ThemedText type="small" style={[styles.dividerText, { color: theme.textSecondary }]}>
                    or
                  </ThemedText>
                  <View style={[styles.dividerLine, { backgroundColor: theme.inputBorder }]} />
                </View>
              </>
            ) : null}

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {tr("Full Name")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.white,
                    color: theme.text,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder={tr("Enter your full name")}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                testID="input-name-signup"
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {tr("Email")}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.white,
                    color: theme.text,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder={tr("you@example.com")}
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                testID="input-email-signup"
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
                {tr("Password")}
              </ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: theme.white,
                      color: theme.text,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  placeholder={tr("Create a password")}
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  testID="input-password-signup"
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {errorMessage ? (
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {errorMessage}
              </ThemedText>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.signUpButton,
                { backgroundColor: theme.primary },
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleSignup}
              disabled={isLoading}
              testID="button-create-account"
            >
              {isLoading ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <View style={styles.signUpButtonContent}>
                  <Feather name="user-plus" size={18} color={theme.white} />
                  <ThemedText style={[styles.signUpButtonText, { color: theme.white }]}>
                    {tr("Create Account")}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <View style={styles.loginContainer}>
              <ThemedText type="body" style={[styles.loginText, { color: theme.textSecondary }]}>
                Already have an account?{" "}
              </ThemedText>
              <Pressable
                style={({ pressed }) => pressed && styles.linkPressed}
                onPress={handleLogin}
                testID="button-login"
              >
                <ThemedText type="link" style={[styles.loginLink, { color: theme.link }]}>
                  {tr("Sign in")}
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText type="small" style={[styles.termsText, { color: theme.textSecondary }]}>
              By continuing, you agree to our{" "}
              <ThemedText type="link" style={[styles.termsLink, { color: theme.link }]}>
                {tr("Terms of Service")}
              </ThemedText>
              {" "}and{" "}
              <ThemedText type="link" style={[styles.termsLink, { color: theme.link }]}>
                {tr("Privacy Policy")}
              </ThemedText>
            </ThemedText>
          </View>

          <View style={styles.secureContainer}>
            <ThemedText type="small" style={[styles.secureText, { color: theme.textSecondary }]}>
              {tr("Secure authentication")}
            </ThemedText>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backText: {
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
    paddingTop: Spacing["2xl"],
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  devCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    width: "100%",
    justifyContent: "center",
  },
  devCodeLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  devCode: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 4,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    width: "100%",
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4285F4",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginVertical: Spacing.xl,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    textTransform: "uppercase",
    fontSize: 12,
  },
  inputContainer: {
    gap: Spacing.sm,
    width: "100%",
    marginBottom: Spacing.lg,
  },
  label: {
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "center",
  },
  otpInput: {
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 8,
    fontWeight: "600",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: Spacing["5xl"],
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  signUpButton: {
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    width: "100%",
    marginTop: Spacing.sm,
  },
  signUpButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  resendButton: {
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  resendText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loginContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  loginText: {},
  linkPressed: {
    opacity: 0.7,
  },
  loginLink: {
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  termsText: {
    textAlign: "center",
    marginTop: Spacing.xl,
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 14,
  },
  secureContainer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
  },
  secureText: {},
});
