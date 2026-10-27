import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
export default function SupportScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !message) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate submission
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <View
        style={[
          styles.container,
          styles.successContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: theme.primary }]}>
            <Feather name="check" size={32} color={theme.white} />
          </View>
          <ThemedText type="h3" style={styles.successTitle}>
            {tr("Message Sent")}
          </ThemedText>
          <ThemedText type="body" style={styles.successText}>
            {tr("Thank you for reaching out. Our team will get back to you within 24 hours.")}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing["3xl"],
        },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.title}>
          {tr("Contact Support")}
        </ThemedText>
        <ThemedText type="body" style={styles.subtitle}>
          {tr("Have a question or need help? We're here for you.")}
        </ThemedText>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <ThemedText type="small" style={styles.label}>
            {tr("Name")}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.backgroundSecondary,
              },
            ]}
            placeholder={tr("Enter your name")}
            placeholderTextColor={theme.tabIconDefault}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            testID="input-name"
          />
        </View>

        <View style={styles.inputContainer}>
          <ThemedText type="small" style={styles.label}>
            {tr("Email")}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.backgroundSecondary,
              },
            ]}
            placeholder={tr("Enter your email")}
            placeholderTextColor={theme.tabIconDefault}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="input-email"
          />
        </View>

        <View style={styles.inputContainer}>
          <ThemedText type="small" style={styles.label}>
            {tr("Message")}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.backgroundSecondary,
              },
            ]}
            placeholder={tr("How can we help you?")}
            placeholderTextColor={theme.tabIconDefault}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            testID="input-message"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: theme.primary },
            pressed && styles.buttonPressed,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
          testID="button-submit"
        >
          {isLoading ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <ThemedText style={[styles.submitButtonText, { color: theme.white }]}>
              {tr("Send Message")}
            </ThemedText>
          )}
        </Pressable>
      </View>

      <View style={styles.contactInfo}>
        <ThemedText type="small" style={styles.contactTitle}>
          {tr("Other ways to reach us")}
        </ThemedText>
        <View style={styles.contactItem}>
          <Feather name="mail" size={16} color={theme.tabIconDefault} />
          <ThemedText type="small" style={styles.contactText}>
            {tr("support@farmers.com")}
          </ThemedText>
        </View>
        <View style={styles.contactItem}>
          <Feather name="phone" size={16} color={theme.tabIconDefault} />
          <ThemedText type="small" style={styles.contactText}>
            +1 (555) 123-4567
          </ThemedText>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing["2xl"],
    flexGrow: 1,
  },
  successContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  successContent: {
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  successIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  successTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  successText: {
    opacity: 0.6,
    textAlign: "center",
  },
  header: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    opacity: 0.6,
  },
  form: {
    width: "100%",
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.xs,
  },
  label: {
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "center",
  },
  textArea: {
    height: 120,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  submitButton: {
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
  },
  contactInfo: {
    marginTop: Spacing["4xl"],
    paddingTop: Spacing["2xl"],
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  contactTitle: {
    fontWeight: "600",
    fontFamily: "DMSans_600SemiBold",
    marginBottom: Spacing.lg,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  contactText: {
    opacity: 0.6,
  },
});
