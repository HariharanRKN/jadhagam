import type { PlanetRow, VimsottariLabelsTa } from "@/types/chartData";
import styles from "./TamilTables.module.css";

interface Props {
  natal: PlanetRow[];
  transit: PlanetRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
}

function PlanetTable({
  rows,
  labels,
}: {
  rows: PlanetRow[];
  labels: VimsottariLabelsTa;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{labels.planet}</th>
            <th>{labels.rasi}</th>
            <th>{labels.deg}</th>
            <th>{labels.totalDegTa}</th>
            <th>{labels.nakshatra}</th>
            <th>{labels.pada}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.planetId}>
              <td>
                <strong>{r.planetTa}</strong>
                <span className={styles.mono}> ({r.planetEn})</span>
              </td>
              <td>{r.rasiTa}</td>
              <td className={styles.mono}>{r.degInSign.toFixed(2)}°</td>
              <td className={styles.mono}>
                {typeof r.totalLongitude === "number"
                  ? `${r.totalLongitude.toFixed(2)}°`
                  : "—"}
              </td>
              <td>{r.nakshatraTa}</td>
              <td>{r.pada}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlanetaryTableTamil({ natal, transit, labels, dark }: Props) {
  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>{labels.natalTitle}</h2>
      <PlanetTable rows={natal} labels={labels} />

      <h2 className={styles.sectionTitle}>{labels.transitTitle}</h2>
      <PlanetTable rows={transit} labels={labels} />
    </section>
  );
}
