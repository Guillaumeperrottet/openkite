"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";
import { windColor, windConditionLabel } from "@/lib/utils";
import type { SpotWithForecast } from "@/types";

function scoreColor(score: number): string {
  if (score >= 70) return "#2e7d32";
  if (score >= 45) return "#f59e0b";
  if (score >= 20) return "#9ca3af";
  return "#d1d5db";
}

interface SpotResultCardProps {
  spot: SpotWithForecast;
  activeDayIdx: number;
  hasLocation: boolean;
  isMultiDay: boolean;
  onHover: (id: string | null) => void;
  onSelectDay: (spotId: string, dayIdx: number) => void;
}

export function SpotResultCard({
  spot,
  activeDayIdx,
  hasLocation,
  isMultiDay,
  onHover,
  onSelectDay,
}: SpotResultCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hoveredBarCell, setHoveredBarCell] = useState<number | null>(null);

  const activeDay = spot.days?.[activeDayIdx];
  const bestDay = activeDay;
  const sc = activeDay?.score ?? spot.bestScore ?? 0;
  const isForecastError = spot.forecastError;

  if (!bestDay && !isForecastError) return null;
  const color = bestDay ? windColor(bestDay.peakWindKmh) : "#d1d5db";

  return (
    <div
      className="rounded-xl bg-white border border-gray-200 hover:border-sky-400/60 hover:shadow-sm transition-all"
      onMouseEnter={() => onHover(spot.id)}
      onMouseLeave={() => onHover(null)}
    >
      <Link href={`/spots/${spot.id}`} className="block p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {spot.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {[spot.region, spot.country].filter(Boolean).join(", ")}
              {hasLocation && (
                <>
                  {" · "}
                  {Math.round(spot.distanceKm)} km
                </>
              )}
              {" · "}
              {spot.sportType === "KITE" ? "🪁" : "🪂"}
              {spot.dataSource === "archive" && (
                <span className="text-amber-500 ml-0.5">{" 📊"}</span>
              )}
            </p>
          </div>
          {/* Score badge — tap toggles detail */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDetail(!showDetail);
              }}
              className="shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white"
              style={{
                background: isForecastError ? "#9ca3af" : scoreColor(sc),
              }}
            >
              {isForecastError ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <>
                  <span className="text-base font-bold leading-none">{sc}</span>
                  <span className="text-[8px] opacity-80">/100</span>
                </>
              )}
            </button>
            {/* Score breakdown popover */}
            {showDetail && bestDay?.breakdown && (
              <ScoreBreakdown
                breakdown={bestDay.breakdown}
                sportType={spot.sportType}
              />
            )}
          </div>
        </div>

        {/* Forecast error */}
        {isForecastError && (
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-orange-400" />
            Prévisions indisponibles
          </div>
        )}

        {/* Wind summary */}
        {bestDay && (
          <>
            <WindSummaryBar
              spot={spot}
              bestDay={bestDay}
              color={color}
              showHelp={showHelp}
              onToggleHelp={() => setShowHelp(!showHelp)}
            />

            {/* Mini forecast bar */}
            {bestDay.forecast.length > 0 && (
              <ForecastBar
                forecast={bestDay.forecast}
                sportType={spot.sportType}
                hoveredIdx={hoveredBarCell}
                onHover={setHoveredBarCell}
              />
            )}
          </>
        )}

        {/* Multi-day strip */}
        {isMultiDay && spot.days && spot.days.length > 1 && (
          <MultiDayStrip
            days={spot.days}
            bestDayIndex={spot.bestDayIndex ?? 0}
            activeDayIdx={activeDayIdx}
            spotId={spot.id}
            onSelectDay={onSelectDay}
          />
        )}
      </Link>
    </div>
  );
}

// ── Score Breakdown Popover ───────────────────────────────────────────────────

