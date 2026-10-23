import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { apiGet, mediaUrl } from "@/lib/api";
import type { AdCard } from "@/components/AdCarousel";

/** One carousel ad as the server sends it (GET /api/ads?placement=...). */
export type CarouselAd = {
  id: string;
  placement: string;
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  ctaEn: string;
  ctaBn: string;
  icon: string;
  color1: string;
  color2: string;
  image: string;
  linkType: string;
  linkTarget: string;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AdPlacement = "home" | "connect" | "market";

const HEX = /^#[0-9a-fA-F]{6}$/;
const mem: Partial<Record<AdPlacement, CarouselAd[]>> = {};
const storeKey = (p: AdPlacement) => `carousel-ads:${p}`;

/** Keeps only ads that should be on screen right now (the server already filters; this guards stale cache). */
export function liveAds(list: unknown): CarouselAd[] {
  if (!Array.isArray(list)) return [];
  const now = Date.now();
  return list.filter((a: any) => {
    if (!a || typeof a.id !== "string" || !a.titleEn) return false;
    if (a.active === false) return false;
    if (a.startsAt && new Date(a.startsAt).getTime() > now) return false;
    if (a.endsAt && new Date(a.endsAt).getTime() <= now) return false;
    return true;
  }) as CarouselAd[];
}

/**
 * The admin's ads for one page, in the admin's order. `null` while the very first load is
 * still running (no cached copy yet), so the page can show a placeholder instead of
 * flashing the built-in cards. Refreshes every time the page comes back into view.
 */
export function useCarouselAds(placement: AdPlacement): CarouselAd[] | null {
  const [ads, setAds] = useState<CarouselAd[] | null>(mem[placement] ? liveAds(mem[placement]) : null);

  useEffect(() => {
    if (mem[placement]) return;
    let alive = true;
    AsyncStorage.getItem(storeKey(placement))
      .then((raw) => {
        if (!alive || !raw || mem[placement]) return;
        const cached = liveAds(JSON.parse(raw));
        setAds((cur) => cur ?? cached);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [placement]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      apiGet<CarouselAd[]>(`/api/ads?placement=${placement}`)
        .then((list) => {
          const live = liveAds(list);
          mem[placement] = live;
          AsyncStorage.setItem(storeKey(placement), JSON.stringify(live)).catch(() => {});
          if (alive) setAds(live);
        })
        .catch(() => {
          // Offline / server asleep: keep what we have; with nothing at all, fall back to built-ins.
          if (alive) setAds((cur) => cur ?? []);
        });
      return () => {
        alive = false;
      };
    }, [placement]),
  );

  return ads;
}

/** Opens what the admin chose for the ad. Returns false when the ad opens nothing. */
export function openAd(ad: CarouselAd, navigation: any): boolean {
  const target = String(ad.linkTarget || "").trim();
  switch (ad.linkType) {
    case "product":
      if (!target) return false;
      navigation.navigate("ProductLink", { productId: target });
      return true;
    case "shop":
      if (!target) return false;
      navigation.navigate("ShopPage", { slug: target });
      return true;
    case "category":
      navigation.navigate("Main", { screen: "Market", params: { category: target || "all", at: Date.now() } });
      return true;
    case "support":
      navigation.navigate("SupportChat");
      return true;
    case "url":
      if (!/^https?:\/\//i.test(target)) return false;
      Linking.openURL(target).catch(() => {});
      return true;
    default:
      return false;
  }
}

/** Turns admin ads into carousel cards in the app language. */
export function adsToCards(ads: CarouselAd[], bn: boolean, navigation: any): AdCard[] {
  return ads.map((a) => {
    const pick = (en: string, bnText: string) => (bn ? bnText || en : en || bnText) || "";
    const opens = a.linkType && a.linkType !== "none";
    return {
      key: a.id,
      icon: (a.icon && a.icon in Feather.glyphMap ? a.icon : "tag") as AdCard["icon"],
      title: pick(a.titleEn, a.titleBn),
      subtitle: pick(a.subtitleEn, a.subtitleBn),
      cta: opens ? pick(a.ctaEn, a.ctaBn) || (bn ? "দেখুন" : "Open") : pick(a.ctaEn, a.ctaBn),
      colors: [HEX.test(a.color1) ? a.color1 : "#16A34A", HEX.test(a.color2) ? a.color2 : "#0E7490"],
      image: a.image ? mediaUrl(a.image) : undefined,
      onPress: opens ? () => openAd(a, navigation) : undefined,
    };
  });
}
