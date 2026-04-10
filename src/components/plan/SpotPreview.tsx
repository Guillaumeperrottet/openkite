"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Wind,
  MapPin,
  ExternalLink,
  Calendar,
  Clock,
} from "lucide-react";
import { windColor, windConditionLabel, windDirectionLabel } from "@/lib/utils";
import { roundKnots, windCellStyle } from "@/lib/forecast";
import type { SpotWithForecast, ForecastHour } from "@/types";

function scoreColor(score: number): string {
  if (score >= 70) return "#2e7d32";
  if (score >= 45) return "#f59e0b";
  if (score >= 20) return "#9ca3af";
  return "#d1d5db";
}

interface Props {
  spot: SpotWithForecast;
  activeDayIdx: number;
  onBack: () => void;
  onSelectDay?: (dayIdx: number) => void;
}

export function SpotPreview({
  spot,
  activeDayIdx,
  onBack,
  onSelectDay,
}: Props) {
  const day = spot.days?.[activeDayIdx];
  const sc = day?.score ?? spot.bestScore ?? 0;
  const isKite = spot.sportType === "KITE";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
          title="Retour aux résultats"
        >
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-900 text-sm truncate">
            {spot.name}
          </h2>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {[spot.region, spot.country].filter(Boolean).join(", ")}
            {spot.distanceKm > 0 && ` · ${Math.round(spot.distanceKm)} km`}
          </p>
        </div>
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white"
          style={{ background: scoreColor(sc) }}
        >
          <span className="text-lg font-bold leading-none">{sc}</span>
          <span className="text-[8px] opacity-80">/100</span>
        </div>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Wind summary cards */}
        {day?.bestHour && (
          <div className="grid grid-cols-3 gap-2">
            <WindCard label="Pic vent" value={day.peakWindKmh} unit="km/h" />
            <WindCard label="Vent moy." value={day.avgWindKmh} unit="km/h" />
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-500 mb-1">Rafales</div>
              <div className="text-lg font-bold text-gray-800">
                ×{day.gustFactor.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* Best hour + Spot description side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Best hour detail */}
          {day?.bestHour && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Meilleure heure
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <g
                      transform={`rotate(${(day.bestHour.windDirection + 180) % 360}, 8, 8)`}
                    >
                      <line
                        x1="8"
                        y1="12"
                        x2="8"
                        y2="5"
                        stroke="#374151"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <polygon points="8,2.5 5.5,6.5 10.5,6.5" fill="#374151" />
                    </g>
                  </svg>
                  <div>
                    <span className="text-lg font-bold text-gray-900">
                      {windDirectionLabel(day.bestHour.windDirection)}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">
                      {day.bestHour.windDirection}°
                    </span>
                  </div>
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: windColor(day.bestHour.windSpeedKmh) }}
                    >
                      {roundKnots(day.bestHour.windSpeedKmh)}
                    </span>
                    <span className="text-xs text-gray-400">kts</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {Math.round(day.bestHour.windSpeedKmh)} km/h ·{" "}
                    {windConditionLabel(day.bestHour.windSpeedKmh)}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-sm font-medium text-gray-700">
                    {new Date(day.bestHour.time).toLocaleTimeString("fr", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Spot description */}
          {spot.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Description
              </div>
              <p className="text-xs text-gray-700 leading-relaxed line-clamp-5">
                {spot.description}
              </p>
            </div>
          )}
        </div>

        {/* Hourly forecasts — single continuous table */}
        {spot.days &&
        spot.days.length > 0 &&
        spot.days.some((d) => d.forecast.length > 0) ? (
          <div>
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Wind className="h-3 w-3" />
              Prévisions{" "}
              {spot.days.length > 1 ? `· ${spot.days.length} jours` : ""}
            </div>
            <MiniWindguruTable days={spot.days} activeDayIdx={activeDayIdx} />
          </div>
        ) : (
          day &&
          day.forecast.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Wind className="h-3 w-3" />
                Prévisions · {formatDate(day.date)}
              </div>
              <MiniWindguruTable days={[day]} activeDayIdx={0} />
            </div>
          )
        )}

        {/* Multi-day overview — clickable */}
        {spot.days && spot.days.length > 1 && (
          <div>
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Aperçu multi-jours
            </div>
            <div className="grid grid-cols-7 gap-1">
              {spot.days.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => onSelectDay?.(i)}
                  className={`rounded-lg p-1.5 text-center text-[10px] border transition-colors ${
                    i === activeDayIdx
                      ? "border-sky-400 bg-sky-50 ring-1 ring-sky-300"
                      : "border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  <div className="text-gray-400">
                    {new Date(d.date + "T12:00").toLocaleDateString("fr", {
                      weekday: "short",
                    })}
                  </div>
                  <div
                    className="text-sm font-bold mt-0.5"
                    style={{ color: scoreColor(d.score) }}
                  >
                    {d.score}
                  </div>
                  <div className="text-gray-400">
                    {Math.round(d.peakWindKmh)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info tags */}
        <div className="flex flex-wrap gap-1.5">
          <Tag>{isKite ? "🪁 Kitesurf" : "🪂 Parapente"}</Tag>
          <Tag>
            {spot.difficulty.charAt(0) + spot.difficulty.slice(1).toLowerCase()}
          </Tag>
          {isKite && <Tag>{spot.waterType.toLowerCase()}</Tag>}
          {spot.bestWindDirections.length > 0 && (
            <Tag>Vent {spot.bestWindDirections.join(", ")}</Tag>
          )}
          {day && (
            <Tag>
              {day.kitableHours}h {isKite ? "rideable" : "flyable"}
            </Tag>
          )}
        </div>

        {/* CTA */}
        <Link
          href={`/spots/${spot.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Voir la page complète
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function WindCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className="flex items-baseline justify-center gap-0.5">
        <span
          className="text-xl font-bold tabular-nums"
          style={{ color: windColor(value) }}
        >
          {Math.round(value)}
        </span>
        <span className="text-[10px] text-gray-400">{unit}</span>
      </div>
      <div className="text-[9px] text-gray-400 mt-0.5">
        {roundKnots(value)} kts
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
      {children}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00").toLocaleDateString("fr", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Mini Windguru-style table — all days merged into one scrollable table */
function MiniWindguruTable({
  days,
  activeDayIdx,
}: {
  days: { date: string; score: number; forecast: ForecastHour[] }[];
  activeDayIdx: number;
}) {
  // Build flat list of points with day boundaries
  const segments: {
    dayIdx: number;
    dayLabel: string;
    points: ForecastHour[];
  }[] = [];
  for (let di = 0; di < days.length; di++) {
    const d = days[di];
    if (d.forecast.length === 0) continue;
    // Sample every 3h if more than 12 points in a day
    const pts =
      d.forecast.length > 12
        ? d.forecast.filter((_, i) => i % 3 === 0)
        : d.forecast;
    const label = new Date(d.date + "T12:00").toLocaleDateString("fr", {
      weekday: "short",
      day: "numeric",
    });
    segments.push({ dayIdx: di, dayLabel: label, points: pts });
  }

  const CELL =
    "text-center text-[10px] font-bold tabular-nums px-0 py-1 min-w-[28px]";
  const LABEL =
    "sticky left-0 z-10 bg-white text-[10px] text-gray-500 font-medium px-2 py-1 text-right whitespace-nowrap border-r border-gray-100";

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="border-collapse w-max">
          <thead>
            {/* Day labels row — only when multi-day */}
            {segments.length > 1 && (
              <tr>
                <td className={`${LABEL} bg-gray-50`} />
                {segments.map((seg) => (
                  <td
                    key={seg.dayIdx}
                    colSpan={seg.points.length}
                    className={`text-center text-[9px] font-semibold px-0 py-0.5 border-b ${
                      seg.dayIdx === activeDayIdx
                        ? "bg-sky-50 text-sky-600 border-sky-200"
                        : "bg-gray-50 text-gray-400 border-gray-100"
                    }`}
                  >
                    {seg.dayLabel}
                    <span
                      className="ml-1 font-bold"
                      style={{ color: scoreColor(days[seg.dayIdx].score) }}
                    >
                      {days[seg.dayIdx].score}
                    </span>
                  </td>
                ))}
              </tr>
            )}
            {/* Hour labels row */}
            <tr>
              <td className={`${LABEL} bg-gray-50`} />
              {segments.map((seg, si) =>
                seg.points.map((h, hi) => (
                  <td
                    key={`${si}-${hi}`}
                    className={`text-center text-[9px] text-gray-400 px-0 py-0.5 border-b border-gray-100 ${
                      hi === 0 && si > 0 ? "border-l border-l-gray-200" : ""
                    }`}
                  >
                    {new Date(h.time).getHours()}h
                  </td>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {/* Wind speed (kts) */}
            <tr>
              <td className={LABEL}>Vent</td>
              {segments.map((seg, si) =>
                seg.points.map((h, hi) => (
                  <td
                    key={`${si}-${hi}`}
                    style={windCellStyle(h.windSpeedKmh)}
                    className={`${CELL} ${
                      hi === 0 && si > 0 ? "border-l border-l-gray-200" : ""
                    }`}
                    title={`${Math.round(h.windSpeedKmh)} km/h`}
                  >
                    {roundKnots(h.windSpeedKmh)}
                  </td>
                )),
              )}
            </tr>
            {/* Gusts (kts) */}
            <tr>
              <td className={LABEL}>Raf.</td>
              {segments.map((seg, si) =>
                seg.points.map((h, hi) => (
                  <td
                    key={`${si}-${hi}`}
                    style={windCellStyle(h.gustsKmh)}
                    className={`${CELL} ${
                      hi === 0 && si > 0 ? "border-l border-l-gray-200" : ""
                    }`}
                    title={`${Math.round(h.gustsKmh)} km/h`}
                  >
                    {roundKnots(h.gustsKmh)}
                  </td>
                )),
              )}
            </tr>
            {/* Direction arrows */}
            <tr>
              <td className={LABEL}>Dir.</td>
              {segments.map((seg, si) =>
                seg.points.map((h, hi) => (
                  <td
                    key={`${si}-${hi}`}
                    className={`${CELL} font-normal text-gray-500 ${
                      hi === 0 && si > 0 ? "border-l border-l-gray-200" : ""
                    }`}
                    title={`${h.windDirection}°`}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      style={{ display: "block", margin: "0 auto" }}
                      aria-hidden="true"
                    >
                      <g
                        transform={`rotate(${(h.windDirection + 180) % 360}, 8, 8)`}
                      >
                        <line
                          x1="8"
                          y1="13"
                          x2="8"
                          y2="4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <polygon
                          points="8,1.5 4.5,6.5 11.5,6.5"
                          fill="currentColor"
                        />
                      </g>
                    </svg>
                  </td>
                )),
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
