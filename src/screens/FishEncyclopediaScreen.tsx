import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export interface Fish {
  id: string;
  name: string;
  nameBn: string;
  scientificName: string;
  image: string;
  category: string;
  type: "freshwater" | "marine" | "brackish";
  difficulty: "easy" | "medium" | "hard";
  growthPeriod: string;
  idealTemperature: string;
  feedType: string;
  marketPrice: string;
  description: string;
  habitat: string;
  breeding: string;
  diseases: string[];
  feeding: string;
  waterQuality: string;
  harvestTime: string;
  profitability: "low" | "medium" | "high";
}

const CATEGORIES = ["সব", "রুই জাতীয়", "কার্প", "তেলাপিয়া", "ক্যাটফিশ", "চিংড়ি", "অন্যান্য"];

export const FISH_DATA: Fish[] = [
  {
    id: "1",
    name: "Rohu",
    nameBn: "রুই",
    scientificName: "Labeo rohita",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
    category: "রুই জাতীয়",
    type: "freshwater",
    difficulty: "easy",
    growthPeriod: "১২-১৮ মাস",
    idealTemperature: "২৫-৩২°C",
    feedType: "ভাসমান খাবার",
    marketPrice: "২৫০-৩৫০ টাকা/কেজি",
    description: "রুই মাছ বাংলাদেশের অন্যতম জনপ্রিয় মাছ। এটি মিঠা পানির মাছ এবং সারা বছর চাষ করা যায়। রুই মাছ দ্রুত বৃদ্ধি পায় এবং রোগ প্রতিরোধ ক্ষমতা ভালো।",
    habitat: "পুকুর, বিল, নদী এবং হাওর-বাঁওড়ে পাওয়া যায়। গভীর পানি পছন্দ করে।",
    breeding: "বর্ষাকালে (জুন-আগস্ট) প্রজনন করে। হ্যাচারিতে কৃত্রিম প্রজনন সম্ভব।",
    diseases: ["লেজ পচা রোগ", "আঁশ খসা রোগ", "ড্রপসি"],
    feeding: "প্রতিদিন মাছের ওজনের ৩-৫% খাবার দিতে হবে। সকাল ও বিকালে দুইবার খাওয়াতে হবে।",
    waterQuality: "pH ৭-৮.৫, দ্রবীভূত অক্সিজেন ৫ mg/L এর বেশি, অ্যামোনিয়া ০.০২ mg/L এর কম",
    harvestTime: "৮০০ গ্রাম-১.৫ কেজি হলে বাজারজাত করা যায়",
    profitability: "high",
  },
  {
    id: "2",
    name: "Catla",
    nameBn: "কাতলা",
    scientificName: "Catla catla",
    image: "https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=400",
    category: "রুই জাতীয়",
    type: "freshwater",
    difficulty: "easy",
    growthPeriod: "১২-১৮ মাস",
    idealTemperature: "২৫-৩২°C",
    feedType: "প্ল্যাঙ্কটন ভোজী",
    marketPrice: "২৮০-৪০০ টাকা/কেজি",
    description: "কাতলা মাছ বাংলাদেশের প্রধান কার্প মাছ। এটি পানির উপরের স্তরে বাস করে এবং প্ল্যাঙ্কটন খায়। কাতলা মাছ দ্রুত বড় হয় এবং ২-৩ কেজি পর্যন্ত হতে পারে।",
    habitat: "মিঠা পানির পুকুর, বিল এবং নদীতে পাওয়া যায়।",
    breeding: "বর্ষাকালে (মে-জুলাই) প্রজনন করে। হ্যাচারিতে প্রজনন করা হয়।",
    diseases: ["এপিজুটিক আলসার", "গিল রট", "লেজ পচা"],
    feeding: "ভাসমান খাবার ও সবুজ শ্যাওলা খায়। প্রতিদিন ২-৪% খাবার দিতে হবে।",
    waterQuality: "pH ৬.৫-৮.৫, দ্রবীভূত অক্সিজেন ৫+ mg/L",
    harvestTime: "১-২ কেজি হলে বিক্রি করা যায়",
    profitability: "high",
  },
  {
    id: "3",
    name: "Mrigal",
    nameBn: "মৃগেল",
    scientificName: "Cirrhinus cirrhosus",
    image: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=400",
    category: "রুই জাতীয়",
    type: "freshwater",
    difficulty: "easy",
    growthPeriod: "১০-১৪ মাস",
    idealTemperature: "২৪-৩০°C",
    feedType: "তলদেশের খাবার",
    marketPrice: "২০০-২৮০ টাকা/কেজি",
    description: "মৃগেল মাছ তলদেশে বাস করে এবং জৈব পদার্থ খায়। এটি মিশ্র চাষে রুই ও কাতলার সাথে চাষ করা হয়।",
    habitat: "পুকুর ও বিলের তলদেশে বাস করে।",
    breeding: "বর্ষাকালে প্রজনন করে।",
    diseases: ["লেজ পচা", "ড্রপসি", "ফাঙ্গাস"],
    feeding: "তলদেশের খাবার ও সম্পূরক খাদ্য খায়।",
    waterQuality: "pH ৭-৮.৫, অক্সিজেন ৪+ mg/L",
    harvestTime: "৫০০ গ্রাম-১ কেজি হলে বিক্রি",
    profitability: "medium",
  },
  {
    id: "4",
    name: "Tilapia",
    nameBn: "তেলাপিয়া",
    scientificName: "Oreochromis niloticus",
    image: "https://images.unsplash.com/photo-1498654077810-12c21d4d6dc3?w=400",
    category: "তেলাপিয়া",
    type: "freshwater",
    difficulty: "easy",
    growthPeriod: "৬-৮ মাস",
    idealTemperature: "২৬-৩০°C",
    feedType: "সর্বভুক",
    marketPrice: "১৫০-২২০ টাকা/কেজি",
    description: "তেলাপিয়া দ্রুত বর্ধনশীল এবং সহজে চাষযোগ্য মাছ। এটি বিভিন্ন পরিবেশে টিকে থাকতে পারে এবং কম খরচে চাষ করা যায়।",
    habitat: "পুকুর, খাল, ডোবা সব জায়গায় চাষ করা যায়।",
    breeding: "সারা বছর প্রজনন করে। পুকুরেই বাচ্চা দেয়।",
    diseases: ["স্ট্রেপ্টোকক্কাস", "আঁশ খসা"],
    feeding: "চালের কুঁড়া, গমের ভুসি, সয়াবিন মিল দিয়ে খাওয়ানো যায়।",
    waterQuality: "pH ৬-৯, তাপমাত্রা ২৫-৩২°C সহ্য করতে পারে",
    harvestTime: "২৫০-৫০০ গ্রাম হলে বাজারজাত",
    profitability: "medium",
  },
  {
    id: "5",
    name: "Pangasius",
    nameBn: "পাঙ্গাশ",
    scientificName: "Pangasianodon hypophthalmus",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400",
    category: "ক্যাটফিশ",
    type: "freshwater",
    difficulty: "medium",
    growthPeriod: "৮-১২ মাস",
    idealTemperature: "২৬-৩০°C",
    feedType: "সম্পূরক খাদ্য",
    marketPrice: "১২০-১৮০ টাকা/কেজি",
    description: "পাঙ্গাশ মাছ দ্রুত বৃদ্ধি পায় এবং বড় আকার ধারণ করে। এটি বাণিজ্যিক চাষের জন্য জনপ্রিয়।",
    habitat: "গভীর পুকুরে চাষ করা হয়।",
    breeding: "হ্যাচারিতে কৃত্রিম প্রজনন করা হয়।",
    diseases: ["লাল দাগ রোগ", "ফুলকা পচা"],
    feeding: "উচ্চ প্রোটিন সম্পন্ন খাবার দিতে হবে।",
    waterQuality: "pH ৬.৫-৭.৫, গভীরতা ৫-৬ ফুট",
    harvestTime: "১-২ কেজি হলে বাজারজাত",
    profitability: "medium",
  },
  {
    id: "6",
    name: "Shrimp",
    nameBn: "চিংড়ি",
    scientificName: "Penaeus monodon",
    image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400",
    category: "চিংড়ি",
    type: "brackish",
    difficulty: "hard",
    growthPeriod: "৪-৬ মাস",
    idealTemperature: "২৮-৩২°C",
    feedType: "চিংড়ি ফিড",
    marketPrice: "৫০০-১২০০ টাকা/কেজি",
    description: "বাগদা চিংড়ি রপ্তানিযোগ্য এবং অত্যন্ত লাভজনক। তবে চাষে বিশেষ যত্ন ও প্রযুক্তি প্রয়োজন।",
    habitat: "লোনা পানির ঘের ও উপকূলীয় এলাকায় চাষ করা হয়।",
    breeding: "হ্যাচারিতে পোনা উৎপাদন করা হয়।",
    diseases: ["সাদা দাগ রোগ (WSSV)", "হলুদ মাথা রোগ"],
    feeding: "বিশেষ চিংড়ি ফিড দিতে হয়। প্রতিদিন ৩-৫% খাবার।",
    waterQuality: "লবণাক্ততা ১৫-২৫ ppt, pH ৭.৫-৮.৫",
    harvestTime: "৩০-৫০ গ্রাম হলে রপ্তানিযোগ্য",
    profitability: "high",
  },
  {
    id: "7",
    name: "Carp",
    nameBn: "সিলভার কার্প",
    scientificName: "Hypophthalmichthys molitrix",
    image: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=400",
    category: "কার্প",
    type: "freshwater",
    difficulty: "easy",
    growthPeriod: "১০-১৪ মাস",
    idealTemperature: "২৫-৩০°C",
    feedType: "ফাইটোপ্ল্যাঙ্কটন",
    marketPrice: "১৮০-২৫০ টাকা/কেজি",
    description: "সিলভার কার্প পানির সবুজ শ্যাওলা খায় এবং পুকুর পরিষ্কার রাখতে সাহায্য করে। মিশ্র চাষে গুরুত্বপূর্ণ।",
    habitat: "মিঠা পানির পুকুরে চাষ করা হয়।",
    breeding: "হ্যাচারিতে কৃত্রিম প্রজনন করা হয়।",
    diseases: ["গিল রট", "আঁশ খসা"],
    feeding: "প্রাকৃতিক খাদ্য (প্ল্যাঙ্কটন) খায়।",
    waterQuality: "pH ৬.৫-৮, সবুজ পানি পছন্দ করে",
    harvestTime: "১-১.৫ কেজি হলে বিক্রি",
    profitability: "medium",
  },
  {
    id: "8",
    name: "Grass Carp",
    nameBn: "গ্রাস কার্প",
    scientificName: "Ctenopharyngodon idella",
    image: "https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=400",
    category: "কার্প",
    type: "freshwater",
    difficulty: "easy",
    growthPeriod: "১২-১৬ মাস",
    idealTemperature: "২০-৩০°C",
    feedType: "তৃণভোজী",
    marketPrice: "২০০-২৮০ টাকা/কেজি",
    description: "গ্রাস কার্প ঘাস ও জলজ উদ্ভিদ খায়। এটি পুকুরের আগাছা নিয়ন্ত্রণে সাহায্য করে।",
    habitat: "মিঠা পানির পুকুর।",
    breeding: "হ্যাচারিতে প্রজনন করা হয়।",
    diseases: ["ফাঙ্গাস", "ব্যাকটেরিয়াল সংক্রমণ"],
    feeding: "কচুরিপানা, নেপিয়ার ঘাস, কলাপাতা দেওয়া যায়।",
    waterQuality: "pH ৬.৫-৮.৫",
    harvestTime: "১.৫-২ কেজি হলে বাজারজাত",
    profitability: "medium",
  },
  {
    id: "9",
    name: "Shing",
    nameBn: "শিং",
    scientificName: "Heteropneustes fossilis",
    image: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=400",
    category: "ক্যাটফিশ",
    type: "freshwater",
    difficulty: "medium",
    growthPeriod: "৮-১০ মাস",
    idealTemperature: "২৫-৩২°C",
    feedType: "মাংসাশী",
    marketPrice: "৪০০-৬০০ টাকা/কেজি",
    description: "শিং মাছ অত্যন্ত সুস্বাদু এবং পুষ্টিকর। এটি দেশি জাতের মাছ এবং বাজারে ভালো দাম পাওয়া যায়।",
    habitat: "কাদা ও জলাভূমিতে থাকে।",
    breeding: "প্রাকৃতিক ও কৃত্রিম প্রজনন সম্ভব।",
    diseases: ["আলসার", "ফাঙ্গাস"],
    feeding: "গোবর, শুঁটকি গুঁড়া, মাছের কিমা দেওয়া যায়।",
    waterQuality: "pH ৬.৫-৮, কম অক্সিজেনেও বাঁচে",
    harvestTime: "৫০-১০০ গ্রাম হলে বিক্রি",
    profitability: "high",
  },
  {
    id: "10",
    name: "Magur",
    nameBn: "মাগুর",
    scientificName: "Clarias batrachus",
    image: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=400",
    category: "ক্যাটফিশ",
    type: "freshwater",
    difficulty: "medium",
    growthPeriod: "৬-৮ মাস",
    idealTemperature: "২৫-৩২°C",
    feedType: "সর্বভুক",
    marketPrice: "৩৫০-৫০০ টাকা/কেজি",
    description: "মাগুর মাছ দেশি জাতের মাছ এবং ঔষধি গুণসম্পন্ন। এটি রোগীদের জন্য উপকারী।",
    habitat: "কাদা, ডোবা, পুকুরে পাওয়া যায়।",
    breeding: "প্রাকৃতিক ও ইনজেকশনের মাধ্যমে প্রজনন।",
    diseases: ["আলসার", "লেজ পচা"],
    feeding: "মাছের নাড়িভুঁড়ি, শুঁটকি, চালের কুঁড়া দেওয়া যায়।",
    waterQuality: "pH ৬.৫-৮, কম পানিতেও চাষ সম্ভব",
    harvestTime: "১০০-২০০ গ্রাম হলে বিক্রি",
    profitability: "high",
  },
  {
    id: "11",
    name: "Koi",
    nameBn: "কৈ",
    scientificName: "Anabas testudineus",
    image: "https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=400",
    category: "অন্যান্য",
    type: "freshwater",
    difficulty: "medium",
    growthPeriod: "৮-১০ মাস",
    idealTemperature: "২৫-৩০°C",
    feedType: "সর্বভুক",
    marketPrice: "৪০০-৫৫০ টাকা/কেজি",
    description: "কৈ মাছ অত্যন্ত সুস্বাদু এবং ঔষধি গুণসম্পন্ন। এটি শ্বাস নিতে পারে এবং কম পানিতেও বাঁচে।",
    habitat: "পুকুর, ডোবা, জলাভূমিতে থাকে।",
    breeding: "বর্ষাকালে প্রজনন করে।",
    diseases: ["আঁশ খসা", "ফাঙ্গাস"],
    feeding: "চালের কুঁড়া, সয়াবিন, মাছের গুঁড়া দেওয়া যায়।",
    waterQuality: "pH ৬-৮.৫, কম অক্সিজেনে বাঁচতে পারে",
    harvestTime: "৮০-১৫০ গ্রাম হলে বাজারজাত",
    profitability: "high",
  },
  {
    id: "12",
    name: "Pabda",
    nameBn: "পাবদা",
    scientificName: "Ompok pabda",
    image: "https://images.unsplash.com/photo-1545816250-e12bedba42ba?w=400",
    category: "অন্যান্য",
    type: "freshwater",
    difficulty: "hard",
    growthPeriod: "১০-১২ মাস",
    idealTemperature: "২৫-৩০°C",
    feedType: "মাংসাশী",
    marketPrice: "৫০০-৮০০ টাকা/কেজি",
    description: "পাবদা মাছ অত্যন্ত সুস্বাদু এবং দামী। এটি বাংলাদেশের অন্যতম জনপ্রিয় দেশি মাছ।",
    habitat: "নদী, খাল ও বিলে পাওয়া যায়।",
    breeding: "হ্যাচারিতে কৃত্রিম প্রজনন করা হয়।",
    diseases: ["ব্যাকটেরিয়াল সংক্রমণ", "পরজীবী"],
    feeding: "উচ্চ প্রোটিন খাবার, মাছের কিমা।",
    waterQuality: "pH ৭-৮, পরিষ্কার পানি প্রয়োজন",
    harvestTime: "৫০-১০০ গ্রাম হলে বিক্রি",
    profitability: "high",
  },
];

