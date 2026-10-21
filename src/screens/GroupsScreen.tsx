import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ModalBottomInset } from "@/components/ModalBottomInset";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Group {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  category: string;
  coverImage?: string;
  lastActivity: string;
}

const INITIAL_GROUPS: Group[] = [];

const CATEGORIES = ["সব", "শস্য", "মৎস্য", "পোল্ট্রি", "সবজি", "পশুপালন", "জৈব", "ফল", "যন্ত্রপাতি"];

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedGroupCategory, setSelectedGroupCategory] = useState("শস্য");

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleJoinToggle = (groupId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              isJoined: !group.isJoined,
              memberCount: group.isJoined
                ? group.memberCount - 1
                : group.memberCount + 1,
            }
          : group
      )
    );
  };

  const handleGroupPress = (group: Group) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("GroupDetail", { group });
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      Alert.alert("ত্রুটি", "গ্রুপের নাম লিখুন");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || "নতুন গ্রুপ",
      icon: "👥",
      color: theme.primary,
      memberCount: 1,
      postCount: 0,
      isJoined: true,
      category: selectedGroupCategory,
      lastActivity: "এইমাত্র",
    };

    setGroups([newGroup, ...groups]);
    setNewGroupName("");
    setNewGroupDesc("");
    setShowCreateGroup(false);
  };

  const filteredGroups = groups.filter((group) => {
    const matchesCategory =
      selectedCategory === "সব" || group.category === selectedCategory;
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const myGroups = groups.filter((g) => g.isJoined);

  const formatMemberCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K";
    }
    return count.toString();
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <Pressable
      style={({ pressed }) => [
        styles.groupCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
        pressed && styles.cardPressed,
      ]}
      onPress={() => handleGroupPress(item)}
    >
      {item.coverImage ? (
        <Image
          source={{ uri: item.coverImage }}
          style={styles.coverImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: item.color + "30" }]}>
          <ThemedText style={styles.coverIcon}>{item.icon}</ThemedText>
        </View>
      )}

      <View style={styles.groupContent}>
        <View style={styles.groupHeader}>
          <View style={[styles.iconCircle, { backgroundColor: item.color + "20" }]}>
            <ThemedText style={styles.groupIcon}>{item.icon}</ThemedText>
          </View>
          <View style={styles.groupInfo}>
            <ThemedText style={[styles.groupName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </ThemedText>
            <View style={styles.statsRow}>
              <Feather name="users" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {formatMemberCount(item.memberCount)}
              </ThemedText>
              <ThemedText style={[styles.dotSeparator, { color: theme.textSecondary }]}>
                •
              </ThemedText>
              <Feather name="message-square" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {formatMemberCount(item.postCount)}
              </ThemedText>
            </View>
          </View>
        </View>

        <ThemedText
          style={[styles.groupDesc, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {item.description}
        </ThemedText>

        <View style={styles.groupFooter}>
          <View style={[styles.categoryBadge, { backgroundColor: item.color + "15" }]}>
            <ThemedText style={[styles.categoryText, { color: item.color }]}>
              {item.category}
            </ThemedText>
          </View>
          <Pressable
            style={[
              styles.joinButton,
              {
                backgroundColor: item.isJoined ? theme.backgroundRoot : theme.primary,
                borderColor: item.isJoined ? theme.inputBorder : theme.primary,
              },
            ]}
            onPress={() => handleJoinToggle(item.id)}
          >
            <Feather
              name={item.isJoined ? "check" : "plus"}
              size={14}
              color={item.isJoined ? theme.primary : theme.white}
            />
            <ThemedText
              style={[
                styles.joinButtonText,
                { color: item.isJoined ? theme.primary : theme.white },
              ]}
            >
              {item.isJoined ? "যুক্ত" : "যোগ দিন"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInput,
            { backgroundColor: theme.backgroundRoot, borderColor: theme.inputBorder },
          ]}
        >
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchTextInput, { color: theme.text }]}
            placeholder="গ্রুপ খুঁজুন..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryChip,
              {
                backgroundColor:
                  selectedCategory === cat ? theme.primary : theme.backgroundRoot,
                borderColor:
                  selectedCategory === cat ? theme.primary : theme.inputBorder,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory(cat);
            }}
          >
            <ThemedText
              style={[
                styles.categoryChipText,
                { color: selectedCategory === cat ? theme.white : theme.text },
              ]}
            >
              {cat}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {myGroups.length > 0 ? (
        <View style={styles.myGroupsSection}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            আমার গ্রুপ ({myGroups.length})
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.myGroupsScroll}
          >
            {myGroups.map((group) => (
              <Pressable
                key={group.id}
                style={[styles.myGroupChip, { backgroundColor: group.color + "15" }]}
                onPress={() => handleGroupPress(group)}
              >
                <ThemedText style={styles.myGroupIcon}>{group.icon}</ThemedText>
                <ThemedText
                  style={[styles.myGroupName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {group.name}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
        সব গ্রুপ
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              কোনো গ্রুপ পাওয়া যায়নি
            </ThemedText>
          </View>
        }
      />

      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + Spacing.lg }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowCreateGroup(true);
        }}
      >
        <Feather name="plus" size={24} color={theme.white} />
      </Pressable>

      <Modal
        visible={showCreateGroup}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateGroup(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreateGroup(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                নতুন গ্রুপ তৈরি
              </ThemedText>
              <Pressable onPress={() => setShowCreateGroup(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.xl },
              ]}
            >
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                গ্রুপের নাম
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.backgroundRoot,
                    color: theme.text,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder="গ্রুপের নাম লিখুন..."
                placeholderTextColor={theme.textSecondary}
                value={newGroupName}
                onChangeText={setNewGroupName}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                বিবরণ
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  {
                    backgroundColor: theme.backgroundRoot,
                    color: theme.text,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder="গ্রুপ সম্পর্কে লিখুন..."
                placeholderTextColor={theme.textSecondary}
                value={newGroupDesc}
                onChangeText={setNewGroupDesc}
                multiline
                numberOfLines={3}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                ক্যাটাগরি
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categorySelectContainer}
              >
                {CATEGORIES.filter((c) => c !== "সব").map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categorySelectChip,
                      {
                        backgroundColor:
                          selectedGroupCategory === cat
                            ? theme.primary
                            : theme.backgroundRoot,
                        borderColor:
                          selectedGroupCategory === cat
                            ? theme.primary
                            : theme.inputBorder,
                      },
                    ]}
                    onPress={() => setSelectedGroupCategory(cat)}
                  >
                    <ThemedText
                      style={[
                        styles.categorySelectText,
                        {
                          color:
                            selectedGroupCategory === cat ? theme.white : theme.text,
                        },
                      ]}
                    >
                      {cat}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={[styles.createButton, { backgroundColor: theme.primary }]}
                onPress={handleCreateGroup}
              >
                <ThemedText style={[styles.createButtonText, { color: theme.white }]}>
                  গ্রুপ তৈরি করুন
                </ThemedText>
              </Pressable>
            </ScrollView>
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
  searchContainer: {
    marginBottom: Spacing.md,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 15,
  },
  categoriesContainer: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  myGroupsSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  myGroupsScroll: {
    gap: Spacing.sm,
  },
  myGroupChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    maxWidth: 150,
  },
  myGroupIcon: {
    fontSize: 16,
  },
  myGroupName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  groupCard: {
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.medium,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  coverImage: {
    width: "100%",
    height: 100,
  },
  coverPlaceholder: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  coverIcon: {
    fontSize: 40,
  },
  groupContent: {
    padding: Spacing.lg,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  groupIcon: {
    fontSize: 22,
  },
  groupInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  dotSeparator: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  groupDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  groupFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
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
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    marginBottom: Spacing.lg,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  categorySelectContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  categorySelectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  categorySelectText: {
    fontSize: 13,
    fontWeight: "500",
  },
  createButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
