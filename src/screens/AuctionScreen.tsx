import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
import { ModalBottomInset } from "@/components/ModalBottomInset";
interface AuctionItem {
  id: string;
  name: string;
  image: string;
  currentBid: number;
  startingPrice: number;
  bidCount: number;
  seller: string;
  endsAt: Date;
  topBidder: string;
  myBid?: number;
}

const getEndTime = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

const AUCTIONS: AuctionItem[] = [
  {
    id: "1",
    name: "বিশেষ জাতের আম গাছ - ল্যাংড়া",
    image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400",
    currentBid: 8500,
    startingPrice: 5000,
    bidCount: 23,
    seller: "রাজশাহী নার্সারি",
    endsAt: getEndTime(2),
    topBidder: "করিম মিয়া",
  },
  {
    id: "2",
    name: "হাইব্রিড দেশি মুরগি - ২০টি",
    image: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=400",
    currentBid: 12000,
    startingPrice: 8000,
    bidCount: 45,
    seller: "পোল্ট্রি ফার্ম ঢাকা",
    endsAt: getEndTime(5),
    topBidder: "রহিম আহমেদ",
    myBid: 11500,
  },
  {
    id: "3",
    name: "ট্র্যাক্টর - মিতসুবিশি ১৮HP",
    image: "https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=400",
    currentBid: 185000,
    startingPrice: 150000,
    bidCount: 12,
    seller: "কৃষি যন্ত্রপাতি হাউজ",
    endsAt: getEndTime(24),
    topBidder: "জালাল উদ্দিন",
  },
  {
    id: "4",
    name: "রুই মাছের পোনা - ১০০০টি",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    currentBid: 3500,
    startingPrice: 2500,
    bidCount: 18,
    seller: "মৎস্য হ্যাচারি",
    endsAt: getEndTime(8),
    topBidder: "সেলিম বিশ্বাস",
  },
];

