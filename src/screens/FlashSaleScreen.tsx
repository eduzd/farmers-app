import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FlashSaleItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  seller: string;
  sold: number;
  stock: number;
  endsAt: Date;
  unit?: string;
  category?: string;
}

const getEndTime = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

const FLASH_SALE_ITEMS: FlashSaleItem[] = [
  {
    id: "1",
    name: "প্রিমিয়াম জৈব সার ৫০কেজি",
    price: 1200,
    originalPrice: 1800,
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
    seller: "গ্রিন ফার্ম সাপ্লাই",
    sold: 234,
    stock: 50,
    endsAt: getEndTime(2),
  },
  {
    id: "2",
    name: "হাইব্রিড ধান বীজ ১০কেজি",
    price: 850,
    originalPrice: 1200,
    image: "https://images.unsplash.com/photo-1536617621572-1d5f1e6269a0?w=400",
    seller: "বীজ বাংলা",
    sold: 567,
    stock: 30,
    endsAt: getEndTime(4),
  },
  {
    id: "3",
    name: "স্প্রেয়ার মেশিন ২০লি",
    price: 2500,
    originalPrice: 3500,
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400",
    seller: "কৃষি যন্ত্রপাতি",
    sold: 89,
    stock: 15,
    endsAt: getEndTime(1),
  },
  {
    id: "4",
    name: "মাছের ভাসমান খাবার ২৫কেজি",
    price: 1800,
    originalPrice: 2400,
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    seller: "ফিশ ফিড কর্পোরেশন",
    sold: 345,
    stock: 100,
    endsAt: getEndTime(6),
  },
  {
    id: "5",
    name: "সেচ পাইপ ১০০মিটার",
    price: 3200,
    originalPrice: 4500,
    image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400",
    seller: "ইরিগেশন সল্যুশন",
    sold: 156,
    stock: 25,
    endsAt: getEndTime(3),
  },
];

function CountdownTimer({ endsAt, theme }: { endsAt: Date; theme: any }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = endsAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const pad = (num: number) => num.toString().padStart(2, "0");

  return (
    <View style={styles.timerContainer}>
      <View style={[styles.timerBox, { backgroundColor: "#DC2626" }]}>
        <ThemedText style={styles.timerText}>{pad(timeLeft.hours)}</ThemedText>
      </View>
      <ThemedText style={[styles.timerSeparator, { color: theme.text }]}>:</ThemedText>
      <View style={[styles.timerBox, { backgroundColor: "#DC2626" }]}>
        <ThemedText style={styles.timerText}>{pad(timeLeft.minutes)}</ThemedText>
      </View>
      <ThemedText style={[styles.timerSeparator, { color: theme.text }]}>:</ThemedText>
      <View style={[styles.timerBox, { backgroundColor: "#DC2626" }]}>
        <ThemedText style={styles.timerText}>{pad(timeLeft.seconds)}</ThemedText>
      </View>
    </View>
  );
}

function AnimatedFlashIcon() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="zap" size={24} color="#F5B700" />
    </Animated.View>
  );
}

export default function FlashSaleScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [items, setItems] = useState<FlashSaleItem[]>(FLASH_SALE_ITEMS);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleBuyNow = (item: FlashSaleItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const discount = Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100);
    navigation.navigate("ProductDetail", {
      product: {
        id: item.id,
        name: item.name,
        price: item.price,
        currency: "৳",
        unit: item.unit || "কেজি",
        seller: "ফ্ল্যাশ সেল",
        location: "বাংলাদেশ",
        rating: 4.8,
        image: item.image,
        description: `${item.name} - ${discount}% ছাড়ে! মূল দাম: ৳${item.originalPrice}`,
        quantity: item.stock,
        category: item.category ?? "",
      }
    });
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.card }]}>
      <View style={styles.headerTop}>
        <View style={styles.headerTitle}>
          <AnimatedFlashIcon />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            ফ্ল্যাশ সেল
          </ThemedText>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: "#DC2626" }]}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveText}>LIVE</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
        সীমিত সময়ের জন্য বিশেষ ছাড়!
      </ThemedText>
    </View>
  );

  const renderItem = ({ item }: { item: FlashSaleItem }) => {
    const discount = Math.round(
      ((item.originalPrice - item.price) / item.originalPrice) * 100
    );
    const soldPercentage = Math.round((item.sold / (item.sold + item.stock)) * 100);

    return (
      <Pressable
        style={[
          styles.itemCard,
          { backgroundColor: theme.card, borderColor: theme.cardBorder },
        ]}
        onPress={() => handleBuyNow(item)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image }}
            style={styles.itemImage}
            contentFit="cover"
            transition={200}
          />
          <View style={[styles.discountBadge, { backgroundColor: "#DC2626" }]}>
            <ThemedText style={styles.discountText}>-{discount}%</ThemedText>
          </View>
        </View>

        <View style={styles.itemContent}>
          <ThemedText
            style={[styles.itemName, { color: theme.text }]}
            numberOfLines={2}
          >
            {item.name}
          </ThemedText>

          <ThemedText style={[styles.sellerName, { color: theme.textSecondary }]}>
            {item.seller}
          </ThemedText>

          <View style={styles.priceRow}>
            <ThemedText style={[styles.price, { color: "#DC2626" }]}>
              ৳{item.price}
            </ThemedText>
            <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
              ৳{item.originalPrice}
            </ThemedText>
          </View>

          <View style={styles.timerRow}>
            <Feather name="clock" size={12} color="#DC2626" />
            <CountdownTimer endsAt={item.endsAt} theme={theme} />
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBg, { backgroundColor: theme.inputBorder }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: "#DC2626", width: `${soldPercentage}%` },
                ]}
              />
            </View>
            <ThemedText style={[styles.soldText, { color: theme.textSecondary }]}>
              {item.sold} বিক্রি হয়েছে
            </ThemedText>
          </View>

          <Pressable
            style={[styles.buyButton, { backgroundColor: "#DC2626" }]}
            onPress={() => handleBuyNow(item)}
          >
            <Feather name="shopping-bag" size={16} color="#FFFFFF" />
            <ThemedText style={styles.buyButtonText}>এখনই কিনুন</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="zap-off" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              বর্তমানে কোনো ফ্ল্যাশ সেল চলছে না
            </ThemedText>
          </View>
        }
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
  header: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  itemCard: {
    width: "48%",
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.medium,
  },
  imageContainer: {
    position: "relative",
  },
  itemImage: {
    width: "100%",
    height: 120,
  },
  discountBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  itemContent: {
    padding: Spacing.sm,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 4,
    height: 36,
  },
  sellerName: {
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.sm,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timerBox: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 22,
    alignItems: "center",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  timerSeparator: {
    fontSize: 10,
    fontWeight: "700",
    marginHorizontal: 1,
  },
  progressContainer: {
    marginBottom: Spacing.sm,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  soldText: {
    fontSize: 10,
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
});
