export type MarketplaceCategory = "jobs" | "economy" | "ui" | "vehicles" | "standalone";

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  category: MarketplaceCategory;
  framework: "qbcore" | "qbox" | "esx" | "ox" | "standalone";
  downloads: number;
  tags: string[];
  files: Record<string, string>;
}

export interface MarketplaceCatalog {
  version: string;
  updatedAt: string;
  templates: MarketplaceTemplate[];
}