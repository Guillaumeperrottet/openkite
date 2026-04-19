"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PlanFilters } from "@/components/plan/PlanFilters";

const KiteMap = dynamic(
  () => import("@/components/map/KiteMap").then((m) => m.KiteMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
  },
);
import { SpotResultCard } from "@/components/plan/SpotResultCard";
import { SpotPreview } from "@/components/plan/SpotPreview";
import {
  useBottomSheet,
  SNAP_PEEK,
  SNAP_HALF,
  SNAP_FULL,
} from "@/components/plan/useBottomSheet";
import { Button } from "@/components/ui/Button";
import type { SpotWithForecast, SportType } from "@/types";
import {
  MapPin,
  Wind,
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
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";

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
    (searchParams?.sport as SportType) || "KITE",
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
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [previewSpotId, setPreviewSpotId] = useState<string | null>(null);

  // Mobile bottom sheet (continuous drag)
  const hasAutoSearch = !!searchParams?.startDate;
  const {
    sheetFrac,
    setSheetFrac,
    isDragging,
    sheetRef,
    scrollRef,
    updateViewportHeight,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleSheetToggle,
    contentTouchStart,
    contentTouchMove,
    contentTouchEnd,
  } = useBottomSheet(hasAutoSearch ? SNAP_PEEK : SNAP_FULL);

  // Mobile inline filters — open by default on fresh visit
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(!hasAutoSearch);
  const [isMobile, setIsMobile] = useState(false);

  // Selected day override per spot (click day circle → see that day's data)
  const [selectedDayMap, setSelectedDayMap] = useState<Record<string, number>>(
    {},
  );

  // Auto-search on mount if URL had params
  const [didAutoSearch, setDidAutoSearch] = useState(false);

  useEffect(() => {
    const onResize = () => {
      updateViewportHeight();
      setIsMobile(window.innerWidth < 1024);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateViewportHeight]);

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
    [reverseGeocode, isMobile, setSheetFrac],
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
          setSelectedDayMap({});
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
            ? "Autorisez la localisation dans les réglages de votre navigateur."
            : "Impossible d'obtenir votre position. Réessayez.",
        );
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handlePickOnMap = useCallback(() => {
    setSheetFrac(SNAP_PEEK);
    setMobileFiltersOpen(false);
  }, [setSheetFrac]);

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
      setSelectedDayMap({});
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
      (hasLocation ? `${lat!.toFixed(1)}°, ${lng!.toFixed(1)}°` : null),
    `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`,
    hasLocation ? `${radius} km` : null,
    sport !== "ALL" ? (sport === "KITE" ? "Kite" : "Para") : null,
  ]
    .filter(Boolean)
    .join(" · ");

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

  // Cleanup deskGeoTimer on unmount to prevent stale state updates
  useEffect(() => {
    return () => {
      if (deskGeoTimer.current) clearTimeout(deskGeoTimer.current);
    };
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
                    {locationName || `${lat!.toFixed(3)}°, ${lng!.toFixed(3)}°`}
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
                      placeholder="Ville, lieu… ou laissez vide"
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

          {/* Sport */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sport</label>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(
                [
                  ["KITE", "Kite"],
                  ["PARAGLIDE", "Para"],
                ] as const
              ).map(([key, label], i) => (
                <button
                  key={key}
                  onClick={() => setSport(key)}
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
                variant="secondary"
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
                <strong>Données historiques</strong> {"—"} Les dates
                sélectionnées dépassent les 16 jours de prévision. Les scores
                sont basés sur les archives météo des 5 dernières années.
              </span>
            </>
          ) : (
            <>
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Prévisions temps réel</strong> {"—"} Jusqu&apos;à 16
                jours. Au-delà, les scores se baseront sur les archives
                annuelles.
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
        <div className="hidden lg:block relative shrink-0">
          {/* Desktop expand toggle — centered on left edge */}
          {searched && results.length > 0 && (
            <button
              onClick={() => setPanelExpanded((p) => !p)}
              className="absolute -left-3.5 top-1/2 -translate-y-1/2 z-30 w-7 h-14 flex items-center justify-center bg-white border border-gray-200 rounded-l-lg shadow-sm hover:bg-gray-50 hover:shadow transition-all"
              title={panelExpanded ? "Réduire le panel" : "Élargir le panel"}
            >
              {panelExpanded ? (
                <PanelRightClose className="h-4 w-4 text-gray-500" />
              ) : (
                <PanelRightOpen className="h-4 w-4 text-gray-500" />
              )}
            </button>
          )}
        </div>
        <div
          ref={sheetRef}
          className={`absolute bottom-0 left-0 right-0 z-20 lg:static lg:z-auto w-full flex flex-col min-h-0 bg-white rounded-t-2xl lg:rounded-none shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:shadow-none border-t border-gray-200 lg:border-t-0 transition-[width] duration-300 ease-in-out ${
            panelExpanded ? "lg:w-[65vw]" : "lg:w-105"
          }`}
          style={{
            height: isMobile ? `${sheetFrac * 100}vh` : undefined,
            transition: isDragging
              ? "none"
              : isMobile
                ? "height 0.3s cubic-bezier(0.32,0.72,0,1)"
                : "width 0.3s cubic-bezier(0.32,0.72,0,1)",
          }}
        >
          {/* Drag handle — tall touch target for easy swiping */}
          <div
            className="lg:hidden flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
            onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientY)}
            onClick={handleSheetToggle}
          >
            <div className="w-12 h-1.5 rounded-full bg-gray-300 mb-1.5" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span>
                {loading
                  ? "Recherche…"
                  : results.length > 0
                    ? `${results.length} spot${results.length > 1 ? "s" : ""}`
                    : searched
                      ? "Aucun résultat"
                      : "Résultats"}
              </span>
              <ChevronUp
                className={`h-3.5 w-3.5 transition-transform ${sheetFrac > SNAP_HALF + 0.05 ? "rotate-180" : ""}`}
              />
            </div>
          </div>

          {/* Swipeable content wrapper — enables drag from anywhere, not just the handle */}
          <div
            className="flex flex-col min-h-0 flex-1"
            onTouchStart={contentTouchStart}
            onTouchMove={contentTouchMove}
            onTouchEnd={contentTouchEnd}
          >
            {/* Peek preview — first result */}
            {sheetFrac <= SNAP_PEEK + 0.02 && firstResult && !loading && (
              <div className="lg:hidden px-4 pb-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                    style={{
                      background: scoreColor(firstResult.bestScore ?? 0),
                    }}
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
                        ` · ${Math.round(firstResult.distanceKm)} km`}
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
                  Choisissez une destination et vos dates, ou lancez une
                  recherche rapide pour trouver le meilleur vent.
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
                        {loading ? "Recherche…" : "Trouver"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handleSearchNearMe}
                          disabled={loading || geoLoading}
                          className="h-10 flex-1"
                        >
                          {geoLoading ? (
                            "Localisation…"
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
                          variant="secondary"
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
                      <strong>Données historiques</strong> {"—"} archives météo
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

            {/* Results list */}
            <div
              ref={scrollRef}
              className={`flex-1 overflow-y-auto p-4 ${panelExpanded ? "grid grid-cols-2 gap-3 auto-rows-min items-start" : "space-y-2.5"}`}
            >
              {/* Empty state — desktop only (mobile has the onboarding header + open filters) */}
              {!searched && !loading && (
                <div className="hidden lg:block text-center text-gray-400 text-sm py-12 col-span-full">
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
                <div className="space-y-2.5 col-span-full">
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
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-200 col-span-full">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* No results */}
              {!loading && searched && results.length === 0 && !error && (
                <div className="text-center text-gray-400 text-sm py-12 col-span-full">
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

              {/* Result cards / Spot preview */}
              {!loading && previewSpotId && panelExpanded
                ? (() => {
                    const previewSpot = sorted.find(
                      (s) => s.id === previewSpotId,
                    );
                    if (!previewSpot) return null;
                    const dayIdx =
                      selectedDayMap[previewSpot.id] ??
                      previewSpot.bestDayIndex ??
                      0;
                    return (
                      <div className="col-span-full h-full">
                        <SpotPreview
                          spot={previewSpot}
                          activeDayIdx={dayIdx}
                          onBack={() => setPreviewSpotId(null)}
                          onSelectDay={(i) =>
                            setSelectedDayMap((prev) => ({
                              ...prev,
                              [previewSpot.id]: i,
                            }))
                          }
                        />
                      </div>
                    );
                  })()
                : !loading &&
                  sorted.map((spot) => {
                    const activeDayIdx =
                      selectedDayMap[spot.id] ?? spot.bestDayIndex ?? 0;

                    return (
                      <SpotResultCard
                        key={spot.id}
                        spot={spot}
                        activeDayIdx={activeDayIdx}
                        hasLocation={hasLocation}
                        isMultiDay={isMultiDay}
                        onHover={setHoveredSpotId}
                        onSelectDay={(spotId, dayIdx) =>
                          setSelectedDayMap((prev) => ({
                            ...prev,
                            [spotId]: dayIdx,
                          }))
                        }
                        onSelect={
                          panelExpanded
                            ? (id) => setPreviewSpotId(id)
                            : undefined
                        }
                      />
                    );
                  })}
            </div>
          </div>
          {/* end swipeable content wrapper */}
        </div>
      </div>
    </div>
  );
}
