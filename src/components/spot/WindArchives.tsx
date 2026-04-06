"use client";

import { useState, useEffect } from "react";
import { windDirectionLabel, MONTHS } from "@/lib/utils";
import type { WindArchiveData, MonthStats } from "@/types";
import { Archive, Wind, Calendar, TrendingUp, ChevronDown } from "lucide-react";

const SHORT_MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function pctColor(pct: number): string {
  if (pct >= 60) return "#2e7d32";
  if (pct >= 40) return "#5cb85c";
  if (pct >= 25) return "#a8d8a8";
  if (pct >= 15) return "#ffa726";
  return "#e0e0e0";
}

interface Props {
  spotId: string;
  useKnots?: boolean;
}

const toKts = (kmh: number) => Math.round(kmh / 1.852);

export function WindArchives({ spotId, useKnots = true }: Props) {
  const [data, setData] = useState<WindArchiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showYears, setShowYears] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/spots/${spotId}/archives`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: WindArchiveData) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spotId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-32 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-sm text-gray-400 text-center py-4">
          <Archive className="h-5 w-5 mx-auto mb-2 opacity-30" />
          Archives historiques indisponibles
        </div>
      </div>
    );
  }

  const bestIdx = data.bestMonth - 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-gray-100 gap-1">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Archive className="h-4 w-4 text-gray-500" />
          Archives vent · {data.yearRange[0]}–{data.yearRange[1]}
        </h2>
        <span className="text-xs text-gray-400">
          Meilleur mois :{" "}
          <span className="text-gray-700 font-medium">{MONTHS[bestIdx]}</span>
        </span>
      </div>

      {/* Combined averages — main heatmap */}
      <div className="px-4 py-4">
        <div className="text-xs text-gray-500 mb-2 font-medium">
          Moyenne {data.yearRange[0]}–{data.yearRange[1]}
        </div>
        <MonthRow
          months={data.combined}
          bestMonth={data.bestMonth}
          useKnots={useKnots}
        />
      </div>

      {/* Per-year expandable */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowYears((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span>Détail par année</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showYears ? "rotate-180" : ""}`}
          />
        </button>

        {showYears && (
          <div className="px-4 pb-4 space-y-3">
            {data.years.map((yr) => (
              <div key={yr.year}>
                <div className="text-xs text-gray-400 mb-1.5 font-medium">
                  {yr.year}
                </div>
                <MonthRow
                  months={yr.months}
                  bestMonth={0}
                  useKnots={useKnots}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <Wind className="h-3 w-3" /> Vent max jour moyen (
          {useKnots ? "kts" : "km/h"})
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" /> % jours ≥{" "}
          {useKnots ? "8 kts" : "15 km/h"}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Source : Open-Meteo Archive
        </span>
      </div>
    </div>
  );
}

/** Row of 12 month cards as a heatmap */
function MonthRow({
  months,
  bestMonth,
  useKnots = true,
}: {
  months: MonthStats[];
  bestMonth: number;
  useKnots?: boolean;
}) {
  const fmt = (kmh: number) => (useKnots ? toKts(kmh) : Math.round(kmh));
  const unit = useKnots ? "kts" : "km/h";
  return (
    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
      {months.map((m) => {
        const isBest = m.month === bestMonth;
        return (
          <div
            key={m.month}
            className={`relative rounded-lg p-1.5 text-center transition-all ${
              isBest
                ? "ring-2 ring-sky-400 ring-offset-1"
                : "border border-gray-100"
            }`}
            style={{
              background:
                m.dataDays > 0 ? `${pctColor(m.goodDaysPct)}18` : "#f5f5f5",
            }}
            title={`${MONTHS[m.month - 1]} — Moy. ${fmt(m.avgWindKmh)} ${unit} · Max ${fmt(m.maxWindKmh)} ${unit} · ${m.goodDaysPct}% bons jours · Dir. ${windDirectionLabel(m.dominantDirection)} · ${m.dataDays}j de données`}
          >
            <div className="text-[10px] text-gray-500 font-medium mb-0.5">
              {SHORT_MONTHS[m.month - 1]}
            </div>
            {m.dataDays > 0 ? (
              <>
                <div className="text-sm font-bold tabular-nums leading-none text-gray-900">
                  {fmt(m.avgWindKmh)}
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">
                  {m.goodDaysPct}%
                </div>
                <div className="text-[8px] text-gray-400">
                  {windDirectionLabel(m.dominantDirection)}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-gray-300 py-1">—</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
