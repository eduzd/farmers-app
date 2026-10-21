import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

import { tr, useTr } from "@/lib/tr";
interface WeatherData {
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    isDay: boolean;
  };
  daily: {
    date: string;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
    precipitation: number;
  }[];
  location: string;
}

const WEATHER_CODES: Record<number, { icon: keyof typeof Feather.glyphMap; label: string; labelBn: string }> = {
  0: { icon: "sun", label: "Clear sky", labelBn: "পরিষ্কার আকাশ" },
  1: { icon: "sun", label: "Mainly clear", labelBn: "মূলত পরিষ্কার" },
  2: { icon: "cloud", label: "Partly cloudy", labelBn: "আংশিক মেঘলা" },
  3: { icon: "cloud", label: "Overcast", labelBn: "মেঘাচ্ছন্ন" },
  45: { icon: "cloud", label: "Foggy", labelBn: "কুয়াশাচ্ছন্ন" },
  48: { icon: "cloud", label: "Depositing rime fog", labelBn: "ঘন কুয়াশা" },
  51: { icon: "cloud-drizzle", label: "Light drizzle", labelBn: "হালকা গুঁড়ি বৃষ্টি" },
  53: { icon: "cloud-drizzle", label: "Moderate drizzle", labelBn: "মাঝারি গুঁড়ি বৃষ্টি" },
  55: { icon: "cloud-drizzle", label: "Dense drizzle", labelBn: "ঘন গুঁড়ি বৃষ্টি" },
  61: { icon: "cloud-rain", label: "Slight rain", labelBn: "হালকা বৃষ্টি" },
  63: { icon: "cloud-rain", label: "Moderate rain", labelBn: "মাঝারি বৃষ্টি" },
  65: { icon: "cloud-rain", label: "Heavy rain", labelBn: "ভারী বৃষ্টি" },
  71: { icon: "cloud-snow", label: "Slight snow", labelBn: "হালকা তুষারপাত" },
  73: { icon: "cloud-snow", label: "Moderate snow", labelBn: "মাঝারি তুষারপাত" },
  75: { icon: "cloud-snow", label: "Heavy snow", labelBn: "ভারী তুষারপাত" },
  80: { icon: "cloud-rain", label: "Rain showers", labelBn: "বৃষ্টির ঝাপটা" },
  81: { icon: "cloud-rain", label: "Moderate showers", labelBn: "মাঝারি বৃষ্টি" },
  82: { icon: "cloud-rain", label: "Violent showers", labelBn: "প্রবল বৃষ্টি" },
  95: { icon: "cloud-lightning", label: "Thunderstorm", labelBn: "বজ্রঝড়" },
  96: { icon: "cloud-lightning", label: "Thunderstorm with hail", labelBn: "শিলাবৃষ্টিসহ বজ্রঝড়" },
  99: { icon: "cloud-lightning", label: "Severe thunderstorm", labelBn: "তীব্র বজ্রঝড়" },
};

const getWeatherInfo = (code: number) => {
  return WEATHER_CODES[code] || { icon: "cloud", label: "Unknown", labelBn: "অজানা" };
};

const getDayName = (dateString: string): string => {
  const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "আজ";
  if (date.toDateString() === tomorrow.toDateString()) return "আগামীকাল";
  return days[date.getDay()];
};

