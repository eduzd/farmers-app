import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

/** Marketplace categories, managed by admins in the admin app (Shop > Categories). */
export type MarketCategory = { slug: string; nameEn: string; nameBn: string; icon: string; color: string };

/** Used only until the server answers, or if it can't be reached. Same list the server seeds. */
export const FALLBACK_CATEGORIES: MarketCategory[] = [
  ["vegetables", "Vegetables", "সবজি", "feather", "#00BB77"],
  ["fruits", "Fruits", "ফল", "sun", "#B25E09"],
  ["grains", "Grains", "শস্য", "layers", "#B25E09"],
  ["livestock", "Livestock", "গবাদি পশু", "github", "#B25E09"],
  ["seeds", "Seeds", "বীজ", "sun", "#00BB77"],
  ["fertilizer", "Fertilizer", "সার", "droplet", "#39B1FE"],
  ["equipment", "Equipment", "যন্ত্রপাতি", "tool", "#4A5568"],
  ["feed", "Feed", "খাদ্য", "package", "#B25E09"],
  ["medicine", "Medicine", "ওষুধ", "heart", "#DA2F2F"],
  ["organic", "Organic", "অর্গানিক", "zap", "#2E96EF"],
  ["dairy", "Dairy", "দুগ্ধ", "coffee", "#2E96EF"],
  ["fish", "Fish", "মাছ", "anchor", "#1F86DB"],
  ["other", "Other", "অন্যান্য", "grid", "#7A8CA3"],
].map(([slug, nameEn, nameBn, icon, color]) => ({ slug, nameEn, nameBn, icon, color }));

let cache: MarketCategory[] | null = null;
let cachedAt = 0;
let inflight: Promise<MarketCategory[]> | null = null;
const listeners = new Set<(c: MarketCategory[]) => void>();

export function fetchMarketCategories(force = false): Promise<MarketCategory[]> {
  if (!force && cache && Date.now() - cachedAt < 60_000) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = apiGet<MarketCategory[]>("/api/market/categories")
    .then((r) => {
      const list = Array.isArray(r) ? r.filter((c) => c && c.slug) : [];
      if (list.length) {
        cache = list;
        cachedAt = Date.now();
        listeners.forEach((l) => l(list));
      }
      return cache || FALLBACK_CATEGORIES;
    })
    .catch(() => cache || FALLBACK_CATEGORIES)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Live list: renames, new categories, hidden ones and the admin's order show up without an app update. */
export function useMarketCategories(): MarketCategory[] {
  const [list, setList] = useState<MarketCategory[]>(cache || FALLBACK_CATEGORIES);
  useEffect(() => {
    let alive = true;
    const l = (c: MarketCategory[]) => alive && setList(c);
    listeners.add(l);
    fetchMarketCategories().then((c) => alive && setList(c));
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);
  return list;
}

export function categoryLabel(list: MarketCategory[], slug: string | undefined, bn: boolean) {
  const c = list.find((x) => x.slug === (slug || "").toLowerCase());
  if (!c) return slug || "";
  return bn ? c.nameBn || c.nameEn : c.nameEn;
}
