"use client";

import { VIMSOTTARI_LABELS_EN } from "@/i18n/vimsottariLabelsEn";
import { useTranslations } from "@/i18n/useTranslations";
import { periodKey, type OpenPeriod } from "@/lib/antara/period";
import type {
  AntaraRow,
  BhuktiRow,
  MahadashaRow,
  SookshmaRow,
  VimsottariLabelsTa,
} from "@/types/chartData";
import { compareDashaStart, lordEnglish, lordTamil } from "@/lib/tamilDasha";
import styles from "./TamilTables.module.css";

interface Props {
  mahas: MahadashaRow[];
  bhukti: BhuktiRow[];
  antara: AntaraRow[];
  sookshma: SookshmaRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
  onOpenPeriod?: (period: OpenPeriod) => void;
  activeKey?: string | null;
}

function DateRange({ start, end }: { start: string; end: string | null }) {
  return (
    <span className={styles.dates}>
      {start} → {end ?? "—"}
    </span>
  );
}

function OpenPeriodButton({
  period,
  label,
  onOpenPeriod,
}: {
  period: OpenPeriod;
  label: string;
  onOpenPeriod?: (period: OpenPeriod) => void;
}) {
  if (!onOpenPeriod) return null;
  return (
    <button
      type="button"
      className={styles.openPeriod}
      aria-label={label}
      data-antara-open={period.level}
      data-antara-start={period.start}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenPeriod(period);
      }}
    >
      ›
    </button>
  );
}

export function VimsottariExpander({
  mahas,
  bhukti,
  antara,
  sookshma,
  labels,
  dark,
  onOpenPeriod,
  activeKey,
}: Props) {
  const { t, language, interpolate: ti } = useTranslations();
  const tableLabels = language === "en" ? VIMSOTTARI_LABELS_EN : labels;
  const lord = (id: number) => (language === "en" ? lordEnglish(id) : lordTamil(id));
  const intro = t("tables.vimsottariExpanderIntro");

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
        {tableLabels.dashaTitle} — {tableLabels.mahadasha} / {tableLabels.bhukti} /{" "}
        {tableLabels.antara} / {tableLabels.sookshma}
      </h2>
      <p className={styles.loading} style={{ marginBottom: "0.75rem" }}>
        {intro}
      </p>

      <div className={styles.expander}>
        {mahasSorted.map((m) => {
          const mahaPeriod: OpenPeriod = {
            level: "maha",
            mahaLord: m.lord,
            bhuktiLord: null,
            antaraLord: null,
            start: m.start,
            end: m.end,
          };
          return (
          <details
            key={`m-${m.lord}-${m.start}`}
            className={activeKey === periodKey(mahaPeriod) ? styles.periodActive : undefined}
          >
            <summary>
              <span>
                {tableLabels.mahadasha}: {lord(m.lord)}
              </span>
              <DateRange start={m.start} end={m.end} />
              <OpenPeriodButton
                period={mahaPeriod}
                label={ti("antara.openPeriod", {
                  level: tableLabels.mahadasha,
                  lord: lord(m.lord),
                })}
                onOpenPeriod={onOpenPeriod}
              />
            </summary>
            <div className={styles.nested}>
              {bhuktiByMaha(m.lord).map((b) => {
                const bhuktiPeriod: OpenPeriod = {
                  level: "bhukti",
                  mahaLord: m.lord,
                  bhuktiLord: b.lord,
                  antaraLord: null,
                  start: b.start,
                  end: b.end,
                };
                return (
                <details
                  key={`b-${b.lord}-${b.start}`}
                  className={activeKey === periodKey(bhuktiPeriod) ? styles.periodActive : undefined}
                >
                  <summary>
                    <span>
                      {tableLabels.bhukti}: {lord(b.lord)}
                    </span>
                    <DateRange start={b.start} end={b.end} />
                    <OpenPeriodButton
                      period={bhuktiPeriod}
                      label={ti("antara.openPeriod", {
                        level: tableLabels.bhukti,
                        lord: lord(b.lord),
                      })}
                      onOpenPeriod={onOpenPeriod}
                    />
                  </summary>
                  <div className={styles.nested}>
                    {antaraBy(m.lord, b.lord).map((a) => {
                      const antaraPeriod: OpenPeriod = {
                        level: "antara",
                        mahaLord: m.lord,
                        bhuktiLord: b.lord,
                        antaraLord: a.lord,
                        start: a.start,
                        end: a.end,
                      };
                      return (
                      <details
                        key={`a-${a.lord}-${a.start}`}
                        className={
                          activeKey === periodKey(antaraPeriod) ? styles.periodActive : undefined
                        }
                      >
                        <summary>
                          <span>
                            {tableLabels.antara}: {lord(a.lord)}
                          </span>
                          <DateRange start={a.start} end={a.end} />
                          <OpenPeriodButton
                            period={antaraPeriod}
                            label={ti("antara.openPeriod", {
                              level: tableLabels.antara,
                              lord: lord(a.lord),
                            })}
                            onOpenPeriod={onOpenPeriod}
                          />
                        </summary>
                        <div className={styles.nested}>
                          {sookshmaBy(m.lord, b.lord, a.lord).map((sk) => (
                            <div
                              key={`sk-${sk.lord}-${sk.start}`}
                              className={styles.leaf}
                            >
                              <span>
                                {tableLabels.sookshma}: {lord(sk.lord)}
                              </span>
                              <DateRange start={sk.start} end={sk.end} />
                            </div>
                          ))}
                        </div>
                      </details>
                      );
                    })}
                  </div>
                </details>
                );
              })}
            </div>
          </details>
          );
        })}
      </div>
    </section>
  );
}
