"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import type { PhotonFeature } from "@/lib/photon";
import {
  formatPhotonFeatureLabel,
  featureToLatLng,
} from "@/lib/photon";
import styles from "./PlacePhotonField.module.css";

export type PlacePhotonFieldHandle = {
  getValue: () => string;
};

type Props = {
  label: string;
  placeholder?: string;
  searchingText?: string;
  searchFailedText?: string;
  networkErrorText?: string;
  className?: string;
  syncValue: string;
  onPlaceSelected: (detail: {
    formattedAddress: string;
    lat: number;
    lng: number;
  }) => void;
  disabled?: boolean;
  required?: boolean;
  dark?: boolean;
};

function isPhotonFeature(x: unknown): x is PhotonFeature {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.type !== "Feature") return false;
  const g = o.geometry as Record<string, unknown> | undefined;
  if (!g || !Array.isArray(g.coordinates)) return false;
  const [lng, lat] = g.coordinates;
  return typeof lat === "number" && typeof lng === "number";
}

export const PlacePhotonField = forwardRef<PlacePhotonFieldHandle, Props>(
  function PlacePhotonField(
    {
      label,
      placeholder = "Search place (OpenStreetMap via Photon)…",
      searchingText = "Searching…",
      searchFailedText = "Search failed",
      networkErrorText = "Network error",
      className,
      syncValue,
      onPlaceSelected,
      disabled,
      required,
      dark,
    },
    ref
  ) {
    const inputId = useId();
    const listId = useId();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onPlaceSelectedRef = useRef(onPlaceSelected);
    onPlaceSelectedRef.current = onPlaceSelected;

    const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => inputRef.current?.value?.trim() ?? "",
    }));

    const setInputRef = useCallback((el: HTMLInputElement | null) => {
      inputRef.current = el;
    }, []);

    const runSearch = useCallback(async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        setFetchError(null);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/places?q=${encodeURIComponent(q)}&limit=8`
        );
        const data = (await res.json()) as { features?: unknown[]; error?: string };
        if (!res.ok) {
          setSuggestions([]);
          setFetchError(data.error ?? searchFailedText);
          return;
        }
        const feats = (data.features ?? []).filter(isPhotonFeature);
        setSuggestions(feats);
        setOpen(feats.length > 0);
        setHighlight(0);
      } catch {
        setSuggestions([]);
        setFetchError(networkErrorText);
      } finally {
        setLoading(false);
      }
    }, [networkErrorText, searchFailedText]);

    const selectFeature = useCallback((f: PhotonFeature) => {
      const labelText = formatPhotonFeatureLabel(f);
      const { lat, lng } = featureToLatLng(f);
      if (inputRef.current) inputRef.current.value = labelText;
      setOpen(false);
      setSuggestions([]);
      onPlaceSelectedRef.current({
        formattedAddress: labelText,
        lat,
        lng,
      });
    }, []);

    useEffect(() => {
      const el = inputRef.current;
      if (!el || document.activeElement === el) return;
      if (el.value !== syncValue) el.value = syncValue;
    }, [syncValue]);

    useEffect(() => {
      function onDocDown(e: MouseEvent) {
        const t = e.target as Node;
        if (wrapRef.current && !wrapRef.current.contains(t)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", onDocDown);
      return () => document.removeEventListener("mousedown", onDocDown);
    }, []);

    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    function onInputChange() {
      const q = inputRef.current?.value ?? "";
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSearch(q.trim());
      }, 280);
    }

    function onInputFocus() {
      const q = inputRef.current?.value?.trim() ?? "";
      if (q.length >= 2 && suggestions.length > 0) setOpen(true);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (!open || suggestions.length === 0) {
        if (e.key === "Escape") setOpen(false);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const f = suggestions[highlight];
        if (f) selectFeature(f);
      }
    }

    return (
      <div
        ref={wrapRef}
        className={`${styles.wrap} ${className ?? ""} ${dark ? styles.themeDark : ""}`}
      >
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          ref={setInputRef}
          type="text"
          name="birthPlace"
          className={styles.input}
          placeholder={placeholder}
          defaultValue={syncValue}
          disabled={disabled}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={onInputChange}
          onFocus={onInputFocus}
          onKeyDown={onKeyDown}
        />
        <div className={styles.status} aria-live="polite">
          {loading ? searchingText : fetchError ? fetchError : ""}
        </div>
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            className={styles.suggestions}
            role="listbox"
          >
            {suggestions.map((f, i) => {
              const title = formatPhotonFeatureLabel(f);
              const sub = f.properties.type
                ? `${f.properties.type}${f.properties.countrycode ? ` · ${f.properties.countrycode}` : ""}`
                : f.properties.countrycode ?? "";
              return (
                <li key={`${f.geometry.coordinates.join(",")}-${i}`} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={`${styles.suggestion} ${i === highlight ? styles.suggestionHighlight : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectFeature(f);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    <div className={styles.suggestionTitle}>{title}</div>
                    {sub ? (
                      <div className={styles.suggestionMeta}>{sub}</div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
);
