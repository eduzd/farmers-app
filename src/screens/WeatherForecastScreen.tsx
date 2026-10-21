import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface WeatherData {
  current: {
    temp: number;
    humidity: number;
    windSpeed: number;
    condition: string;
    icon: keyof typeof Feather.glyphMap;
    feelsLike: number;
    uv: number;
    visibility: number;
  };
  hourly: Array<{
    time: string;
    temp: number;
    icon: keyof typeof Feather.glyphMap;
    rainChance: number;
  }>;
  daily: Array<{
    day: string;
    dayBn: string;
    high: number;
    low: number;
    icon: keyof typeof Feather.glyphMap;
    condition: string;
    rainChance: number;
  }>;
  farmingAdvice: Array<{
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Feather.glyphMap;
    priority: 'high' | 'medium' | 'low';
  }>;
}

const MOCK_WEATHER: WeatherData = {
  current: {
    temp: 28,
    humidity: 75,
    windSpeed: 12,
    condition: 'আংশিক মেঘলা',
    icon: 'cloud',
    feelsLike: 31,
    uv: 6,
    visibility: 10,
  },
  hourly: [
    { time: '১২:০০', temp: 28, icon: 'sun', rainChance: 10 },
    { time: '১৩:০০', temp: 29, icon: 'sun', rainChance: 15 },
    { time: '১৪:০০', temp: 30, icon: 'cloud', rainChance: 25 },
    { time: '১৫:০০', temp: 29, icon: 'cloud', rainChance: 40 },
    { time: '১৬:০০', temp: 28, icon: 'cloud-rain', rainChance: 60 },
    { time: '১৭:০০', temp: 26, icon: 'cloud-rain', rainChance: 70 },
    { time: '১৮:০০', temp: 25, icon: 'cloud', rainChance: 45 },
    { time: '১৯:০০', temp: 24, icon: 'moon', rainChance: 20 },
  ],
  daily: [
    { day: 'Today', dayBn: 'আজ', high: 30, low: 22, icon: 'cloud', condition: 'মেঘলা', rainChance: 60 },
    { day: 'Tomorrow', dayBn: 'আগামীকাল', high: 28, low: 21, icon: 'cloud-rain', condition: 'বৃষ্টি', rainChance: 80 },
    { day: 'Wed', dayBn: 'বুধ', high: 27, low: 20, icon: 'cloud-rain', condition: 'ভারী বৃষ্টি', rainChance: 90 },
    { day: 'Thu', dayBn: 'বৃহঃ', high: 29, low: 21, icon: 'cloud', condition: 'মেঘলা', rainChance: 40 },
    { day: 'Fri', dayBn: 'শুক্র', high: 31, low: 23, icon: 'sun', condition: 'রৌদ্রোজ্জ্বল', rainChance: 10 },
    { day: 'Sat', dayBn: 'শনি', high: 32, low: 24, icon: 'sun', condition: 'রৌদ্রোজ্জ্বল', rainChance: 5 },
    { day: 'Sun', dayBn: 'রবি', high: 31, low: 23, icon: 'cloud', condition: 'আংশিক মেঘলা', rainChance: 20 },
  ],
  farmingAdvice: [
    {
      id: '1',
      title: 'ফসল ঢাকা দিন',
      description: 'আগামী ২-৩ দিন ভারী বৃষ্টির সম্ভাবনা। সংবেদনশীল ফসল ঢেকে রাখুন।',
      icon: 'umbrella',
      priority: 'high',
    },
    {
      id: '2',
      title: 'সার প্রয়োগ স্থগিত',
      description: 'বৃষ্টির আগে সার প্রয়োগ করবেন না। বৃষ্টি শেষ হলে প্রয়োগ করুন।',
      icon: 'pause-circle',
      priority: 'high',
    },
    {
      id: '3',
      title: 'পানি নিষ্কাশন',
      description: 'ক্ষেতের পানি নিষ্কাশনের ব্যবস্থা পরীক্ষা করুন।',
      icon: 'droplet',
      priority: 'medium',
    },
    {
      id: '4',
      title: 'শুক্রবার রোপণ',
      description: 'শুক্রবার থেকে আবহাওয়া ভালো থাকবে। নতুন চারা রোপণের জন্য উপযুক্ত।',
      icon: 'calendar',
      priority: 'low',
    },
  ],
};

