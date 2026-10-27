import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";
import { fetchServerPost } from "@/lib/feedApi";
import { refreshUnreadCounts, useUnreadCounts } from "@/lib/liveStatus";
import { AppIcon } from "@/components/icons/AppIcon";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { Page, Text, Btn, Empty, ErrorBox, Loading, Segmented, shadow, st, useAdminNav, useL, fmtDate } from "./ui";

/**
 * Admin notifications (the bell on the admin Home header). It lists the signed-in admin's own
 * notifications from /api/me/notifications: new Support messages from users, chat messages,
 * orders and anything else the server sends this account. The server only ever returns the
 * caller's own rows, so one admin never sees another person's notifications.
 */

type N = { id: string; type: string; title: string; body: string; data: any; read: boolean; createdAt: string };

const COLOR: Record<string, string> = {
  support: "#00BB77", message: "#2E96EF", order: "#B25E09", moderation: "#DA2F2F", official: "#1F86DB", admin: "#B25E09",
  follow: "#3D38D0", like: "#FF4BB7", comment: "#2E96EF", new_post: "#39B1FE", store: "#3D38D0", review: "#B25E09",
};
const ICON: Record<string, string> = {
  order: "package", moderation: "shield", official: "award", admin: "bell", follow: "user-plus", like: "heart",
  new_post: "file-text", store: "shopping-bag", review: "star", reminder: "clock", price: "trending-up", answer: "help-circle", rfq: "file",
};

export function useAdminBellCount() {
  return useUnreadCounts((s) => s.notifications);
}

