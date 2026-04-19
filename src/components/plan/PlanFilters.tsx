"use client";

import { useRef, useState, useCallback } from "react";
import { MapPin, Search, Locate, X, Map } from "lucide-react";
import type { SportType } from "@/types";

export type SortKey = "score" | "distance" | "wind";

interface PlanFiltersProps {
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  startDate: string;
  endDate: string;
  radius: number;
  sport: SportType | "ALL";
  geoLoading: boolean;
  onLatChange: (v: number | null) => void;
  onLngChange: (v: number | null) => void;
  onLocationNameChange: (v: string | null) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onRadiusChange: (v: number) => void;
  onSportChange: (v: SportType | "ALL") => void;
  onGeolocate: () => void;
  onPickOnMap?: () => void;
  reverseGeocode: (lat: number, lng: number) => void;
}

const toISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

const ctrlInput =
  "rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500";

export function PlanFilters({
  lat,
  lng,
  locationName,
  startDate,
  endDate,
  radius,
  sport,
  geoLoading,
  onLatChange,
  onLngChange,
  onLocationNameChange,
  onStartDateChange,
  onEndDateChange,
  onRadiusChange,
  onSportChange,
  onGeolocate,
  onPickOnMap,
}: PlanFiltersProps) {
  const hasLocation = lat !== null && lng !== null;

  // Geocoding search
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<
    { name: string; lat: number; lon: number }[]
  >([]);
  const [geoOpen, setGeoOpen] = useState(false);
  const geoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchGeo = useCallback((q: string) => {
    if (geoTimerRef.current) clearTimeout(geoTimerRef.current);
    if (q.length < 2) {
      setGeoResults([]);
      return;
    }
    geoTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { "Accept-Language": "fr" } },
        );
        const data = await res.json();
        setGeoResults(
          data.map((r: { display_name: string; lat: string; lon: string }) => ({
            name: r.display_name.split(",").slice(0, 3).join(","),
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
          })),
        );
        setGeoOpen(true);
      } catch {
        setGeoResults([]);
      }
    }, 300);
  }, []);

  const selectGeoResult = (r: { name: string; lat: number; lon: number }) => {
    onLatChange(r.lat);
    onLngChange(r.lon);
    onLocationNameChange(r.name.split(",")[0]);
    setGeoQuery("");
    setGeoResults([]);
    setGeoOpen(false);
  };

  const clearLocation = () => {
    onLatChange(null);
    onLngChange(null);
    onLocationNameChange(null);
    setGeoQuery("");
  };

  return (
    <div className="space-y-3">
      {/* Destination */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          Destination <span className="text-gray-400">(optionnel)</span>
        </label>
        <div className="flex gap-1.5">
          <div className="flex-1 min-w-0 relative">
            {hasLocation && !geoQuery ? (
              <div
                className={`${ctrlInput} flex items-center gap-2 h-10 w-full`}
              >
                <MapPin className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                <span className="truncate text-gray-700 text-sm flex-1">
                  {locationName || `${lat!.toFixed(3)}°, ${lng!.toFixed(3)}°`}
                </span>
                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div
                  className={`${ctrlInput} flex items-center gap-2 h-10 w-full`}
                >
                  <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={geoQuery}
                    onChange={(e) => {
                      setGeoQuery(e.target.value);
                      searchGeo(e.target.value);
                    }}
                    onFocus={() => geoResults.length && setGeoOpen(true)}
                    placeholder="Ville, lieu…"
                    className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
                  />
                </div>
                {geoOpen && geoResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {geoResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectGeoResult(r)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-700 border-b border-gray-100 last:border-0 flex items-center gap-2"
                      >
                        <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="truncate">{r.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onGeolocate}
            disabled={geoLoading}
            title="Ma position"
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-40"
          >
            <Locate className="h-3.5 w-3.5" />
          </button>
          {onPickOnMap && (
            <button
              onClick={onPickOnMap}
              title="Choisir sur la carte"
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
            >
              <Map className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Date range */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Du</label>
          <input
            type="date"
            value={startDate}
            min={toISO(0)}
            onChange={(e) => {
              onStartDateChange(e.target.value);
              if (e.target.value > endDate) onEndDateChange(e.target.value);
            }}
            className={`${ctrlInput} w-full h-10`}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Au</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={`${ctrlInput} w-full h-10`}
          />
        </div>
      </div>

      {/* Radius + Sport */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">
            Rayon
            {!hasLocation && <span className="text-gray-400"> (ignoré)</span>}
          </label>
          <select
            value={radius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className={`${ctrlInput} w-full h-10`}
            disabled={!hasLocation}
          >
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
            <option value={150}>150 km</option>
            <option value={300}>300 km</option>
            <option value={500}>500 km</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Sport</label>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm h-10">
            {(
              [
                ["KITE", "Kite"],
                ["PARAGLIDE", "Para"],
              ] as const
            ).map(([key, label], i) => (
              <button
                key={key}
                onClick={() => onSportChange(key)}
                className={`px-3 py-2 font-medium transition-colors ${
                  sport === key
                    ? key === "KITE"
                      ? "bg-green-500 text-white"
                      : "bg-orange-500 text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                } ${i > 0 ? "border-l border-gray-200" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
