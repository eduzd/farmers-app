import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, FlatList } from "react-native";
import { TextInput } from "@/components/MayaText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Switch } from "@/admin/ui";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/lib/authStore";
import { useCommunityStore } from "@/lib/communityStore";
import { useI18n } from "@/lib/i18n";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import {
  AdminCard,
  StatCard,
  ConfirmModal,
  AdminToast,
  ToastType,
  SearchBar,
  FilterChips,
  EmptyState,
  StatCardSkeleton,
  UserRowSkeleton,
} from "@/components/admin";
import { AdminOrdersTab, AdminStoresTab, AdminCatalogTab, AdminNotifyTab, AdminUserSheet, AdminDeliveryTab, AdminMarketplacePanel } from "@/components/admin/ManageTabs";

import { AppIcon } from "@/components/icons/AppIcon";
type AdminTab =
  | "overview"
  | "users"
  | "content"
  | "reports"
  | "announcements"
  | "settings"
  | "analytics"
  | "logs"
  | "orders"
  | "stores"
  | "listings"
  | "notify"
  | "delivery";

interface DashboardStats {
  totalUsers: number;
  activeUsers24h: number;
  totalPosts: number;
  openReports: number;
  totalOrders: number;
  totalExperts: number;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  username?: string;
  verified: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  status?: "active" | "suspended" | "banned";
}

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  active: boolean;
  createdAt: string;
}

interface AppSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  featureFlags: {
    chatEnabled: boolean;
    marketplaceEnabled: boolean;
    commentsEnabled: boolean;
    uploadsEnabled: boolean;
  };
}

