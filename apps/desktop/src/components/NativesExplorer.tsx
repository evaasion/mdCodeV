import { useMemo, useState } from "react";
import type { NativeFunction } from "@mdcodev/natives-core";
import styles from "./NativesExplorer.module.css";

function filterNatives(
  natives: NativeFunction[],
  query: string,
  namespace: string,
  limit = 200,
): NativeFunction[] {
  const needle = query.trim().toLowerCase();

  const filtered = natives.filter((native) => {
    if (namespace !== "ALL" && native.namespace !== namespace) return false;
    if (!needle) return true;

    const haystack = [
      native.luaName,
      native.name,
      native.namespace,
      native.description,
      native.hash,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });

  return filtered.slice(0, limit);
}

interface NativesExplorerProps {
  natives: NativeFunction[];
  namespaces: string[];
  selectedNative: NativeFunction | null;
  onSelect: (native: NativeFunction) => void;
  onInsert: (native: NativeFunction) => void;
}

export function NativesExplorer({
  natives,
  namespaces,
  selectedNative,
  onSelect,
  onInsert,
}: NativesExplorerProps) {
  const [query, setQuery] = useState("");
  const [namespace, setNamespace] = useState<string>("ALL");

  const filtered = useMemo(
    () => filterNatives(natives, query, namespace),
    [natives, query, namespace],
  );

  return (
    <div className={styles.explorer}>
      <div className={styles.searchBox}>
        <input
          className={styles.search}
          placeholder="Rechercher une native..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.filters}>
        <select
          className={styles.select}
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
        >
          <option value="ALL">Tous les namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.list}>
        {filtered.map((native) => {
          const active = selectedNative?.id === native.id;
          return (
            <button
              key={native.id}
              className={active ? styles.itemActive : styles.item}
              onClick={() => onSelect(native)}
              onDoubleClick={() => onInsert(native)}
            >
              <span className={styles.itemName}>{native.luaName}</span>
              <span className={styles.itemNs}>{native.namespace}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className={styles.empty}>Aucune native trouvée.</p>
        )}
      </div>
      <div className={styles.footer}>
        {filtered.length} résultats · double-clic pour insérer
      </div>
    </div>
  );
}