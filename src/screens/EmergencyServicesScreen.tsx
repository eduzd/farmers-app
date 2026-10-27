import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
interface EmergencyContact {
  id: string;
  name: string;
  category: string;
  phone: string;
  location: string;
  available: string;
  icon: string;
  color: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: "2", name: "কৃষি হটলাইন", category: "কৃষি পরামর্শ", phone: "১৬১২৩", location: "সারাদেশ", available: "২৪/৭", icon: "phone", color: "#2E96EF" },
  { id: "5", name: "ফায়ার সার্ভিস", category: "অগ্নিকাণ্ড", phone: "৯৯৯", location: "সারাদেশ", available: "২৪/৭", icon: "zap", color: "#FF4BB7" },
  { id: "6", name: "আবহাওয়া সতর্কতা", category: "আবহাওয়া", phone: "১০৯০", location: "সারাদেশ", available: "২৪/৭", icon: "cloud", color: "#00BB77" },
];

const QUICK_TIPS = [
  { title: "গরু অসুস্থ হলে", tips: ["খাওয়া বন্ধ করুন", "পানি দিন", "পশু ডাক্তার ডাকুন"] },
  { title: "ফসলে পোকা আক্রমণ", tips: ["আক্রান্ত অংশ আলাদা করুন", "নিম তেল স্প্রে করুন", "কৃষি অফিসে জানান"] },
  { title: "মাছের মড়ক দেখা দিলে", tips: ["পানি বদলান", "অক্সিজেন বাড়ান", "মৎস্য বিশেষজ্ঞ ডাকুন"] },
];

export default function EmergencyServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const handleCall = (contact: EmergencyContact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "জরুরি কল",
      `${contact.name}\n${contact.phone}`,
      [
        { text: "বাতিল", style: "cancel" },
        { text: "কল করুন", onPress: () => Linking.openURL(`tel:${contact.phone}`) },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn} style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: "#DA2F2F" + "20" }]}>
          <Feather name="phone-call" size={32} color="#DA2F2F" />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>জরুরি সেবা</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          কৃষি জরুরি সেবা ও হেল্পলাইন নম্বর
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          জরুরি যোগাযোগ
        </ThemedText>
        {EMERGENCY_CONTACTS.map((contact, index) => (
          <Animated.View key={contact.id} entering={FadeInUp.delay(150 + index * 50)}>
            <Pressable
              style={[styles.contactCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => handleCall(contact)}
            >
              <View style={[styles.contactIcon, { backgroundColor: contact.color + "20" }]}>
                <AppIcon name={contact.icon as any} size={24} color={contact.color} />
              </View>
              <View style={styles.contactInfo}>
                <ThemedText style={[styles.contactName, { color: theme.text }]}>{contact.name}</ThemedText>
                <ThemedText style={[styles.contactCategory, { color: theme.textSecondary }]}>
                  {contact.category}
                </ThemedText>
                <View style={styles.contactMeta}>
                  <Feather name="map-pin" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {contact.location}
                  </ThemedText>
                  <View style={[styles.availableBadge, { backgroundColor: "#2E96EF" + "20" }]}>
                    <ThemedText style={[styles.availableText, { color: "#2E96EF" }]}>
                      {contact.available}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View style={[styles.callButton, { backgroundColor: contact.color }]}>
                <Feather name="phone" size={20} color="#fff" />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          প্রাথমিক পদক্ষেপ
        </ThemedText>
        {QUICK_TIPS.map((tip, index) => (
          <View
            key={index}
            style={[styles.tipCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <ThemedText style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</ThemedText>
            {tip.tips.map((t, i) => (
              <View key={i} style={styles.tipItem}>
                <View style={[styles.tipNumber, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.tipNumberText}>{i + 1}</ThemedText>
                </View>
                <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>{t}</ThemedText>
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { alignItems: "center", marginBottom: Spacing.xl },
  iconContainer: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: "700", marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, textAlign: "center" },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  contactCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  contactIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  contactCategory: { fontSize: 12, marginBottom: 4 },
  contactMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, marginRight: Spacing.sm },
  availableBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.sm },
  availableText: { fontSize: 10, fontWeight: "600" },
  callButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tipCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  tipTitle: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.sm },
  tipItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  tipNumber: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipNumberText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  tipText: { flex: 1, fontSize: 13 },
});