const TABS: { id: AdminTab; label: string; labelBn: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "overview", label: "Overview", labelBn: "ওভারভিউ", icon: "home" },
  { id: "users", label: "Users", labelBn: "ব্যবহারকারী", icon: "users" },
  { id: "orders", label: "Orders", labelBn: "অর্ডার", icon: "shopping-bag" },
  { id: "stores", label: "Sellers", labelBn: "বিক্রেতা", icon: "briefcase" },
  { id: "listings", label: "Listings", labelBn: "লিস্টিং", icon: "package" },
  { id: "delivery", label: "Delivery", labelBn: "ডেলিভারি", icon: "truck" },
  { id: "notify", label: "Notify", labelBn: "নোটিফাই", icon: "send" },
  { id: "content", label: "Content", labelBn: "কনটেন্ট", icon: "file-text" },
  { id: "reports", label: "Reports", labelBn: "রিপোর্ট", icon: "flag" },
  { id: "announcements", label: "Announce", labelBn: "ঘোষণা", icon: "bell" },
  { id: "settings", label: "Settings", labelBn: "সেটিংস", icon: "settings" },
  { id: "analytics", label: "Analytics", labelBn: "বিশ্লেষণ", icon: "bar-chart-2" },
  { id: "logs", label: "Logs", labelBn: "লগ", icon: "activity" },
];

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { isSuperAdmin, getToken } = useAuthStore();
  const { language } = useI18n();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<AdminTab>(((useRoute() as any)?.params?.initialTab as AdminTab) || "overview");
  const [manageUserId, setManageUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");

  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: "success",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmColor?: string;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "", type: "info" as "info" | "warning" | "success" });

  useEffect(() => {
    if (!isSuperAdmin) {
      Alert.alert(
        language === "bn" ? "অ্যাক্সেস অস্বীকৃত" : "Access Denied",
        language === "bn" ? "আপনার অ্যাডমিন অ্যাক্সেস নেই।" : "You don't have admin access."
      );
      navigation.goBack();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [activeTab, isSuperAdmin]);

  const loadData = async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    try {
      switch (activeTab) {
        case "overview":
          await loadStats(token);
          await loadAppSettings(token);
          break;
        case "users":
          await loadUsers(token);
          break;
        case "content":
          await loadPosts(token);
          break;
        case "reports":
        case "analytics":
          await loadStats(token);
          await loadAnalytics(token);
          break;
        case "logs":
          await loadLogs(token);
          break;
        case "announcements":
          await loadAnnouncements(token);
          break;
        case "settings":
          await loadAppSettings(token);
          break;
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      showToast("error", language === "bn" ? "ডেটা লোড করতে ব্যর্থ" : "Failed to load data");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadStats = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const loadAnalytics = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/analytics?days=14`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data) {
        setAnalytics(data);
        setAnalyticsError(null);
      } else {
        setAnalyticsError(data?.error || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      setAnalyticsError(String(error?.message || error));
    }
  };

  const [adminPosts, setAdminPosts] = useState<any[]>([]);
  const loadPosts = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setAdminPosts(await response.json());
    } catch (error) {
      console.error("Failed to load posts:", error);
    }
  };
  const deletePost = (postId: string) => {
    Alert.alert(
      language === "bn" ? "পোস্ট মুছবেন?" : "Delete post?",
      language === "bn" ? "এই পোস্টটি স্থায়ীভাবে মুছে যাবে।" : "This post will be removed for everyone.",
      [
        { text: language === "bn" ? "বাতিল" : "Cancel", style: "cancel" },
        {
          text: language === "bn" ? "মুছুন" : "Delete",
          style: "destructive",
          onPress: async () => {
            const token = getToken();
            if (!token) return;
            const r = await fetch(`${getApiUrl()}/api/admin/posts/${postId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null);
            if (r && r.ok) {
              setAdminPosts((prev) => prev.filter((p) => p.id !== postId));
              showToast("success", language === "bn" ? "পোস্ট মুছে ফেলা হয়েছে" : "Post deleted");
            } else {
              showToast("error", language === "bn" ? "মুছতে ব্যর্থ" : "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const loadUsers = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadLogs = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  const loadAnnouncements = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error("Failed to load announcements:", error);
    }
  };

  const loadAppSettings = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/app-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAppSettings(data);
      }
    } catch (error) {
      console.error("Failed to load app settings:", error);
    }
  };

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  const handleBanUser = async (userId: string, action: "ban" | "unban") => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        showToast("success", action === "ban" ? "ব্যবহারকারী নিষিদ্ধ করা হয়েছে" : "নিষেধাজ্ঞা তুলে নেওয়া হয়েছে");
        loadUsers(token);
      }
    } catch (error) {
      showToast("error", "অপারেশন ব্যর্থ হয়েছে");
    }
  };

  const handleToggleMaintenance = async () => {
    const token = getToken();
    if (!token || !appSettings) return;

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/app-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...appSettings,
          maintenanceMode: !appSettings.maintenanceMode,
        }),
      });
      if (response.ok) {
        setAppSettings({ ...appSettings, maintenanceMode: !appSettings.maintenanceMode });
        showToast("success", appSettings.maintenanceMode ? "মেইনটেনেন্স মোড বন্ধ" : "মেইনটেনেন্স মোড চালু");
      }
    } catch (error) {
      showToast("error", "সেটিংস আপডেট ব্যর্থ");
    }
  };

  const handleToggleFeature = async (feature: keyof AppSettings["featureFlags"]) => {
    const token = getToken();
    if (!token || !appSettings) return;

    const newFlags = {
      ...appSettings.featureFlags,
      [feature]: !appSettings.featureFlags[feature],
    };

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/app-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...appSettings,
          featureFlags: newFlags,
        }),
      });
      if (response.ok) {
        setAppSettings({ ...appSettings, featureFlags: newFlags });
        showToast("success", "ফিচার আপডেট হয়েছে");
      }
    } catch (error) {
      showToast("error", "ফিচার আপডেট ব্যর্থ");
    }
  };

  const handleCreateAnnouncement = async () => {
    const token = getToken();
    if (!token || !newAnnouncement.title || !newAnnouncement.message) {
      showToast("error", "সব ফিল্ড পূরণ করুন");
      return;
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAnnouncement),
      });
      if (response.ok) {
        showToast("success", "ঘোষণা তৈরি হয়েছে");
        setNewAnnouncement({ title: "", message: "", type: "info" });
        loadAnnouncements(token);
      }
    } catch (error) {
      showToast("error", "ঘোষণা তৈরি ব্যর্থ");
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [activeTab]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      userFilter === "all" ||
      (userFilter === "verified" && user.verified) ||
      (userFilter === "unverified" && !user.verified) ||
      (userFilter === "admin" && user.isSuperAdmin);
    return matchesSearch && matchesFilter;
  });

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.centered}>
          <Feather name="lock" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.md }}>
            {language === "bn" ? "অ্যাক্সেস অস্বীকৃত" : "Access Denied"}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ThemedText type="h3" style={[styles.sectionTitle, { color: theme.text }]}>
        {language === "bn" ? "কন্ট্রোল টাওয়ার" : "Control Tower"}
      </ThemedText>

      <AdminMarketplacePanel
        onOpen={(tab) => setActiveTab(tab)}
        onOpenSellerHub={() => (navigation as any).navigate("SellerApp")}
      />

      <View style={styles.statsGrid}>
        {isLoading && !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title={language === "bn" ? "মোট ব্যবহারকারী" : "Total Users"}
              value={stats?.totalUsers || 0}
              icon="users"
              iconColor="#2E96EF"
            />
            <StatCard
              title={language === "bn" ? "সক্রিয় (২৪ঘ)" : "Active (24h)"}
              value={stats?.activeUsers24h || 0}
              icon="activity"
              iconColor="#00BB77"
            />
            <StatCard
              title={language === "bn" ? "মোট পোস্ট" : "Total Posts"}
              value={stats?.totalPosts || 0}
              icon="file-text"
              iconColor="#3D38D0"
            />
            <StatCard
              title={language === "bn" ? "রিপোর্ট" : "Reports"}
              value={stats?.openReports || 0}
              icon="flag"
              iconColor="#DA2F2F"
            />
          </>
        )}
      </View>

      <AdminCard
        title={language === "bn" ? "দ্রুত টগল" : "Quick Toggles"}
        icon="sliders"
      >
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Feather name="tool" size={18} color={appSettings?.maintenanceMode ? "#DA2F2F" : theme.textSecondary} />
            <ThemedText style={{ color: theme.text, marginLeft: Spacing.sm }}>
              {language === "bn" ? "মেইনটেনেন্স মোড" : "Maintenance Mode"}
            </ThemedText>
          </View>
          <Switch
            value={appSettings?.maintenanceMode || false}
            onValueChange={handleToggleMaintenance}
            trackColor={{ false: theme.divider, true: "#DA2F2F50" }}
            thumbColor={appSettings?.maintenanceMode ? "#DA2F2F" : theme.textSecondary}
          />
        </View>
      </AdminCard>

      <AdminCard
        title={language === "bn" ? "ফিচার ফ্ল্যাগ" : "Feature Flags"}
        icon="toggle-left"
      >
        {["chatEnabled", "marketplaceEnabled", "commentsEnabled", "uploadsEnabled"].map((feature) => (
          <View key={feature} style={styles.toggleRow}>
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {feature === "chatEnabled" && (language === "bn" ? "চ্যাট" : "Chat")}
              {feature === "marketplaceEnabled" && (language === "bn" ? "মার্কেটপ্লেস" : "Marketplace")}
              {feature === "commentsEnabled" && (language === "bn" ? "মন্তব্য" : "Comments")}
              {feature === "uploadsEnabled" && (language === "bn" ? "আপলোড" : "Uploads")}
            </ThemedText>
            <Switch
              value={appSettings?.featureFlags?.[feature as keyof AppSettings["featureFlags"]] || false}
              onValueChange={() => handleToggleFeature(feature as keyof AppSettings["featureFlags"])}
              trackColor={{ false: theme.divider, true: theme.primary + "50" }}
              thumbColor={appSettings?.featureFlags?.[feature as keyof AppSettings["featureFlags"]] ? theme.primary : theme.textSecondary}
            />
          </View>
        ))}
      </AdminCard>
    </ScrollView>
  );

  const renderUsersTab = () => (
    <View style={styles.tabContent}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={language === "bn" ? "নাম বা ইমেইল খুঁজুন..." : "Search by name or email..."}
      />
      <FilterChips
        options={[
          { id: "all", label: language === "bn" ? "সব" : "All", count: users.length },
          { id: "verified", label: language === "bn" ? "ভেরিফাইড" : "Verified" },
          { id: "unverified", label: language === "bn" ? "আনভেরিফাইড" : "Unverified" },
          { id: "admin", label: language === "bn" ? "অ্যাডমিন" : "Admin" },
        ]}
        selected={userFilter}
        onSelect={setUserFilter}
      />

      {isLoading && users.length === 0 ? (
        <View style={{ marginTop: Spacing.md }}>
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
        </View>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon="users"
          title={language === "bn" ? "কোনো ব্যবহারকারী নেই" : "No users found"}
          message={language === "bn" ? "আপনার অনুসন্ধানে কোনো ব্যবহারকারী পাওয়া যায়নি" : "No users match your search criteria"}
        />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.userRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={[styles.userAvatar, { backgroundColor: theme.primary + "20" }]}>
                <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
                  {item.name?.substring(0, 2).toUpperCase() || "??"}
                </ThemedText>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <ThemedText type="body" style={{ color: theme.text, fontWeight: "500" }}>
                    {item.name || item.email.split("@")[0]}
                  </ThemedText>
                  {item.verified && (
                    <Feather name="check-circle" size={14} color="#00BB77" style={{ marginLeft: 4 }} />
                  )}
                  {item.isSuperAdmin && (
                    <View style={[styles.adminBadge, { backgroundColor: "#DA2F2F20" }]}>
                      <ThemedText style={{ color: "#DA2F2F", fontSize: 10 }}>Admin</ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {item.email}
                </ThemedText>
              </View>
              <Pressable
                testID={`manage-user-${item.id}`}
                style={[styles.actionButton, { backgroundColor: theme.primary + "20", marginRight: 6 }]}
                onPress={() => setManageUserId(item.id)}
              >
                <Feather name="sliders" size={16} color={theme.primary} />
              </Pressable>
              {!item.isSuperAdmin && (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: item.status === "banned" ? "#00BB7720" : "#DA2F2F20" }]}
                  onPress={() => {
                    setConfirmModal({
                      visible: true,
                      title: item.status === "banned" ? "আনব্যান করুন" : "ব্যান করুন",
                      message: `আপনি কি ${item.name || item.email} কে ${item.status === "banned" ? "আনব্যান" : "ব্যান"} করতে চান?`,
                      confirmColor: item.status === "banned" ? "#00BB77" : "#DA2F2F",
                      onConfirm: () => {
                        handleBanUser(item.id, item.status === "banned" ? "unban" : "ban");
                        setConfirmModal({ ...confirmModal, visible: false });
                      },
                    });
                  }}
                >
                  <AppIcon
                    name={item.status === "banned" ? "user-check" : "user-x"}
                    size={16}
                    color={item.status === "banned" ? "#00BB77" : "#DA2F2F"}
                  />
                </Pressable>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );

  const renderAnnouncementsTab = () => (
    <ScrollView style={styles.tabContent}>
      <AdminCard
        title={language === "bn" ? "নতুন ঘোষণা" : "New Announcement"}
        icon="bell"
      >
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.divider }]}
          placeholder={language === "bn" ? "শিরোনাম" : "Title"}
          placeholderTextColor={theme.textSecondary}
          value={newAnnouncement.title}
          onChangeText={(text) => setNewAnnouncement({ ...newAnnouncement, title: text })}
        />
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.divider }]}
          placeholder={language === "bn" ? "বার্তা" : "Message"}
          placeholderTextColor={theme.textSecondary}
          value={newAnnouncement.message}
          onChangeText={(text) => setNewAnnouncement({ ...newAnnouncement, message: text })}
          multiline
          numberOfLines={3}
        />
        <View style={styles.typeSelector}>
          {(["info", "warning", "success"] as const).map((type) => (
            <Pressable
              key={type}
              style={[
                styles.typeButton,
                {
                  backgroundColor: newAnnouncement.type === type ? theme.primary : theme.backgroundDefault,
                  borderColor: theme.divider,
                },
              ]}
              onPress={() => setNewAnnouncement({ ...newAnnouncement, type })}
            >
              <AppIcon
                name={type === "info" ? "info" : type === "warning" ? "alert-triangle" : "check-circle"}
                size={16}
                color={newAnnouncement.type === type ? "#FFF" : theme.text}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleCreateAnnouncement}
        >
          <ThemedText style={{ color: "#FFF", fontWeight: "600" }}>
            {language === "bn" ? "ঘোষণা তৈরি করুন" : "Create Announcement"}
          </ThemedText>
        </Pressable>
      </AdminCard>

      <AdminCard
        title={language === "bn" ? "সাম্প্রতিক ঘোষণা" : "Recent Announcements"}
        icon="list"
      >
        {announcements.length === 0 ? (
          <EmptyState
            icon="bell-off"
            title={language === "bn" ? "কোনো ঘোষণা নেই" : "No announcements"}
          />
        ) : (
          announcements.map((announcement) => (
            <View key={announcement.id} style={[styles.announcementItem, { borderColor: theme.divider }]}>
              <View style={styles.announcementHeader}>
                <AppIcon
                  name={announcement.type === "info" ? "info" : announcement.type === "warning" ? "alert-triangle" : "check-circle"}
                  size={16}
                  color={announcement.type === "info" ? "#2E96EF" : announcement.type === "warning" ? "#B25E09" : "#00BB77"}
                />
                <ThemedText style={{ color: theme.text, fontWeight: "500", marginLeft: Spacing.sm, flex: 1 }}>
                  {announcement.title}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {announcement.message}
              </ThemedText>
            </View>
          ))
        )}
      </AdminCard>
    </ScrollView>
  );

  const renderLogsTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <AdminCard
        title={language === "bn" ? "অডিট লগ" : "Audit Logs"}
        icon="activity"
        subtitle={language === "bn" ? "সর্বশেষ ৫০টি অ্যাকশন" : "Last 50 actions"}
      >
        {logs.length === 0 ? (
          <EmptyState
            icon="file-text"
            title={language === "bn" ? "কোনো লগ নেই" : "No logs yet"}
          />
        ) : (
          logs.map((log) => (
            <View key={log.id} style={[styles.logItem, { borderColor: theme.divider }]}>
              <View style={styles.logHeader}>
                <ThemedText style={{ color: theme.text, fontWeight: "500", fontSize: 13 }}>
                  {log.action}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {new Date(log.createdAt).toLocaleString("bn-BD")}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {log.adminEmail} → {log.targetType}
                {log.targetId ? ` (${log.targetId.substring(0, 8)}...)` : ""}
              </ThemedText>
              {log.details && (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {log.details}
                </ThemedText>
              )}
            </View>
          ))
        )}
      </AdminCard>
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <ScrollView style={styles.tabContent}>
      <AdminCard
        title={language === "bn" ? "অ্যাপ সেটিংস" : "App Settings"}
        icon="settings"
      >
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Feather name="tool" size={18} color={theme.textSecondary} />
            <View style={{ marginLeft: Spacing.sm }}>
              <ThemedText style={{ color: theme.text }}>
                {language === "bn" ? "মেইনটেনেন্স মোড" : "Maintenance Mode"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {language === "bn" ? "সব ব্যবহারকারী ব্লক হবে" : "All users will be blocked"}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={appSettings?.maintenanceMode || false}
            onValueChange={handleToggleMaintenance}
            trackColor={{ false: theme.divider, true: "#DA2F2F50" }}
            thumbColor={appSettings?.maintenanceMode ? "#DA2F2F" : theme.textSecondary}
          />
        </View>

        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.divider, marginTop: Spacing.md }]}
          placeholder={language === "bn" ? "মেইনটেনেন্স বার্তা" : "Maintenance Message"}
          placeholderTextColor={theme.textSecondary}
          value={appSettings?.maintenanceMessage || ""}
          onChangeText={(text) => appSettings && setAppSettings({ ...appSettings, maintenanceMessage: text })}
          multiline
          numberOfLines={2}
        />
      </AdminCard>

      <AdminCard
        title={language === "bn" ? "ফিচার কন্ট্রোল" : "Feature Control"}
        icon="toggle-left"
      >
        {[
          { key: "chatEnabled", label: language === "bn" ? "চ্যাট সিস্টেম" : "Chat System", icon: "message-circle" },
          { key: "marketplaceEnabled", label: language === "bn" ? "মার্কেটপ্লেস" : "Marketplace", icon: "shopping-bag" },
          { key: "commentsEnabled", label: language === "bn" ? "মন্তব্য" : "Comments", icon: "message-square" },
          { key: "uploadsEnabled", label: language === "bn" ? "মিডিয়া আপলোড" : "Media Uploads", icon: "upload" },
        ].map((feature) => (
          <View key={feature.key} style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <AppIcon name={feature.icon as any} size={18} color={theme.textSecondary} />
              <ThemedText style={{ color: theme.text, marginLeft: Spacing.sm }}>
                {feature.label}
              </ThemedText>
            </View>
            <Switch
              value={appSettings?.featureFlags?.[feature.key as keyof AppSettings["featureFlags"]] || false}
              onValueChange={() => handleToggleFeature(feature.key as keyof AppSettings["featureFlags"])}
              trackColor={{ false: theme.divider, true: theme.primary + "50" }}
              thumbColor={appSettings?.featureFlags?.[feature.key as keyof AppSettings["featureFlags"]] ? theme.primary : theme.textSecondary}
            />
          </View>
        ))}
      </AdminCard>
    </ScrollView>
  );

  const renderContentTab = () => (
    <View style={styles.tabContent}>
      {isLoading && adminPosts.length === 0 ? (
        <View style={{ marginTop: Spacing.md }}>
          <UserRowSkeleton />
          <UserRowSkeleton />
        </View>
      ) : adminPosts.length === 0 ? (
        <EmptyState
          icon="file-text"
          title={language === "bn" ? "কোনো পোস্ট নেই" : "No posts yet"}
          message={language === "bn" ? "কমিউনিটিতে পোস্ট হলে এখানে দেখা যাবে" : "Community posts will show up here for review"}
        />
      ) : (
        <FlatList
          data={adminPosts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: Spacing.xl }}
          renderItem={({ item }) => (
            <View style={[styles.userRow, { backgroundColor: theme.card, borderColor: theme.cardBorder, alignItems: "flex-start" }]}>
              <View style={[styles.userInfo, { flex: 1, minWidth: 0 }]}>
                <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }} numberOfLines={1}>
                  {item.authorName || item.authorEmail || "Unknown"}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.text, marginTop: 4 }} numberOfLines={4}>
                  {item.content || (language === "bn" ? "(শুধু ছবি)" : "(media only)")}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => deletePost(item.id)}
                hitSlop={8}
                style={{ padding: 8, borderRadius: 8, backgroundColor: "#DA2F2F15", marginLeft: 8 }}
                accessibilityLabel="Delete post"
              >
                <Feather name="trash-2" size={18} color="#DA2F2F" />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );

  const bn = language === "bn";
  const SERIES: { key: "users" | "posts" | "orders" | "products"; label: string; color: string }[] = [
    { key: "users", label: bn ? "নতুন ব্যবহারকারী" : "New users", color: "#2E96EF" },
    { key: "posts", label: bn ? "নতুন পোস্ট" : "New posts", color: "#00BB77" },
    { key: "orders", label: bn ? "অর্ডার" : "Orders", color: "#B25E09" },
    { key: "products", label: bn ? "নতুন পণ্য" : "New products", color: "#3D38D0" },
  ];

  const renderBarChart = (key: "users" | "posts" | "orders" | "products", label: string, color: string) => {
    const series: any[] = analytics?.series || [];
    const max = Math.max(1, ...series.map((d) => d[key] || 0));
    const sum = series.reduce((n, d) => n + (d[key] || 0), 0);
    return (
      <AdminCard key={key} title={`${label} · ${bn ? "১৪ দিনে" : "last 14 days"}: ${sum}`} icon="bar-chart-2">
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 3 }} accessibilityLabel={`${label} chart`}>
          {series.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              {d[key] ? (
                <ThemedText style={{ fontSize: 9, lineHeight: 12, color: theme.textSecondary }}>{d[key]}</ThemedText>
              ) : null}
              <View
                style={{
                  width: "80%",
                  height: Math.max(2, ((d[key] || 0) / max) * 90),
                  backgroundColor: d[key] ? color : theme.border || "#E5E7EB",
                  borderRadius: 3,
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <ThemedText style={{ fontSize: 11, lineHeight: 14, color: theme.textSecondary }}>{series[0]?.date?.slice(5) || ""}</ThemedText>
          <ThemedText style={{ fontSize: 11, lineHeight: 14, color: theme.textSecondary }}>{series[series.length - 1]?.date?.slice(5) || ""}</ThemedText>
        </View>
      </AdminCard>
    );
  };

  const renderAnalyticsError = () =>
    analyticsError ? (
      <EmptyState
        icon="alert-circle"
        title={bn ? "ডেটা লোড হয়নি" : "Couldn't load analytics"}
        message={analyticsError}
      />
    ) : null;

  const renderReportsTab = () => {
    const tt = analytics?.totals || {};
    const rows: [string, string | number][] = [
      [bn ? "মোট ব্যবহারকারী" : "Total users", tt.users ?? stats?.totalUsers ?? 0],
      [bn ? "মোট পোস্ট" : "Total posts", tt.posts ?? stats?.totalPosts ?? 0],
      [bn ? "মন্তব্য" : "Comments", tt.comments ?? 0],
      [bn ? "সরাসরি বার্তা" : "Direct messages", tt.messages ?? 0],
      [bn ? "অর্ডার" : "Orders", tt.orders ?? 0],
      [bn ? "অর্ডারের মোট মূল্য" : "Order value", `৳${Math.round(tt.revenue || 0).toLocaleString()}`],
      [bn ? "বাজারের পণ্য" : "Market listings", tt.products ?? 0],
      [bn ? "বিশেষজ্ঞ" : "Experts", tt.experts ?? 0],
      [bn ? "ইভেন্ট" : "Events", tt.events ?? 0],
    ];
    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
        {renderAnalyticsError()}
        <AdminCard title={bn ? "অ্যাপ রিপোর্ট" : "App report"} icon="file-text">
          {rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: Spacing.md }}>
              <ThemedText style={{ flex: 1, color: theme.textSecondary }}>{k}</ThemedText>
              <ThemedText style={{ fontWeight: "700" }}>{String(v)}</ThemedText>
            </View>
          ))}
        </AdminCard>
        <AdminCard title={bn ? "ভূমিকা অনুযায়ী ব্যবহারকারী" : "Users by role"} icon="users">
          {(analytics?.roles || []).map((r: any) => (
            <View key={r.role} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: Spacing.md }}>
              <ThemedText style={{ flex: 1, color: theme.textSecondary }}>{r.role}</ThemedText>
              <ThemedText style={{ fontWeight: "700" }}>{r.count}</ThemedText>
            </View>
          ))}
        </AdminCard>
        <AdminCard title={bn ? "সাম্প্রতিক অর্ডার" : "Recent orders"} icon="shopping-cart">
          {(analytics?.recentOrders || []).length === 0 ? (
            <ThemedText style={{ color: theme.textSecondary }}>{bn ? "এখনও কোনো অর্ডার নেই" : "No orders yet"}</ThemedText>
          ) : (
            (analytics?.recentOrders || []).map((o: any) => (
              <View key={o.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: Spacing.md }}>
                <ThemedText style={{ flex: 1, color: theme.textSecondary }} numberOfLines={1}>
                  {String(o.createdAt).slice(0, 16).replace("T", " ")} · {o.itemCount} {bn ? "টি পণ্য" : "items"} · {o.paymentMethod || "-"}
                </ThemedText>
                <ThemedText style={{ fontWeight: "700" }}>৳{Math.round(o.total).toLocaleString()}</ThemedText>
              </View>
            ))
          )}
        </AdminCard>
      </ScrollView>
    );
  };

  const renderAnalyticsTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
      {renderAnalyticsError()}
      <AdminCard title={bn ? "সংক্ষিপ্ত পরিসংখ্যান" : "Quick Stats"} icon="bar-chart-2">
        <View style={styles.statsGrid}>
          <StatCard
            title={bn ? "মোট অর্ডার" : "Total Orders"}
            value={analytics?.totals?.orders ?? 0}
            icon="shopping-cart"
            iconColor="#B25E09"
          />
          <StatCard
            title={bn ? "বাজারের পণ্য" : "Market listings"}
            value={analytics?.totals?.products ?? 0}
            icon="package"
            iconColor="#3D38D0"
          />
        </View>
      </AdminCard>
      {analytics ? SERIES.map((x) => renderBarChart(x.key, x.label, x.color)) : null}
    </ScrollView>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "users":
        return renderUsersTab();
      case "content":
        return renderContentTab();
      case "reports":
        return renderReportsTab();
      case "announcements":
        return renderAnnouncementsTab();
      case "settings":
        return renderSettingsTab();
      case "analytics":
        return renderAnalyticsTab();
      case "logs":
        return renderLogsTab();
      case "orders":
        return <AdminOrdersTab />;
      case "stores":
        return <AdminStoresTab />;
      case "listings":
        return <AdminCatalogTab />;
      case "notify":
        return <AdminNotifyTab />;
      case "delivery":
        return <AdminDeliveryTab />;
      default:
        return renderOverviewTab();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} edges={["top"]}>
      <AdminToast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
      />

      <View style={[styles.header, { borderBottomColor: theme.divider }]}>
        <Pressable onPress={() => (navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate("AdminApp"))} hitSlop={8} testID="classic-back" accessibilityRole="button" accessibilityLabel={language === "bn" ? "পিছনে" : "Back"}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text, marginLeft: Spacing.md }}>
          {language === "bn" ? "কন্ট্রোল টাওয়ার" : "Control Tower"}
        </ThemedText>
        {isLoading && <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: "auto" }} />}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: theme.backgroundDefault }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[
                styles.tab,
                isActive && { backgroundColor: theme.primary + "15" },
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <AppIcon
                name={tab.icon}
                size={18}
                color={isActive ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.primary : theme.textSecondary },
                ]}
              >
                {language === "bn" ? tab.labelBn : tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {renderActiveTab()}
      {manageUserId ? (
        <AdminUserSheet userId={manageUserId} onClose={() => setManageUserId(null)} onChanged={async () => { const t = await getToken(); if (t) loadUsers(t); }} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  tabBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  tabContent: {
    flex: 1,
    padding: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  announcementItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  announcementHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  logItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
