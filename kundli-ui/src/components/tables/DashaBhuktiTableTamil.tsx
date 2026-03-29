import type { BhuktiRow, VimsottariLabelsTa } from "@/types/chartData";
import { compareDashaStart, lordTamil } from "@/lib/tamilDasha";
import styles from "./TamilTables.module.css";

interface Props {
  rows: BhuktiRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
}

export function DashaBhuktiTableTamil({ rows, labels, dark }: Props) {
  const sorted = [...rows].sort((a, b) => compareDashaStart(a.start, b.start));

  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>
        {labels.dashaTitle} — {labels.mahadasha} / {labels.bhukti}
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{labels.mahadasha}</th>
              <th>{labels.bhukti}</th>
              <th>{labels.start}</th>
              <th>{labels.end}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.maha}-${r.lord}-${r.start}-${i}`}>
                <td>{lordTamil(r.maha)}</td>
                <td>{lordTamil(r.lord)}</td>
                <td className={styles.mono}>{r.start}</td>
                <td className={styles.mono}>{r.end ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
