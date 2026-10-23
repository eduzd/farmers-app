import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/authStore";
import { getApiUrl } from "@/lib/query-client";
import { fetchServerPost } from "@/lib/feedApi";
import { refreshUnreadCounts } from "@/lib/liveStatus";
import {
  NotifPayload, NotifTarget, chatParams, cleanId, isAllowedTarget, localTarget, profileUser,
} from "@/lib/notificationTarget";

/**
 * Opens one notification at its source. Shown for a moment while it checks with the server, then
 * replaced by the post (scrolled to the comment), the order, the chat, the profile... If the thing
 * is gone or isn't this account's, it says so here instead of opening an empty or wrong screen.
 * Notices (warnings, announcements) with no page of their own are shown here in full.
 */
type Problem = { kind: "missing" | "forbidden" | "offline"; what?: string };

export default function NotificationOpenScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const bn = useI18n((s) => s.language) === "bn";
  const L = (en: string, b: string) => (bn ? b : en);
  const payload: NotifPayload = route.params?.payload || {};
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<NotifPayload | null>(null);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);

  const hasRoute = (name: string) => (navigation.getState()?.routeNames || []).includes(name);

  const go = useCallback(
    async (t: NotifTarget, info: NotifPayload, opts: { commentMissing?: boolean } = {}) => {
      const p = t.params || {};
      const replace = (name: string, params?: any) => {
        if (done.current) return;
        done.current = true;
        navigation.replace(name, params);
      };
      switch (t.screen) {
        case "PostDetail": {
          const postId = cleanId(p.postId);
          if (!postId) return setProblem({ kind: "missing", what: "post" });
          try {
            const post = await fetchServerPost(postId, bn, useAuthStore.getState().getToken());
            const commentId = cleanId(p.commentId);
            return replace("PostDetail", {
              postId: post.id, post,
              ...(commentId ? { highlightCommentId: commentId } : {}),
              ...(p.toComments ? { scrollToComments: true } : {}),
              ...(opts.commentMissing || p.commentMissing ? { commentMissing: true } : {}),
            });
          } catch (e: any) {
            return setProblem(String(e?.message || "").includes("404") ? { kind: "missing", what: "post" } : { kind: "offline" });
          }
        }
        case "OrderDetail":
          return cleanId(p.orderId) ? replace("OrderDetail", { orderId: cleanId(p.orderId) }) : setProblem({ kind: "missing", what: "order" });
        case "Chat":
          return cleanId(p.userId) ? replace("Chat", chatParams(p)) : setProblem({ kind: "missing", what: "user" });
        case "UserProfile":
          if (p.user?.id) return replace("UserProfile", { user: profileUser(p.user) });
          if (cleanId(p.userId)) return replace("UserProfile", { user: profileUser({ id: cleanId(p.userId), name: p.userName }) });
          return setProblem({ kind: "missing", what: "user" });
        case "AdminApp":
          return hasRoute("AdminApp") ? replace("AdminApp", cleanId(p.openThread) ? { openThread: cleanId(p.openThread) } : undefined) : setProblem({ kind: "forbidden", what: "admin" });
        case "OfficialChat":
          if (hasRoute("OfficialChat")) return replace("OfficialChat", { account: cleanId(p.account) || "official" });
          return setNotice(info);
        case "Notice":
          if (hasRoute("NoticeDetail") && info.id) return replace("NoticeDetail", { notificationId: info.id, preview: info });
          return setNotice(info);
        default:
          if (isAllowedTarget(t) && hasRoute(t.screen)) return replace(t.screen);
          return setNotice(info);
      }
    },
    [bn, navigation],
  );

  useEffect(() => {
    let alive = true;
    done.current = false;
    setProblem(null);
    (async () => {
      const id = cleanId(payload.id);
      const token = useAuthStore.getState().getToken();
      // A tap on a phone push hasn't been marked read yet (the list marks its own taps).
      if (id && token && !route.params?.markedRead) {
        fetch(`${getApiUrl()}/api/me/notifications/read`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: [id] }),
        }).then(() => refreshUnreadCounts()).catch(() => {});
      }
      if (id && token) {
        try {
          const r = await fetch(`${getApiUrl()}/api/me/notifications/${encodeURIComponent(id)}/target`, { headers: { Authorization: `Bearer ${token}` } });
          if (!alive) return;
          if (r.status === 404) return setProblem({ kind: "missing", what: "notification" });
          if (r.ok) {
            const out = await r.json();
            const info: NotifPayload = { ...payload, ...(out.notification || {}), data: payload.data };
            if (out.status === "forbidden") return setProblem({ kind: "forbidden", what: out.what });
            if (out.status === "missing") {
              // A deleted comment still opens its post, with a note that the comment is gone.
              if (out.what === "comment" && isAllowedTarget(out.target)) return go(out.target, info, { commentMissing: true });
              return setProblem({ kind: "missing", what: out.what });
            }
            if (isAllowedTarget(out.target)) return go(out.target, info);
            return setNotice(info);
          }
          // Older server without the target check, or a server error: fall back to the notification's own data.
        } catch {
          // Offline: try the notification's own data below.
        }
      }
      if (!alive) return;
      const t = localTarget(payload);
      if (t) return go(t, payload);
      setNotice(payload);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace("Notifications"));

  if (notice) {
    const when = notice.createdAt ? new Date(notice.createdAt) : null;
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScrollView testID="notification-notice" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + "1A", alignItems: "center", justifyContent: "center" }}>
              <Feather name={notice.type === "warning" || notice.type === "moderation" ? "alert-triangle" : "bell"} size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontSize: 18, fontWeight: "800" }}>{notice.title || L("Notification", "নোটিফিকেশন")}</ThemedText>
              {when && !isNaN(when.getTime()) ? (
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{when.toLocaleString(bn ? "bn-BD" : "en-GB")}</ThemedText>
              ) : null}
            </View>
          </View>
          {notice.body ? <ThemedText testID="notification-notice-body" selectable style={{ fontSize: 15, lineHeight: 23 }}>{notice.body}</ThemedText> : null}
        </ScrollView>
      </ThemedView>
    );
  }

  if (problem) {
    const what = problem.what || "";
    const msg =
      problem.kind === "offline"
        ? [L("Couldn't open this", "খোলা যায়নি"), L("Check your internet connection and try again.", "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।")]
        : problem.kind === "forbidden"
          ? [L("Not available on this account", "এই অ্যাকাউন্টে দেখা যাবে না"),
             what === "admin" ? L("Only Farmers admins can open this.", "শুধু ফার্মার্স অ্যাডমিনরা এটি খুলতে পারেন।") : L("This order belongs to another account.", "এই অর্ডারটি অন্য অ্যাকাউন্টের।")]
          : what === "post" ? [L("This post was removed", "পোস্টটি সরানো হয়েছে"), L("The post this notification was about isn't there anymore.", "এই নোটিফিকেশনের পোস্টটি আর নেই।")]
          : what === "order" ? [L("Order not found", "অর্ডার পাওয়া যায়নি"), L("This order isn't there anymore.", "এই অর্ডারটি আর নেই।")]
          : what === "user" ? [L("Account not found", "অ্যাকাউন্ট পাওয়া যায়নি"), L("This person's account isn't there anymore.", "এই ব্যক্তির অ্যাকাউন্টটি আর নেই।")]
          : [L("Notification not found", "নোটিফিকেশন পাওয়া যায়নি"), L("It may have been deleted.", "এটি হয়তো মুছে ফেলা হয়েছে।")];
    return (
      <ThemedView testID="notification-problem" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 }}>
        <Feather name={problem.kind === "offline" ? "wifi-off" : problem.kind === "forbidden" ? "lock" : "slash"} size={36} color={theme.textSecondary} />
        <ThemedText style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>{msg[0]}</ThemedText>
        <ThemedText style={{ color: theme.textSecondary, textAlign: "center" }}>{msg[1]}</ThemedText>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          {problem.kind === "offline" ? (
            <Pressable testID="notification-retry" onPress={() => setAttempt((a) => a + 1)} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: theme.primary }}>
              <ThemedText style={{ color: "#fff", fontWeight: "700" }}>{L("Try again", "আবার চেষ্টা করুন")}</ThemedText>
            </Pressable>
          ) : null}
          <Pressable testID="notification-back" onPress={back} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: theme.backgroundSecondary }}>
            <ThemedText style={{ fontWeight: "700" }}>{L("Back", "ফিরে যান")}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView testID="notification-opening" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText style={{ color: theme.textSecondary }}>{L("Opening…", "খোলা হচ্ছে…")}</ThemedText>
    </ThemedView>
  );
}
