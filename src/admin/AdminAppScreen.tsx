import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable, BackHandler, Platform, StyleSheet, Animated, Easing } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/lib/authStore";
import { apiGet } from "@/lib/api";
import { AdminNav, Route, TabName, ShopSection, useL, Btn, Text, shadow } from "./ui";
import { SearchScreen, OfficialScreen, AdsScreen, AdForm } from "./power";
import { Image } from "expo-image";
import { FontFamily } from "@/constants/theme";
import { ShopTab, ProductDetail, ProductForm, StoreDetail, StoreForm, CategoryForm } from "./shop";
import { HomeTab, OrdersTab, OrderDetail, SupportTab, ThreadView, UsersList, UserDetail, MoreTab } from "./ops";

import { ChatIcon } from "@/components/icons/ChatIcon";
import { AppIcon } from "@/components/icons/AppIcon";
import { HomeIcon } from "@/components/icons/HomeIcon";
import { useThemeStore } from "@/lib/themeStore";
import { useLiveStatus, refreshUnreadCounts } from "@/lib/liveStatus";
import { apiPost } from "@/lib/api";
import { NotificationsScreen, useAdminBellCount } from "./notifications";
/**
 * Farmers Admin app: its own bottom navigation (Home, Shop, Orders, Support, More) over the
 * shared backend. Every call goes to /api/admin/manage/*, which the server checks for an
 * admin account on each request; this screen's own guard is only for a friendly message.
 */
