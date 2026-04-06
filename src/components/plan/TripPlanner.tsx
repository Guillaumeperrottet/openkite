"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { KiteMap } from "@/components/map/KiteMap";
import { Button } from "@/components/ui/Button";
import { windColor, windConditionLabel } from "@/lib/utils";
import type { SpotWithForecast, SportType } from "@/types";
import Link from "next/link";
import {
  MapPin,
  Wind,
  Clock,
  Navigation,
  Locate,
  AlertTriangle,
  Search,
  Globe,
  X,
  Archive,
  Info,
  Share2,
  Check,
  ChevronUp,
} from "lucide-react";

// Score 0–100 → display color
function scoreColor(score: number): string {
  if (score >= 70) return "#2e7d32";
  if (score >= 45) return "#f59e0b";
  if (score >= 20) return "#9ca3af";
  return "#d1d5db";
}

type SortKey = "score" | "distance" | "wind";

interface TripPlannerProps {
  searchParams?: Record<string, string | undefined>;
}

export function TripPlanner({ searchParams }: TripPlannerProps) {
  const router = useRouter();

  const toISO = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  // Restore state from URL searchParams (shared links / refresh)
  const spLat = searchParams?.lat ? parseFloat(searchParams.lat) : null;
  const spLng = searchParams?.lng ? parseFloat(searchParams.lng) : null;

  const [lat, setLat] = useState<number | null>(
    spLat !== null && !isNaN(spLat) ? spLat : null,
  );
  const [lng, setLng] = useState<number | null>(
    spLng !== null && !isNaN(spLng) ? spLng : null,
  );
  const [startDate, setStartDate] = useState(
    searchParams?.startDate || toISO(1),
  );
  const [endDate, setEndDate] = useState(searchParams?.endDate || toISO(7));
  const [radius, setRadius] = useState(
    searchParams?.radius ? Number(searchParams.radius) : 150,
  );
  const [sport, setSport] = useState<SportType | "ALL">(
    (searchParams?.sport as SportType) || "ALL",
  );
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [results, setResults] = useState<SpotWithForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mobile bottom sheet + filters state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetPos, setSheetPos] = useState<"peek" | "half" | "full">("peek");
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // Geocoding search
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<
    { name: string; lat: number; lon: number }[]
  >([]);
  const [geoOpen, setGeoOpen] = useState(false);
  const geoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoInputRef = useRef<HTMLInputElement>(null);

  // Auto-search on mount if URL had params
  const [didAutoSearch, setDidAutoSearch] = useState(false);
  useEffect(() => {
    if (didAutoSearch) return;
    if (searchParams?.startDate) {
      setDidAutoSearch(true);
      if (lat !== null && lng !== null) reverseGeocode(lat, lng);
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverseGeocode = useCallback(async (la: number, lo: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json`,
        { headers: { "Accept-Language": "fr" } },
      );
      const data = await res.json();
      setLocationName(
        data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.hamlet ||
          data.address?.municipality ||
          data.address?.county ||
          null,
      );
    } catch {
      setLocationName(null);
    }
  }, []);

  // Debounced geocoding search
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
    setLat(r.lat);
    setLng(r.lon);
    setLocationName(r.name.split(",")[0]);
    setGeoQuery("");
    setGeoResults([]);
    setGeoOpen(false);
  };

  const clearLocation = () => {
    setLat(null);
    setLng(null);
    setLocationName(null);
    setGeoQuery("");
  };

  const handlePickLocation = useCallback(
    (latitude: number, longitude: number) => {
      setLat(latitude);
      setLng(longitude);
      setGeoQuery("");
      reverseGeocode(latitude, longitude);
    },
    [reverseGeocode],
  );

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleSearchNearMe = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setLat(la);
        setLng(lo);
        reverseGeocode(la, lo);
        setGeoLoading(false);

        // Trigger search immediately with the new coords
        setLoading(true);
        setSearched(true);
        setError(null);

        const params = new URLSearchParams({
          startDate,
          endDate,
          radius: radius.toString(),
          lat: la.toFixed(5),
          lng: lo.toFixed(5),
          ...(sport !== "ALL" ? { sport } : {}),
        });
        router.replace(`/plan?${params}`, { scroll: false });

        try {
          const res = await fetch(`/api/plan?${params}`);
          if (!res.ok) throw new Error(`Erreur ${res.status}`);
          const data: SpotWithForecast[] = await res.json();
          setResults(data);
          if (data.length > 0) setSheetPos("half");
        } catch {
          setError("Impossible de récupérer les prévisions. Réessayez.");
          setResults([]);
        } finally {
          setLoading(false);
        }
      },
      () => setGeoLoading(false),
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setError(null);

    // Encode in URL for shareability
    const params = new URLSearchParams({
      startDate,
      endDate,
      radius: radius.toString(),
      ...(lat !== null && lng !== null
        ? { lat: lat.toFixed(5), lng: lng.toFixed(5) }
        : {}),
      ...(sport !== "ALL" ? { sport } : {}),
    });
    router.replace(`/plan?${params}`, { scroll: false });

    try {
      const res = await fetch(`/api/plan?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: SpotWithForecast[] = await res.json();
      setResults(data);
      if (data.length > 0) setSheetPos("half");
    } catch {
      setError("Impossible de récupérer les prévisions. Réessayez.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const isMultiDay = startDate !== endDate;
  const hasLocation = lat !== null && lng !== null;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "OpenKite — Planificateur", url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  // Compute if end date is beyond 16-day forecast range
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const endMs = new Date(endDate + "T00:00:00").getTime();
  const daysAhead = Math.ceil((endMs - todayMs) / 86400000);
  const isArchive = daysAhead > 16;
  const dataSource =
    results[0]?.dataSource ?? (isArchive ? "archive" : "forecast");

  const sorted = [...results].sort((a, b) => {
    if (sortBy === "score") return (b.bestScore ?? 0) - (a.bestScore ?? 0);
    if (sortBy === "wind") {
      const aPeak = a.days?.[a.bestDayIndex ?? 0]?.peakWindKmh ?? 0;
      const bPeak = b.days?.[b.bestDayIndex ?? 0]?.peakWindKmh ?? 0;
      return bPeak - aPeak;
    }
    return a.distanceKm - b.distanceKm;
  });

  const ctrlInput =
    "rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-500";

  // ── Mobile helpers ──────────────────────────────────────────
  const formatDateShort = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("fr", { day: "numeric", month: "short" });
  };

  const filterSummary = [
    locationName ||
      (hasLocation ? `${lat!.toFixed(1)}°, ${lng!.toFixed(1)}°` : null),
    `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`,
    hasLocation ? `${radius} km` : null,
    sport !== "ALL" ? (sport === "KITE" ? "Kite" : "Para") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const sheetTranslateClass = {
    peek: "translate-y-[calc(100%-3.5rem)]",
    half: "translate-y-[50%]",
    full: "translate-y-0",
  }[sheetPos];

  const handleSheetToggle = () => {
    setSheetPos((p) =>
      p === "peek" ? "half" : p === "half" ? "full" : "peek",
    );
  };

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(delta) < 30) return;
    if (delta < 0) {
      setSheetPos((p) => (p === "peek" ? "half" : "full"));
    } else {
      setSheetPos((p) => (p === "full" ? "half" : "peek"));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Controls bar (desktop only) ────────────────────────── */}
      <div className="hidden lg:block shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex flex-wrap items-end gap-2.5">
          {/* Destination — with geocoding search */}
          <div className="flex items-end gap-1.5 min-w-0 flex-1 relative">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 mb-1 block">
                Destination <span className="text-gray-400">(optionnel)</span>
              </label>
              {/* Show search input OR current location */}
              {hasLocation && !geoQuery ? (
                <div
                  className={`${ctrlInput} flex items-center gap-2 h-9.5 cursor-default`}
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
                  <div className={`${ctrlInput} flex items-center gap-2 h-9.5`}>
                    <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <input
                      ref={geoInputRef}
                      type="text"
                      value={geoQuery}
                      onChange={(e) => {
                        setGeoQuery(e.target.value);
                        searchGeo(e.target.value);
                      }}
                      onFocus={() => geoResults.length && setGeoOpen(true)}
                      placeholder="Ville, lieu… ou laissez vide"
                      className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
                    />
                  </div>
                  {/* Geocoding dropdown */}
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
            {/* Geolocate */}
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              title="Utiliser ma position"
              className="h-9.5 w-9.5 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-40"
            >
              <Locate className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Date range — side-by-side on mobile */}
          <div className="flex gap-2 flex-1 min-w-0 sm:flex-none sm:contents">
            <div className="flex-1 sm:flex-none">
              <label className="text-xs text-gray-500 mb-1 block">Du</label>
              <input
                type="date"
                value={startDate}
                min={toISO(0)}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className={`${ctrlInput} w-full sm:w-auto`}
              />
            </div>
            <div className="flex-1 sm:flex-none">
              <label className="text-xs text-gray-500 mb-1 block">Au</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`${ctrlInput} w-full sm:w-auto`}
              />
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Rayon
              {!hasLocation && <span className="text-gray-400"> (ignoré)</span>}
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className={ctrlInput}
              disabled={!hasLocation}
            >
              <option value={50}>50 km</option>
              <option value={100}>100 km</option>
              <option value={150}>150 km</option>
              <option value={300}>300 km</option>
              <option value={500}>500 km</option>
            </select>
          </div>

          {/* Sport toggle */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sport</label>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(
                [
                  ["ALL", "Tous"],
                  ["KITE", "Kite"],
                  ["PARAGLIDE", "Para"],
                ] as const
              ).map(([key, label], i) => (
                <button
                  key={key}
                  onClick={() => setSport(key)}
                  className={`px-3 py-2 font-medium transition-colors ${
                    sport === key
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  } ${i > 0 ? "border-l border-gray-200" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hasLocation ? (
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="h-9.5 self-end w-full sm:w-auto"
            >
              {loading ? "Recherche…" : "Trouver"}
            </Button>
          ) : (
            <div className="flex gap-2 self-end w-full sm:w-auto">
              <Button
                onClick={handleSearchNearMe}
                disabled={loading || geoLoading}
                className="h-9.5 flex-1 sm:flex-none"
                variant="secondary"
              >
                {geoLoading ? (
                  "Localisation…"
                ) : loading ? (
                  "Recherche…"
                ) : (
                  <>
                    <Locate className="h-3.5 w-3.5 mr-1" />
                    Autour de moi
                  </>
                )}
              </Button>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="h-9.5 flex-1 sm:flex-none"
              >
                {loading ? (
                  "Recherche…"
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 mr-1" />
                    Meilleurs spots
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Data source info banner ───────────────────────────────── */}
      {searched && !loading && results.length > 0 && (
        <div
          className={`shrink-0 hidden lg:flex items-center gap-2 px-4 py-2 text-xs border-b border-gray-200 ${
            dataSource === "archive"
              ? "bg-amber-50 text-amber-700"
              : "bg-sky-50 text-sky-700"
          }`}
        >
          {dataSource === "archive" ? (
            <>
              <Archive className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Données historiques</strong> — Les dates sélectionnées
                dépassent les 16 jours de prévision. Les scores sont basés sur
                les archives météo des 5 dernières années.
              </span>
            </>
          ) : (
            <>
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Prévisions temps réel</strong> — Jusqu&apos;à 16 jours.
                Au-delà, les scores se baseront sur les archives annuelles.
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Map + Results ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row relative">
        {/* Map — full height on mobile, flex-1 on desktop */}
        <div className="flex-1 min-h-0 lg:h-full lg:border-r border-gray-200 relative">
          {/* Mobile compact controls overlay */}
          <div className="lg:hidden absolute top-3 left-3 right-3 z-10">
            <button
              onClick={() => setFiltersOpen(true)}
              className="w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-md px-3 py-2.5 flex items-center gap-2 text-sm border border-gray-200/50"
            >
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-600 truncate flex-1 text-left text-xs">
                {filterSummary || "Rechercher…"}
              </span>
            </button>
          </div>
          <KiteMap
            spots={results}
            pickMode={true}
            onPickLocation={handlePickLocation}
            highlightSpotId={hoveredSpotId}
          />
        </div>

        {/* Results panel — bottom sheet on mobile, side panel on desktop */}
        <div
          ref={sheetRef}
          className={`
            absolute bottom-0 left-0 right-0 z-20
            lg:static lg:z-auto
            ${sheetTranslateClass} lg:translate-y-0
            w-full lg:w-105
            flex flex-col min-h-0
            bg-white rounded-t-2xl lg:rounded-none
            shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:shadow-none
            max-h-[85vh] lg:max-h-none
            transition-transform duration-300 ease-out lg:transition-none
            border-t border-gray-200 lg:border-t-0
          `}
        >
          {/* Mobile drag handle */}
          <div
            className="lg:hidden flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            onClick={handleSheetToggle}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mb-1.5" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span>
                {loading
                  ? "Recherche…"
                  : results.length > 0
                    ? `${results.length} spot${results.length > 1 ? "s" : ""} trouvé${results.length > 1 ? "s" : ""}`
                    : searched
                      ? "Aucun résultat"
                      : "Résultats"}
              </span>
              <ChevronUp
                className={`h-3.5 w-3.5 transition-transform ${sheetPos === "full" ? "rotate-180" : ""}`}
              />
            </div>
          </div>

          {/* Mobile data source banner */}
          {searched && !loading && results.length > 0 && (
            <div
              className={`lg:hidden flex items-center gap-2 px-4 py-2 text-xs border-b border-gray-200 ${
                dataSource === "archive"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-sky-50 text-sky-700"
              }`}
            >
              {dataSource === "archive" ? (
                <>
                  <Archive className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>Données historiques</strong> — archives météo
                  </span>
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>Prévisions temps réel</strong>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Sort bar */}
          {results.length > 1 && (
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 text-xs">
              <span className="text-gray-400">Trier :</span>
              {(
                [
                  ["score", "Score"],
                  ...(hasLocation
                    ? [["distance", "Distance"] as [SortKey, string]]
                    : []),
                  ["wind", "Vent"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    sortBy === key
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-2 text-gray-400">
                {results.length} spot{results.length > 1 ? "s" : ""}
                {results.filter((r) => r.forecastError).length > 0 && (
                  <span className="text-orange-400 ml-1">
                    ({results.filter((r) => r.forecastError).length} sans
                    prévision)
                  </span>
                )}
                <button
                  onClick={handleShare}
                  className="ml-1 p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-sky-600 transition-colors"
                  title="Partager cette recherche"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Empty state */}
            {!searched && !loading && (
              <div className="text-center text-gray-400 text-sm py-12">
                <Navigation className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-500">
                  Trouvez les meilleurs spots
                </p>
                <p className="text-xs mt-1.5 opacity-70 leading-5">
                  Recherchez une ville, cliquez sur la carte ou{" "}
                  <button
                    onClick={handleGeolocate}
                    className="underline underline-offset-2"
                  >
                    utilisez votre position
                  </button>
                  .
                  <br />
                  Ou lancez directement pour voir les meilleurs spots mondiaux.
                </p>
              </div>
            )}

            {/* Skeleton loader */}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-50 border border-gray-200 p-4 animate-pulse"
                  >
                    <div className="flex justify-between mb-3">
                      <div className="space-y-1.5">
                        <div className="h-3.5 bg-gray-200 rounded w-28" />
                        <div className="h-2.5 bg-gray-200 rounded w-20" />
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-gray-200" />
                    </div>
                    <div className="h-10 bg-gray-200 rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-4 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* No results */}
            {!loading && searched && results.length === 0 && !error && (
              <div className="text-center text-gray-400 text-sm py-12">
                <Wind className="h-7 w-7 mx-auto mb-3 opacity-30" />
                {hasLocation ? (
                  <>
                    Aucun spot dans un rayon de {radius} km.
                    <br />
                    <span className="text-xs opacity-60">
                      Élargissez le rayon ou changez de destination.
                    </span>
                  </>
                ) : (
                  "Aucun spot trouvé."
                )}
              </div>
            )}

            {/* Results */}
            {!loading &&
              sorted.map((spot) => {
                const bestDay = spot.days?.[spot.bestDayIndex ?? 0];
                const sc = spot.bestScore ?? 0;
                const isForecastError = spot.forecastError;

                if (!bestDay && !isForecastError) return null;
                const color = bestDay
                  ? windColor(bestDay.peakWindKmh)
                  : "#d1d5db";

                return (
                  <Link
                    key={spot.id}
                    href={`/spots/${spot.id}`}
                    className="block rounded-xl bg-white border border-gray-200 p-4 hover:border-sky-400/60 hover:shadow-sm transition-all"
                    onMouseEnter={() => setHoveredSpotId(spot.id)}
                    onMouseLeave={() => setHoveredSpotId(null)}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {spot.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[spot.region, spot.country]
                            .filter(Boolean)
                            .join(", ")}
                          {hasLocation && (
                            <>
                              {" · "}
                              {Math.round(spot.distanceKm)} km
                            </>
                          )}
                          {" · "}
                          {spot.sportType === "KITE" ? "🪁 Kite" : "🪂 Para"}
                          {spot.dataSource === "archive" && (
                            <span className="text-amber-500 ml-0.5">
                              · 📊 Archives
                            </span>
                          )}
                        </p>
                      </div>
                      {/* Score badge with tooltip */}
                      <div className="group relative">
                        <div
                          className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white"
                          style={{
                            background: isForecastError
                              ? "#9ca3af"
                              : scoreColor(sc),
                          }}
                        >
                          {isForecastError ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <>
                              <span className="text-lg font-bold leading-none">
                                {sc}
                              </span>
                              <span className="text-[9px] opacity-80">
                                /100
                              </span>
                            </>
                          )}
                        </div>
                        {/* Score breakdown tooltip */}
                        {bestDay?.breakdown && (
                          <div className="hidden group-hover:block absolute right-0 top-full mt-1 z-50 bg-gray-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl w-44">
                            <div className="font-semibold mb-1.5 text-xs">
                              Détails du score
                            </div>
                            {(spot.sportType === "PARAGLIDE"
                              ? [
                                  ["Calme", bestDay.breakdown.hours, "30%"],
                                  [
                                    "Soleil",
                                    bestDay.breakdown.sunshine ?? 0,
                                    "30%",
                                  ],
                                  [
                                    "Rafales",
                                    bestDay.breakdown.regularity,
                                    "20%",
                                  ],
                                  ["Pluie", bestDay.breakdown.quality, "20%"],
                                ]
                              : [
                                  ["Heures", bestDay.breakdown.hours, "35%"],
                                  [
                                    "Qualité vent",
                                    bestDay.breakdown.quality,
                                    "25%",
                                  ],
                                  [
                                    "Régularité",
                                    bestDay.breakdown.regularity,
                                    "20%",
                                  ],
                                  [
                                    "Direction",
                                    bestDay.breakdown.direction,
                                    "20%",
                                  ],
                                ]
                            ).map(([label, val, weight]) => (
                              <div
                                key={label as string}
                                className="flex items-center gap-1.5 mb-1"
                              >
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
                                <span className="w-16 text-gray-300">
                                  {label}
                                </span>
                                <span className="w-6 text-right tabular-nums">
                                  {val}
                                </span>
                                <span className="text-gray-500 w-6 text-right">
                                  {weight}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Forecast error state */}
                    {isForecastError && (
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-orange-400" />
                        Prévisions indisponibles
                      </div>
                    )}

                    {/* Wind summary */}
                    {bestDay && (
                      <>
                        <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 mb-2">
                          <div
                            className="text-2xl font-bold tabular-nums leading-none"
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
                              : Math.round(bestDay.peakWindKmh)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                              {spot.sportType === "PARAGLIDE"
                                ? "Moy. km/h"
                                : "Pic km/h"}
                            </div>
                            <div
                              className="text-xs font-medium mt-0.5"
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
                                ? bestDay.avgWindKmh < 10
                                  ? "Calme idéal"
                                  : bestDay.avgWindKmh < 15
                                    ? "Acceptable"
                                    : "Venteux"
                                : windConditionLabel(bestDay.peakWindKmh) ||
                                  "—"}
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
                              <Clock className="h-3 w-3" />
                              {bestDay.kitableHours}h{" "}
                              {spot.sportType === "PARAGLIDE"
                                ? "calmes"
                                : "rideable"}
                            </div>
                            {bestDay.bestHour && (
                              <div className="text-[10px] text-gray-400">
                                {spot.sportType === "PARAGLIDE"
                                  ? "Meilleur créneau"
                                  : "Pic"}{" "}
                                à {new Date(bestDay.bestHour.time).getHours()}
                                h00
                              </div>
                            )}
                            {spot.sportType !== "PARAGLIDE" &&
                              bestDay.gustFactor > 1.35 && (
                                <div className="flex items-center gap-0.5 text-[10px] text-orange-500 justify-end">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Rafales ×{bestDay.gustFactor.toFixed(1)}
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Mini forecast bar (best day, 6h–21h) */}
                        {bestDay.forecast.length > 0 && (
                          <>
                            <div className="flex gap-px h-4 rounded overflow-hidden">
                              {bestDay.forecast.slice(6, 22).map((h, i) => (
                                <div
                                  key={i}
                                  className="flex-1"
                                  style={{
                                    background: windColor(h.windSpeedKmh),
                                  }}
                                  title={`${new Date(h.time).getHours()}h : ${Math.round(h.windSpeedKmh)} km/h`}
                                />
                              ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
                              <span>6h</span>
                              <span>21h</span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Multi-day calendar strip */}
                    {isMultiDay && spot.days && spot.days.length > 1 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-1">
                        {spot.days.map((day, i) => {
                          const isBest = i === (spot.bestDayIndex ?? 0);
                          const dayDate = new Date(day.date + "T12:00:00Z");
                          return (
                            <div
                              key={day.date}
                              className="flex-1 flex flex-col items-center gap-1"
                            >
                              <span className="text-[9px] text-gray-400 uppercase">
                                {dayDate.toLocaleDateString("fr", {
                                  weekday: "short",
                                })}
                              </span>
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                style={{
                                  background: scoreColor(day.score),
                                  outline: isBest
                                    ? `2px solid ${scoreColor(day.score)}`
                                    : "none",
                                  outlineOffset: "2px",
                                }}
                                title={`${day.date} — ${day.score}/100 · ${day.kitableHours}h`}
                              >
                                {day.score > 0 ? day.score : "·"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Link>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── Mobile expanded filters overlay ───────────────────── */}
      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Filtres</h3>
              <button
                onClick={() => setFiltersOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Destination */}
            <div className="mb-3">
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
                        {locationName ||
                          `${lat!.toFixed(3)}°, ${lng!.toFixed(3)}°`}
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
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  title="Ma position"
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-40"
                >
                  <Locate className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Date range */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Du</label>
                <input
                  type="date"
                  value={startDate}
                  min={toISO(0)}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
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
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${ctrlInput} w-full h-10`}
                />
              </div>
            </div>

            {/* Radius + Sport */}
            <div className="flex gap-3 mb-5">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">
                  Rayon
                  {!hasLocation && (
                    <span className="text-gray-400"> (ignoré)</span>
                  )}
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
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
                <label className="text-xs text-gray-500 mb-1 block">
                  Sport
                </label>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm h-10">
                  {(
                    [
                      ["ALL", "Tous"],
                      ["KITE", "Kite"],
                      ["PARAGLIDE", "Para"],
                    ] as const
                  ).map(([key, label], i) => (
                    <button
                      key={key}
                      onClick={() => setSport(key)}
                      className={`px-3 py-2 font-medium transition-colors ${
                        sport === key
                          ? "bg-gray-900 text-white"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                      } ${i > 0 ? "border-l border-gray-200" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search buttons */}
            <div className="space-y-2">
              {hasLocation ? (
                <Button
                  onClick={() => {
                    handleSearch();
                    setFiltersOpen(false);
                  }}
                  disabled={loading}
                  className="h-11 w-full"
                >
                  {loading ? "Recherche…" : "Trouver"}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      handleSearchNearMe();
                      setFiltersOpen(false);
                    }}
                    disabled={loading || geoLoading}
                    className="h-11 w-full"
                    variant="secondary"
                  >
                    {geoLoading ? (
                      "Localisation…"
                    ) : loading ? (
                      "Recherche…"
                    ) : (
                      <>
                        <Locate className="h-3.5 w-3.5 mr-1" />
                        Autour de moi
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      handleSearch();
                      setFiltersOpen(false);
                    }}
                    disabled={loading}
                    className="h-11 w-full"
                  >
                    {loading ? (
                      "Recherche…"
                    ) : (
                      <>
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        Meilleurs spots
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
