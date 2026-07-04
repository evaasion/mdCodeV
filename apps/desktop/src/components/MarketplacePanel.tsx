import { useMemo, useState } from "react";
import {
  getMarketplaceCatalog,
  searchTemplates,
  type MarketplaceCategory,
  type MarketplaceTemplate,
} from "@mdcodev/marketplace";
import styles from "./MarketplacePanel.module.css";

interface MarketplacePanelProps {
  onInstall: (template: MarketplaceTemplate) => Promise<void>;
  disabled: boolean;
  catalogVersion: number;
  catalogUrl: string;
  onCloudSync: () => Promise<void>;
}

const CATEGORIES: { id: MarketplaceCategory | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "jobs", label: "Jobs" },
  { id: "economy", label: "Economie" },
  { id: "vehicles", label: "Véhicules" },
  { id: "ui", label: "UI / NUI" },
  { id: "standalone", label: "Standalone" },
];

export function MarketplacePanel({
  onInstall,
  disabled,
  catalogVersion,
  catalogUrl,
  onCloudSync,
}: MarketplacePanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory | "all">("all");
  const [installing, setInstalling] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncState, setSyncState] = useState<string | null>(null);

  const catalog = useMemo(() => getMarketplaceCatalog(), [catalogVersion]);

  const templates = useMemo(
    () =>
      searchTemplates(
        query,
        category === "all" ? undefined : category,
      ),
    [query, category, catalogVersion],
  );

  async function handleInstall(template: MarketplaceTemplate) {
    setInstalling(template.id);
    try {
      await onInstall(template);
    } finally {
      setInstalling(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncState(null);
    try {
      await onCloudSync();
      setSyncState("Catalogue synchronisé");
    } catch (err) {
      setSyncState(err instanceof Error ? err.message : "Sync échouée");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>Marketplace</h3>
          <p>{catalog.templates.length} templates · {catalogUrl === "bundled" ? "bundled" : "cloud"}</p>
        </div>
        <button
          className={styles.syncBtn}
          onClick={() => void handleSync()}
          disabled={syncing}
        >
          {syncing ? "Sync..." : "☁ Sync"}
        </button>
      </div>
      {syncState && <p className={styles.syncState}>{syncState}</p>}

      <div className={styles.searchBox}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un template..."
        />
      </div>

      <div className={styles.filters}>
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            className={category === item.id ? styles.filterActive : styles.filter}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {templates.map((template) => (
          <article key={template.id} className={styles.card}>
            <div className={styles.cardTop}>
              <h4>{template.name}</h4>
              <span className={styles.framework}>{template.framework}</span>
            </div>
            <p className={styles.desc}>{template.description}</p>
            <div className={styles.meta}>
              <span>★ {template.downloads.toLocaleString()}</span>
              <span>{template.tags.join(" · ")}</span>
            </div>
            <button
              className={styles.installBtn}
              disabled={disabled || installing === template.id}
              onClick={() => void handleInstall(template)}
            >
              {installing === template.id ? "Installation..." : "Installer"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}