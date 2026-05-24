"use client";

import { useMemo, useState } from "react";
import formStyles from "../birthForm.module.css";
import styles from "./page.module.css";

type AskResponse = {
  error?: string;
  chosen?: { event: string; confidence: number; rationale: string };
  semantic?: unknown;
};

function topDims(v: Record<string, number> | null | undefined): Array<[string, number]> {
  if (!v) return [];
  return Object.entries(v)
    .filter(([, val]) => typeof val === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export default function AskPage() {
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [mode, setMode] = useState<"now" | "timeline">("timeline");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AskResponse | null>(null);

  // /api/ask returns { semantic: <response from /api/semantic> }.
  const semanticObj =
    res?.semantic && typeof res.semantic === "object" && res.semantic !== null ? (res.semantic as Record<string, unknown>) : null;
  const semanticInner =
    semanticObj && typeof semanticObj.semantic === "object" && semanticObj.semantic !== null
      ? (semanticObj.semantic as Record<string, unknown>)
      : null;

  // mode=now => semantic.semantic_api output is nested under `semantic`.
  const semanticNow =
    semanticInner && typeof semanticInner.semantic === "object" && semanticInner.semantic !== null
      ? (semanticInner.semantic as Record<string, unknown>)
      : null;

  // mode=timeline => semantic.semantic_api output is at `semantic` root (rankedPeriods).
  const semanticTimeline = semanticInner;

  const dashaVector =
    semanticNow && typeof semanticNow.dashaVector === "object" && semanticNow.dashaVector !== null
      ? (semanticNow.dashaVector as Record<string, number>)
      : undefined;
  const scores =
    semanticNow && typeof semanticNow.scores === "object" && semanticNow.scores !== null
      ? (semanticNow.scores as Record<string, number>)
      : undefined;

  const rankedPeriods = Array.isArray(semanticTimeline?.rankedPeriods) ? (semanticTimeline?.rankedPeriods as unknown[]) : [];

  const topVector = useMemo(() => topDims(dashaVector), [dashaVector]);

  async function onSubmit() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dob,
          tob,
          place,
          questionText,
          category: category || undefined,
          mode,
          limit,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as AskResponse;
      if (!r.ok) {
        setRes({ error: j.error ?? "Request failed" });
      } else {
        setRes(j);
      }
    } catch (e) {
      setRes({ error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Ask (Semantic + Gemini)</h1>
        <p>Enter birth details and your question. The server maps your question to an event template and scores it against the current dasha.</p>
      </header>

      <section className={formStyles.form}>
        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span>DOB (YYYY-MM-DD)</span>
            <input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="1994-05-10" />
          </label>
          <label className={formStyles.field}>
            <span>Time of birth (HH:MM or HH:MM:SS)</span>
            <input value={tob} onChange={(e) => setTob(e.target.value)} placeholder="17:00:00" />
          </label>
        </div>

        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span>Place of birth</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Pondicherry, India" />
          </label>
          <label className={formStyles.field}>
            <span>Category (optional)</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">(auto)</option>
              <option value="Marriage">Marriage</option>
              <option value="Relationship">Relationship</option>
              <option value="Work">Work</option>
              <option value="Money">Money</option>
              <option value="Family">Family</option>
            </select>
          </label>
        </div>

        <div className={formStyles.row}>
          <label className={formStyles.field}>
            <span>Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value === "now" ? "now" : "timeline")}>
              <option value="timeline">Timeline (find best periods)</option>
              <option value="now">Now (current period score)</option>
            </select>
          </label>
          <label className={formStyles.field}>
            <span>Timeline limit</span>
            <input
              value={String(limit)}
              onChange={(e) => setLimit(Math.max(1, Math.min(200, Math.floor(Number(e.target.value) || 20))))}
              placeholder="20"
            />
          </label>
        </div>

        <label className={`${formStyles.field} ${styles.field}`}>
          <span>Question</span>
          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
        </label>

        <button className={formStyles.submit} onClick={onSubmit} disabled={loading}>
          {loading ? "Generating..." : "Generate"}
        </button>
      </section>

      {res?.error ? <div className={styles.error}>{res.error}</div> : null}

      <section className={styles.results}>
        {res?.chosen ? (
          <div className={styles.card}>
            <h2>Chosen Event</h2>
            <pre className={styles.pre}>{JSON.stringify(res.chosen, null, 2)}</pre>
          </div>
        ) : null}

        {scores ? (
          <div className={styles.card}>
            <h2>Scores</h2>
            <pre className={styles.pre}>{JSON.stringify(scores, null, 2)}</pre>
          </div>
        ) : null}

        {mode === "timeline" && rankedPeriods.length ? (
          <div className={styles.card}>
            <h2>Best Periods</h2>
            <pre className={styles.pre}>{JSON.stringify(rankedPeriods.slice(0, 10), null, 2)}</pre>
          </div>
        ) : null}

        {topVector.length ? (
          <div className={styles.card}>
            <h2>Top Dimensions (Current Dasha Vector)</h2>
            <pre className={styles.pre}>{JSON.stringify(topVector, null, 2)}</pre>
          </div>
        ) : null}
      </section>
    </main>
  );
}
