import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

import { AppIcon } from "@/components/icons/AppIcon";
const { width } = Dimensions.get('window');

interface QuickAction {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  titleBn: string;
  description: string;
  color: string;
  gradient: [string, string];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'disease',
    icon: 'camera',
    title: 'Disease Detection',
    titleBn: 'রোগ সনাক্তকরণ',
    description: 'ফসলের ছবি তুলে রোগ চিহ্নিত করুন',
    color: '#DC2626',
    gradient: ['#FEE2E2', '#FECACA'],
  },
  {
    id: 'weather',
    icon: 'cloud',
    title: 'Weather Forecast',
    titleBn: 'আবহাওয়া পূর্বাভাস',
    description: '৭ দিনের আবহাওয়া ও কৃষি পরামর্শ',
    color: '#2563EB',
    gradient: ['#DBEAFE', '#BFDBFE'],
  },
  {
    id: 'market',
    icon: 'trending-up',
    title: 'Market Prices',
    titleBn: 'বাজার দর',
    description: 'আজকের ফসলের দাম দেখুন',
    color: '#16A34A',
    gradient: ['#D1FAE5', '#A7F3D0'],
  },
  {
    id: 'calendar',
    icon: 'calendar',
    title: 'Crop Calendar',
    titleBn: 'ফসল ক্যালেন্ডার',
    description: 'রোপণ ও সংগ্রহের সময়সূচি',
    color: '#EA8A0C',
    gradient: ['#FEF3C7', '#FDE68A'],
  },
  {
    id: 'soil',
    icon: 'layers',
    title: 'Soil Analysis',
    titleBn: 'মাটি বিশ্লেষণ',
    description: 'মাটির গুণাগুণ ও সার পরামর্শ',
    color: '#7C3AED',
    gradient: ['#EDE9FE', '#DDD6FE'],
  },
  {
    id: 'livestock',
    icon: 'heart',
    title: 'Livestock Health',
    titleBn: 'পশুস্বাস্থ্য',
    description: 'গবাদি পশুর স্বাস্থ্য ট্র্যাকিং',
    color: '#EC4899',
    gradient: ['#FCE7F3', '#FBCFE8'],
  },
  {
    id: 'fish',
    icon: 'anchor',
    title: 'Fish Farming',
    titleBn: 'মাছ চাষ',
    description: 'মাছের তালিকা ও চাষ পদ্ধতি',
    color: '#0EA5E9',
    gradient: ['#E0F2FE', '#BAE6FD'],
  },
];

interface AIInsight {
  id: string;
  type: 'tip' | 'warning' | 'success';
  title: string;
  message: string;
  icon: keyof typeof Feather.glyphMap;
}

const AI_INSIGHTS: AIInsight[] = [
  {
    id: '1',
    type: 'warning',
    title: 'আবহাওয়া সতর্কতা',
    message: 'আগামীকাল ভারী বৃষ্টির সম্ভাবনা। ফসল ঢেকে রাখুন।',
    icon: 'alert-triangle',
  },
  {
    id: '2',
    type: 'tip',
    title: 'কৃষি পরামর্শ',
    message: 'ধানের ক্ষেতে এখন ইউরিয়া সার প্রয়োগের উপযুক্ত সময়।',
    icon: 'info',
  },
  {
    id: '3',
    type: 'success',
    title: 'বাজার আপডেট',
    message: 'টমেটোর দাম গত সপ্তাহের চেয়ে ১৫% বেড়েছে!',
    icon: 'trending-up',
  },
];