const getDifficultyConfig = (difficulty: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    easy: { color: "#2FA36B", label: "সহজ" },
    medium: { color: "#EA8A0C", label: "মাঝারি" },
    hard: { color: "#DC2626", label: "কঠিন" },
  };
  return configs[difficulty] || configs.easy;
};

const getProfitabilityConfig = (profitability: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    low: { color: "#9E9E9E", label: "কম" },
    medium: { color: "#EA8A0C", label: "মাঝারি" },
    high: { color: "#2FA36B", label: "বেশি" },
  };
  return configs[profitability] || configs.medium;
};

export default function FishEncyclopediaScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [refreshing, setRefreshing] = useState(false);

  const filteredFish = FISH_DATA.filter(fish => {
    const matchesSearch = 
      fish.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fish.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "সব" || fish.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleFishPress = (fish: Fish) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("FishDetail", { fish });
  };

  const renderFish = ({ item, index }: { item: Fish; index: number }) => {
    const difficulty = getDifficultyConfig(item.difficulty);
    const profitability = getProfitabilityConfig(item.profitability);
    
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.fishCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={() => handleFishPress(item)}
        >
          <Image source={{ uri: item.image }} style={styles.fishImage} contentFit="cover" />
          <View style={styles.fishContent}>
            <View style={styles.fishHeader}>
              <View>
                <ThemedText style={[styles.fishName, { color: theme.text }]}>{item.nameBn}</ThemedText>
                <ThemedText style={[styles.scientificName, { color: theme.textSecondary }]}>
                  {item.scientificName}
                </ThemedText>
              </View>
              <View style={[styles.difficultyBadge, { backgroundColor: difficulty.color + "20" }]}>
                <ThemedText style={[styles.difficultyText, { color: difficulty.color }]}>
                  {difficulty.label}
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.fishMeta}>
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {item.growthPeriod}
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <Feather name="thermometer" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {item.idealTemperature}
                </ThemedText>
              </View>
            </View>

            <View style={styles.fishFooter}>
              <ThemedText style={[styles.priceText, { color: theme.primary }]}>
                {item.marketPrice}
              </ThemedText>
              <View style={[styles.profitBadge, { backgroundColor: profitability.color + "20" }]}>
                <ThemedText style={[styles.profitText, { color: profitability.color }]}>
                  লাভ: {profitability.label}
                </ThemedText>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderCategory = ({ item }: { item: string }) => {
    const isSelected = selectedCategory === item;
    return (
      <Pressable
        style={[
          styles.categoryChip,
          {
            backgroundColor: isSelected ? theme.primary : theme.surface,
            borderColor: isSelected ? theme.primary : theme.cardBorder,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedCategory(item);
        }}
      >
        <ThemedText
          style={[
            styles.categoryText,
            { color: isSelected ? "#FFFFFF" : theme.text },
          ]}
        >
          {item}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Feather name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="মাছ খুঁজুন..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={CATEGORIES}
        renderItem={renderCategory}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      />

      <FlatList
        data={filteredFish}
        renderItem={renderFish}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোনো মাছ পাওয়া যায়নি
            </ThemedText>
          </Animated.View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  categoriesContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  fishCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  fishImage: {
    width: 100,
    height: 120,
  },
  fishContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  fishHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  fishName: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  scientificName: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    fontStyle: "italic",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  difficultyText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  fishMeta: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  fishFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  priceText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  profitBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  profitText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
