"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { BirthInputForm } from "@/components/BirthInputForm";
import { SouthIndianChart } from "@/components/SouthIndianChart/SouthIndianChart";
import { dignityWord } from "@/i18n/astro";
import { getMessage, useTranslations } from "@/i18n/useTranslations";
import { formatMatchedRoles } from "@/lib/prediction/events/marriageLocale";
import type { ChartDataPayload } from "@/types/chartData";
import type { MarriagePrediction } from "@/lib/prediction/events";
import { lordEnglish, lordTamil } from "@/lib/tamilDasha";
import styles from "./page.module.css";

function rasiForHouse(ascendantRasi: number, houseNumber: 3 | 7 | 11) {
  return (ascendantRasi + houseNumber - 1) % 12;
}

function verdictLabel(
  v: "strong" | "supportive" | "weak",
  t: (k: string) => string
): string {
  if (v === "strong") return t("marriage2.verdictStrong");
  if (v === "supportive") return t("marriage2.verdictSupportive");
  return t("marriage2.verdictWeak");
}

function lordName(lang: "en" | "ta", id: number): string {
  return lang === "en" ? lordEnglish(id) : lordTamil(id);
}

export default function MarriageTwoPage() {
  const { language } = useLanguage();
  const { t } = useTranslations();
  const [chart, setChart] = useState<ChartDataPayload | null>(null);
  const [prediction, setPrediction] = useState<MarriagePrediction | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  const rules = useMemo(
    () => [
      t("marriage2.rule0"),
      t("marriage2.rule1"),
      t("marriage2.rule2"),
      t("marriage2.rule3"),
    ],
    [t]
  );

  const highlightedRasis = useMemo(() => {
    if (!chart) return [];
    return [3, 7, 11].map((house) =>
      rasiForHouse(chart.birth.ascendantRasi, house as 3 | 7 | 11)
    );
  }, [chart]);

  function handleChartSuccess(nextChart: ChartDataPayload) {
    setChart(nextChart);
    setRequestError(null);
  }

  useEffect(() => {
    if (!chart) {
      setPrediction(null);
      return;
    }
    let cancelled = false;
    setLoadingPrediction(true);
    setRequestError(null);
    void (async () => {
      try {
        const res = await fetch("/api/prediction/marriage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chart, language }),
        });
        const json = (await res.json()) as MarriagePrediction & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Prediction failed (${res.status})`);
        }
        if (!cancelled) {
          setPrediction(json);
        }
      } catch (error) {
        if (!cancelled) {
          setPrediction(null);
          setRequestError(
            error instanceof Error
              ? error.message
              : getMessage(language, "marriage2.predictionFailed")
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPrediction(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, language]);

  function placementLine(
    planetEn: string,
    planetTa: string,
    signEn: string,
    signTa: string,
    house: number
  ): string {
    if (language === "ta") {
      return `${planetTa} ${signTa}-இில் ${house}ஆம் பாவம்`;
    }
    return `${planetEn} in ${signEn}, house ${house}`;
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{t("marriage2.kicker")}</p>
          <h1>{t("marriage2.title")}</h1>
          <p className={styles.intro}>{t("marriage2.intro")}</p>
        </div>
        <div className={styles.ruleCard}>
          <h2>{t("marriage2.currentRuleSet")}</h2>
          <ul>
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.formSection}>
        <BirthInputForm
          onSuccess={(data) => {
            void handleChartSuccess(data);
          }}
          onError={(message) => setRequestError(message || null)}
        />
        {requestError ? <p className={styles.error}>{requestError}</p> : null}
      </section>

      <section className={styles.resultsSection}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>{t("marriage2.predictionOutput")}</p>
            <h2>{t("marriage2.marriageAssessment")}</h2>
          </div>
          {loadingPrediction ? (
            <p className={styles.loading}>{t("marriage2.building")}</p>
          ) : null}
        </div>

        {prediction ? (
          <div className={styles.resultsGrid}>
            <article className={styles.scoreCard}>
              <span className={styles.scoreLabel}>{t("marriage2.marriageStrength")}</span>
              <strong className={styles.scoreValue}>
                {prediction.overview.marriageStrengthScore}
              </strong>
              <p className={styles.scoreSummary}>{prediction.overview.summary}</p>
            </article>

            <article className={styles.signalCard}>
              <h3>{t("marriage2.marriageFoundation")}</h3>
              <p className={styles.signalValue}>
                {t("marriage2.activation")}: {prediction.overview.activationScore}
              </p>
              <p>{prediction.foundation.summary}</p>
              <ul className={styles.compactList}>
                {prediction.foundation.positives.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>

            <article className={styles.signalCard}>
              <h3>{t("marriage2.guruKochar")}</h3>
              {prediction.guruKochar ? (
                <>
                  <p>
                    {t("marriage2.transitHouse")}: {prediction.guruKochar.transitHouseFromAsc}
                  </p>
                  <p className={styles.signalValue}>
                    {prediction.guruKochar.favorable
                      ? t("marriage2.guruTriggerYes")
                      : t("marriage2.guruTriggerNo")}
                  </p>
                  <ul className={styles.compactList}>
                    {prediction.guruKochar.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{t("marriage2.noGuruKochar")}</p>
              )}
            </article>

            <article className={styles.chartCard}>
              <h3>{t("marriage2.natalChart")}</h3>
              {chart ? (
                <SouthIndianChart
                  planetsByRasi={chart.birth.planetsByRasi}
                  ascendantRasi={chart.birth.ascendantRasi}
                  highlightedRasis={highlightedRasis}
                  title={t("marriage2.chartTitleMarriage")}
                />
              ) : (
                <p className={styles.emptyState}>{t("marriage2.chartPrompt")}</p>
              )}
            </article>

            <article className={styles.housePanel}>
              <h3>{t("marriage2.primaryMarriageHouses")}</h3>
              <div className={styles.houseList}>
                {prediction.foundation.marriageHouses.map((signal) => (
                  <section key={signal.houseNumber} className={styles.houseCard}>
                    <div className={styles.houseHeader}>
                      <strong>
                        {t("marriage2.house")} {signal.houseNumber}
                      </strong>
                      <span>
                        {language === "ta"
                          ? `${signal.signTa} • ${signal.houseLord.planetTa}`
                          : `${signal.signEn} • ${signal.houseLord.planetEn}`}
                      </span>
                    </div>
                    <p className={styles.houseMeta}>
                      {t("marriage2.structural")} {signal.structuralScore} •{" "}
                      {t("marriage2.aggregate")} {signal.aggregateScore}
                    </p>
                    <p className={styles.houseSummary}>{signal.summary}</p>
                    <div className={styles.dualList}>
                      <div>
                        <h4>{t("marriage2.support")}</h4>
                        <ul className={styles.compactList}>
                          {signal.positives.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4>{t("marriage2.challenges")}</h4>
                        <ul className={styles.compactList}>
                          {signal.challenges.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </article>

            <article className={styles.notesPanel}>
              <div>
                <h3>{t("marriage2.seventhLordPlacement")}</h3>
                {prediction.foundation.seventhLord ? (
                  <>
                    <p className={styles.signalValue}>
                      {placementLine(
                        prediction.foundation.seventhLord.planet.planetEn,
                        prediction.foundation.seventhLord.planet.planetTa,
                        prediction.foundation.seventhLord.signEn,
                        prediction.foundation.seventhLord.signTa,
                        prediction.foundation.seventhLord.houseFromAsc
                      )}
                    </p>
                    <p>
                      {t("marriage2.strength")}: {prediction.foundation.seventhLord.strength} •{" "}
                      {dignityWord(
                        language,
                        prediction.foundation.seventhLord.dignity
                      )}
                    </p>
                    <ul className={styles.compactList}>
                      {prediction.foundation.seventhLord.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>{t("marriage2.noSeventhLord")}</p>
                )}
              </div>
              <div>
                <h3>{t("marriage2.shukraKarakathuva")}</h3>
                {prediction.foundation.shukraKarakathuva ? (
                  <>
                    <p className={styles.signalValue}>
                      {placementLine(
                        prediction.foundation.shukraKarakathuva.planet.planetEn,
                        prediction.foundation.shukraKarakathuva.planet.planetTa,
                        prediction.foundation.shukraKarakathuva.signEn,
                        prediction.foundation.shukraKarakathuva.signTa,
                        prediction.foundation.shukraKarakathuva.houseFromAsc
                      )}
                    </p>
                    <p>
                      {t("marriage2.strength")}: {prediction.foundation.shukraKarakathuva.strength}{" "}
                      •{" "}
                      {dignityWord(
                        language,
                        prediction.foundation.shukraKarakathuva.dignity
                      )}
                    </p>
                    <ul className={styles.compactList}>
                      {prediction.foundation.shukraKarakathuva.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>{t("marriage2.noShukra")}</p>
                )}
              </div>
            </article>

            <article className={styles.notesPanel}>
              <div>
                <h3>{t("marriage2.guruKarakathuva")}</h3>
                {prediction.foundation.guruKarakathuva ? (
                  <>
                    <p className={styles.signalValue}>
                      {placementLine(
                        prediction.foundation.guruKarakathuva.planet.planetEn,
                        prediction.foundation.guruKarakathuva.planet.planetTa,
                        prediction.foundation.guruKarakathuva.signEn,
                        prediction.foundation.guruKarakathuva.signTa,
                        prediction.foundation.guruKarakathuva.houseFromAsc
                      )}
                    </p>
                    <p>
                      {t("marriage2.strength")}: {prediction.foundation.guruKarakathuva.strength} •{" "}
                      {dignityWord(
                        language,
                        prediction.foundation.guruKarakathuva.dignity
                      )}
                    </p>
                    <ul className={styles.compactList}>
                      {prediction.foundation.guruKarakathuva.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>{t("marriage2.noGuru")}</p>
                )}
              </div>
            </article>

            <article className={styles.notesPanel}>
              <div>
                <h3>{t("marriage2.marriagePeriodSequence")}</h3>
                <p className={styles.houseSummary}>{prediction.periodSequence.summary}</p>
                {prediction.periodSequence.current ? (
                  <div className={styles.sequenceCard}>
                    <strong>{t("marriage2.currentPeriodHeading")}</strong>
                    <p>
                      {t("marriage2.mahaLabel")}{" "}
                      {lordName(language, prediction.periodSequence.current.maha)} •{" "}
                      {t("marriage2.bhuktiLabel")}{" "}
                      {lordName(language, prediction.periodSequence.current.bhukti)} •{" "}
                      {t("marriage2.antaraLabel")}{" "}
                      {lordName(language, prediction.periodSequence.current.antara)}
                    </p>
                    <p>
                      {t("marriage2.scoreLabel")} {prediction.periodSequence.current.score} •{" "}
                      {verdictLabel(prediction.periodSequence.current.verdict, t)}
                    </p>
                    <ul className={styles.compactList}>
                      {prediction.periodSequence.current.notes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p>{t("marriage2.noCurrentPeriod")}</p>
                )}
              </div>
              <div>
                <h3>{t("marriage2.upcomingWindows")}</h3>
                <div className={styles.sequenceList}>
                  {prediction.periodSequence.upcoming.map((row) => (
                    <div
                      key={`${row.start}-${row.maha}-${row.bhukti}-${row.antara}`}
                      className={styles.sequenceCard}
                    >
                      <strong>
                        {row.start.slice(0, 10)} • {verdictLabel(row.verdict, t)}
                      </strong>
                      <p>
                        {t("marriage2.scoreLabel")} {row.score}
                      </p>
                      <p>
                        {formatMatchedRoles(language, row.matchedRoles) ||
                          t("marriage2.noMarriageRoles")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className={styles.notesPanel}>
              <div>
                <h3>{t("marriage2.positiveFactors")}</h3>
                <ul className={styles.compactList}>
                  {prediction.reasoning.positives.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{t("marriage2.challengeFactors")}</h3>
                <ul className={styles.compactList}>
                  {prediction.reasoning.challenges.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <h3>{t("marriage2.noMarriageResult")}</h3>
            <p>{t("marriage2.submitPrompt")}</p>
          </div>
        )}
      </section>

      <section className={styles.jsonSection}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>{t("marriage2.debugData")}</p>
            <h2>{t("marriage2.storedJson")}</h2>
          </div>
        </div>
        <pre className={styles.jsonBlock}>
          {JSON.stringify(
            {
              chart,
              prediction,
            },
            null,
            2
          )}
        </pre>
      </section>
    </main>
  );
}
