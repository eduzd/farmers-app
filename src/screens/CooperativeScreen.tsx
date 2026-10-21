import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Cooperative {
  id: string;
  name: string;
  type: string;
  location: string;
  members: number;
  established: string;
  services: string[];
  contact: string;
  benefits: string[];
}

const COOPERATIVES: Cooperative[] = [
  { id: "1", name: "কৃষক উন্নয়ন সমবায় সমিতি", type: "বহুমুখী", location: "গাজীপুর", members: 450, established: "২০১৫", services: ["ঋণ সুবিধা", "সার সরবরাহ", "বাজারজাতকরণ"], contact: "০১৭১২-১১১১১১", benefits: ["৫% কম সুদে ঋণ", "পাইকারি দরে সার"] },
  { id: "2", name: "মৎস্যজীবী সমবায়", type: "মৎস্য", location: "কিশোরগঞ্জ", members: 280, established: "২০১৮", services: ["পোনা সরবরাহ", "খাদ্য সরবরাহ", "প্রশিক্ষণ"], contact: "০১৮১২-২২২২২২", benefits: ["বিনামূল্যে প্রশিক্ষণ", "মাছ বিক্রয় সহায়তা"] },
  { id: "3", name: "দুগ্ধ উৎপাদক সমিতি", type: "দুগ্ধ", location: "বগুড়া", members: 320, established: "২০১০", services: ["দুধ সংগ্রহ", "পশু চিকিৎসা", "খাদ্য সরবরাহ"], contact: "০১৯১২-৩৩৩৩৩৩", benefits: ["উচ্চ দরে দুধ ক্রয়", "বিনামূল্যে পশু টিকা"] },
  { id: "4", name: "জৈব কৃষি সমবায়", type: "জৈব", location: "ময়মনসিংহ", members: 180, established: "২০২০", services: ["জৈব সার সরবরাহ", "সার্টিফিকেশন", "রপ্তানি সহায়তা"], contact: "০১৫১২-৪৪৪৪৪৪", benefits: ["জৈব সনদ প্রাপ্তি", "প্রিমিয়াম মূল্য"] },
];

export default function CooperativeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleJoin = (coop: Cooperative) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("সদস্য হন", `${coop.name}\n\nমোট সদস্য: ${coop.members}\nযোগাযোগ: ${coop.contact}`, [
      { text: "বাতিল", style: "cancel" },
      { text: "যোগাযোগ করুন", onPress: () => {} },
    ]);
  };

  const renderCooperative = ({ item, index }: { item: Cooperative; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable style={[styles.coopCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => handleJoin(item)}>
        <View style={styles.coopHeader}>
          <View style={[styles.coopIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="users" size={24} color={theme.primary} />
          </View>
          <View style={styles.coopInfo}>
            <ThemedText style={[styles.coopName, { color: theme.text }]}>{item.name}</ThemedText>
            <View style={styles.metaRow}>
              <View style={[styles.typeBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.typeText}>{item.type}</ThemedText>
              </View>
              <ThemedText style={[styles.location, { color: theme.textSecondary }]}>{item.location}</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.text }]}>{item.members} সদস্য</ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>প্রতিষ্ঠা: {item.established}</ThemedText>
          </View>
        </View>

        <View style={styles.servicesRow}>
          {item.services.map((service, i) => (
            <View key={i} style={[styles.serviceBadge, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={[styles.serviceText, { color: theme.text }]}>{service}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.benefitsSection}>
          <ThemedText style={[styles.benefitsLabel, { color: theme.text }]}>সদস্য সুবিধা:</ThemedText>
          {item.benefits.map((benefit, i) => (
            <View key={i} style={styles.benefitItem}>
              <Feather name="check-circle" size={14} color="#2FA36B" />
              <ThemedText style={[styles.benefitText, { color: theme.textSecondary }]}>{benefit}</ThemedText>
            </View>
          ))}
        </View>

        <Pressable style={[styles.joinButton, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.joinButtonText}>সদস্য হন</ThemedText>
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={COOPERATIVES}
        keyExtractor={(item) => item.id}
        renderItem={renderCooperative}
        contentContainerStyle={[styles.listContent, { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="home" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>সমবায় সমিতি</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>একসাথে এগিয়ে যাই, সমৃদ্ধি আনি</ThemedText>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg },
  headerCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  coopCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  coopHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  coopIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
  coopInfo: { flex: 1 },
  coopName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  typeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  location: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: Spacing.lg, marginBottom: Spacing.sm },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12 },
  servicesRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  serviceBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  serviceText: { fontSize: 11 },
  benefitsSection: { marginBottom: Spacing.md },
  benefitsLabel: { fontSize: 13, fontWeight: "600", marginBottom: Spacing.xs },
  benefitItem: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 4 },
  benefitText: { fontSize: 12 },
  joinButton: { alignItems: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  joinButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  separator: { height: Spacing.md },
});
