import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { UserAvatar } from "@/components/UserAvatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface Farmer {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  distance: string;
  rating: number;
  reviews: number;
  phone: string;
  products: string[];
  verified: boolean;
}

interface Shop {
  id: string;
  name: string;
  type: string;
  icon: string;
  distance: string;
  rating: number;
  openNow: boolean;
  address: string;
  phone: string;
}

const FARMERS: Farmer[] = [];

const SHOPS: Shop[] = [
  {
    id: "s1",
    name: "কৃষি ভাণ্ডার",
    type: "সার ও বীজ",
    icon: "🌱",
    distance: "০.৮ কিমি",
    rating: 4.7,
    openNow: true,
    address: "মেইন রোড, বাজার মোড়",
    phone: "01512345678",
  },
  {
    id: "s2",
    name: "মৎস্য কেন্দ্র",
    type: "মাছের খাবার ও ঔষধ",
    icon: "🐟",
    distance: "১.৫ কিমি",
    rating: 4.4,
    openNow: true,
    address: "স্টেশন রোড",
    phone: "01412345678",
  },
  {
    id: "s3",
    name: "পোল্ট্রি সাপ্লাই",
    type: "পোল্ট্রি সামগ্রী",
    icon: "🐔",
    distance: "২.২ কিমি",
    rating: 4.5,
    openNow: false,
    address: "কলেজ রোড",
    phone: "01312345678",
  },
  {
    id: "s4",
    name: "যন্ত্রপাতি হাউজ",
    type: "কৃষি যন্ত্রপাতি",
    icon: "🚜",
    distance: "৩.৫ কিমي",
    rating: 4.8,
    openNow: true,
    address: "ইন্ডাস্ট্রিয়াল এরিয়া",
    phone: "01212345678",
  },
];