/** Smooth fade + slight rise whenever the tab or the open screen changes. */
function FadeIn({ children }: { children: React.ReactNode }) {
  const a = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a]);
  return (
    <Animated.View style={{ flex: 1, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

export default function AdminAppScreen() {
  const { theme, isDark } = useTheme();
  const setThemePref = useThemeStore((x) => x.setPreference);
  const insets = useSafeAreaInsets();
  const L = useL();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user) as any;
  const logout = useAuthStore((s) => s.logout);
  const [tab, setTab] = useState<TabName>("home");
  const [shopSection, setShopSection] = useState<ShopSection>("products");
  const [stack, setStack] = useState<Route[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  // Sign-in puts the admin flag on the store (from the server's /login, Firebase exchange and /me),
  // not on the saved user object, so read the store first. Only hides UI: every /api/admin/manage
  // call is still checked on the server.
  const storeAdmin = useAuthStore((s) => s.isSuperAdmin);
  const isAdmin = storeAdmin || !!user?.isSuperAdmin;
  // Online beat while the admin app is open (the main tabs do this for the app; the admin app never mounted it),
  // so users see Support as online (green dot) and Support voice calls ring an admin who is actually here.
  useLiveStatus();
  // Bell on the Home header: this admin's unread notifications (new Support messages and the rest), same count as the main app's bell.
  const bellCount = useAdminBellCount();
  // Opening a Support conversation (from the bell, the Support tab or anywhere) marks its "new Support message" notifications read.
  const openThreadId = stack.length && stack[stack.length - 1].name === "thread" ? (stack[stack.length - 1] as any).id as string : "";
  useEffect(() => {
    if (!openThreadId || !isAdmin) return;
    apiPost("/api/me/notifications/read", { supportThreadId: openThreadId }).then(() => refreshUnreadCounts()).catch(() => {});
  }, [openThreadId, isAdmin]);

  const refreshBadges = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [s, o] = await Promise.all([apiGet("/api/admin/manage/support/unread"), apiGet("/api/admin/manage/shop/overview")]);
      setSupportUnread(Number(s?.threads || 0));
      setPendingOrders(Number(o?.pendingOrders || 0));
    } catch {}
  }, [isAdmin]);
  useEffect(() => {
    refreshBadges();
    const t = setInterval(refreshBadges, 20000);
    return () => clearInterval(t);
  }, [refreshBadges]);

  const nav = useMemo(
    () => ({
      push: (r: Route) => setStack((s) => [...s, r]),
      pop: () => setStack((s) => s.slice(0, -1)),
      goTab: (t: TabName, section?: ShopSection) => { setStack([]); setTab(t); if (section) setShopSection(section); },
      refreshBadges,
      openClassic: (initialTab: string) => navigation.navigate("AdminDashboard", { initialTab }),
    }),
    [refreshBadges, navigation],
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length) { nav.pop(); return true; }
      if (tab !== "home") { setTab("home"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab, nav]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14, backgroundColor: theme.backgroundRoot }} testID="admin-denied">
        <Feather name="lock" size={40} color={theme.textSecondary} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" }}>{L("Admins only", "শুধু অ্যাডমিনদের জন্য")}</Text>
        <Text style={{ color: theme.textSecondary, textAlign: "center" }}>
          {L("This account isn't a Farmers admin. Sign in with an admin account.", "এই অ্যাকাউন্টটি অ্যাডমিন নয়। অ্যাডমিন অ্যাকাউন্ট দিয়ে সাইন ইন করুন।")}
        </Text>
        <Btn testID="denied-logout" icon="log-out" label={L("Sign out", "সাইন আউট")} onPress={() => logout()} />
      </View>
    );
  }

  const top = stack[stack.length - 1];
  const bellBadge = bellCount > 0 ? (
    <View testID="header-bell-badge" style={{ position: "absolute", top: 3, right: 1, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: theme.backgroundRoot }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{bellCount > 99 ? "99+" : bellCount}</Text>
    </View>
  ) : null;
  const tabTitle: Record<TabName, string> = {
    home: L("Farmers Admin", "ফার্মার্স অ্যাডমিন"), shop: L("Shop", "শপ"), orders: L("Orders", "অর্ডার"), support: L("Support", "সাপোর্ট"), more: L("More", "আরও"),
  };
  const routeTitle = (r: Route) =>
    ({
      product: L("Product", "পণ্য"), productForm: (r as any).id ? L("Edit product", "পণ্য এডিট") : L("Add product", "পণ্য যোগ"),
      store: L("Shop details", "দোকানের তথ্য"), storeForm: (r as any).id ? L("Edit shop", "দোকান এডিট") : L("Open a shop", "দোকান খুলুন"),
      order: L("Order", "অর্ডার"), user: L("User", "ব্যবহারকারী"), users: L("Users", "ব্যবহারকারী"), thread: L("Conversation", "কথোপকথন"),
      categoryForm: (r as any).id ? L("Edit category", "ক্যাটাগরি এডিট") : L("New category", "নতুন ক্যাটাগরি"),
      notifications: L("Notifications", "নোটিফিকেশন"),
    } as Record<string, string>)[r.name];

  const renderRoute = (r: Route) => {
    const key = `${r.name}-${(r as any).id || ""}-${stack.length}`;
    switch (r.name) {
      case "product": return <ProductDetail key={key} id={r.id} />;
      case "productForm": return <ProductForm key={key} id={r.id} storeId={r.storeId} />;
      case "store": return <StoreDetail key={key} id={r.id} />;
      case "storeForm": return <StoreForm key={key} id={r.id} />;
      case "order": return <OrderDetail key={key} id={r.id} />;
      case "user": return <UserDetail key={key} id={r.id} />;
      case "users": return <UsersList key={key} />;
      case "thread": return <ThreadView key={key} id={r.id} />;
      case "search":
        return <SearchScreen />;
      case "official":
        return <OfficialScreen target={r.target} targetName={r.targetName} />;
      case "ads":
        return <AdsScreen />;
      case "adForm":
        return <AdForm id={r.id} />;
      case "categoryForm": return <CategoryForm key={key} id={r.id} />;
      case "notifications": return <NotificationsScreen key={key} />;
    }
  };

  const tabs: [TabName, string, keyof typeof Feather.glyphMap, number][] = [
    ["home", L("Home", "হোম"), "home", 0],
    ["shop", L("Shop", "শপ"), "shopping-bag", 0],
    ["orders", L("Orders", "অর্ডার"), "package", pendingOrders],
    ["support", L("Support", "সাপোর্ট"), "message-circle", supportUnread],
    ["more", L("More", "আরও"), "menu", 0],
  ];

  // A support conversation opens full screen with the main app's own chat header and composer.
  const fullScreen = top?.name === "thread";
  const iconBtn = (testID: string, onPress: () => void, child: React.ReactNode, dot?: boolean, label?: string) => (
    <Pressable testID={testID} accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? theme.backgroundSecondary : "transparent" })}>
      {child}
      {dot ? <View style={{ position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: "#DC2626", borderWidth: 1.5, borderColor: theme.backgroundRoot }} /> : null}
    </Pressable>
  );
  return (
    <AdminNav.Provider value={nav}>
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }} testID="admin-app">
        {fullScreen ? null : (
          <View style={{ paddingTop: insets.top, backgroundColor: theme.backgroundRoot }}>
            <View style={{ height: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 6, width: "100%", maxWidth: 920, alignSelf: "center" }}>
              {top ? (
                iconBtn("admin-back", nav.pop, <Feather name="arrow-left" size={22} color={theme.text} />, false, L("Back", "পেছনে"))
              ) : (
                <View style={[{ width: 38, height: 38, borderRadius: 12, overflow: "hidden", marginLeft: 4, marginRight: 4, backgroundColor: theme.card }, shadow(isDark)]}>
                  <Image source={require("../../assets/images/icon.png")} style={{ width: 38, height: 38 }} contentFit="cover" />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                {!top && tab === "home" ? (
                  <>
                    <Text style={{ color: theme.text, fontSize: 20, fontFamily: FontFamily.bold, letterSpacing: -0.3 }} numberOfLines={1} testID="admin-title">Farmers</Text>
                    <Text style={{ color: theme.primary, fontSize: 11.5, fontWeight: "700", marginTop: -2, letterSpacing: 0.4 }} numberOfLines={1}>{L("ADMIN CONSOLE", "অ্যাডমিন কনসোল")}</Text>
                  </>
                ) : (
                  <Text style={{ color: theme.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.2 }} numberOfLines={1} testID="admin-title">
                    {top ? routeTitle(top) : tabTitle[tab]}
                  </Text>
                )}
              </View>
              {!top && tab === "home" ? iconBtn("header-theme", () => setThemePref(isDark ? "light" : "dark"), <Feather name={isDark ? "sun" : "moon"} size={20} color={theme.text} />, false, isDark ? L("Switch to light mode", "লাইট মোডে যান") : L("Switch to dark mode", "ডার্ক মোডে যান")) : null}
              {!top && tab === "home" ? iconBtn("header-bell", () => nav.push({ name: "notifications" }), <><Feather name="bell" size={21} color={theme.text} />{bellBadge}</>, false, bellCount ? L(`Notifications, ${bellCount} unread`, `নোটিফিকেশন, ${bellCount}টি অপঠিত`) : L("Notifications", "নোটিফিকেশন")) : null}
              {top?.name !== "search" ? iconBtn("header-search", () => nav.push({ name: "search" }), <Feather name="search" size={21} color={theme.text} />, false, L("Search", "খুঁজুন")) : null}
              {!top && tab !== "support" ? iconBtn("header-support", () => nav.goTab("support"), <ChatIcon size={21} color={theme.text} />, !!supportUnread, L("Support chats", "সাপোর্ট চ্যাট")) : null}
            </View>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <FadeIn key={top ? `r-${stack.length}-${top.name}` : `t-${tab}`}>
          {top ? renderRoute(top) : tab === "home" ? <HomeTab supportUnread={supportUnread} /> : tab === "shop" ? <ShopTab section={shopSection} setSection={setShopSection} />
            : tab === "orders" ? <OrdersTab /> : tab === "support" ? <SupportTab /> : <MoreTab adminName={user?.name || user?.email || ""} onLogout={() => logout()} />}
          </FadeIn>
        </View>
        {fullScreen ? null : (
          <View style={[{ flexDirection: "row", backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.cardBorder }]} testID="admin-tabbar">
            <View style={{ flexDirection: "row", flex: 1, maxWidth: 640, alignSelf: "center", marginHorizontal: "auto" as any }}>
              {tabs.map(([k, label, icon, badge]) => {
                const on = tab === k && !top;
                return (
                  <Pressable key={k} testID={`admin-tab-${k}`} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { if (on && !stack.length) return; nav.goTab(k); }} style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 3, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
                    <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: on ? theme.primary + "1F" : "transparent" }}>
                      {k === "home" ? (
                        <HomeIcon size={20} color={on ? theme.primary : theme.tabIconDefault || theme.textSecondary} />
                      ) : (
                        <AppIcon name={icon} size={22} color={on ? theme.primary : theme.tabIconDefault || theme.textSecondary} />
                      )}
                      {badge ? (
                        <View style={{ position: "absolute", top: -4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: theme.card }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{badge > 99 ? "99+" : badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: on ? "700" : "500", color: on ? theme.primary : theme.textSecondary }} numberOfLines={1}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </AdminNav.Provider>
  );
}
