import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useCommunityStore, CommunityType } from "@/lib/communityStore";
import { getToolsByCommunity, CommunityTool, CommunityToolCategory } from "@/lib/communityData";
import { useI18n } from "@/lib/i18n";

import { AppIcon } from "@/components/icons/AppIcon";
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - Spacing.xl * 3) / 2;

const COMMUNITY_NAMES: Record<CommunityType, { bn: string; en: string }> = {
  agriculture: { bn: "কৃষি", en: "Agriculture" },
  health: { bn: "স্বাস্থ্য", en: "Health" },
  education: { bn: "শিক্ষা", en: "Education" },
  business: { bn: "ব্যবসা", en: "Business" },
  technology: { bn: "প্রযুক্তি", en: "Technology" },
};

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const activeCommunity = useCommunityStore((state) => state.activeCommunity);
  const { language, t } = useI18n();
  const isBn = language === "bn";

  const communityType = (activeCommunity?.type || "agriculture") as CommunityType;
  const communityName = COMMUNITY_NAMES[communityType]?.[isBn ? "bn" : "en"] || "Agriculture";
  
  const categories = useMemo(() => {
    return getToolsByCommunity(communityType);
  }, [communityType]);

  const getToolTitle = (tool: CommunityTool) => isBn ? tool.titleBn : tool.titleEn;
  const getToolSubtitle = (tool: CommunityTool) => isBn ? tool.subtitleBn : tool.subtitleEn;
  const getCategoryTitle = (cat: CommunityToolCategory) => isBn ? cat.titleBn : cat.titleEn;

  const handleToolPress = (tool: CommunityTool) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tool.screen) {
      navigation.navigate(tool.screen as any);
    }
  };

  const allTools = categories.flatMap((cat) => cat.tools);

  const filteredTools = searchQuery.trim()
    ? allTools.filter((t) =>
        getToolTitle(t).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getToolSubtitle(t).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const renderToolCard = (tool: CommunityTool, index: number) => (
    <Animated.View
      key={tool.id}
      entering={FadeInUp.delay(index * 50).duration(400)}
      style={styles.cardWrapper}
    >
      <Pressable
        onPress={() => handleToolPress(tool)}
        style={({ pressed }) => [
          styles.toolCard,
          { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)" },
          pressed && styles.cardPressed,
        ]}
      >
        <LinearGradient
          colors={tool.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <AppIcon name={tool.icon} size={24} color="#FFF" />
        </LinearGradient>
        
        <ThemedText style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
          {getToolTitle(tool)}
        </ThemedText>
        <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
          {getToolSubtitle(tool)}
        </ThemedText>
        
        {tool.badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: tool.badgeColor || "#DC2626" },
            ]}
          >
            <ThemedText style={styles.badgeText}>{tool.badge}</ThemedText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={isDark ? ["#1a1a2e", "#16213e"] : ["#f8f9fa", "#e9ecef"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.headerSection}>
          <View style={[styles.headerIcon, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
            <Feather name="tool" size={32} color={theme.primary} />
          </View>
          {/* No second "Agriculture Tools" title here: the top bar already says Tools. */}
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {isBn ? `আপনার জন্য ${allTools.length}+ টুলস` : `${allTools.length}+ tools for you`}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)", borderColor: theme.cardBorder },
            ]}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={isBn ? "টুল খুঁজুন..." : "Search tools..."}
              placeholderTextColor={theme.textSecondary}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        {filteredTools ? (
          <>
            <View style={styles.categorySeparator}>
              <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
              <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary, backgroundColor: isDark ? "#1a1a2e" : "#f8f9fa" }]}>
                {isBn ? `অনুসন্ধান ফলাফল (${filteredTools.length})` : `Search Results (${filteredTools.length})`}
              </ThemedText>
              <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
            </View>

            <View style={styles.gridContainer}>
              {filteredTools.map((tool, index) => renderToolCard(tool, index))}
            </View>

            {filteredTools.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="search" size={48} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {isBn ? "কোন টুল পাওয়া যায়নি" : "No tools found"}
                </ThemedText>
              </View>
            ) : null}
          </>
        ) : (
          categories.map((category: CommunityToolCategory, catIndex: number) => (
            <View key={category.id}>
              <View style={styles.categorySeparator}>
                <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
                <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary, backgroundColor: isDark ? "#1a1a2e" : "#f8f9fa" }]}>
                  {getCategoryTitle(category)}
                </ThemedText>
                <View style={[styles.separatorLine, { backgroundColor: theme.cardBorder }]} />
              </View>

              <View style={styles.gridContainer}>
                {category.tools.map((tool: CommunityTool, index: number) => renderToolCard(tool, catIndex * 10 + index))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  categorySeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: Spacing.md,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  toolCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    minHeight: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});
