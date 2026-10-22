import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, BackHandler, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/lib/authStore";
import { apiGet } from "@/lib/api";
import { AdminNav, Route, TabName, ShopSection, useL, Btn } from "./ui";
import { ShopTab, ProductDetail, ProductForm, StoreDetail, StoreForm, CategoryForm } from "./shop";
import { HomeTab, OrdersTab, OrderDetail, SupportTab, ThreadView, UsersList, UserDetail, MoreTab } from "./ops";

/**
 * Farmers Admin app: its own bottom navigation (Home, Shop, Orders, Support, More) over the
 * shared backend. Every call goes to /api/admin/manage/*, which the server checks for an
 * admin account on each request; this screen's own guard is only for a friendly message.
 */
export default function AdminAppScreen() {
  const { theme } = useTheme();
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
  const isAdmin = !!user?.isSuperAdmin;

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
  const tabTitle: Record<TabName, string> = {
    home: L("Farmers Admin", "ফার্মার্স অ্যাডমিন"), shop: L("Shop", "শপ"), orders: L("Orders", "অর্ডার"), support: L("Support", "সাপোর্ট"), more: L("More", "আরও"),
  };
  const routeTitle = (r: Route) =>
    ({
      product: L("Product", "পণ্য"), productForm: (r as any).id ? L("Edit product", "পণ্য এডিট") : L("Add product", "পণ্য যোগ"),
      store: L("Shop details", "দোকানের তথ্য"), storeForm: (r as any).id ? L("Edit shop", "দোকান এডিট") : L("Open a shop", "দোকান খুলুন"),
      order: L("Order", "অর্ডার"), user: L("User", "ব্যবহারকারী"), users: L("Users", "ব্যবহারকারী"), thread: L("Conversation", "কথোপকথন"),
      categoryForm: (r as any).id ? L("Edit category", "ক্যাটাগরি এডিট") : L("New category", "নতুন ক্যাটাগরি"),
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
      case "categoryForm": return <CategoryForm key={key} id={r.id} />;
    }
  };

  const tabs: [TabName, string, keyof typeof Feather.glyphMap, number][] = [
    ["home", L("Home", "হোম"), "home", 0],
    ["shop", L("Shop", "শপ"), "shopping-bag", 0],
    ["orders", L("Orders", "অর্ডার"), "package", pendingOrders],
    ["support", L("Support", "সাপোর্ট"), "message-circle", supportUnread],
    ["more", L("More", "আরও"), "menu", 0],
  ];

  return (
    <AdminNav.Provider value={nav}>
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }} testID="admin-app">
        <View style={{ paddingTop: insets.top, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}>
          <View style={{ height: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4, width: "100%", maxWidth: 900, alignSelf: "center" }}>
            {top ? (
              <Pressable testID="admin-back" onPress={nav.pop} hitSlop={8} style={{ padding: 8 }}>
                <Feather name="arrow-left" size={22} color={theme.text} />
              </Pressable>
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", marginHorizontal: 6 }}>
                <Feather name="shield" size={18} color="#fff" />
              </View>
            )}
            <Text style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: "800" }} numberOfLines={1} testID="admin-title">
              {top ? routeTitle(top) : tabTitle[tab]}
            </Text>
            {!top && tab === "home" ? (
              <Pressable testID="header-support" onPress={() => nav.goTab("support")} hitSlop={8} style={{ padding: 8 }}>
                <Feather name="message-circle" size={21} color={theme.text} />
                {supportUnread ? <View style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: "#DC2626" }} /> : null}
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          {top ? renderRoute(top) : tab === "home" ? <HomeTab supportUnread={supportUnread} /> : tab === "shop" ? <ShopTab section={shopSection} setSection={setShopSection} />
            : tab === "orders" ? <OrdersTab /> : tab === "support" ? <SupportTab /> : <MoreTab adminName={user?.name || user?.email || ""} onLogout={() => logout()} />}
        </View>
        <View style={{ flexDirection: "row", backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.cardBorder, paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }} testID="admin-tabbar">
          {tabs.map(([k, label, icon, badge]) => {
            const on = tab === k;
            return (
              <Pressable key={k} testID={`admin-tab-${k}`} onPress={() => { if (on && !stack.length) return; nav.goTab(k); }} style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}>
                <View>
                  <Feather name={icon} size={22} color={on ? theme.primary : theme.tabIconDefault || theme.textSecondary} />
                  {badge ? (
                    <View style={{ position: "absolute", top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: theme.card }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{badge > 99 ? "99+" : badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11.5, fontWeight: on ? "800" : "600", color: on ? theme.primary : theme.textSecondary }} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AdminNav.Provider>
  );
}
