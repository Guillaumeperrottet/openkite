"use client";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { windDirectionLabel } from "@/lib/utils";
import { roundKnots } from "@/lib/forecast";
import type { StationWithDist } from "@/components/spot/useNearbyStations";

const SOURCE_LABELS: Record<string, string> = {
  meteoswiss: "MeteoSwiss",
  pioupiou: "Pioupiou",
  netatmo: "Netatmo",
  meteofrance: "Météo-France",
  windball: "Windball",
};

/** Marker color for station wind speed (same palette as map) */
function stationColor(kmh: number): string {
  if (kmh < 8) return "#c8d4dc";
  if (kmh < 15) return "#d0d0d0";
  if (kmh < 22) return "#a8bdd4";
  if (kmh < 30) return "#6a9cbd";
  if (kmh < 38) return "#3a7fa8";
  if (kmh < 50) return "#e07720";
  return "#cc3333";
}

interface Props {
  stations: StationWithDist[];
  loading: boolean;
  useKnots: boolean;
}

export function NearbyStationsPanel({ stations, loading, useKnots }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-gray-400 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des balises…
      </div>
    );
  }

  if (stations.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {stations.map((s) => {
        const kts = roundKnots(s.windSpeedKmh);
        const dir = windDirectionLabel(s.windDirection);
        return (
          <Link
            key={s.id}
            href={`/stations/${s.id}`}
            className="group bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 hover:border-gray-300 hover:shadow transition-all"
          >
            {/* Header: name + distance */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: stationColor(s.windSpeedKmh) }}
                />
                <span className="text-sm font-medium text-gray-800 truncate">
                  {s.name}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">
                {s.dist < 1
                  ? `${Math.round(s.dist * 1000)}m`
                  : `${s.dist.toFixed(1)}km`}
              </span>
            </div>

            {/* Wind data row */}
            <div className="flex items-center gap-3">
              {/* Speed */}
              <div>
                <div className="flex items-baseline gap-0.5">
                  <span
                    className="text-2xl font-bold tabular-nums leading-none"
                    style={{ color: stationColor(s.windSpeedKmh) }}
                  >
                    {useKnots ? kts : Math.round(s.windSpeedKmh)}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {useKnots ? "kts" : "km/h"}
                  </span>
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">
                  /{" "}
                  {useKnots
                    ? `${Math.round(s.windSpeedKmh)} km/h`
                    : `${kts} kts`}
                </div>
              </div>

              {/* Direction */}
              <div className="flex items-center gap-1">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <g
                    transform={`rotate(${(s.windDirection + 180) % 360}, 8, 8)`}
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
                <span className="text-sm font-semibold text-gray-700">
                  {dir}
                </span>
                <span className="text-[10px] text-gray-400">
                  {s.windDirection}°
                </span>
              </div>
            </div>

            {/* Footer: source + time */}
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">
                {SOURCE_LABELS[s.source] ?? s.source}
              </span>
              <div className="flex items-center gap-1">
                {s.updatedAt && (
                  <span className="text-[9px] text-gray-400">
                    {new Date(s.updatedAt).toLocaleTimeString("fr", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                <ExternalLink className="h-2.5 w-2.5 text-gray-300 group-hover:text-sky-500 transition-colors" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