export default function SmartFarmingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const handleVoicePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsListening(!isListening);
  };

  const handleQuickAction = async (action: QuickAction) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    switch (action.id) {
      case 'disease':
        navigation.navigate('DiseaseDetector');
        break;
      case 'weather':
        navigation.navigate('WeatherForecast');
        break;
      case 'market':
        navigation.navigate('MarketPrices');
        break;
      case 'calendar':
        navigation.navigate('CropCalendar');
        break;
      case 'soil':
        navigation.navigate('SoilAnalysis');
        break;
      case 'livestock':
        navigation.navigate('LivestockHealth');
        break;
      case 'fish':
        navigation.navigate('FishEncyclopedia');
        break;
      default:
        break;
    }
  };

  const handleAskAI = async () => {
    if (!query.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AIAssistant', { initialQuery: query });
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning':
        return { bg: '#FEF3C7', text: '#92400E', icon: '#EA8A0C' };
      case 'success':
        return { bg: '#D1FAE5', text: '#065F46', icon: '#16A34A' };
      case 'tip':
      default:
        return { bg: '#DBEAFE', text: '#1E40AF', icon: '#2563EB' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={isDark ? ['#1F4E3D', '#0D2818'] : ['#D1FAE5', '#A7F3D0']}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroContent}>
              <ThemedText style={styles.heroTitle}>
                স্মার্ট ফার্মিং
              </ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                AI দ্বারা চালিত কৃষি সহায়তা
              </ThemedText>

              <View style={styles.searchContainer}>
                <View style={[styles.searchBox, { backgroundColor: theme.card }]}>
                  <Feather name="search" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="জিজ্ঞাসা করুন... (যেমন: ধানে পোকার দমন)"
                    placeholderTextColor={theme.textSecondary}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleAskAI}
                  />
                  <Pressable onPress={handleAskAI} style={styles.sendButton}>
                    <Feather name="send" size={18} color="#16A34A" />
                  </Pressable>
                </View>

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Pressable
                    onPress={handleVoicePress}
                    style={[
                      styles.voiceButton,
                      isListening && styles.voiceButtonActive,
                    ]}
                  >
                    <AppIcon
                      name={isListening ? 'mic' : 'mic-off'}
                      size={24}
                      color={isListening ? '#fff' : '#16A34A'}
                    />
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.insightsSection}>
          <ThemedText style={styles.sectionTitle}>AI অন্তর্দৃষ্টি</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.insightsScroll}
          >
            {AI_INSIGHTS.map((insight, index) => {
              const colors = getInsightColor(insight.type);
              return (
                <Pressable
                  key={insight.id}
                  style={[styles.insightCard, { backgroundColor: colors.bg }]}
                >
                  <View style={[styles.insightIcon, { backgroundColor: colors.icon + '20' }]}>
                    <AppIcon name={insight.icon} size={20} color={colors.icon} />
                  </View>
                  <ThemedText style={[styles.insightTitle, { color: colors.text }]}>
                    {insight.title}
                  </ThemedText>
                  <ThemedText style={[styles.insightMessage, { color: colors.text }]}>
                    {insight.message}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.actionsSection}>
          <ThemedText style={styles.sectionTitle}>দ্রুত অ্যাক্সেস</ThemedText>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action, index) => (
              <Pressable
                key={action.id}
                onPress={() => handleQuickAction(action)}
                style={({ pressed }) => [
                  styles.actionCard,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <LinearGradient
                  colors={action.gradient}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: action.color + '20' }]}>
                    <AppIcon name={action.icon} size={24} color={action.color} />
                  </View>
                  <ThemedText style={[styles.actionTitle, { color: '#1F2937' }]}>
                    {action.titleBn}
                  </ThemedText>
                  <ThemedText style={[styles.actionDescription, { color: '#6B7280' }]}>
                    {action.description}
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.statsSection}>
          <ThemedText style={styles.sectionTitle}>আপনার ফার্ম স্ট্যাটস</ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="sun" size={24} color="#EA8A0C" />
              <ThemedText style={styles.statValue}>২৮°C</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                তাপমাত্রা
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="droplet" size={24} color="#2563EB" />
              <ThemedText style={styles.statValue}>৭৫%</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                আর্দ্রতা
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="wind" size={24} color="#7C3AED" />
              <ThemedText style={styles.statValue}>১২ km/h</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                বাতাস
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="cloud-rain" size={24} color="#06B6D4" />
              <ThemedText style={styles.statValue}>৪০%</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                বৃষ্টির সম্ভাবনা
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  heroSection: {
    marginBottom: Spacing.lg,
  },
  heroGradient: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  heroContent: {
    padding: Spacing.lg,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  sendButton: {
    padding: Spacing.xs,
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#16A34A',
  },
  insightsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  insightsScroll: {
    paddingRight: Spacing.md,
    gap: Spacing.sm,
  },
  insightCard: {
    width: width * 0.7,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  insightMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsSection: {
    marginBottom: Spacing.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionCard: {
    width: (width - Spacing.md * 2 - Spacing.sm) / 2,
  },
  actionGradient: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 140,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  actionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: (width - Spacing.md * 2 - Spacing.sm) / 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
});
