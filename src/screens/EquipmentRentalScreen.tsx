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
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Equipment {
  id: string;
  name: string;
  category: string;
  image: string;
  dailyRate: number;
  weeklyRate: number;
  owner: string;
  location: string;
  rating: number;
  available: boolean;
  description: string;
}

const EQUIPMENT: Equipment[] = [
  {
    id: "1",
    name: "ট্রাক্টর - মাহিন্দ্রা ৫৭৫",
    category: "চাষ",
    image: "https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=400",
    dailyRate: 2500,
    weeklyRate: 15000,
    owner: "করিম ফার্ম হাউস",
    location: "বগুড়া সদর",
    rating: 4.8,
    available: true,
    description: "৫৫ HP ট্রাক্টর, চাষ ও বহনে উপযোগী",
  },
  {
    id: "2",
    name: "কম্বাইন হার্ভেস্টার",
    category: "ফসল কাটা",
    image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400",
    dailyRate: 8000,
    weeklyRate: 50000,
    owner: "আগ্রো টেক সার্ভিস",
    location: "রংপুর",
    rating: 4.9,
    available: true,
    description: "ধান ও গম কাটার জন্য আধুনিক মেশিন",
  },
  {
    id: "3",
    name: "পাওয়ার টিলার",
    category: "চাষ",
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400",
    dailyRate: 1200,
    weeklyRate: 7000,
    owner: "শফিক এগ্রো",
    location: "দিনাজপুর",
    rating: 4.5,
    available: false,
    description: "১২ HP পাওয়ার টিলার",
  },
  {
    id: "4",
    name: "স্প্রে মেশিন (ড্রোন)",
    category: "স্প্রে",
    image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=400",
    dailyRate: 5000,
    weeklyRate: 30000,
    owner: "ড্রোন ফার্মিং বিডি",
    location: "ঢাকা",
    rating: 4.7,
    available: true,
    description: "১০ লিটার ক্যাপাসিটি কৃষি ড্রোন",
  },
  {
    id: "5",
    name: "সীড ড্রিল মেশিন",
    category: "বপন",
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400",
    dailyRate: 1500,
    weeklyRate: 9000,
    owner: "কৃষি যন্ত্র কেন্দ্র",
    location: "কুমিল্লা",
    rating: 4.4,
    available: true,
    description: "সারি বপন মেশিন, বীজ সাশ্রয়ী",
  },
  {
    id: "6",
    name: "রাইস ট্রান্সপ্লান্টার",
    category: "রোপণ",
    image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400",
    dailyRate: 3500,
    weeklyRate: 20000,
    owner: "গ্রিন এগ্রো সার্ভিস",
    location: "সিলেট",
    rating: 4.6,
    available: true,
    description: "৪ সারি ধান রোপণ মেশিন",
  },
];

const CATEGORIES = ["সব", "চাষ", "ফসল কাটা", "স্প্রে", "বপন", "রোপণ"];

export default function EquipmentRentalScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredEquipment = EQUIPMENT.filter(
    (eq) => selectedCategory === "সব" || eq.category === selectedCategory
  );

  const handleRent = (equipment: Equipment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!equipment.available) {
      Alert.alert("অনুপলব্ধ", "এই যন্ত্রপাতি বর্তমানে ভাড়ায় নেই");
      return;
    }
    Alert.alert(
      "ভাড়া অনুরোধ",
      `${equipment.name}\n\nদৈনিক: ৳${equipment.dailyRate}\nসাপ্তাহিক: ৳${equipment.weeklyRate}\n\nমালিক: ${equipment.owner}`,
      [
        { text: "বাতিল", style: "cancel" },
        { text: "কল করুন", onPress: () => {} },
        { text: "মেসেজ করুন", onPress: () => {} },
      ]
    );
  };

  const renderEquipment = ({ item, index }: { item: Equipment; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable
        style={[
          styles.equipmentCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
          !item.available && styles.unavailable,
        ]}
        onPress={() => handleRent(item)}
      >
        <Image source={{ uri: item.image }} style={styles.equipmentImage} contentFit="cover" />

        <View style={[styles.categoryBadge, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.categoryText}>{item.category}</ThemedText>
        </View>

        {!item.available ? (
          <View style={styles.unavailableBadge}>
            <ThemedText style={styles.unavailableText}>বুকড</ThemedText>
          </View>
        ) : null}

        <View style={styles.equipmentContent}>
          <ThemedText style={[styles.equipmentName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </ThemedText>

          <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.description}
          </ThemedText>

          <View style={styles.ownerRow}>
            <Feather name="user" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.ownerText, { color: theme.textSecondary }]}>
              {item.owner}
            </ThemedText>
            <Feather name="map-pin" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
              {item.location}
            </ThemedText>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                দৈনিক
              </ThemedText>
              <ThemedText style={[styles.price, { color: theme.primary }]}>
                ৳{item.dailyRate.toLocaleString()}
              </ThemedText>
            </View>
            <View style={styles.priceContainer}>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                সাপ্তাহিক
              </ThemedText>
              <ThemedText style={[styles.price, { color: "#2FA36B" }]}>
                ৳{item.weeklyRate.toLocaleString()}
              </ThemedText>
            </View>
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color="#FFB300" />
              <ThemedText style={[styles.rating, { color: theme.text }]}>{item.rating}</ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn} style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoriesList, { paddingTop: Spacing.sm }]}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === item ? theme.primary : theme.card,
                  borderColor: selectedCategory === item ? theme.primary : theme.cardBorder,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(item);
              }}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: selectedCategory === item ? theme.white : theme.text },
                ]}
              >
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </Animated.View>

      <FlatList
        data={filteredEquipment}
        keyExtractor={(item) => item.id}
        renderItem={renderEquipment}
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
          <View style={styles.headerInfo}>
            <View style={[styles.infoCard, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="truck" size={20} color={theme.primary} />
              <ThemedText style={[styles.infoText, { color: theme.text }]}>
                আপনার এলাকায় যন্ত্রপাতি খুঁজুন এবং সরাসরি ভাড়া নিন
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
  categoriesContainer: { zIndex: 1 },
  categoriesList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerInfo: { marginBottom: Spacing.md },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  infoText: { flex: 1, fontSize: 13 },
  equipmentCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  unavailable: { opacity: 0.7 },
  equipmentImage: { height: 140, width: "100%" },
  categoryBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  categoryText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  unavailableBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "#DC2626",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  unavailableText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  equipmentContent: { padding: Spacing.md },
  equipmentName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  description: { fontSize: 13, marginBottom: Spacing.xs },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.sm },
  ownerText: { fontSize: 12, marginRight: Spacing.sm },
  locationText: { fontSize: 12 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  priceContainer: { alignItems: "center" },
  priceLabel: { fontSize: 11 },
  price: { fontSize: 15, fontWeight: "700" },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  rating: { fontSize: 14, fontWeight: "600" },
  separator: { height: Spacing.md },
});
