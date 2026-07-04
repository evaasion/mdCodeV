import catalogData from "../data/templates.json";
import type { MarketplaceCatalog, MarketplaceTemplate, MarketplaceCategory } from "./types.js";

export type { MarketplaceCatalog, MarketplaceTemplate, MarketplaceCategory };
export {
  syncCloudCatalog,
  loadCloudCache,
  saveCloudCache,
  getMergedCatalogFromCache,
} from "./cloud.js";
export type { CloudSyncResult } from "./cloud.js";

const builtinCatalog = catalogData as unknown as MarketplaceCatalog;
let activeCatalog: MarketplaceCatalog = builtinCatalog;

export function getMarketplaceCatalog(): MarketplaceCatalog {
  return activeCatalog;
}

export function setMarketplaceCatalog(catalog: MarketplaceCatalog): void {
  activeCatalog = catalog;
}

export function resetMarketplaceCatalog(): void {
  activeCatalog = builtinCatalog;
}

export function searchTemplates(query: string, category?: MarketplaceCategory): MarketplaceTemplate[] {
  const needle = query.trim().toLowerCase();
  return activeCatalog.templates.filter((template) => {
    if (category && template.category !== category) return false;
    if (!needle) return true;

    const haystack = [
      template.name,
      template.description,
      template.framework,
      ...template.tags,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

export function getTemplateById(id: string): MarketplaceTemplate | undefined {
  return activeCatalog.templates.find((template) => template.id === id);
}