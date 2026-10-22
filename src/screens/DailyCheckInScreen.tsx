import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { AppIcon } from "@/components/icons/AppIcon";
const WEEK_DAYS = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র"];
const CURRENT_STREAK: number = 0;
const TOTAL_POINTS: number = 0;

// This week, ending today (no check-ins recorded yet)
const WEEKLY_STATUS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return { day: WEEK_DAYS[(d.getDay() + 1) % 7], date: d.getDate(), checked: false, points: i === 6 ? 15 : 10, isToday: i === 6 };
});

const DAILY_TASKS = [
  { id: "1", title: "অ্যাপে লগইন করুন", points: 5, completed: false, icon: "log-in" as const },
  { id: "2", title: "একটি পোস্ট পড়ুন", points: 5, completed: false, icon: "book-open" as const },
  { id: "3", title: "একটি পোস্টে লাইক দিন", points: 3, completed: false, icon: "heart" as const },
  { id: "4", title: "একটি মন্তব্য করুন", points: 5, completed: false, icon: "message-circle" as const },
  { id: "5", title: "মার্কেটপ্লেস ভিজিট করুন", points: 3, completed: false, icon: "shopping-bag" as const },
  { id: "6", title: "একটি প্রশ্নের উত্তর দিন", points: 10, completed: false, icon: "help-circle" as const },
];

const STREAK_MILESTONES = [
  { days: 7, reward: "৫০ বোনাস পয়েন্ট", achieved: false },
  { days: 14, reward: "১০০ বোনাস পয়েন্ট", achieved: false },
  { days: 30, reward: "বিশেষ ব্যাজ", achieved: false },
  { days: 60, reward: "প্রিমিয়াম ১ সপ্তাহ", achieved: false },
];