function CountdownTimer({ endsAt, theme }: { endsAt: Date; theme: any }) {
  const tr = useTr();
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
  const isUrgent = timeLeft.hours < 1;

  return (
    <View style={styles.timerContainer}>
      <View style={[styles.timerBox, { backgroundColor: isUrgent ? "#DC2626" : theme.primary }]}>
        <ThemedText style={styles.timerText}>{pad(timeLeft.hours)}</ThemedText>
        <ThemedText style={styles.timerLabel}>{tr("ঘণ্টা")}</ThemedText>
      </View>
      <ThemedText style={[styles.timerSeparator, { color: theme.text }]}>:</ThemedText>
      <View style={[styles.timerBox, { backgroundColor: isUrgent ? "#DC2626" : theme.primary }]}>
        <ThemedText style={styles.timerText}>{pad(timeLeft.minutes)}</ThemedText>
        <ThemedText style={styles.timerLabel}>{tr("মিনিট")}</ThemedText>
      </View>
      <ThemedText style={[styles.timerSeparator, { color: theme.text }]}>:</ThemedText>
      <View style={[styles.timerBox, { backgroundColor: isUrgent ? "#DC2626" : theme.primary }]}>
        <ThemedText style={styles.timerText}>{pad(timeLeft.seconds)}</ThemedText>
        <ThemedText style={styles.timerLabel}>{tr("সেকেন্ড")}</ThemedText>
      </View>
    </View>
  );
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AuctionScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [auctions, setAuctions] = useState<AuctionItem[]>(AUCTIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState("");

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handlePlaceBid = () => {
    if (!selectedAuction || !bidAmount) return;

    const amount = parseInt(bidAmount);
    if (amount <= selectedAuction.currentBid) {
      Alert.alert(tr("ত্রুটি"), tr("বিড বর্তমান মূল্যের চেয়ে বেশি হতে হবে"));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setAuctions((prev) =>
      prev.map((a) =>
        a.id === selectedAuction.id
          ? {
              ...a,
              currentBid: amount,
              bidCount: a.bidCount + 1,
              topBidder: "আপনি",
              myBid: amount,
            }
          : a
      )
    );

    Alert.alert(tr("সফল"), `আপনার বিড ৳${amount} গ্রহণ করা হয়েছে`);
    setShowBidModal(false);
    setBidAmount("");
    setSelectedAuction(null);
  };

  const openBidModal = (auction: AuctionItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedAuction(auction);
    setBidAmount((auction.currentBid + 100).toString());
    setShowBidModal(true);
  };

  const renderAuction = ({ item }: { item: AuctionItem }) => {
    const isWinning = item.topBidder === "আপনি";

    return (
      <Animated.View entering={FadeIn}>
        <Pressable
          style={[
            styles.auctionCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("ProductDetail", {
              product: {
                id: item.id,
                name: item.name,
                price: item.currentBid,
                currency: "৳",
                unit: "টি",
                seller: item.seller,
                location: "বাংলাদেশ",
                rating: 4.7,
                image: item.image,
                description: `নিলামে ${item.bidCount} বিড পড়েছে। শুরুর দাম: ৳${item.startingPrice}`,
                quantity: 1,
                category: "auction",
              }
            });
          }}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.auctionImage}
            contentFit="cover"
            transition={200}
          />

          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveText}>LIVE</ThemedText>
          </View>

          <View style={styles.auctionContent}>
            <ThemedText
              style={[styles.auctionName, { color: theme.text }]}
              numberOfLines={2}
            >
              {item.name}
            </ThemedText>

            <ThemedText style={[styles.sellerName, { color: theme.textSecondary }]}>
              {item.seller}
            </ThemedText>

            <View style={styles.bidInfo}>
              <View style={styles.currentBidContainer}>
                <ThemedText style={[styles.bidLabel, { color: theme.textSecondary }]}>
                  {tr("বর্তমান বিড")}
                </ThemedText>
                <ThemedText style={[styles.currentBid, { color: theme.primary }]}>
                  ৳{item.currentBid.toLocaleString()}
                </ThemedText>
              </View>

              <View style={styles.bidCountContainer}>
                <Feather name="users" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.bidCount, { color: theme.textSecondary }]}>
                  {item.bidCount} বিড
                </ThemedText>
              </View>
            </View>

            <View style={styles.topBidderRow}>
              <ThemedText style={[styles.topBidderLabel, { color: theme.textSecondary }]}>
                {tr("শীর্ষ বিডার:")}
              </ThemedText>
              <ThemedText
                style={[
                  styles.topBidderName,
                  { color: isWinning ? theme.primary : theme.text },
                ]}
              >
                {item.topBidder}
                {isWinning ? " (আপনি)" : ""}
              </ThemedText>
            </View>

            {item.myBid ? (
              <View style={[styles.myBidBadge, { backgroundColor: theme.primary + "15" }]}>
                <ThemedText style={[styles.myBidText, { color: theme.primary }]}>
                  আপনার বিড: ৳{item.myBid.toLocaleString()}
                </ThemedText>
              </View>
            ) : null}

            <CountdownTimer endsAt={item.endsAt} theme={theme} />

            <Pressable
              style={[styles.bidButton, { backgroundColor: theme.primary }]}
              onPress={() => openBidModal(item)}
            >
              <Feather name="dollar-sign" size={18} color={theme.white} />
              <ThemedText style={styles.bidButtonText}>{tr("বিড করুন")}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={auctions}
        keyExtractor={(item) => item.id}
        renderItem={renderAuction}
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
        ListHeaderComponent={
          <View style={[styles.header, { backgroundColor: theme.card }]}>
            <Feather name="activity" size={24} color={theme.primary} />
            <View style={styles.headerText}>
              <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                {tr("লাইভ নিলাম")}
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {tr("সেরা মূল্যে পণ্য কিনুন ও বিক্রি করুন")}
              </ThemedText>
            </View>
          </View>
        }
      />

      <Modal
        visible={showBidModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBidModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowBidModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {tr("বিড করুন")}
              </ThemedText>
              <Pressable onPress={() => setShowBidModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedAuction ? (
              <View style={[styles.modalBody, { paddingBottom: Spacing.xl }]}>
                <ThemedText style={[styles.auctionNameModal, { color: theme.text }]}>
                  {selectedAuction.name}
                </ThemedText>

                <View style={styles.currentBidModal}>
                  <ThemedText style={[styles.currentBidLabelModal, { color: theme.textSecondary }]}>
                    {tr("বর্তমান বিড")}
                  </ThemedText>
                  <ThemedText style={[styles.currentBidValueModal, { color: theme.primary }]}>
                    ৳{selectedAuction.currentBid.toLocaleString()}
                  </ThemedText>
                </View>

                <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                  {tr("আপনার বিড")}
                </ThemedText>
                <View
                  style={[
                    styles.bidInputContainer,
                    { backgroundColor: theme.backgroundRoot, borderColor: theme.inputBorder },
                  ]}
                >
                  <ThemedText style={[styles.currencySymbol, { color: theme.primary }]}>
                    {tr("৳")}
                  </ThemedText>
                  <TextInput
                    style={[styles.bidInput, { color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={bidAmount}
                    onChangeText={setBidAmount}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.quickBids}>
                  {[100, 500, 1000, 2000].map((add) => (
                    <Pressable
                      key={add}
                      style={[styles.quickBidChip, { backgroundColor: theme.backgroundRoot }]}
                      onPress={() =>
                        setBidAmount((selectedAuction.currentBid + add).toString())
                      }
                    >
                      <ThemedText style={[styles.quickBidText, { color: theme.primary }]}>
                        +৳{add}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[styles.placeBidButton, { backgroundColor: theme.primary }]}
                  onPress={handlePlaceBid}
                >
                  <ThemedText style={styles.placeBidButtonText}>{tr("বিড নিশ্চিত করুন")}</ThemedText>
                </Pressable>
              </View>
            ) : null}
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  auctionCard: {
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.medium,
  },
  auctionImage: {
    width: "100%",
    height: 180,
  },
  liveIndicator: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
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
    fontSize: 10,
    fontWeight: "700",
  },
  auctionContent: {
    padding: Spacing.lg,
  },
  auctionName: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  bidInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  currentBidContainer: {},
  bidLabel: {
    fontSize: 12,
  },
  currentBid: {
    fontSize: 24,
    fontWeight: "700",
  },
  bidCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bidCount: {
    fontSize: 13,
  },
  topBidderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  topBidderLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  topBidderName: {
    fontSize: 12,
    fontWeight: "600",
  },
  myBidBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  myBidText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    gap: 4,
  },
  timerBox: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 60,
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  timerLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    marginTop: 2,
  },
  timerSeparator: {
    fontSize: 20,
    fontWeight: "700",
  },
  bidButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  bidButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing["2xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalBody: {},
  auctionNameModal: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  currentBidModal: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  currentBidLabelModal: {
    fontSize: 13,
  },
  currentBidValueModal: {
    fontSize: 32,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  bidInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: 56,
    marginBottom: Spacing.md,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "700",
    marginRight: Spacing.sm,
  },
  bidInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
  },
  quickBids: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickBidChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  quickBidText: {
    fontSize: 13,
    fontWeight: "600",
  },
  placeBidButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  placeBidButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