export default function WeatherForecastScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [weather, setWeather] = useState<WeatherData>(MOCK_WEATHER);
  const [location, setLocation] = useState<string>('ঢাকা, বাংলাদেশ');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const [address] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (address) {
          setLocation(`${address.city || address.region}, ${address.country}`);
        }
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await requestLocation();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return { bg: '#FEE2E2', text: '#991B1B', icon: '#DC2626' };
      case 'medium':
        return { bg: '#FEF3C7', text: '#92400E', icon: '#EA8A0C' };
      default:
        return { bg: '#D1FAE5', text: '#065F46', icon: '#16A34A' };
    }
  };

  const getWeatherGradient = (): [string, string] => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return ['#FCD34D', '#EA8A0C'];
    if (hour >= 12 && hour < 17) return ['#38BDF8', '#0EA5E9'];
    if (hour >= 17 && hour < 20) return ['#FB923C', '#DC2626'];
    return ['#1E3A8A', '#312E81'];
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <LinearGradient
          colors={getWeatherGradient()}
          style={styles.currentWeather}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={16} color="#fff" />
            <ThemedText style={styles.locationText}>{location}</ThemedText>
          </View>

          <View style={styles.tempContainer}>
            <Feather name={weather.current.icon} size={64} color="#fff" />
            <View style={styles.tempInfo}>
              <ThemedText style={styles.tempValue}>
                {weather.current.temp}°
              </ThemedText>
              <ThemedText style={styles.condition}>
                {weather.current.condition}
              </ThemedText>
              <ThemedText style={styles.feelsLike}>
                অনুভূত: {weather.current.feelsLike}°
              </ThemedText>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Feather name="droplet" size={18} color="#fff" />
              <ThemedText style={styles.detailValue}>
                {weather.current.humidity}%
              </ThemedText>
              <ThemedText style={styles.detailLabel}>আর্দ্রতা</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <Feather name="wind" size={18} color="#fff" />
              <ThemedText style={styles.detailValue}>
                {weather.current.windSpeed} km/h
              </ThemedText>
              <ThemedText style={styles.detailLabel}>বাতাস</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <Feather name="sun" size={18} color="#fff" />
              <ThemedText style={styles.detailValue}>
                {weather.current.uv}
              </ThemedText>
              <ThemedText style={styles.detailLabel}>UV সূচক</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <Feather name="eye" size={18} color="#fff" />
              <ThemedText style={styles.detailValue}>
                {weather.current.visibility} km
              </ThemedText>
              <ThemedText style={styles.detailLabel}>দৃশ্যমানতা</ThemedText>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>ঘণ্টায় ঘণ্টায়</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hourlyScroll}
          >
            {weather.hourly.map((hour, index) => (
              <View
                key={index}
                style={[styles.hourlyCard, { backgroundColor: theme.card }]}
              >
                <ThemedText style={styles.hourlyTime}>{hour.time}</ThemedText>
                <Feather
                  name={hour.icon}
                  size={24}
                  color={hour.icon === 'cloud-rain' ? '#2563EB' : '#EA8A0C'}
                />
                <ThemedText style={styles.hourlyTemp}>{hour.temp}°</ThemedText>
                <View style={styles.rainChance}>
                  <Feather name="droplet" size={10} color="#2563EB" />
                  <ThemedText style={styles.rainChanceText}>
                    {hour.rainChance}%
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>৭ দিনের পূর্বাভাস</ThemedText>
          <View style={[styles.dailyContainer, { backgroundColor: theme.card }]}>
            {weather.daily.map((day, index) => (
              <View
                key={index}
                style={[
                  styles.dailyRow,
                  index < weather.daily.length - 1 && styles.dailyRowBorder,
                  { borderBottomColor: theme.inputBorder },
                ]}
              >
                <View style={styles.dailyLeft}>
                  <ThemedText style={styles.dailyDay}>{day.dayBn}</ThemedText>
                  <View style={styles.rainChance}>
                    <Feather name="droplet" size={12} color="#2563EB" />
                    <ThemedText style={[styles.rainChanceText, { color: theme.textSecondary }]}>
                      {day.rainChance}%
                    </ThemedText>
                  </View>
                </View>
                <Feather
                  name={day.icon}
                  size={24}
                  color={day.icon === 'sun' ? '#EA8A0C' : day.icon === 'cloud-rain' ? '#2563EB' : '#9CA3AF'}
                />
                <View style={styles.dailyRight}>
                  <ThemedText style={styles.dailyHigh}>{day.high}°</ThemedText>
                  <ThemedText style={[styles.dailyLow, { color: theme.textSecondary }]}>
                    {day.low}°
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>কৃষি পরামর্শ</ThemedText>
          {weather.farmingAdvice.map((advice) => {
            const colors = getPriorityColor(advice.priority);
            return (
              <View
                key={advice.id}
                style={[styles.adviceCard, { backgroundColor: colors.bg }]}
              >
                <View style={[styles.adviceIcon, { backgroundColor: colors.icon + '20' }]}>
                  <Feather name={advice.icon} size={20} color={colors.icon} />
                </View>
                <View style={styles.adviceContent}>
                  <ThemedText style={[styles.adviceTitle, { color: colors.text }]}>
                    {advice.title}
                  </ThemedText>
                  <ThemedText style={[styles.adviceDescription, { color: colors.text }]}>
                    {advice.description}
                  </ThemedText>
                </View>
              </View>
            );
          })}
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
    paddingTop: Spacing.md,
  },
  currentWeather: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  tempInfo: {
    flex: 1,
  },
  tempValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 70,
  },
  condition: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
  },
  feelsLike: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: Spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  detailLabel: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.8,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  hourlyScroll: {
    gap: Spacing.sm,
  },
  hourlyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 70,
  },
  hourlyTime: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  rainChance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: Spacing.xs,
  },
  rainChanceText: {
    fontSize: 10,
    color: '#2563EB',
  },
  dailyContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  dailyRowBorder: {
    borderBottomWidth: 1,
  },
  dailyLeft: {
    width: 100,
  },
  dailyDay: {
    fontSize: 15,
    fontWeight: '500',
  },
  dailyRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: 60,
    justifyContent: 'flex-end',
  },
  dailyHigh: {
    fontSize: 15,
    fontWeight: '600',
  },
  dailyLow: {
    fontSize: 15,
  },
  adviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  adviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceContent: {
    flex: 1,
  },
  adviceTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  adviceDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