/** "5 min ago" style time, in the admin's language. */
function ago(isoS: string, L: ReturnType<typeof useL>) {
  const t = new Date(isoS).getTime();
  if (isNaN(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return L("Just now", "এইমাত্র");
  if (m < 60) return L(`${m} min ago`, `${m} মিনিট আগে`);
  const h = Math.round(m / 60);
  if (h < 24) return L(`${h} h ago`, `${h} ঘণ্টা আগে`);
  const d = Math.round(h / 24);
  if (d < 7) return L(`${d} d ago`, `${d} দিন আগে`);
  return fmtDate(isoS, false);
}

/** The server writes titles in English; the common ones read in Bangla too. */
function titleOf(n: N, L: ReturnType<typeof useL>) {
  let m = /^Help request from (.+)$/.exec(n.title);
  if (m) return L(`New Support message from ${m[1]}`, `${m[1]} সাপোর্টে মেসেজ পাঠিয়েছেন`);
  m = /^Message from (.+)$/.exec(n.title);
  if (m) return L(n.title, `${m[1]}-এর মেসেজ`);
  const fixed: Record<string, string> = {
    "New order": "নতুন অর্ডার", "Order placed": "অর্ডার দেওয়া হয়েছে", "Order cancelled": "অর্ডার বাতিল",
    "Farmers Support replied": "Farmers সাপোর্ট উত্তর দিয়েছে", "New follower": "নতুন ফলোয়ার", "New review": "নতুন রিভিউ",
  };
  return fixed[n.title] ? L(n.title, fixed[n.title]) : n.title;
}

export function NotificationsScreen() {
  const nav = useAdminNav();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const L = useL();
  const count = useAdminBellCount();
  const [list, setList] = useState<N[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ notifications: N[] }>("/api/me/notifications");
      if (!alive.current) return;
      setList(Array.isArray(r?.notifications) ? r.notifications : []);
      setError(null);
    } catch (e: any) {
      if (alive.current) setError(e?.message || L("Couldn't load notifications", "নোটিফিকেশন আনা যায়নি"));
    }
  }, [L]);

  useEffect(() => { load(); }, [load]);
  // A new notification moves the bell count (live, or the 20 s check in useLiveStatus): bring the list up to date with it.
  const lastCount = useRef(count);
  useEffect(() => {
    if (count !== lastCount.current) { lastCount.current = count; load(); }
  }, [count, load]);
  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const markRead = (ids: string[] | "all") => {
    setList((p) => (p ? p.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)) : p));
    const u = useUnreadCounts.getState();
    if (ids === "all") u.set({ notifications: 0 });
    else {
      const fresh = (list || []).filter((n) => ids.includes(n.id) && !n.read).length;
      if (fresh) u.set({ notifications: Math.max(0, u.notifications - fresh) });
    }
    lastCount.current = useUnreadCounts.getState().notifications;
    apiPost("/api/me/notifications/read", ids === "all" ? { all: true } : { ids }).then(() => refreshUnreadCounts()).catch(() => {});
  };

  const open = (n: N) => {
    if (!n.read) markRead([n.id]);
    const d = n.data || {};
    if (n.type === "support" && d.supportThreadId && d.screen !== "Support") return nav.push({ name: "thread", id: String(d.supportThreadId) });
    if (d.orderId) return nav.push({ name: "order", id: String(d.orderId) });
    if (n.type === "message" && d.userId)
      return navigation.navigate("Chat", { conversationId: d.userId, userName: d.userName || n.title.replace(/^Message from /, ""), userInitials: "" });
    if (d.postId) {
      fetchServerPost(String(d.postId), useI18n.getState().language === "bn", useAuthStore.getState().getToken())
        .then((post) => navigation.navigate("PostDetail", { postId: post.id, post: post as any }))
        .catch(() => {});
      return;
    }
    if (d.userId) return nav.push({ name: "user", id: String(d.userId) });
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); refreshUnreadCounts(); };
  const unread = (list || []).filter((n) => !n.read).length;
  const shown = (list || []).filter((n) => filter === "all" || !n.read);

  return (
    <Page onRefresh={onRefresh} refreshing={refreshing} testID="admin-notifications">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Segmented
            testID="notif-filter"
            value={filter}
            onChange={setFilter}
            options={[{ value: "all", label: L("All", "সব") }, { value: "unread", label: L("Unread", "অপঠিত"), count: unread }]}
          />
        </View>
        {unread ? <Btn small kind="soft" icon="check-circle" testID="notif-read-all" label={L("Mark all read", "সব পঠিত")} onPress={() => markRead("all")} /> : null}
      </View>
      {error && !list ? <ErrorBox text={error} onRetry={load} /> : null}
      {!list && !error ? <Loading rows={4} /> : null}
      {list && !shown.length ? (
        <Empty icon="bell" text={filter === "unread" ? L("You're all caught up.", "সব পড়া হয়ে গেছে।") : L("No notifications yet. New Support messages and other alerts show up here.", "এখনো কোনো নোটিফিকেশন নেই। নতুন সাপোর্ট মেসেজ ও অন্য সতর্কতা এখানে দেখাবে।")} />
      ) : null}
      {shown.map((n) => {
        const c = COLOR[n.type] || theme.primary;
        const chat = n.type === "support" || n.type === "message" || n.type === "comment";
        return (
          <Pressable
            key={n.id}
            testID={`notif-${n.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${n.read ? "" : L("Unread. ", "অপঠিত। ")}${titleOf(n, L)}. ${n.body}`}
            onPress={() => open(n)}
            style={({ pressed }) => [
              st.card,
              shadow(isDark),
              { backgroundColor: n.read ? theme.card : theme.primary + (isDark ? "26" : "12"), flexDirection: "row", alignItems: "flex-start", gap: 12, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c + "1F", alignItems: "center", justifyContent: "center" }}>
              {chat ? <ChatIcon size={20} color={c} /> : <AppIcon name={(ICON[n.type] || "bell") as any} size={19} color={c} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, color: theme.text, fontSize: 14.5, fontWeight: n.read ? "600" : "800" }} numberOfLines={2}>{titleOf(n, L)}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11.5 }}>{ago(n.createdAt, L)}</Text>
              </View>
              {n.body ? <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>{n.body}</Text> : null}
            </View>
            {!n.read ? <View testID="notif-unread-dot" style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary, marginTop: 6 }} /> : null}
          </Pressable>
        );
      })}
    </Page>
  );
}
