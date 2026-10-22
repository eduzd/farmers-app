import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

import { AppIcon } from "@/components/icons/AppIcon";
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

// Real forecast from Open-Meteo (free, no key). Nothing here is made up: every number
// comes from the forecast, and the farming tips are worked out from it.
type IconName = keyof typeof Feather.glyphMap;
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bn = (n: number | string) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
const DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

function describe(code: number, night = false): { icon: IconName; text: string } {
  if (code === 0) return { icon: night ? "moon" : "sun", text: "রৌদ্রোজ্জ্বল" };
  if (code <= 2) return { icon: "cloud", text: "আংশিক মেঘলা" };
  if (code === 3) return { icon: "cloud", text: "মেঘলা" };
  if (code === 45 || code === 48) return { icon: "cloud", text: "কুয়াশা" };
  if (code >= 51 && code <= 57) return { icon: "cloud-drizzle", text: "গুঁড়ি বৃষ্টি" };
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 81)) return { icon: "cloud-rain", text: "বৃষ্টি" };
  if (code === 82 || code === 66 || code === 67) return { icon: "cloud-rain", text: "ভারী বৃষ্টি" };
  if (code >= 95) return { icon: "cloud-lightning", text: "বজ্রঝড়" };
  return { icon: "cloud", text: "মেঘলা" };
}

function adviceFrom(daily: WeatherData["daily"], current: WeatherData["current"]): WeatherData["farmingAdvice"] {
  const tips: WeatherData["farmingAdvice"] = [];
  const next3 = daily.slice(0, 3);
  const wet = next3.filter((d) => d.rainChance >= 60);
  if (wet.length) {
    tips.push({ id: "rain", title: "বৃষ্টির প্রস্তুতি নিন", description: `সামনের ৩ দিনের ${bn(wet.length)} দিন বৃষ্টির সম্ভাবনা ${bn(Math.max(...wet.map((d) => d.rainChance)))}% পর্যন্ত। সংবেদনশীল ফসল ঢেকে রাখুন ও নালা পরিষ্কার রাখুন।`, icon: "umbrella", priority: "high" });
    tips.push({ id: "fert", title: "সার ও কীটনাশক পরে দিন", description: "বৃষ্টির আগে সার বা কীটনাশক দিলে ধুয়ে যায়। বৃষ্টি থামলে প্রয়োগ করুন।", icon: "pause-circle", priority: "medium" });
  }
  const hot = next3.find((d) => d.high >= 34);
  if (hot) tips.push({ id: "heat", title: "গরমে সেচ দিন", description: `তাপমাত্রা ${bn(Math.round(hot.high))}°C পর্যন্ত উঠতে পারে। সকালে বা বিকেলে সেচ দিন।`, icon: "droplet", priority: "high" });
  if (current.windSpeed >= 30) tips.push({ id: "wind", title: "জোরালো বাতাস", description: `বাতাসের গতি ${bn(Math.round(current.windSpeed))} কিমি/ঘণ্টা। লম্বা ফসলে খুঁটি দিন, স্প্রে করবেন না।`, icon: "wind", priority: "medium" });
  const dry = daily.findIndex((d, i) => i > 0 && d.rainChance <= 20);
  if (!wet.length && dry > 0) tips.push({ id: "plant", title: "রোপণের ভালো সময়", description: `${daily[dry].dayBn} বৃষ্টির সম্ভাবনা কম (${bn(daily[dry].rainChance)}%), চারা রোপণ বা ফসল তোলার জন্য উপযুক্ত।`, icon: "sun", priority: "low" });
  return tips;
}

async function loadForecast(lat: number, lon: number): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,uv_index,visibility,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
    "&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max" +
    "&timezone=auto&forecast_days=7";
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather " + res.status);
  const d = await res.json();
  const c = d.current;
  const cur = describe(c.weather_code, c.is_day === 0);
  const current: WeatherData["current"] = {
    temp: Math.round(c.temperature_2m),
    humidity: Math.round(c.relative_humidity_2m),
    windSpeed: Math.round(c.wind_speed_10m),
    condition: cur.text,
    icon: cur.icon,
    feelsLike: Math.round(c.apparent_temperature),
    uv: Math.round(c.uv_index ?? 0),
    visibility: Math.round((c.visibility ?? 0) / 1000),
  };
  const nowIdx = Math.max(0, (d.hourly.time as string[]).findIndex((t) => t >= String(c.time).slice(0, 13)));
  const hourly: WeatherData["hourly"] = (d.hourly.time as string[]).slice(nowIdx, nowIdx + 8).map((t, k) => {
    const i = nowIdx + k;
    return {
      time: bn(t.slice(11, 16)),
      temp: Math.round(d.hourly.temperature_2m[i]),
      icon: describe(d.hourly.weather_code[i], d.hourly.is_day?.[i] === 0).icon,
      rainChance: Math.round(d.hourly.precipitation_probability?.[i] ?? 0),
    };
  });
  const daily: WeatherData["daily"] = (d.daily.time as string[]).map((t, i) => {
    const wd = new Date(t + "T12:00:00").getDay();
    const w = describe(d.daily.weather_code[i]);
    return {
      day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAY_EN[wd],
      dayBn: i === 0 ? "আজ" : i === 1 ? "আগামীকাল" : DAY_BN[wd],
      high: Math.round(d.daily.temperature_2m_max[i]),
      low: Math.round(d.daily.temperature_2m_min[i]),
      icon: w.icon,
      condition: w.text,
      rainChance: Math.round(d.daily.precipitation_probability_max?.[i] ?? 0),
    };
  });
  return { current, hourly, daily, farmingAdvice: adviceFrom(daily, current) };
}

export default function WeatherForecastScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [location, setLocation] = useState<string>('ঢাকা, বাংলাদেশ');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    // Dhaka until the phone's location is known.
    let lat = 23.8103;
    let lon = 90.4125;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
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
    try {
      setWeather(await loadForecast(lat, lon));
      setWeatherError(false);
    } catch {
      setWeatherError(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await requestLocation();
    setRefreshing(false);
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

  if (!weather) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
        {weatherError ? (
          <>
            <Feather name="cloud-off" size={40} color={theme.textSecondary} />
            <ThemedText style={{ marginTop: Spacing.md, textAlign: 'center', color: theme.textSecondary }}>
              আবহাওয়ার তথ্য আনা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।
            </ThemedText>
            <Pressable onPress={requestLocation} style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: theme.primary }}>
              <ThemedText style={{ color: '#fff', fontWeight: '600' }}>আবার চেষ্টা করুন</ThemedText>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={theme.primary} />
        )}
      </View>
    );
  }

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
            <AppIcon name={weather.current.icon} size={64} color="#fff" />
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
                <AppIcon
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
                <AppIcon
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
                  <AppIcon name={advice.icon} size={20} color={colors.icon} />
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
