import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { FormError } from "@/components/AuthShell";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useAuthStore } from "@/lib/authStore";
import { firebaseErrorMessage } from "@/lib/firebaseSignIn";

const COPY = {
  en: {
    sent: (email: string) =>
      `We sent a verification link to ${email}. Open it, then come back and tap the button below.`,
    spam: "Can't find it? Check your Spam or Promotions folder.",
    done: "I've verified my email",
    resend: "Resend email",
    resendIn: (s: number) => `Resend in ${s}s`,
    resent: "A new verification email is on its way.",
    notYet: "Your email isn't verified yet. Open the link in the email first.",
    expired: "Your sign-in timed out. Please sign in again.",
    other: "Use a different account",
  },
  bn: {
    sent: (email: string) =>
      `${email} ঠিকানায় একটি যাচাই লিংক পাঠানো হয়েছে। লিংকটি খুলুন, তারপর ফিরে এসে নিচের বোতামে চাপুন।`,
    spam: "খুঁজে পাচ্ছেন না? স্প্যাম বা প্রমোশন ফোল্ডার দেখুন।",
    done: "আমি ইমেইল যাচাই করেছি",
    resend: "আবার ইমেইল পাঠান",
    resendIn: (s: number) => `${s} সেকেন্ড পরে আবার পাঠান`,
    resent: "নতুন যাচাই ইমেইল পাঠানো হয়েছে।",
    notYet: "ইমেইল এখনও যাচাই হয়নি। আগে ইমেইলের লিংকটি খুলুন।",
    expired: "সাইন ইনের সময় শেষ। আবার সাইন ইন করুন।",
    other: "অন্য অ্যাকাউন্ট ব্যবহার করুন",
  },
};

export function VerifyEmailPanel({
  email,
  lang,
  onCancel,
}: {
  email: string;
  lang: "en" | "bn";
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const { confirmEmailVerified, resendVerificationEmail } = useAuthStore();
  const t = COPY[lang];
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const check = async () => {
    setChecking(true);
    setError("");
    setInfo("");
    const result = await confirmEmailVerified();
    setChecking(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (result.needsVerification) setError(t.notYet);
    else if (result.error === "session_expired") setError(t.expired);
    else if (result.firebaseError)
      setError(firebaseErrorMessage(result.firebaseError, lang));
    else setError(result.error || t.notYet);
  };

  const resend = async () => {
    setResending(true);
    setError("");
    setInfo("");
    const result = await resendVerificationEmail();
    setResending(false);
    if (result.success) {
      setInfo(t.resent);
      setCooldown(60);
    } else if (result.error === "session_expired") setError(t.expired);
    else setError(firebaseErrorMessage(result.firebaseError, lang));
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <View
        style={[
          styles.notice,
          {
            backgroundColor: theme.primary + "14",
            borderColor: theme.primary + "40",
          },
        ]}
      >
        <Feather name="mail" size={22} color={theme.primary} />
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText>{t.sent(email)}</ThemedText>
          <ThemedText muted type="small">
            {t.spam}
          </ThemedText>
        </View>
      </View>
      {info ? (
        <ThemedText style={{ color: theme.primary }}>{info}</ThemedText>
      ) : null}
      <FormError message={error} />
      <Button
        title={t.done}
        icon="check-circle"
        onPress={check}
        loading={checking}
        size="lg"
        testID="button-email-verified"
      />
      <Button
        title={cooldown > 0 ? t.resendIn(cooldown) : t.resend}
        variant="outline"
        icon="refresh-cw"
        onPress={resend}
        loading={resending}
        disabled={cooldown > 0}
        testID="button-resend-verification"
      />
      <Button
        title={t.other}
        variant="ghost"
        onPress={onCancel}
        testID="button-verify-cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "flex-start",
  },
});
