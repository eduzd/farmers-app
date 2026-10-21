import { Platform } from "react-native";

/**
 * One codebase, three apps on one backend:
 *  - main   : Farmers community + buyer app (default)
 *  - seller : Seller Hub (store, products, orders)
 *  - admin  : Admin app (controls buyers, sellers, orders and app settings)
 * Web picks the app from the URL path (/seller, /admin). Native builds and Expo Go pick it from
 * EXPO_PUBLIC_APP_VARIANT (see app.config.js and the start:seller / start:admin scripts).
 */
export type AppVariant = "main" | "seller" | "admin";

export function getAppVariant(): AppVariant {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const p = window.location.pathname || "/";
    if (p === "/seller" || p.startsWith("/seller/")) return "seller";
    if (p === "/admin" || p.startsWith("/admin/")) return "admin";
  }
  const v = process.env.EXPO_PUBLIC_APP_VARIANT;
  return v === "seller" || v === "admin" ? v : "main";
}

/** Opens another of the three apps (web: same site, other path). */
export function openVariantOnWeb(v: AppVariant) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.href = v === "main" ? "/" : `/${v}`;
    return true;
  }
  return false;
}
