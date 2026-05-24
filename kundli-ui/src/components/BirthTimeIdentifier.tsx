"use client";

import { useMemo, useState } from "react";
import styles from "@/app/birthForm.module.css";

type LifeEventRow = { type: string; at: string };

type Props = {
  dark?: boolean;
  seed?: { dob: string; tob: string; place: string } | null;
};

const EVENT_TYPE_OPTIONS: Array<{ label: string; key: string }> = [
  { label: "Marriage (timing)", key: "marriage_timing" },
  { label: "Breakup", key: "breakup" },
  { label: "Cheating / Betrayal", key: "cheating_betrayal" },
  { label: "Childbirth (boy)", key: "childbirth_boy" },
  { label: "Childbirth (girl)", key: "childbirth_girl" },
  { label: "Job joined (offer success)", key: "job_offer_success" },
  { label: "Job left / switch blocked", key: "job_switch_blocked" },
  { label: "Fired / job loss", key: "job_loss_fired" },
  { label: "Money blocked", key: "money_blocked" },
  { label: "Wealth growth", key: "wealth_growth" },
  { label: "Property purchase", key: "property_purchase" },
  { label: "Second house purchase", key: "second_house_purchase" },
  { label: "Loan approval success", key: "loan_approval_success" },
  { label: "Relocation / move", key: "relocation_move" },
  { label: "Foreign travel/settlement", key: "foreign_travel_settlement" },
  { label: "Fight with father", key: "fight_father" },
  { label: "Fight with mother", key: "fight_mother" },
  { label: "Fight with brother", key: "fight_brother" },
  { label: "Fight with sister", key: "fight_sister" },
  { label: "Fight with wife / spouse", key: "fight_spouse" },
];

export function BirthTimeIdentifier({ dark, seed }: Props) {
  const [dob, setDob] = useState(seed?.dob ?? "");
  const [tob, setTob] = useState(seed?.tob ?? "");
  const [place, setPlace] = useState(seed?.place ?? "");
  const [deltaMinutes, setDeltaMinutes] = useState(30);
  const [stepSeconds, setStepSeconds] = useState(60);
  const [topK, setTopK] = useState(5);
  const [rows, setRows] = useState<LifeEventRow[]>([{ type: "marriage_timing", at: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  // keep form synced when chart gets recomputed
  useMemo(() => {
    if (seed?.dob) setDob(seed.dob);
    if (seed?.tob) setTob(seed.tob);
    if (seed?.place) setPlace(seed.place);
  }, [seed?.dob, seed?.tob, seed?.place]);

  function updateRow(i: number, patch: Partial<LifeEventRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { type: "breakup", at: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const lifeEvents = rows.filter((r) => r.type && r.at.trim());
      const res = await fetch("/api/birth-time-identify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dob,
          tob,
          place,
          deltaMinutes,
          stepSeconds,
          topK,
          lifeEvents,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? String((json as Record<string, unknown>).error)
            : `Request failed (${res.status})`;
        setError(msg);
        return;
      }
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const topCandidates = useMemo(() => {
    if (!result || typeof result !== "object") return [];
    const obj = result as Record<string, unknown>;
    const top = obj.topCandidates;
    return Array.isArray(top) ? top.slice(0, 3) : [];
  }, [result]);

  return (
    <section className={`${styles.form} ${dark ? styles.formDark : ""}`}>
      <div style={{ marginBottom: 12 }}>
        <strong>Birth Time Identifier (beta)</strong>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Provide a rough birth time + dated life events. The engine searches around the time and finds the best match by dasha/bhukti/antara alignment.
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>DOB (YYYY-MM-DD)</span>
          <input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="1994-05-10" />
        </label>
        <label className={styles.field}>
          <span>Approx birth time (HH:MM or HH:MM:SS)</span>
          <input value={tob} onChange={(e) => setTob(e.target.value)} placeholder="17:00:00" />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Place</span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Pondicherry, India" />
        </label>
        <label className={styles.field}>
          <span>Search window (+/- minutes)</span>
          <input value={String(deltaMinutes)} onChange={(e) => setDeltaMinutes(Number(e.target.value) || 30)} />
        </label>
      </div>

      <div className={styles.rowThree}>
        <label className={styles.field}>
          <span>Step (seconds)</span>
          <input value={String(stepSeconds)} onChange={(e) => setStepSeconds(Number(e.target.value) || 60)} />
        </label>
        <label className={styles.field}>
          <span>Top K</span>
          <input value={String(topK)} onChange={(e) => setTopK(Number(e.target.value) || 5)} />
        </label>
        <div />
      </div>

      <div style={{ marginTop: 8, marginBottom: 8, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.8 }}>
        Life events
      </div>

      {rows.map((r, i) => (
        <div key={i} className={styles.row} style={{ alignItems: "end" }}>
          <label className={styles.field}>
            <span>Type</span>
            <select value={r.type} onChange={(e) => updateRow(i, { type: e.target.value })}>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Date/time (ISO or YYYY-MM-DD)</span>
            <input value={r.at} onChange={(e) => updateRow(i, { at: e.target.value })} placeholder="2022-08-01" />
          </label>
          <button type="button" className={styles.presetBtn} onClick={() => removeRow(i)} disabled={rows.length <= 1}>
            Remove
          </button>
        </div>
      ))}

      <div className={styles.presetBtns} style={{ marginTop: 8 }}>
        <button type="button" className={styles.presetBtn} onClick={addRow}>
          Add event
        </button>
      </div>

      <button type="button" className={styles.submit} onClick={run} disabled={loading}>
        {loading ? "Computing..." : "Identify birth time"}
      </button>

      {error ? (
        <p style={{ marginTop: 10, color: "#991b1b", whiteSpace: "pre-wrap" }} role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.8, marginBottom: 6 }}>
            Top 3 candidates
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #cbd5e1" }}>Rank</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #cbd5e1" }}>Birth time</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #cbd5e1" }}>Avg score</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #cbd5e1" }}>Delta</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #cbd5e1" }}>Events matched</th>
                </tr>
              </thead>
              <tbody>
                {topCandidates.map((c, idx) => {
                  const row = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
                  const candidateTob = typeof row.candidateTob === "string" ? row.candidateTob : "";
                  const avgScore = typeof row.avgScore === "number" ? row.avgScore : null;
                  const deltaSeconds = typeof row.deltaSeconds === "number" ? row.deltaSeconds : null;
                  const matchedEvents = Array.isArray(row.matchedEvents) ? row.matchedEvents.length : null;
                  const deltaLabel =
                    deltaSeconds == null
                      ? ""
                      : `${deltaSeconds >= 0 ? "+" : ""}${Math.round((deltaSeconds / 60) * 100) / 100}m`;
                  return (
                    <tr key={idx}>
                      <td style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>{idx + 1}</td>
                      <td style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>{candidateTob}</td>
                      <td style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>
                        {avgScore == null ? "" : avgScore.toFixed(4)}
                      </td>
                      <td style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>{deltaLabel}</td>
                      <td style={{ padding: "8px 6px", borderBottom: "1px solid #e2e8f0" }}>
                        {matchedEvents == null ? "" : matchedEvents}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.presetBtns} style={{ marginTop: 8 }}>
            <button type="button" className={styles.presetBtn} onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "Hide raw response" : "Show raw response"}
            </button>
          </div>
          {showRaw ? (
            <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
