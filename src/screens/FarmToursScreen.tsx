import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface FarmTour {
  id: string;
  title: string;
  farm: { name: string; avatar: string; location: string };
  image: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  capacity: number;
  registered: number;
  price: number;
  isVirtual: boolean;
  highlights: string[];
}

const FARM_TOURS: FarmTour[] = [
  {
    id: "1",
    title: "জৈব সবজি বাগান পরিদর্শন",
    farm: { name: "সবুজ কৃষি খামার", avatar: "https://randomuser.me/api/portraits/men/32.jpg", location: "ময়মনসিংহ" },
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800",
    description: "জৈব পদ্ধতিতে সবজি চাষের সম্পূর্ণ প্রক্রিয়া দেখুন এবং শিখুন",
    date: "২৫ জানুয়ারি ২০২৬",
    time: "সকাল ৯টা",
    duration: "৩ ঘণ্টা",
    capacity: 30,
    registered: 24,
    price: 500,
    isVirtual: false,
    highlights: ["জৈব সার তৈরি", "বীজ সংরক্ষণ", "পোকা দমন"],
  },
  {
    id: "2",
    title: "আধুনিক মাছের খামার ভার্চুয়াল ট্যুর",
    farm: { name: "নীল জলাশয়", avatar: "https://randomuser.me/api/portraits/men/45.jpg", location: "চট্টগ্রাম" },
    image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=800",
    description: "ঘরে বসেই দেখুন বড় আকারের মাছের খামার পরিচালনা",
    date: "২৮ জানুয়ারি ২০২৬",
    time: "বিকাল ৪টা",
    duration: "২ ঘণ্টা",
    capacity: 100,
    registered: 67,
    price: 0,
    isVirtual: true,
    highlights: ["পুকুর ব্যবস্থাপনা", "খাদ্য প্রয়োগ", "রোগ নিয়ন্ত্রণ"],
  },
  {
    id: "3",
    title: "গরুর খামার পরিদর্শন",
    farm: { name: "সোনালী ফার্ম", avatar: "https://randomuser.me/api/portraits/men/55.jpg", location: "রংপুর" },
    image: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800",
    description: "৫০টি গরুর আধুনিক খামার দেখুন এবং পশুপালন শিখুন",
    date: "১ ফেব্রুয়ারি ২০২৬",
    time: "সকাল ১০টা",
    duration: "৪ ঘণ্টা",
    capacity: 20,
    registered: 18,
    price: 1000,
    isVirtual: false,
    highlights: ["দুধ উৎপাদন", "খাদ্য তৈরি", "স্বাস্থ্য পরিচর্যা"],
  },
];

