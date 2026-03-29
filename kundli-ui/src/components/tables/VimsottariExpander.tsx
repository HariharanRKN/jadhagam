"use client";

import type {
  AntaraRow,
  BhuktiRow,
  MahadashaRow,
  SookshmaRow,
  VimsottariLabelsTa,
} from "@/types/chartData";
import { compareDashaStart, lordTamil } from "@/lib/tamilDasha";
import styles from "./TamilTables.module.css";

interface Props {
  mahas: MahadashaRow[];
  bhukti: BhuktiRow[];
  antara: AntaraRow[];
  sookshma: SookshmaRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
}

function DateRange({ start, end }: { start: string; end: string | null }) {
  return (
    <span className={styles.dates}>
      {start} → {end ?? "—"}
    </span>
  );
}

export function VimsottariExpander({
  mahas,
  bhukti,
  antara,
  sookshma,
  labels,
  dark,
}: Props) {
  const mahasSorted = [...mahas].sort((a, b) =>
    compareDashaStart(a.start, b.start)
  );

  const bhuktiByMaha = (mahaLord: number) =>
    bhukti
      .filter((b) => b.maha === mahaLord)
      .sort((a, b) => compareDashaStart(a.start, b.start));

  const antaraBy = (mahaLord: number, bhuktiLord: number) =>
    antara
      .filter((a) => a.maha === mahaLord && a.bhukti === bhuktiLord)
      .sort((a, b) => compareDashaStart(a.start, b.start));

  const sookshmaBy = (
    mahaLord: number,
    bhuktiLord: number,
    antaraLord: number
  ) =>
    sookshma
      .filter(
        (s) =>
          s.maha === mahaLord &&
          s.bhukti === bhuktiLord &&
          s.antara === antaraLord
      )
      .sort((a, b) => compareDashaStart(a.start, b.start));

  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>
        {labels.dashaTitle} — {labels.mahadasha} / {labels.bhukti} /{" "}
        {labels.antara} / {labels.sookshma}
      </h2>
      <p className={styles.loading} style={{ marginBottom: "0.75rem" }}>
        ஒவ்வொரு மஹா தசையையும் விரிவாக்கி புக்தி, அந்தர்தசை, சூக்ஷ்ம தசை
        கால வரம்புகளைக் காணலாம்.
      </p>

      <div className={styles.expander}>
        {mahasSorted.map((m) => (
          <details key={`m-${m.lord}-${m.start}`}>
            <summary>
              <span>
                {labels.mahadasha}: {lordTamil(m.lord)}
              </span>
              <DateRange start={m.start} end={m.end} />
            </summary>
            <div className={styles.nested}>
              {bhuktiByMaha(m.lord).map((b) => (
                <details key={`b-${b.lord}-${b.start}`}>
                  <summary>
                    <span>
                      {labels.bhukti}: {lordTamil(b.lord)}
                    </span>
                    <DateRange start={b.start} end={b.end} />
                  </summary>
                  <div className={styles.nested}>
                    {antaraBy(m.lord, b.lord).map((a) => (
                      <details key={`a-${a.lord}-${a.start}`}>
                        <summary>
                          <span>
                            {labels.antara}: {lordTamil(a.lord)}
                          </span>
                          <DateRange start={a.start} end={a.end} />
                        </summary>
                        <div className={styles.nested}>
                          {sookshmaBy(m.lord, b.lord, a.lord).map((sk) => (
                            <div
                              key={`sk-${sk.lord}-${sk.start}`}
                              className={styles.leaf}
                            >
                              <span>
                                {labels.sookshma}: {lordTamil(sk.lord)}
                              </span>
                              <DateRange start={sk.start} end={sk.end} />
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
