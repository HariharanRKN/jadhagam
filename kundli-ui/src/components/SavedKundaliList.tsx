"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedKundali } from "@/lib/kundalis/types";
import { formatSavedKundaliLabel } from "@/lib/kundalis/client";
import { useTranslations } from "@/i18n/useTranslations";
import styles from "@/app/page.module.css";

type Props = {
  dark?: boolean;
  refreshKey?: number;
  onLoad: (item: SavedKundali) => void;
};

export function SavedKundaliList({ dark, refreshKey, onLoad }: Props) {
  const { t } = useTranslations();
  const [items, setItems] = useState<SavedKundali[]>([]);
  const [filter, setFilter] = useState<"all" | "family">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kundalis");
      const json = (await res.json()) as {
        kundalis?: SavedKundali[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setItems(json.kundalis ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home.savedLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadList();
  }, [loadList, refreshKey]);

  async function toggleFamily(item: SavedKundali) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/kundalis/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family: !item.family }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home.savedUpdateError"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: SavedKundali) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/kundalis/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home.savedDeleteError"));
    } finally {
      setBusyId(null);
    }
  }

  const visible =
    filter === "family" ? items.filter((item) => item.family) : items;

  return (
    <section
      className={`${styles.savedWrap} ${dark ? styles.savedWrapDark : ""}`}
    >
      <div className={styles.savedHeader}>
        <div>
          <h2>{t("home.savedTitle")}</h2>
          <p>{t("home.savedDesc")}</p>
        </div>
        <div className={styles.savedFilters}>
          <button
            type="button"
            className={`${styles.savedFilterBtn} ${
              filter === "all" ? styles.savedFilterBtnActive : ""
            }`}
            onClick={() => setFilter("all")}
          >
            {t("home.savedFilterAll")}
          </button>
          <button
            type="button"
            className={`${styles.savedFilterBtn} ${
              filter === "family" ? styles.savedFilterBtnActive : ""
            }`}
            onClick={() => setFilter("family")}
          >
            {t("home.savedFilterFamily")}
          </button>
        </div>
      </div>

      {error ? <p className={styles.inlineError}>{error}</p> : null}
      {loading ? (
        <p className={styles.inlineMeta}>{t("home.savedLoading")}</p>
      ) : visible.length === 0 ? (
        <p className={styles.inlineMeta}>{t("home.savedEmpty")}</p>
      ) : (
        <ul className={styles.savedList}>
          {visible.map((item) => (
            <li key={item.id} className={styles.savedItem}>
              <div className={styles.savedItemMain}>
                <strong>{formatSavedKundaliLabel(item)}</strong>
                {item.family ? (
                  <span className={styles.familyBadge}>{t("home.familyBadge")}</span>
                ) : null}
              </div>
              <div className={styles.savedItemActions}>
                <button
                  type="button"
                  className={styles.savedLoadBtn}
                  disabled={busyId === item.id}
                  onClick={() => onLoad(item)}
                >
                  {t("home.savedLoad")}
                </button>
                <button
                  type="button"
                  className={styles.savedActionBtn}
                  disabled={busyId === item.id}
                  onClick={() => void toggleFamily(item)}
                >
                  {item.family
                    ? t("home.savedUnmarkFamily")
                    : t("home.savedMarkFamily")}
                </button>
                <button
                  type="button"
                  className={styles.savedActionBtnDanger}
                  disabled={busyId === item.id}
                  onClick={() => void remove(item)}
                >
                  {t("home.savedDelete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