export default function FarmToursScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [tours, setTours] = useState(FARM_TOURS);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleRegister = (tourId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTours(prev =>
      prev.map(t => (t.id === tourId ? { ...t, registered: t.registered + 1 } : t))
    );
  };

  const renderTour = ({ item, index }: { item: FarmTour; index: number }) => {
    const spotsLeft = item.capacity - item.registered;
    const isFull = spotsLeft <= 0;
    
    return (
      <Animated.View entering={FadeInUp.delay(index * 100)}>
        <Pressable style={[styles.tourCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.image }} style={styles.tourImage} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.imageGradient} />
            {item.isVirtual ? (
              <View style={[styles.virtualBadge, { backgroundColor: "#2E96EF" }]}>
                <Feather name="monitor" size={10} color="#fff" />
                <ThemedText style={styles.virtualText}>ভার্চুয়াল</ThemedText>
              </View>
            ) : (
              <View style={[styles.virtualBadge, { backgroundColor: "#2E96EF" }]}>
                <Feather name="map-pin" size={10} color="#fff" />
                <ThemedText style={styles.virtualText}>সশরীর</ThemedText>
              </View>
            )}
            <View style={styles.imageInfo}>
              <ThemedText style={styles.tourTitle}>{item.title}</ThemedText>
            </View>
          </View>

          <View style={styles.tourContent}>
            <View style={styles.farmRow}>
              <Image source={{ uri: item.farm.avatar }} style={styles.farmAvatar} />
              <View style={styles.farmInfo}>
                <ThemedText style={[styles.farmName, { color: theme.text }]}>{item.farm.name}</ThemedText>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={10} color={theme.textSecondary} />
                  <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>{item.farm.location}</ThemedText>
                </View>
              </View>
            </View>

            <ThemedText style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </ThemedText>

            <View style={styles.highlightsRow}>
              {item.highlights.map((h, idx) => (
                <View key={idx} style={[styles.highlightChip, { backgroundColor: theme.primary + "10" }]}>
                  <ThemedText style={[styles.highlightText, { color: theme.primary }]}>{h}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Feather name="calendar" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.text }]}>{item.date}</ThemedText>
              </View>
              <View style={styles.detailItem}>
                <Feather name="clock" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.text }]}>{item.time}</ThemedText>
              </View>
              <View style={styles.detailItem}>
                <Feather name="watch" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.text }]}>{item.duration}</ThemedText>
              </View>
            </View>

            <View style={styles.footer}>
              <View>
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>রেজিস্ট্রেশন ফি</ThemedText>
                <ThemedText style={[styles.price, { color: item.price === 0 ? "#2E96EF" : theme.text }]}>
                  {item.price === 0 ? "ফ্রি" : `৳${item.price}`}
                </ThemedText>
              </View>
              <View style={styles.registrationInfo}>
                <View style={[styles.spotsContainer, { backgroundColor: isFull ? "#DA2F2F15" : "#2E96EF15" }]}>
                  <ThemedText style={[styles.spotsText, { color: isFull ? "#DA2F2F" : "#2E96EF" }]}>
                    {isFull ? "পূর্ণ" : `${spotsLeft}টি সিট বাকি`}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.registerBtn, { backgroundColor: isFull ? theme.textSecondary : theme.primary }]}
                  onPress={() => handleRegister(item.id)}
                  disabled={isFull}
                >
                  <ThemedText style={styles.registerBtnText}>
                    {isFull ? "ওয়েটলিস্ট" : "রেজিস্টার"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={tours}
        keyExtractor={item => item.id}
        renderItem={renderTour}
        ListHeaderComponent={
          <Animated.View entering={FadeIn} style={styles.header}>
            <ThemedText style={[styles.title, { color: theme.text }]}>ফার্ম ট্যুর</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              সফল খামার পরিদর্শন করুন, শিখুন
            </ThemedText>
          </Animated.View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  listContent: { paddingHorizontal: Spacing.lg },
  tourCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: "hidden", marginBottom: Spacing.lg },
  imageContainer: { position: "relative", height: 160 },
  tourImage: { width: "100%", height: "100%" },
  imageGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80 },
  virtualBadge: { position: "absolute", top: Spacing.md, left: Spacing.md, flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4 },
  virtualText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  imageInfo: { position: "absolute", bottom: Spacing.md, left: Spacing.md, right: Spacing.md },
  tourTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  tourContent: { padding: Spacing.md },
  farmRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  farmAvatar: { width: 40, height: 40, borderRadius: 20 },
  farmInfo: { flex: 1, marginLeft: Spacing.sm },
  farmName: { fontSize: 14, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  locationText: { fontSize: 12 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  highlightsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  highlightChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  highlightText: { fontSize: 11 },
  detailsRow: { flexDirection: "row", gap: Spacing.lg, marginBottom: Spacing.md },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 10 },
  price: { fontSize: 20, fontWeight: "700" },
  registrationInfo: { alignItems: "flex-end" },
  spotsContainer: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 4, marginBottom: Spacing.xs },
  spotsText: { fontSize: 10, fontWeight: "500" },
  registerBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  registerBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