export default function NearbyFarmersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<"farmers" | "shops">("farmers");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone}`);
  };

  const handleMessage = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Nearby farmers are directory entries (not app accounts yet), so open an SMS to their number.
    Linking.openURL(`sms:${phone}`).catch(() => Alert.alert("মেসেজ", phone));
  };

  const renderFarmer = ({ item, index }: { item: Farmer; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.cardHeader}>
          <UserAvatar
            initials={item.initials}
            size="medium"
            isWelfareMember={item.verified}
          />
          <View style={styles.farmerInfo}>
            <View style={styles.nameRow}>
              <ThemedText style={[styles.farmerName, { color: theme.text }]}>
                {item.name}
              </ThemedText>
            </View>
            <ThemedText style={[styles.specialty, { color: theme.textSecondary }]}>
              {item.specialty}
            </ThemedText>
          </View>
          <View style={styles.distanceContainer}>
            <Feather name="map-pin" size={12} color={theme.primary} />
            <ThemedText style={[styles.distanceText, { color: theme.primary }]}>
              {item.distance}
            </ThemedText>
          </View>
        </View>

        <View style={styles.ratingRow}>
          <Feather name="star" size={14} color="#F5B700" />
          <ThemedText style={[styles.ratingText, { color: theme.text }]}>
            {item.rating}
          </ThemedText>
          <ThemedText style={[styles.reviewsText, { color: theme.textSecondary }]}>
            ({item.reviews} রিভিউ)
          </ThemedText>
        </View>

        <View style={styles.productsRow}>
          {item.products.map((product, i) => (
            <View
              key={i}
              style={[styles.productChip, { backgroundColor: theme.primary + "10" }]}
            >
              <ThemedText style={[styles.productText, { color: theme.primary }]}>
                {product}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.callButton, { backgroundColor: theme.primary }]}
            onPress={() => handleCall(item.phone)}
          >
            <Feather name="phone" size={16} color={theme.white} />
            <ThemedText style={styles.callButtonText}>কল করুন</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.messageButton, { borderColor: theme.inputBorder }]}
            onPress={() => handleMessage(item.phone)}
          >
            <Feather name="message-circle" size={16} color={theme.text} />
            <ThemedText style={[styles.messageButtonText, { color: theme.text }]}>
              মেসেজ
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  const renderShop = ({ item, index }: { item: Shop; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.shopIcon, { backgroundColor: theme.primary + "15" }]}>
            <ThemedText style={styles.shopIconText}>{item.icon}</ThemedText>
          </View>
          <View style={styles.farmerInfo}>
            <View style={styles.nameRow}>
              <ThemedText style={[styles.farmerName, { color: theme.text }]}>
                {item.name}
              </ThemedText>
              <View
                style={[
                  styles.openBadge,
                  { backgroundColor: item.openNow ? "#2FA36B15" : "#DC262615" },
                ]}
              >
                <View
                  style={[
                    styles.openDot,
                    { backgroundColor: item.openNow ? "#2FA36B" : "#DC2626" },
                  ]}
                />
                <ThemedText
                  style={[
                    styles.openText,
                    { color: item.openNow ? "#2FA36B" : "#DC2626" },
                  ]}
                >
                  {item.openNow ? "খোলা" : "বন্ধ"}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.specialty, { color: theme.textSecondary }]}>
              {item.type}
            </ThemedText>
          </View>
          <View style={styles.distanceContainer}>
            <Feather name="map-pin" size={12} color={theme.primary} />
            <ThemedText style={[styles.distanceText, { color: theme.primary }]}>
              {item.distance}
            </ThemedText>
          </View>
        </View>

        <View style={styles.addressRow}>
          <Feather name="navigation" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.addressText, { color: theme.textSecondary }]}>
            {item.address}
          </ThemedText>
        </View>

        <View style={styles.ratingRow}>
          <Feather name="star" size={14} color="#F5B700" />
          <ThemedText style={[styles.ratingText, { color: theme.text }]}>
            {item.rating}
          </ThemedText>
        </View>

        <Pressable
          style={[styles.callButton, { backgroundColor: theme.primary }]}
          onPress={() => handleCall(item.phone)}
        >
          <Feather name="phone" size={16} color={theme.white} />
          <ThemedText style={styles.callButtonText}>কল করুন</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderHeader = () => (
    <View>
      <View style={[styles.locationCard, { backgroundColor: theme.card }]}>
        <Feather name="map-pin" size={20} color={theme.primary} />
        <View style={styles.locationInfo}>
          <ThemedText style={[styles.locationTitle, { color: theme.text }]}>
            আপনার অবস্থান
          </ThemedText>
          <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
            গাজীপুর, ঢাকা
          </ThemedText>
        </View>
        <Pressable style={[styles.changeBtn, { borderColor: theme.inputBorder }]}>
          <ThemedText style={[styles.changeBtnText, { color: theme.primary }]}>
            পরিবর্তন
          </ThemedText>
        </Pressable>
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.card }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "farmers" && { backgroundColor: theme.primary },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab("farmers");
          }}
        >
          <Feather
            name="users"
            size={18}
            color={activeTab === "farmers" ? theme.white : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === "farmers" ? theme.white : theme.textSecondary },
            ]}
          >
            কৃষক
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "shops" && { backgroundColor: theme.primary },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab("shops");
          }}
        >
          <Feather
            name="shopping-bag"
            size={18}
            color={activeTab === "shops" ? theme.white : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === "shops" ? theme.white : theme.textSecondary },
            ]}
          >
            দোকান
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={(activeTab === "farmers" ? FARMERS : SHOPS) as (Farmer | Shop)[]}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) =>
          activeTab === "farmers"
            ? renderFarmer({ item: item as Farmer, index })
            : renderShop({ item: item as Shop, index })
        }
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  locationInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  locationTitle: {
    fontSize: 12,
  },
  locationText: {
    fontSize: 15,
    fontWeight: "600",
  },
  changeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    ...Shadows.medium,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  shopIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  shopIconText: {
    fontSize: 24,
  },
  farmerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  openText: {
    fontSize: 10,
    fontWeight: "600",
  },
  specialty: {
    fontSize: 13,
    marginTop: 2,
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.md,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewsText: {
    fontSize: 12,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addressText: {
    fontSize: 13,
    flex: 1,
  },
  productsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  productChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  productText: {
    fontSize: 11,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
});
