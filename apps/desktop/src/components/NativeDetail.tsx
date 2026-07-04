import type { NativeFunction } from "@mdcodev/natives-core";
import styles from "./NativeDetail.module.css";

interface NativeDetailProps {
  native: NativeFunction;
  onClose: () => void;
  onInsert: () => void;
}

export function NativeDetail({ native, onClose, onInsert }: NativeDetailProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{native.luaName}</h2>
          <p className={styles.subtitle}>
            {native.namespace} · {native.name}
          </p>
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          <h3>Signature</h3>
          <pre className={styles.code}>{native.signature}</pre>
          {native.hash && <p className={styles.hash}>Hash: {native.hash}</p>}
        </section>

        {native.description && (
          <section className={styles.section}>
            <h3>Description</h3>
            <p className={styles.text}>{native.description}</p>
          </section>
        )}

        {native.params.length > 0 && (
          <section className={styles.section}>
            <h3>Paramètres</h3>
            <ul className={styles.params}>
              {native.params.map((param: NativeFunction["params"][number]) => (
                <li key={param.name}>
                  <code>{param.name}</code>
                  <span className={styles.type}>{param.type}</span>
                  {param.description && <p>{param.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section}>
          <h3>Retour</h3>
          <code className={styles.returnType}>{native.returnType}</code>
        </section>

        {native.examples && (
          <section className={styles.section}>
            <h3>Exemple</h3>
            <pre className={styles.example}>{native.examples}</pre>
          </section>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.insertBtn} onClick={onInsert}>
          Insérer dans l'éditeur
        </button>
      </div>
    </aside>
  );
}