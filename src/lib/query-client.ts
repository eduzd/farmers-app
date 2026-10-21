import { QueryClient, QueryFunction } from "@tanstack/react-query";

import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Resolves the base URL of the Farmers API server, in this order:
 *  1. EXPO_PUBLIC_API_URL  - full URL, e.g. https://farmers-api.onrender.com
 *  2. EXPO_PUBLIC_DOMAIN   - bare host, https is assumed (Replit-style)
 *  3. Web build served by the API server itself - same origin
 *  4. Expo Go / dev client - the computer running `expo start`, port 5000
 *  5. http://localhost:5000
 */
export function getApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`.replace(/\/$/, "");

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port, origin } = window.location;
    // Expo web dev server runs on 8081; the API runs on 5000 next to it.
    if (port === "8081" || port === "19006") return `${protocol}//${hostname}:5000`;
    return origin;
  }

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.0.12:8081"
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:5000`;
  }

  return "http://localhost:5000";
}

/** WebSocket base (ws:// or wss://) for the same server. */
export function getWsUrl(): string {
  return getApiUrl().replace(/^http/, "ws");
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