export default function WeatherScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("আপনার অবস্থান");

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    try {
      setError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      let latitude = 23.8103;
      let longitude = 90.4125;
      let location = "ঢাকা, বাংলাদেশ";
      
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          
          if (reverseGeocode.length > 0) {
            const place = reverseGeocode[0];
            location = `${place.city || place.district || place.subregion || ""}, ${place.country || ""}`;
          }
        } catch (locError) {
          console.log("Using default location (Dhaka)");
        }
      }
      
      setLocationName(location);

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`
      );

      if (!response.ok) {
        throw new Error("আবহাওয়া ডাটা লোড করতে সমস্যা হয়েছে");
      }

      const data = await response.json();

      const weatherData: WeatherData = {
        current: {
          temperature: Math.round(data.current.temperature_2m),
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          weatherCode: data.current.weather_code,
          isDay: data.current.is_day === 1,
        },
        daily: data.daily.time.map((date: string, index: number) => ({
          date,
          tempMax: Math.round(data.daily.temperature_2m_max[index]),
          tempMin: Math.round(data.daily.temperature_2m_min[index]),
          weatherCode: data.daily.weather_code[index],
          precipitation: data.daily.precipitation_sum[index] || 0,
        })),
        location,
      };

      setWeather(weatherData);
    } catch (err) {
      console.error("Weather fetch error:", err);
      setError("আবহাওয়া তথ্য লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWeather();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          {tr("আবহাওয়া লোড হচ্ছে...")}
        </ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="cloud-off" size={64} color={theme.textSecondary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          {error}
        </ThemedText>
        <Pressable
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={fetchWeather}
        >
          <ThemedText style={styles.retryButtonText}>{tr("আবার চেষ্টা করুন")}</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (!weather) return null;

  const currentWeather = getWeatherInfo(weather.current.weatherCode);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={weather.current.isDay ? ["#5B9BD5", "#87CEEB"] : ["#1a1a2e", "#16213e"]}
        style={styles.currentWeatherCard}
      >
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={16} color="#FFFFFF" />
          <ThemedText style={styles.locationText}>{locationName}</ThemedText>
        </View>

        <View style={styles.mainTempRow}>
          <Feather name={currentWeather.icon} size={64} color="#FFFFFF" />
          <ThemedText style={styles.temperature}>
            {weather.current.temperature}°
          </ThemedText>
        </View>

        <ThemedText style={styles.weatherCondition}>
          {currentWeather.labelBn}
        </ThemedText>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Feather name="droplet" size={18} color="#FFFFFF" />
            <ThemedText style={styles.detailValue}>
              {weather.current.humidity}%
            </ThemedText>
            <ThemedText style={styles.detailLabel}>{tr("আর্দ্রতা")}</ThemedText>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Feather name="wind" size={18} color="#FFFFFF" />
            <ThemedText style={styles.detailValue}>
              {weather.current.windSpeed} km/h
            </ThemedText>
            <ThemedText style={styles.detailLabel}>{tr("বাতাস")}</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.forecastSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {tr("৭ দিনের পূর্বাভাস")}
        </ThemedText>

        {weather.daily.map((day, index) => {
          const dayWeather = getWeatherInfo(day.weatherCode);
          return (
            <View
              key={day.date}
              style={[
                styles.forecastCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.forecastDay}>
                <ThemedText style={[styles.dayName, { color: theme.text }]}>
                  {getDayName(day.date)}
                </ThemedText>
                <ThemedText style={[styles.dayCondition, { color: theme.textSecondary }]}>
                  {dayWeather.labelBn}
                </ThemedText>
              </View>

              <View style={styles.forecastMiddle}>
                <Feather name={dayWeather.icon} size={24} color={theme.primary} />
                {day.precipitation > 0 ? (
                  <View style={styles.precipitationBadge}>
                    <Feather name="droplet" size={10} color="#2563EB" />
                    <ThemedText style={styles.precipitationText}>
                      {Math.round(day.precipitation)}mm
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.forecastTemps}>
                <ThemedText style={[styles.tempMax, { color: theme.text }]}>
                  {day.tempMax}°
                </ThemedText>
                <ThemedText style={[styles.tempMin, { color: theme.textSecondary }]}>
                  {day.tempMin}°
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.farmingTipsCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.tipsHeader}>
          <Feather name="info" size={20} color={theme.primary} />
          <ThemedText style={[styles.tipsTitle, { color: theme.text }]}>
            {tr("কৃষি পরামর্শ")}
          </ThemedText>
        </View>
        <ThemedText style={[styles.tipsText, { color: theme.textSecondary }]}>
          {weather.current.weatherCode >= 61 && weather.current.weatherCode <= 82
            ? "বৃষ্টির দিনে সার প্রয়োগ এড়িয়ে চলুন। ফসলের পানি নিষ্কাশন নিশ্চিত করুন।"
            : weather.current.temperature > 35
            ? "অত্যধিক গরমে ফসলে পানি দিন সকাল বা সন্ধ্যায়। পশুদের ছায়ায় রাখুন।"
            : weather.current.humidity > 80
            ? "উচ্চ আর্দ্রতায় ছত্রাক রোগের ঝুঁকি বেশি। ফসল পর্যবেক্ষণ করুন।"
            : "আজকের আবহাওয়া কৃষি কাজের জন্য উপযুক্ত। সার প্রয়োগ বা বীজ বপন করতে পারেন।"}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  currentWeatherCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.large,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  locationText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  mainTempRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  temperature: {
    fontSize: 72,
    fontWeight: "200",
    color: "#FFFFFF",
  },
  weatherCondition: {
    fontSize: 20,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  detailItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  detailDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  detailValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  detailLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  forecastSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: Spacing.md,
  },
  forecastCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  forecastDay: {
    flex: 1,
  },
  dayName: {
    fontSize: 15,
    fontWeight: "600",
  },
  dayCondition: {
    fontSize: 12,
    marginTop: 2,
  },
  forecastMiddle: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  precipitationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
  },
  precipitationText: {
    fontSize: 10,
    color: "#2563EB",
  },
  forecastTemps: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tempMax: {
    fontSize: 16,
    fontWeight: "700",
  },
  tempMin: {
    fontSize: 14,
  },
  farmingTipsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