export default function DailyCheckInScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [checkedIn, setCheckedIn] = useState(false);
  const [tasks, setTasks] = useState(DAILY_TASKS);

  const handleCheckIn = () => {
    if (!checkedIn) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCheckedIn(true);
    }
  };

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const taskProgress = (completedTasks / totalTasks) * 100;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.text }]}>দৈনিক চেক-ইন</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            প্রতিদিন চেক-ইন করুন, পয়েন্ট জিতুন
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(50)}>
          <LinearGradient colors={[theme.primary, "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.streakCard}>
            <View style={styles.streakInfo}>
              <View style={styles.streakMain}>
                <Feather name="zap" size={32} color="#F5B700" />
                <View>
                  <ThemedText style={styles.streakValue}>{CURRENT_STREAK} দিন</ThemedText>
                  <ThemedText style={styles.streakLabel}>স্ট্রিক চলছে!</ThemedText>
                </View>
              </View>
              <View style={styles.pointsBox}>
                <ThemedText style={styles.pointsValue}>{TOTAL_POINTS}</ThemedText>
                <ThemedText style={styles.pointsLabel}>পয়েন্ট</ThemedText>
              </View>
            </View>

            <View style={styles.weekRow}>
              {WEEKLY_STATUS.map((day, index) => (
                <View key={index} style={styles.dayItem}>
                  <ThemedText style={styles.dayName}>{day.day}</ThemedText>
                  <View style={[styles.dayCircle, day.checked && styles.dayCircleChecked, day.isToday && styles.dayCircleToday]}>
                    {day.checked ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : (
                      <ThemedText style={styles.dayDate}>{day.date}</ThemedText>
                    )}
                  </View>
                  <ThemedText style={styles.dayPoints}>+{day.points}</ThemedText>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={styles.checkInSection}>
          <Pressable
            style={[styles.checkInButton, checkedIn && styles.checkInButtonDone, { backgroundColor: checkedIn ? "#2FA36B" : theme.primary }]}
            onPress={handleCheckIn}
            disabled={checkedIn}
          >
            {checkedIn ? (
              <Animated.View entering={ZoomIn} style={styles.checkInContent}>
                <Feather name="check-circle" size={28} color="#fff" />
                <ThemedText style={styles.checkInText}>চেক-ইন সম্পন্ন!</ThemedText>
              </Animated.View>
            ) : (
              <View style={styles.checkInContent}>
                <Feather name="calendar" size={28} color="#fff" />
                <ThemedText style={styles.checkInText}>আজকের চেক-ইন করুন</ThemedText>
                <ThemedText style={styles.checkInPoints}>+15 পয়েন্ট</ThemedText>
              </View>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>দৈনিক টাস্ক</ThemedText>
            <ThemedText style={[styles.progressText, { color: theme.primary }]}>
              {completedTasks}/{totalTasks} সম্পন্ন
            </ThemedText>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
            <View style={[styles.progressFill, { width: `${taskProgress}%`, backgroundColor: theme.primary }]} />
          </View>
          <View style={[styles.tasksCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {tasks.map((task, index) => (
              <View key={task.id} style={[styles.taskRow, index < tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.taskIcon, { backgroundColor: task.completed ? "#2FA36B15" : theme.primary + "15" }]}>
                  <AppIcon name={task.icon} size={16} color={task.completed ? "#2FA36B" : theme.primary} />
                </View>
                <ThemedText style={[styles.taskTitle, { color: theme.text, textDecorationLine: task.completed ? "line-through" : "none" }]}>
                  {task.title}
                </ThemedText>
                <View style={[styles.taskPoints, { backgroundColor: task.completed ? "#2FA36B15" : "#F5B70015" }]}>
                  <ThemedText style={[styles.taskPointsText, { color: task.completed ? "#2FA36B" : "#F5B700" }]}>
                    +{task.points}
                  </ThemedText>
                </View>
                {task.completed ? (
                  <Feather name="check-circle" size={20} color="#2FA36B" />
                ) : (
                  <Feather name="circle" size={20} color={theme.textSecondary} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>স্ট্রিক মাইলস্টোন</ThemedText>
          <View style={[styles.milestonesCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {STREAK_MILESTONES.map((milestone, index) => (
              <View key={index} style={[styles.milestoneRow, index < STREAK_MILESTONES.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
                <View style={[styles.milestoneDays, { backgroundColor: milestone.achieved ? "#2FA36B15" : theme.primary + "15" }]}>
                  <ThemedText style={[styles.milestoneDaysText, { color: milestone.achieved ? "#2FA36B" : theme.primary }]}>
                    {milestone.days}
                  </ThemedText>
                  <ThemedText style={[styles.milestoneDaysLabel, { color: milestone.achieved ? "#2FA36B" : theme.primary }]}>দিন</ThemedText>
                </View>
                <View style={styles.milestoneInfo}>
                  <ThemedText style={[styles.milestoneReward, { color: theme.text }]}>{milestone.reward}</ThemedText>
                  <ThemedText style={[styles.milestoneStatus, { color: milestone.achieved ? "#2FA36B" : theme.textSecondary }]}>
                    {milestone.achieved ? "অর্জিত!" : `${milestone.days - CURRENT_STREAK} দিন বাকি`}
                  </ThemedText>
                </View>
                {milestone.achieved ? (
                  <Feather name="award" size={24} color="#F5B700" />
                ) : (
                  <Feather name="lock" size={20} color={theme.textSecondary} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  streakCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  streakInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  streakMain: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  streakValue: { color: "#fff", fontSize: 28, fontWeight: "700" },
  streakLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  pointsBox: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, alignItems: "center" },
  pointsValue: { color: "#fff", fontSize: 20, fontWeight: "700" },
  pointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  dayItem: { alignItems: "center" },
  dayName: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginBottom: 4 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  dayCircleChecked: { backgroundColor: "#2FA36B" },
  dayCircleToday: { borderWidth: 2, borderColor: "#F5B700" },
  dayDate: { color: "#fff", fontSize: 12, fontWeight: "600" },
  dayPoints: { color: "rgba(255,255,255,0.7)", fontSize: 9, marginTop: 4 },
  checkInSection: { marginBottom: Spacing.lg },
  checkInButton: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: "center" },
  checkInButtonDone: {},
  checkInContent: { alignItems: "center", gap: Spacing.sm },
  checkInText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  checkInPoints: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  progressText: { fontSize: 13, fontWeight: "500" },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: Spacing.md },
  progressFill: { height: "100%", borderRadius: 3 },
  tasksCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  taskRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.sm },
  taskIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  taskTitle: { flex: 1, fontSize: 14 },
  taskPoints: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  taskPointsText: { fontSize: 11, fontWeight: "600" },
  milestonesCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  milestoneRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  milestoneDays: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  milestoneDaysText: { fontSize: 18, fontWeight: "700" },
  milestoneDaysLabel: { fontSize: 9 },
  milestoneInfo: { flex: 1, marginLeft: Spacing.md },
  milestoneReward: { fontSize: 14, fontWeight: "500" },
  milestoneStatus: { fontSize: 12, marginTop: 2 },
});