function ScoreBreakdown({
  breakdown,
  sportType,
}: {
  breakdown: {
    hours: number;
    quality: number;
    regularity: number;
    direction: number;
    sunshine?: number;
  };
  sportType: string;
}) {
  const rows =
    sportType === "PARAGLIDE"
      ? [
          ["Calme", breakdown.hours, "30%"],
          ["Soleil", breakdown.sunshine ?? 0, "30%"],
          ["Rafales", breakdown.regularity, "20%"],
          ["Pluie", breakdown.quality, "20%"],
        ]
      : [
          ["Heures", breakdown.hours, "35%"],
          ["Qualité vent", breakdown.quality, "25%"],
          ["Régularité", breakdown.regularity, "20%"],
          ["Direction", breakdown.direction, "20%"],
        ];

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl w-44">
      <div className="font-semibold mb-1.5 text-xs">Détails du score</div>
      {rows.map(([label, val, weight]) => (
        <div key={label as string} className="flex items-center gap-1.5 mb-1">
          <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${val}%`,
                background:
                  (val as number) >= 70
                    ? "#4ade80"
                    : (val as number) >= 40
                      ? "#fbbf24"
                      : "#f87171",
              }}
            />
          </div>
          <span className="w-16 text-gray-300">{label}</span>
          <span className="w-6 text-right tabular-nums">{val}</span>
          <span className="text-gray-500 w-6 text-right">{weight}</span>
        </div>
      ))}
    </div>
  );
}

// ── Wind Summary Bar ──────────────────────────────────────────────────────────

interface DayData {
  peakWindKmh: number;
  avgWindKmh: number;
  kitableHours: number;
  gustFactor: number;
  bestHour?: { time: string } | null;
}

function WindSummaryBar({
  spot,
  bestDay,
  color,
  showHelp,
  onToggleHelp,
}: {
  spot: SpotWithForecast;
  bestDay: DayData;
  color: string;
  showHelp: boolean;
  onToggleHelp: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-1.5 relative">
      {/* Help tooltip */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleHelp();
        }}
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-[8px] text-gray-500 z-10 transition-colors"
      >
        ?
      </button>
      {showHelp && <HelpTooltip sportType={spot.sportType} />}

      <div
        className="text-xl font-bold tabular-nums leading-none"
        style={{
          color:
            spot.sportType === "PARAGLIDE"
              ? bestDay.avgWindKmh < 10
                ? "#2e7d32"
                : bestDay.avgWindKmh < 20
                  ? "#f59e0b"
                  : "#d1d5db"
              : color,
        }}
      >
        {spot.sportType === "PARAGLIDE"
          ? Math.round(bestDay.avgWindKmh)
          : Math.round(bestDay.peakWindKmh / 1.852)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide">
          {spot.sportType === "PARAGLIDE" ? "Moy. km/h" : "Pic kts"}
        </div>
        <div
          className="text-xs font-medium"
          style={{
            color:
              spot.sportType === "PARAGLIDE"
                ? bestDay.avgWindKmh < 10
                  ? "#2e7d32"
                  : bestDay.avgWindKmh < 15
                    ? "#f59e0b"
                    : "#d1d5db"
                : color,
          }}
        >
          {spot.sportType === "PARAGLIDE"
            ? bestDay.avgWindKmh < 10
              ? "Calme idéal"
              : bestDay.avgWindKmh < 15
                ? "Acceptable"
                : "Venteux"
            : windConditionLabel(bestDay.peakWindKmh) || "—"}
        </div>
      </div>
      <div className="text-right space-y-0.5">
        <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
          <Clock className="h-3 w-3" />
          {bestDay.kitableHours}h
        </div>
        {bestDay.bestHour && (
          <div className="text-[10px] text-gray-400">
            Pic {new Date(bestDay.bestHour.time).getHours()}h
          </div>
        )}
        {spot.sportType !== "PARAGLIDE" && bestDay.gustFactor > 1.35 && (
          <div className="relative group/gust">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex items-center gap-0.5 text-[10px] text-orange-500 justify-end cursor-help"
            >
              <AlertTriangle className="h-2.5 w-2.5" />×
              {bestDay.gustFactor.toFixed(1)}
            </button>
            <div className="invisible group-hover/gust:visible group-focus-within/gust:visible absolute right-0 bottom-full mb-1 z-50 bg-gray-900 text-white text-[10px] rounded-md px-2 py-1.5 shadow-lg w-40 leading-snug pointer-events-none">
              Rafales {bestDay.gustFactor.toFixed(1)}× plus fortes que la
              moyenne —{" "}
              {bestDay.gustFactor < 1.6
                ? "légèrement irrégulier"
                : bestDay.gustFactor < 2
                  ? "irrégulier"
                  : "très irrégulier"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Help Tooltip ──────────────────────────────────────────────────────────────

function HelpTooltip({ sportType }: { sportType: string }) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 text-white text-[10px] rounded-lg p-2.5 shadow-xl w-52 leading-relaxed">
      <div className="font-semibold mb-1">Lecture rapide</div>
      <div className="space-y-0.5">
        <p>
          <span className="text-sky-300 font-medium">Chiffre</span> —{" "}
          {sportType === "PARAGLIDE"
            ? "vent moyen en km/h"
            : "vent en pointe (nœuds)"}
        </p>
        <p>
          <span className="text-sky-300 font-medium">Score /100</span> — qualité
          globale de la journée
        </p>
        <p>
          <span className="text-sky-300 font-medium">Heures</span> — durée{" "}
          {sportType === "PARAGLIDE" ? "calme favorable" : "de vent kitable"}
        </p>
        <p>
          <span className="text-sky-300 font-medium">Barre colorée</span> —
          force du vent heure par heure (6h–21h)
        </p>
        {sportType !== "PARAGLIDE" && (
          <p>
            <span className="text-orange-400 font-medium">×rafales</span> —
            irrégularité (1.0 = stable)
          </p>
        )}
        <p>
          <span className="text-sky-300 font-medium">Cercles</span> — scores par
          jour sur la période
        </p>
      </div>
    </div>
  );
}

// ── Mini Forecast Bar ─────────────────────────────────────────────────────────

function ForecastBar({
  forecast,
  sportType,
  hoveredIdx,
  onHover,
}: {
  forecast: { windSpeedKmh: number; time: string }[];
  sportType: string;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const sliced = forecast.slice(6, 22);
  return (
    <div className="mt-1.5" onMouseLeave={() => onHover(null)}>
      <div className="flex gap-px h-3 rounded overflow-hidden">
        {sliced.map((h, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className={`flex-1 transition-opacity ${hoveredIdx !== null && !isHovered ? "opacity-50" : ""}`}
              style={{ background: windColor(h.windSpeedKmh) }}
              onMouseEnter={() => onHover(i)}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5 px-0.5">
        {hoveredIdx !== null ? (
          (() => {
            const h = sliced[hoveredIdx];
            if (!h) return <span>6h</span>;
            const hour = new Date(h.time).getHours();
            const wind =
              sportType === "PARAGLIDE"
                ? `${Math.round(h.windSpeedKmh)} km/h`
                : `${Math.round(h.windSpeedKmh / 1.852)} kts`;
            return (
              <span className="w-full text-center text-gray-500 font-medium">
                {hour}h · {wind}
              </span>
            );
          })()
        ) : (
          <>
            <span>6h</span>
            <span>21h</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Multi-Day Strip ───────────────────────────────────────────────────────────

interface DayInfo {
  date: string;
  score: number;
  kitableHours: number;
}

function MultiDayStrip({
  days,
  bestDayIndex,
  activeDayIdx,
  spotId,
  onSelectDay,
}: {
  days: DayInfo[];
  bestDayIndex: number;
  activeDayIdx: number;
  spotId: string;
  onSelectDay: (spotId: string, dayIdx: number) => void;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-100 overflow-x-auto -mx-1 px-1 scrollbar-none">
      <div
        className="flex gap-1"
        style={{
          minWidth: days.length > 7 ? `${days.length * 2}rem` : undefined,
        }}
      >
        {days.map((day, i) => {
          const isBest = i === bestDayIndex;
          const isSelected = i === activeDayIdx;
          const dayDate = new Date(day.date + "T12:00:00Z");
          return (
            <button
              type="button"
              key={day.date}
              className="flex-1 flex flex-col items-center gap-0.5 min-w-7 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectDay(spotId, i);
              }}
            >
              <span className="text-[8px] text-gray-400 uppercase">
                {dayDate.toLocaleDateString("fr", { weekday: "narrow" })}
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-all ${isSelected ? "ring-2 ring-offset-1" : ""}`}
                style={{
                  background: scoreColor(day.score),
                  ...(isBest && !isSelected
                    ? {
                        outline: `2px solid ${scoreColor(day.score)}`,
                        outlineOffset: "1px",
                      }
                    : {}),
                  ...(isSelected
                    ? {
                        ["--tw-ring-color" as string]: scoreColor(day.score),
                      }
                    : {}),
                }}
                title={`${day.date} — ${day.score}/100 · ${day.kitableHours}h`}
              >
                {day.score > 0 ? day.score : "·"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
