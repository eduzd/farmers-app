import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { TextInput } from "@/components/MayaText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
interface HelpCategory {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  articlesCount: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  isExpanded: boolean;
}

const HELP_CATEGORIES: HelpCategory[] = [
  { id: "1", title: "অ্যাকাউন্ট", icon: "user", color: "#2E96EF", articlesCount: 12 },
  { id: "2", title: "মার্কেটপ্লেস", icon: "shopping-bag", color: "#2E96EF", articlesCount: 18 },
  { id: "3", title: "পেমেন্ট", icon: "credit-card", color: "#B25E09", articlesCount: 15 },
  { id: "4", title: "ডেলিভারি", icon: "truck", color: "#3D38D0", articlesCount: 8 },
  { id: "5", title: "কমিউনিটি", icon: "users", color: "#DA2F2F", articlesCount: 10 },
  { id: "6", title: "প্রযুক্তি", icon: "settings", color: "#4A5568", articlesCount: 7 },
];

const FAQS: FAQ[] = [
  {
    id: "1",
    question: "কিভাবে বিক্রেতা হবো?",
    answer: "প্রোফাইল থেকে 'বিক্রেতা হন' অপশনে যান। আপনার খামারের তথ্য দিন, ছবি আপলোড করুন এবং ভেরিফিকেশন সম্পন্ন করুন। ২৪ ঘণ্টার মধ্যে আপনার অ্যাকাউন্ট অ্যাক্টিভ হয়ে যাবে।",
    isExpanded: false,
  },
  {
    id: "2",
    question: "পেমেন্ট কিভাবে পাবো?",
    answer: "অর্ডার সম্পন্ন হওয়ার পর ৩-৫ কর্মদিবসের মধ্যে আপনার বিকাশ/নগদ অ্যাকাউন্টে টাকা পাঠানো হয়। প্রতি সোম ও বৃহস্পতিবার পেমেন্ট প্রসেস করা হয়।",
    isExpanded: false,
  },
  {
    id: "3",
    question: "ডেলিভারি কতদিন লাগে?",
    answer: "ঢাকার মধ্যে ২-৩ দিন, ঢাকার বাইরে ৩-৫ দিন সময় লাগে। তাজা পণ্যের জন্য আমরা দ্রুত ডেলিভারি নিশ্চিত করি।",
    isExpanded: false,
  },
  {
    id: "4",
    question: "পণ্য রিটার্ন করতে চাই?",
    answer: "পণ্য পাওয়ার ২৪ ঘণ্টার মধ্যে রিটার্ন রিকুয়েস্ট করুন। তাজা পণ্যের ক্ষেত্রে ছবি/ভিডিও প্রমাণ দিন। আমরা পরীক্ষা করে রিফান্ড প্রসেস করবো।",
    isExpanded: false,
  },
  {
    id: "5",
    question: "বিশেষজ্ঞদের সাথে কথা বলতে চাই?",
    answer: "এক্সপার্ট Q&A সেকশনে যান। লাইভ সেশনে যোগ দিন অথবা সরাসরি প্রশ্ন করুন। প্রিমিয়াম মেম্বাররা ১-১ ভিডিও কল করতে পারেন।",
    isExpanded: false,
  },
];

