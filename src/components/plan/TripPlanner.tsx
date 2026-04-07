"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { KiteMap } from "@/components/map/KiteMap";
import { PlanFilters } from "@/components/plan/PlanFilters";
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
  ChevronDown,
  SlidersHorizontal,
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

const toISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

// ── Bottom sheet snap positions (fraction of viewport height) ──
const SNAP_PEEK = 0.08;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.92;
const SNAPS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];

function closestSnap(frac: number): number {
  let best = SNAPS[0];
  let bestDist = Math.abs(frac - best);
  for (const s of SNAPS) {
    const d = Math.abs(frac - s);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export function TripPlanner({ searchParams }: TripPlannerProps) {
  const router = useRouter();

  // Restore state from URL searchParams
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

  // Mobile bottom sheet (continuous drag)
  const hasAutoSearch = !!searchParams?.startDate;
  const [sheetFrac, setSheetFrac] = useState(
    hasAutoSearch ? SNAP_PEEK : SNAP_FULL,
  );
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartFrac = useRef(0);
  const viewportH = useRef(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  // Mobile inline filters — open by default on fresh visit
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(!hasAutoSearch);
  const [isMobile, setIsMobile] = useState(false);

  // Score detail popover (tap-to-toggle for touch)
  const [scoreDetailId, setScoreDetailId] = useState<string | null>(null);

  // Auto-search on mount if URL had params
  const [didAutoSearch, setDidAutoSearch] = useState(false);

  useEffect(() => {
    const onResize = () => {
      viewportH.current = window.innerHeight;
      setIsMobile(window.innerWidth < 1024);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  const handlePickLocation = useCallback(
    (latitude: number, longitude: number) => {
      setLat(latitude);
      setLng(longitude);
      reverseGeocode(latitude, longitude);
      // On mobile, re-open sheet + filters after picking on map
      if (isMobile) {
        setSheetFrac(SNAP_FULL);
        setMobileFiltersOpen(true);
      }
    },
    [reverseGeocode, isMobile],
  );

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Autorisez la localisation dans les réglages de votre navigateur."
            : "Impossible d'obtenir votre position. Réessayez.",
        );
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleSearchNearMe = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setLat(la);
        setLng(lo);
        reverseGeocode(la, lo);
        setGeoLoading(false);

        setLoading(true);
        setSearched(true);
        setError(null);
        setMobileFiltersOpen(false);

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
          if (data.length > 0) setSheetFrac(SNAP_HALF);
        } catch {
          setError("Impossible de récupérer les prévisions. Réessayez.");
          setResults([]);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Autorisez la localisation dans les r\u00e9glages de votre navigateur."
            : "Impossible d'obtenir votre position. R\u00e9essayez.",
        );
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handlePickOnMap = useCallback(() => {
    setSheetFrac(SNAP_PEEK);
    setMobileFiltersOpen(false);
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setError(null);
    setMobileFiltersOpen(false);

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
      if (data.length > 0) setSheetFrac(SNAP_HALF);
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
        await navigator.share({ title: "OpenWind — Planificateur", url });
        return;
      } catch {
        // User cancelled
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

  // Data source info
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

  // Mobile helpers
  const formatDateShort = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("fr", { day: "numeric", month: "short" });
  };

  const filterSummary = [
    locationName ||
      (hasLocation
        ? `${lat!.toFixed(1)}\u00B0, ${lng!.toFixed(1)}\u00B0`
        : null),
    `${formatDateShort(startDate)} \u2013 ${formatDateShort(endDate)}`,
    hasLocation ? `${radius} km` : null,
    sport !== "ALL" ? (sport === "KITE" ? "Kite" : "Para") : null,
  ]
    .filter(Boolean)
    .join(" \u00B7 ");

  // ── Fluid bottom sheet drag ──
  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartFrac.current = sheetFrac;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - clientY;
    const deltaFrac = deltaY / viewportH.current;
    const newFrac = Math.max(
      SNAP_PEEK,
      Math.min(SNAP_FULL, dragStartFrac.current + deltaFrac),
    );
    setSheetFrac(newFrac);
  };

  const handleDragEnd = (clientY: number) => {
    if (!isDragging) return;
    setIsDragging(false);
    const deltaY = dragStartY.current - clientY;
    const velocity = deltaY / viewportH.current;
    const biasedFrac = sheetFrac + velocity * 0.3;
    setSheetFrac(closestSnap(biasedFrac));
  };

  const handleSheetToggle = () => {
    if (sheetFrac < SNAP_HALF - 0.05) setSheetFrac(SNAP_HALF);
    else if (sheetFrac < SNAP_FULL - 0.05) setSheetFrac(SNAP_FULL);
    else setSheetFrac(SNAP_PEEK);
  };

  // First result for peek
  const firstResult = sorted[0] ?? null;

  // Desktop geocoding state (separate from PlanFilters)
  const [deskGeoQuery, setDeskGeoQuery] = useState("");
  const [deskGeoResults, setDeskGeoResults] = useState<
    { name: string; lat: number; lon: number }[]
  >([]);
  const [deskGeoOpen, setDeskGeoOpen] = useState(false);
  const deskGeoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchDeskGeo = useCallback((q: string) => {
    if (deskGeoTimer.current) clearTimeout(deskGeoTimer.current);
    if (q.length < 2) {
      setDeskGeoResults([]);
      return;
    }
    deskGeoTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { "Accept-Language": "fr" } },
        );
        const data = await res.json();
        setDeskGeoResults(
          data.map((r: { display_name: string; lat: string; lon: string }) => ({
            name: r.display_name.split(",").slice(0, 3).join(","),
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
          })),
        );
        setDeskGeoOpen(true);
      } catch {
        setDeskGeoResults([]);
      }
    }, 300);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ═══ Desktop Controls Bar ═══ */}
      <div className="hidden lg:block shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex flex-wrap items-end gap-2.5">
          {/* Destination */}
          <div className="flex items-end gap-1.5 min-w-0 flex-1 relative">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-gray-500 mb-1 block">
                Destination <span className="text-gray-400">(optionnel)</span>
              </label>
              {hasLocation && !deskGeoQuery ? (
                <div
                  className={`${ctrlInput} flex items-center gap-2 h-9.5 cursor-default`}
                >
                  <MapPin className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <span className="truncate text-gray-700 text-sm flex-1">
                    {locationName ||
                      `${lat!.toFixed(3)}\u00B0, ${lng!.toFixed(3)}\u00B0`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLat(null);
                      setLng(null);
                      setLocationName(null);
                      setDeskGeoQuery("");
                    }}
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
                      type="text"
                      value={deskGeoQuery}
                      onChange={(e) => {
                        setDeskGeoQuery(e.target.value);
                        searchDeskGeo(e.target.value);
                      }}
                      onFocus={() =>
                        deskGeoResults.length && setDeskGeoOpen(true)
                      }
                      placeholder="Ville, lieu\u2026 ou laissez vide"
                      className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
                    />
                  </div>
                  {deskGeoOpen && deskGeoResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {deskGeoResults.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setLat(r.lat);
                            setLng(r.lon);
                            setLocationName(r.name.split(",")[0]);
                            setDeskGeoQuery("");
                            setDeskGeoResults([]);
                            setDeskGeoOpen(false);
                          }}
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
              title="Utiliser ma position"
              className="h-9.5 w-9.5 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-40"
            >
              <Locate className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Dates */}
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
              {!hasLocation && (
                <span className="text-gray-400"> (ignor\u00E9)</span>
              )}
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

          {/* Sport */}
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
              {loading ? "Recherche\u2026" : "Trouver"}
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
                  "Localisation\u2026"
                ) : loading ? (
                  "Recherche\u2026"
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
                  "Recherche\u2026"
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

      {/* ═══ Desktop data source banner ═══ */}
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
                <strong>Donn\u00E9es historiques</strong> {"\u2014"} Les dates
                s\u00E9lectionn\u00E9es d\u00E9passent les 16 jours de
                pr\u00E9vision. Les scores sont bas\u00E9s sur les archives
                m\u00E9t\u00E9o des 5 derni\u00E8res ann\u00E9es.
              </span>
            </>
          ) : (
            <>
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Pr\u00E9visions temps r\u00E9el</strong> {"\u2014"}{" "}
                Jusqu&apos;\u00E0 16 jours. Au-del\u00E0, les scores se baseront
                sur les archives annuelles.
              </span>
            </>
          )}
        </div>
      )}

      {/* ═══ Map + Results ═══ */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row relative">
        {/* Map */}
        <div className="flex-1 min-h-0 lg:h-full lg:border-r border-gray-200 relative">
          <KiteMap
            spots={results}
            pickMode={true}
            onPickLocation={handlePickLocation}
            highlightSpotId={hoveredSpotId}
          />

          {/* Mobile FABs — positioned above the sheet */}
          <div
            className="lg:hidden absolute right-3 z-10 flex flex-col gap-2"
            style={{
              bottom: `calc(${sheetFrac * 100}vh + 12px)`,
              transition: isDragging
                ? "none"
                : "bottom 0.3s cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            {!searched && (
              <button
                onClick={handleSearchNearMe}
                disabled={loading || geoLoading}
                className="h-12 w-12 rounded-full bg-sky-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                title="Autour de moi"
              >
                <Locate className="h-5 w-5" />
              </button>
            )}
            {!searched && !hasLocation && (
              <button
                onClick={handleSearch}
                disabled={loading}
                className="h-12 w-12 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                title="Meilleurs spots"
              >
                <Globe className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* ═══ Bottom Sheet (mobile) / Side Panel (desktop) ═══ */}
        <div
          ref={sheetRef}
          className="absolute bottom-0 left-0 right-0 z-20 lg:static lg:z-auto w-full lg:w-105 flex flex-col min-h-0 bg-white rounded-t-2xl lg:rounded-none shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:shadow-none border-t border-gray-200 lg:border-t-0"
          style={{
            height: isMobile ? `${sheetFrac * 100}vh` : undefined,
            transition: isDragging
              ? "none"
              : "height 0.3s cubic-bezier(0.32,0.72,0,1)",
          }}
        >
          {/* Drag handle */}
          <div
            className="lg:hidden flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
            onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientY)}
            onClick={handleSheetToggle}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mb-1" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span>
                {loading
                  ? "Recherche\u2026"
                  : results.length > 0
                    ? `${results.length} spot${results.length > 1 ? "s" : ""}`
                    : searched
                      ? "Aucun r\u00E9sultat"
                      : "R\u00E9sultats"}
              </span>
              <ChevronUp
                className={`h-3.5 w-3.5 transition-transform ${sheetFrac > SNAP_HALF + 0.05 ? "rotate-180" : ""}`}
              />
            </div>
          </div>

          {/* Peek preview — first result */}
          {sheetFrac <= SNAP_PEEK + 0.02 && firstResult && !loading && (
            <div className="lg:hidden px-4 pb-2 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: scoreColor(firstResult.bestScore ?? 0) }}
                >
                  {firstResult.bestScore ?? 0}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {firstResult.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {[firstResult.region, firstResult.country]
                      .filter(Boolean)
                      .join(", ")}
                    {hasLocation &&
                      ` \u00B7 ${Math.round(firstResult.distanceKm)} km`}
                  </p>
                </div>
                {results.length > 1 && (
                  <span className="text-xs text-gray-400 shrink-0">
                    +{results.length - 1}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Mobile onboarding — visible before first search */}
          {!searched && !loading && (
            <div className="lg:hidden px-4 pt-3 pb-2 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                🪁 Planifiez votre session
              </h2>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Choisissez une destination et vos dates, ou lancez une recherche
                rapide pour trouver le meilleur vent.
              </p>
            </div>
          )}

          {/* Mobile inline filters (collapsible) */}
          <div className="lg:hidden shrink-0">
            <button
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs border-b border-gray-100"
            >
              <div className="flex items-center gap-2 text-gray-500 min-w-0">
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{filterSummary || "Filtres"}</span>
              </div>
              {mobileFiltersOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              )}
            </button>
            {mobileFiltersOpen && (
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <PlanFilters
                  lat={lat}
                  lng={lng}
                  locationName={locationName}
                  startDate={startDate}
                  endDate={endDate}
                  radius={radius}
                  sport={sport}
                  geoLoading={geoLoading}
                  onLatChange={setLat}
                  onLngChange={setLng}
                  onLocationNameChange={setLocationName}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onRadiusChange={setRadius}
                  onSportChange={setSport}
                  onGeolocate={handleGeolocate}
                  onPickOnMap={handlePickOnMap}
                  reverseGeocode={reverseGeocode}
                />
                <div className="mt-3 flex gap-2">
                  {hasLocation ? (
                    <Button
                      onClick={handleSearch}
                      disabled={loading}
                      className="h-10 flex-1"
                    >
                      {loading ? "Recherche\u2026" : "Trouver"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSearchNearMe}
                        disabled={loading || geoLoading}
                        className="h-10 flex-1"
                        variant="secondary"
                      >
                        {geoLoading ? (
                          "Localisation\u2026"
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
                        className="h-10 flex-1"
                      >
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        Meilleurs spots
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile data source banner */}
          {searched && !loading && results.length > 0 && (
            <div
              className={`lg:hidden shrink-0 flex items-center gap-2 px-4 py-1.5 text-xs border-b border-gray-200 ${
                dataSource === "archive"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-sky-50 text-sky-700"
              }`}
            >
              {dataSource === "archive" ? (
                <>
                  <Archive className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>Donn\u00E9es historiques</strong> {"\u2014"}{" "}
                    archives m\u00E9t\u00E9o
                  </span>
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>Pr\u00E9visions temps r\u00E9el</strong>
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
                    pr\u00E9vision)
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

          {/* Results list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {/* Empty state — desktop only (mobile has the onboarding header + open filters) */}
            {!searched && !loading && (
              <div className="hidden lg:block text-center text-gray-400 text-sm py-12">
                <Navigation className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-500">
                  Trouvez les meilleurs spots
                </p>
                <p className="text-xs mt-1.5 opacity-70 leading-5">
                  Cliquez sur la carte, recherchez un lieu,
                  <br />
                  ou lancez directement pour les meilleurs spots mondiaux.
                </p>
              </div>
            )}

            {/* Skeleton */}
            {loading && (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-50 border border-gray-200 p-3 animate-pulse"
                  >
                    <div className="flex justify-between mb-2">
                      <div className="space-y-1">
                        <div className="h-3.5 bg-gray-200 rounded w-28" />
                        <div className="h-2.5 bg-gray-200 rounded w-20" />
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-gray-200" />
                    </div>
                    <div className="h-8 bg-gray-200 rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-200">
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
                      \u00C9largissez le rayon ou changez de destination.
                    </span>
                  </>
                ) : (
                  "Aucun spot trouv\u00E9."
                )}
              </div>
            )}

            {/* Result cards */}
            {!loading &&
              sorted.map((spot) => {
                const bestDay = spot.days?.[spot.bestDayIndex ?? 0];
                const sc = spot.bestScore ?? 0;
                const isForecastError = spot.forecastError;
                const showDetail = scoreDetailId === spot.id;

                if (!bestDay && !isForecastError) return null;
                const color = bestDay
                  ? windColor(bestDay.peakWindKmh)
                  : "#d1d5db";

                return (
                  <div
                    key={spot.id}
                    className="rounded-xl bg-white border border-gray-200 hover:border-sky-400/60 hover:shadow-sm transition-all"
                    onMouseEnter={() => setHoveredSpotId(spot.id)}
                    onMouseLeave={() => setHoveredSpotId(null)}
                  >
                    <Link href={`/spots/${spot.id}`} className="block p-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">
                            {spot.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[spot.region, spot.country]
                              .filter(Boolean)
                              .join(", ")}
                            {hasLocation && (
                              <>
                                {" \u00B7 "}
                                {Math.round(spot.distanceKm)} km
                              </>
                            )}
                            {" \u00B7 "}
                            {spot.sportType === "KITE" ? "🪁" : "🪂"}
                            {spot.dataSource === "archive" && (
                              <span className="text-amber-500 ml-0.5">
                                {" 📊"}
                              </span>
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
                              setScoreDetailId(showDetail ? null : spot.id);
                            }}
                            className="shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white"
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
                                <span className="text-base font-bold leading-none">
                                  {sc}
                                </span>
                                <span className="text-[8px] opacity-80">
                                  /100
                                </span>
                              </>
                            )}
                          </button>
                          {/* Score breakdown popover */}
                          {showDetail && bestDay?.breakdown && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl w-44">
                              <div className="font-semibold mb-1.5 text-xs">
                                D\u00E9tails du score
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
                                      "Qualit\u00E9 vent",
                                      bestDay.breakdown.quality,
                                      "25%",
                                    ],
                                    [
                                      "R\u00E9gularit\u00E9",
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

                      {/* Forecast error */}
                      {isForecastError && (
                        <div className="text-xs text-gray-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-orange-400" />
                          Pr\u00E9visions indisponibles
                        </div>
                      )}

                      {/* Wind summary */}
                      {bestDay && (
                        <>
                          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-1.5">
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
                                : Math.round(bestDay.peakWindKmh)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                                {spot.sportType === "PARAGLIDE"
                                  ? "Moy. km/h"
                                  : "Pic km/h"}
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
                                    ? "Calme id\u00E9al"
                                    : bestDay.avgWindKmh < 15
                                      ? "Acceptable"
                                      : "Venteux"
                                  : windConditionLabel(bestDay.peakWindKmh) ||
                                    "\u2014"}
                              </div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
                                <Clock className="h-3 w-3" />
                                {bestDay.kitableHours}h
                              </div>
                              {bestDay.bestHour && (
                                <div className="text-[10px] text-gray-400">
                                  Pic{" "}
                                  {new Date(bestDay.bestHour.time).getHours()}h
                                </div>
                              )}
                              {spot.sportType !== "PARAGLIDE" &&
                                bestDay.gustFactor > 1.35 && (
                                  <div className="flex items-center gap-0.5 text-[10px] text-orange-500 justify-end">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    \u00D7{bestDay.gustFactor.toFixed(1)}
                                  </div>
                                )}
                            </div>
                          </div>

                          {/* Mini forecast bar */}
                          {bestDay.forecast.length > 0 && (
                            <div className="mt-1.5">
                              <div className="flex gap-px h-3 rounded overflow-hidden">
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
                              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5 px-0.5">
                                <span>6h</span>
                                <span>21h</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Multi-day strip (scrollable if >7 days) */}
                      {isMultiDay && spot.days && spot.days.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 overflow-x-auto -mx-1 px-1 scrollbar-none">
                          <div
                            className="flex gap-1"
                            style={{
                              minWidth:
                                spot.days.length > 7
                                  ? `${spot.days.length * 2}rem`
                                  : undefined,
                            }}
                          >
                            {spot.days.map((day, i) => {
                              const isBest = i === (spot.bestDayIndex ?? 0);
                              const dayDate = new Date(day.date + "T12:00:00Z");
                              return (
                                <div
                                  key={day.date}
                                  className="flex-1 flex flex-col items-center gap-0.5 min-w-[1.75rem]"
                                >
                                  <span className="text-[8px] text-gray-400 uppercase">
                                    {dayDate.toLocaleDateString("fr", {
                                      weekday: "narrow",
                                    })}
                                  </span>
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                    style={{
                                      background: scoreColor(day.score),
                                      outline: isBest
                                        ? `2px solid ${scoreColor(day.score)}`
                                        : "none",
                                      outlineOffset: "1px",
                                    }}
                                    title={`${day.date} \u2014 ${day.score}/100 \u00B7 ${day.kitableHours}h`}
                                  >
                                    {day.score > 0 ? day.score : "\u00B7"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Link>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
