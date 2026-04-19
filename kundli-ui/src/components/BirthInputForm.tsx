"use client";

import { useState, useCallback, useRef } from "react";
import type { ChartDataPayload } from "@/types/chartData";
import styles from "@/app/birthForm.module.css";
import {
  PlacePhotonField,
  type PlacePhotonFieldHandle,
} from "@/components/PlacePhotonField";
import { fetchUtcOffsetHours } from "@/lib/timezoneClient";
import { useTranslations } from "@/i18n/useTranslations";

const PLACE_PRESETS = [
  {
    label: "Pondicherry",
    name: "Pondicherry, IN",
    lat: 11.9416,
    lng: 79.8083,
    tz: 5.5,
  },
  {
    label: "Chennai",
    name: "Chennai, IN",
    lat: 13.0827,
    lng: 80.2707,
    tz: 5.5,
  },
  {
    label: "Mumbai",
    name: "Mumbai, IN",
    lat: 19.076,
    lng: 72.8777,
    tz: 5.5,
  },
  {
    label: "Bengaluru",
    name: "Bengaluru, IN",
    lat: 12.9716,
    lng: 77.5946,
    tz: 5.5,
  },
  {
    label: "London",
    name: "London, UK",
    lat: 51.5074,
    lng: -0.1278,
    tz: 0,
  },
] as const;

const DEFAULT_DATE = "1994-05-10";
const DEFAULT_TIME = "17:00";

interface Props {
  dark?: boolean;
  onSuccess: (data: ChartDataPayload) => void;
  onError: (message: string) => void;
}

export function BirthInputForm({ dark, onSuccess, onError }: Props) {
  const { t } = useTranslations();
  const placePhotonRef = useRef<PlacePhotonFieldHandle>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState(DEFAULT_DATE);
  const [birthTime, setBirthTime] = useState(DEFAULT_TIME);
  const [placeName, setPlaceName] = useState("Pondicherry, IN");
  const [lat, setLat] = useState("11.9416");
  const [lng, setLng] = useState("79.8083");
  const [tz, setTz] = useState("5.5");
  const [submitting, setSubmitting] = useState(false);

  const text = {
    name: t("birthForm.name"),
    gender: t("birthForm.gender"),
    genderPlaceholder: t("birthForm.genderPlaceholder"),
    female: t("birthForm.female"),
    male: t("birthForm.male"),
    other: t("birthForm.other"),
    birthDate: t("birthForm.birthDate"),
    birthTime: t("birthForm.birthTime"),
    presets: t("birthForm.presets"),
    placeName: t("birthForm.placeName"),
    placePlaceholder: t("birthForm.placePlaceholder"),
    latitude: t("birthForm.latitude"),
    longitude: t("birthForm.longitude"),
    timezone: t("birthForm.timezone"),
    hint: t("birthForm.hint"),
    submit: t("birthForm.submit"),
    computing: t("birthForm.computing"),
    invalidDateTime: t("birthForm.invalidDateTime"),
    invalidNumbers: t("birthForm.invalidNumbers"),
    networkError: t("birthForm.networkError"),
    optional: t("birthForm.optional"),
    searching: t("birthForm.searching"),
    searchFailed: t("birthForm.searchFailed"),
    placeNetworkError: t("birthForm.placeNetworkError"),
  };

  const handlePlaceSelected = useCallback(
    async (detail: {
      formattedAddress: string;
      lat: number;
      lng: number;
    }) => {
      setPlaceName(detail.formattedAddress);
      setLat(detail.lat.toFixed(6));
      setLng(detail.lng.toFixed(6));

      const offset = await fetchUtcOffsetHours(detail.lat, detail.lng);
      if (offset !== null) {
        const rounded = Math.round(offset * 1000) / 1000;
        setTz(String(rounded));
      }
    },
    []
  );

  function applyPreset(p: (typeof PLACE_PRESETS)[number]) {
    setPlaceName(p.name);
    setLat(String(p.lat));
    setLng(String(p.lng));
    setTz(String(p.tz));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    const [y, mo, d] = birthDate.split("-").map(Number);
    const [hh, mm] = birthTime.split(":").map(Number);
    if (!y || !mo || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
      onError(text.invalidDateTime);
      return;
    }
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    const tzN = parseFloat(tz);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN) || !Number.isFinite(tzN)) {
      onError(text.invalidNumbers);
      return;
    }

    const resolvedPlace =
      placePhotonRef.current?.getValue()?.trim() ||
      placeName.trim() ||
      "Birth place";

    const body: Record<string, unknown> = {
      birth: {
        year: y,
        month: mo,
        day: d,
        hour: hh,
        minute: mm,
        second: 0,
      },
      place: {
        name: resolvedPlace,
        lat: latN,
        lng: lngN,
        tz: tzN,
      },
      transit: null,
    };
    if (name.trim()) body.name = name.trim();
    if (gender) body.gender = gender;

    setSubmitting(true);
    try {
      const res = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ChartDataPayload & { error?: string };
      if (!res.ok) {
        onError(
          typeof json.error === "string"
            ? json.error
            : `Request failed (${res.status})`
        );
        return;
      }
      if ("error" in json && json.error) {
        onError(json.error);
        return;
      }
      onSuccess(json as ChartDataPayload);
    } catch (err) {
      onError(err instanceof Error ? err.message : text.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className={`${styles.form} ${dark ? styles.formDark : ""}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.row}>
        <label className={styles.field}>
          <span>{text.name}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={text.optional}
            autoComplete="name"
          />
        </label>
        <label className={styles.field}>
          <span>{text.gender}</span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">{text.genderPlaceholder}</option>
            <option value="female">{text.female}</option>
            <option value="male">{text.male}</option>
            <option value="other">{text.other}</option>
          </select>
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>{text.birthDate}</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span>{text.birthTime}</span>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
          />
        </label>
      </div>

      <div className={styles.presets}>
        <span className={styles.presetsLabel}>{text.presets}</span>
        <div className={styles.presetBtns}>
          {PLACE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={styles.presetBtn}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <PlacePhotonField
        ref={placePhotonRef}
        className={styles.field}
        label={text.placeName}
        placeholder={text.placePlaceholder}
        searchingText={text.searching}
        searchFailedText={text.searchFailed}
        networkErrorText={text.placeNetworkError}
        syncValue={placeName}
        onPlaceSelected={handlePlaceSelected}
        required
        dark={dark}
      />

      <div className={styles.rowThree}>
        <label className={styles.field}>
          <span>{text.latitude}</span>
          <input
            type="text"
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span>{text.longitude}</span>
          <input
            type="text"
            inputMode="decimal"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span>{text.timezone}</span>
          <input
            type="text"
            inputMode="decimal"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            required
          />
        </label>
      </div>

      <p className={styles.hint}>{text.hint}</p>

      <button
        type="submit"
        className={styles.submit}
        disabled={submitting}
      >
        {submitting ? text.computing : text.submit}
      </button>
    </form>
  );
}