export default function HelpCenterScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [faqs, setFaqs] = useState(FAQS);

  const toggleFaq = (faqId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFaqs(prev =>
      prev.map(faq => (faq.id === faqId ? { ...faq, isExpanded: !faq.isExpanded } : faq))
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.text }]}>{tr("সাহায্য কেন্দ্র")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {tr("আপনার প্রশ্নের উত্তর খুঁজুন")}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(50)}>
          <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={tr("সমস্যা বা প্রশ্ন লিখুন...")}
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={[styles.quickActions, { backgroundColor: theme.primary + "10", borderColor: theme.primary }]}>
          <ThemedText style={[styles.quickActionsTitle, { color: theme.text }]}>{tr("দ্রুত সাহায্য")}</ThemedText>
          <View style={styles.quickActionsRow}>
            <Pressable style={[styles.quickAction, { backgroundColor: theme.card }]}>
              <ChatIcon size={20} color={theme.primary} />
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{tr("চ্যাট সাপোর্ট")}</ThemedText>
            </Pressable>
            <Pressable style={[styles.quickAction, { backgroundColor: theme.card }]}>
              <Feather name="phone" size={20} color="#2E96EF" />
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{tr("কল করুন")}</ThemedText>
            </Pressable>
            <Pressable style={[styles.quickAction, { backgroundColor: theme.card }]}>
              <Feather name="mail" size={20} color="#B25E09" />
              <ThemedText style={[styles.quickActionText, { color: theme.text }]}>{tr("ইমেইল")}</ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("বিষয় অনুযায়ী সাহায্য")}</ThemedText>
          <View style={styles.categoriesGrid}>
            {HELP_CATEGORIES.map((cat, index) => (
              <Animated.View key={cat.id} entering={FadeInUp.delay(150 + index * 30)}>
                <Pressable
                  style={[styles.categoryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color + "15" }]}>
                    <AppIcon name={cat.icon} size={20} color={cat.color} />
                  </View>
                  <ThemedText style={[styles.categoryTitle, { color: theme.text }]}>{cat.title}</ThemedText>
                  <ThemedText style={[styles.categoryCount, { color: theme.textSecondary }]}>
                    {cat.articlesCount} আর্টিকেল
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{tr("জনপ্রিয় প্রশ্ন")}</ThemedText>
          <View style={[styles.faqsContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {faqs.map((faq, index) => (
              <Animated.View key={faq.id} entering={FadeInUp.delay(300 + index * 30)}>
                <Pressable
                  style={[styles.faqItem, index < faqs.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}
                  onPress={() => toggleFaq(faq.id)}
                >
                  <View style={styles.faqHeader}>
                    <ThemedText style={[styles.faqQuestion, { color: theme.text }]}>{faq.question}</ThemedText>
                    <AppIcon name={faq.isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
                  </View>
                  {faq.isExpanded ? (
                    <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>{faq.answer}</ThemedText>
                  ) : null}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(500)} style={[styles.feedbackCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ChatIcon size={24} color={theme.primary} />
          <View style={styles.feedbackContent}>
            <ThemedText style={[styles.feedbackTitle, { color: theme.text }]}>{tr("সমস্যার সমাধান হয়নি?")}</ThemedText>
            <ThemedText style={[styles.feedbackDescription, { color: theme.textSecondary }]}>
              {tr("আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন")}
            </ThemedText>
          </View>
          <Pressable style={[styles.feedbackBtn, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.feedbackBtnText}>{tr("যোগাযোগ")}</ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  searchContainer: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, marginBottom: Spacing.lg },
  searchInput: { flex: 1, fontSize: 15 },
  quickActions: { padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.lg },
  quickActionsTitle: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.md },
  quickActionsRow: { flexDirection: "row", gap: Spacing.md },
  quickAction: { flex: 1, alignItems: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  quickActionText: { fontSize: 11, marginTop: 4 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  categoryCard: { width: "48%", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  categoryTitle: { fontSize: 14, fontWeight: "600" },
  categoryCount: { fontSize: 11, marginTop: 2 },
  faqsContainer: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  faqItem: { padding: Spacing.md },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: "500", paddingRight: Spacing.sm },
  faqAnswer: { fontSize: 13, lineHeight: 20, marginTop: Spacing.sm },
  feedbackCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1 },
  feedbackContent: { flex: 1, marginLeft: Spacing.md },
  feedbackTitle: { fontSize: 14, fontWeight: "600" },
  feedbackDescription: { fontSize: 12, marginTop: 2 },
  feedbackBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  feedbackBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
