import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TransportService {
  id: string;
  name: string;
  type: "ট্রাক" | "পিকআপ" | "ভ্যান" | "মোটরসাইকেল";
  capacity: string;
  ratePerKm: number;
  minCharge: number;
  owner: string;
  location: string;
  phone: string;
  rating: number;
  available: boolean;
  features: string[];
}

const TRANSPORTS: TransportService[] = [
  {
    id: "1",
    name: "কৃষি পণ্য পরিবহন",
    type: "ট্রাক",
    capacity: "৫ টন",
    ratePerKm: 25,
    minCharge: 2000,
    owner: "আব্দুল করিম ট্রান্সপোর্ট",
    location: "সাভার, ঢাকা",
    phone: "০১৭১২-৩৪৫৬৭৮",
    rating: 4.8,
    available: true,
    features: ["কভার্ড", "GPS ট্র্যাকিং", "বীমা"],
  },
  {
    id: "2",
    name: "ফ্রেশ ভেজিটেবল ক্যারিয়ার",
    type: "পিকআপ",
    capacity: "১.৫ টন",
    ratePerKm: 15,
    minCharge: 800,
    owner: "গ্রিন লজিস্টিক",
    location: "গাজীপুর",
    phone: "০১৮১২-১২৩৪৫৬",
    rating: 4.5,
    available: true,
    features: ["কভার্ড", "দ্রুত সেবা"],
  },
  {
    id: "3",
    name: "কোল্ড স্টোরেজ ভ্যান",
    type: "ভ্যান",
    capacity: "২ টন",
    ratePerKm: 35,
    minCharge: 3000,
    owner: "ফ্রেশ কুল লজিস্টিক",
    location: "উত্তরা, ঢাকা",
    phone: "০১৯১২-৯৮৭৬৫৪",
    rating: 4.9,
    available: false,
    features: ["কুলিং সিস্টেম", "তাপমাত্রা নিয়ন্ত্রণ", "বীমা"],
  },
  {
    id: "4",
    name: "দ্রুত ডেলিভারি",
    type: "মোটরসাইকেল",
    capacity: "৫০ কেজি",
    ratePerKm: 8,
    minCharge: 150,
    owner: "ফার্ম ডেলিভারি",
    location: "মিরপুর, ঢাকা",
    phone: "০১৬১২-৫৫৫৫৫৫",
    rating: 4.6,
    available: true,
    features: ["দ্রুত সেবা", "ট্র্যাকিং"],
  },
  {
    id: "5",
    name: "মাছ পরিবহন স্পেশাল",
    type: "ট্রাক",
    capacity: "৩ টন",
    ratePerKm: 30,
    minCharge: 2500,
    owner: "ফিশ ট্রান্সপোর্ট সার্ভিস",
    location: "ময়মনসিংহ",
    phone: "০১৫১২-৩৩৩৩৩৩",
    rating: 4.7,
    available: true,
    features: ["অক্সিজেন সাপ্লাই", "পানি ট্যাংক", "বীমা"],
  },
];

const VEHICLE_TYPES = ["সব", "ট্রাক", "পিকআপ", "ভ্যান", "মোটরসাইকেল"] as const;

export default function TransportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedType, setSelectedType] = useState<string>("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredTransports = TRANSPORTS.filter(
    (t) => selectedType === "সব" || t.type === selectedType
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ট্রাক": return "truck";
      case "পিকআপ": return "package";
      case "ভ্যান": return "box";
      case "মোটরসাইকেল": return "zap";
      default: return "truck";
    }
  };

  const handleBook = (transport: TransportService) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!transport.available) {
      Alert.alert("অনুপলব্ধ", "এই সেবা বর্তমানে ব্যস্ত");
      return;
    }
    Alert.alert(
      "বুকিং করুন",
      `${transport.name}\n\nধারণক্ষমতা: ${transport.capacity}\nপ্রতি কিমি: ৳${transport.ratePerKm}\nন্যূনতম চার্জ: ৳${transport.minCharge}`,
      [
        { text: "বাতিল", style: "cancel" },
        { text: "কল করুন", onPress: () => {} },
        { text: "বুক করুন", onPress: () => {} },
      ]
    );
  };

  const renderTransport = ({ item, index }: { item: TransportService; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable
        style={[
          styles.transportCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          !item.available && styles.unavailable,
        ]}
        onPress={() => handleBook(item)}
      >
        <View style={styles.transportHeader}>
          <View style={[styles.typeIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name={getTypeIcon(item.type) as any} size={24} color={theme.primary} />
          </View>
          <View style={styles.transportInfo}>
            <ThemedText style={[styles.transportName, { color: theme.text }]}>{item.name}</ThemedText>
            <View style={styles.metaRow}>
              <View style={[styles.typeBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.typeText}>{item.type}</ThemedText>
              </View>
              <ThemedText style={[styles.capacity, { color: theme.textSecondary }]}>
                {item.capacity}
              </ThemedText>
            </View>
          </View>
          {item.available ? (
            <View style={[styles.statusDot, { backgroundColor: "#2FA36B" }]} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: "#DC2626" }]} />
          )}
        </View>

        <View style={styles.ownerRow}>
          <Feather name="user" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.ownerText, { color: theme.textSecondary }]}>
            {item.owner}
          </ThemedText>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
            {item.location}
          </ThemedText>
        </View>

        <View style={styles.featuresRow}>
          {item.features.map((feature, i) => (
            <View key={i} style={[styles.featureBadge, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={[styles.featureText, { color: theme.text }]}>{feature}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceItem}>
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>প্রতি কিমি</ThemedText>
            <ThemedText style={[styles.priceValue, { color: theme.primary }]}>
              ৳{item.ratePerKm}
            </ThemedText>
          </View>
          <View style={styles.priceItem}>
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>ন্যূনতম</ThemedText>
            <ThemedText style={[styles.priceValue, { color: theme.text }]}>
              ৳{item.minCharge}
            </ThemedText>
          </View>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color="#FFB300" />
            <ThemedText style={[styles.rating, { color: theme.text }]}>{item.rating}</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.typesContainer}>
        <FlatList
          horizontal
          data={VEHICLE_TYPES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.typesList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.typeChip,
                {
                  backgroundColor: selectedType === item ? theme.primary : theme.card,
                  borderColor: selectedType === item ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedType(item);
              }}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: selectedType === item ? theme.white : theme.text },
                ]}
              >
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredTransports}
        keyExtractor={(item) => item.id}
        renderItem={renderTransport}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="truck" size={24} color={theme.primary} />
            <View style={styles.headerContent}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                কৃষি পণ্য পরিবহন
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                আপনার ফসল নিরাপদে গন্তব্যে পৌঁছে দিন
              </ThemedText>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typesContainer: { zIndex: 1 },
  typesList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  typeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  headerSubtitle: { fontSize: 13 },
  transportCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  unavailable: { opacity: 0.6 },
  transportHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  typeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  transportInfo: { flex: 1 },
  transportName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  typeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  capacity: { fontSize: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.sm },
  ownerText: { fontSize: 12, marginRight: Spacing.sm },
  locationText: { fontSize: 12 },
  featuresRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  featureBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  featureText: { fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },
  priceItem: { alignItems: "center" },
  priceLabel: { fontSize: 11 },
  priceValue: { fontSize: 16, fontWeight: "700" },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  rating: { fontSize: 14, fontWeight: "600" },
  separator: { height: Spacing.md },
});
