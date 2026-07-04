import cloudCatalogData from "../data/cloud-catalog.json";
import type { MarketplaceCatalog, MarketplaceTemplate } from "./types.js";
import { getMarketplaceCatalog } from "./index.js";

const bundledCloudCatalog = cloudCatalogData as unknown as MarketplaceCatalog;

const CACHE_KEY = "mdcodev.marketplace.cloud";

export interface CloudSyncResult {
  catalog: MarketplaceCatalog;
  source: "remote" | "cache" | "local";
  added: number;
  updatedAt: string;
}

interface CloudCache {
  url: string;
  catalog: MarketplaceCatalog;
  syncedAt: string;
}

export function loadCloudCache(): CloudCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CloudCache;
  } catch {
    return null;
  }
}

export function saveCloudCache(url: string, catalog: MarketplaceCatalog): void {
  const payload: CloudCache = {
    url,
    catalog,
    syncedAt: new Date().toISOString(),
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

function mergeCatalogs(
  local: MarketplaceCatalog,
  remote: MarketplaceCatalog,
): MarketplaceCatalog {
  const map = new Map<string, MarketplaceTemplate>();

  for (const template of local.templates) {
    map.set(template.id, template);
  }

  let added = 0;
  for (const template of remote.templates) {
    if (!map.has(template.id)) added += 1;
    map.set(template.id, { ...map.get(template.id), ...template });
  }

  return {
    version: remote.version || local.version,
    updatedAt: remote.updatedAt || new Date().toISOString(),
    templates: [...map.values()],
  };
}

export async function syncCloudCatalog(
  url: string,
  fallbackLocal = true,
): Promise<CloudSyncResult> {
  const local = getMarketplaceCatalog();

  const normalizedUrl = url.trim();

  if (!normalizedUrl || normalizedUrl === "bundled") {
    const merged = mergeCatalogs(local, bundledCloudCatalog);
    saveCloudCache("bundled", bundledCloudCatalog);
    const added = bundledCloudCatalog.templates.filter(
      (t) => !local.templates.some((l) => l.id === t.id),
    ).length;
    return {
      catalog: merged,
      source: "remote",
      added,
      updatedAt: bundledCloudCatalog.updatedAt,
    };
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const remote = (await response.json()) as MarketplaceCatalog;
    const merged = mergeCatalogs(local, remote);
    saveCloudCache(url, remote);

    const added = remote.templates.filter(
      (t) => !local.templates.some((l) => l.id === t.id),
    ).length;

    return {
      catalog: merged,
      source: "remote",
      added,
      updatedAt: remote.updatedAt ?? new Date().toISOString(),
    };
  } catch (error) {
    if (fallbackLocal) {
      const cache = loadCloudCache();
      if (cache && cache.url === url) {
        return {
          catalog: mergeCatalogs(local, cache.catalog),
          source: "cache",
          added: 0,
          updatedAt: cache.syncedAt,
        };
      }
    }
    throw error;
  }
}

export function getMergedCatalogFromCache(): MarketplaceCatalog | null {
  const cache = loadCloudCache();
  if (!cache) return null;
  return mergeCatalogs(getMarketplaceCatalog(), cache.catalog);
}