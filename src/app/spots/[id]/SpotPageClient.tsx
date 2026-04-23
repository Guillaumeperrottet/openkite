"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Wind,
  Zap,
  Waves,
  Calendar,
  AlertTriangle,
  Car,
  ExternalLink,
  Sailboat,
  Mountain,
  TrendingUp,
  Pencil,
  Images,
  Star,
  Radio,
  Camera,
} from "lucide-react";
import dynamic from "next/dynamic";
import { WindCompass } from "@/components/spot/WindCompass";
import { WindDirectionRose } from "@/components/spot/WindDirectionRose";
import { WindChart } from "@/components/spot/WindChart";
import { WindHistoryChart } from "@/components/spot/WindHistoryChart";
import { NearbyStationsPanel } from "@/components/spot/NearbyStationsPanel";
import { useNearbyStations } from "@/components/spot/useNearbyStations";
import { SpotLightbox } from "@/components/spot/SpotLightbox";

// Lazy-load heavy below-fold components — keeps initial bundle small
const ForecastTable = dynamic(
  () => import("@/components/spot/ForecastTable").then((m) => m.ForecastTable),
  { ssr: false },
);
const WindArchives = dynamic(
  () => import("@/components/spot/WindArchives").then((m) => m.WindArchives),
  { ssr: false },
);
const SpotMiniMap = dynamic(() => import("./SpotMiniMap"), { ssr: false });
import {
  windConditionLabel,
  windDirectionLabel,
  MONTHS,
  getWindData,
  relativeTime,
} from "@/lib/utils";
import { roundKnots } from "@/lib/forecast";
import { useFavContext } from "@/lib/FavContext";
import {
  Badge,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  WATER_LABELS,
} from "@/components/ui/Badge";
import type { WindData } from "@/types";
import type { HistoryPoint } from "@/types";
import type { FullForecast } from "@/lib/forecast";

const NETWORK_LABELS: Record<string, string> = {
  pioupiou: "Pioupiou",
  windball: "Windball",
  meteofrance: "Météo-France",
  netatmo: "Netatmo",
  meteoswiss: "MeteoSwiss",
};

/** Infer the network label from a station id prefix. */
function networkLabelFromStationId(id: string): string {
  if (id.startsWith("piou-")) return NETWORK_LABELS.pioupiou;
  if (id.startsWith("windball-")) return NETWORK_LABELS.windball;
  if (id.startsWith("mf-")) return NETWORK_LABELS.meteofrance;
  if (id.startsWith("netatmo-")) return NETWORK_LABELS.netatmo;
  return NETWORK_LABELS.meteoswiss;
}

// Serialised spot from Prisma (dates are strings after JSON)
interface SpotData {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  country: string | null;
  region: string | null;
  difficulty: string;
  waterType: string;
  sportType: string;
  minWindKmh: number;
  maxWindKmh: number;
  bestMonths: string[];
  bestWindDirections: string[];
  hazards: string | null;
  access: string | null;
  nearestStationId: string | null;
  images: { id: string; url: string; caption: string | null }[];
  reports: {
    id: string;
    date: string;
    windSpeedKmh: number;
    windDirection: number;
    gustsKmh: number | null;
    isKitable: boolean;
    comment: string | null;
    rating: number;
  }[];
}

interface Props {
  spot: SpotData;
  wind: WindData | null;
  windSource: { name: string; network: string } | null;
}

export function SpotPageClient({
  spot,
  wind: initialWind,
  windSource: initialWindSource,
}: Props) {
  const [useKnots, setUseKnots] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [forecast, setForecast] = useState<FullForecast | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    spot.nearestStationId,
  );
  const [historySource, setHistorySource] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const router = useRouter();
  const { favoriteIds, toggleFavorite } = useFavContext();
  const isFav = favoriteIds.has(spot.id);
  const { nearbyStations, loadingStations } = useNearbyStations(
    spot.latitude,
    spot.longitude,
  );

  // Fetch forecast + history client-side
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/spots/${spot.id}/weather`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.forecast) setForecast(data.forecast);
        if (data.history) setHistory(data.history);
        if (data.stationId) setHistorySource(data.stationId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spot.id]);

  // Re-fetch history when user selects a different nearby station
  useEffect(() => {
    if (!selectedStationId) return;
    // Skip initial load — already fetched above
    if (selectedStationId === spot.nearestStationId && historySource === null)
      return;
    // Skip if already showing this station's history
    if (selectedStationId === historySource) return;

    let cancelled = false;
    const stationParam = encodeURIComponent(selectedStationId);
    // Use a microtask to avoid synchronous setState inside effect body
    queueMicrotask(() => {
      if (!cancelled) setHistoryLoading(true);
    });
    fetch(`/api/spots/${spot.id}/weather?stationId=${stationParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.history) setHistory(data.history);
        if (data.stationId) setHistorySource(data.stationId);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStationId, spot.id, spot.nearestStationId, historySource]);

  // SINGLE SOURCE OF TRUTH for the "Vent moyen / Rafales / Direction" cards:
  // the last *measured* point of the 48h history chart.
  //
  // Derived (not stored as state) so there's no race between the SSR
  // value and an async setState — the cards always reflect what the chart
  // shows. Falls back to the SSR `initialWind` while history is loading.
  const wind = useMemo<WindData | null>(() => {
    if (!history || history.length === 0) return initialWind;
    const nowIso = new Date().toISOString().slice(0, 16);
    let last: HistoryPoint | null = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].time <= nowIso) {
        last = history[i];
        break;
      }
    }
    if (!last) return initialWind;
    return getWindData(
      last.windSpeedKmh,
      last.windDirection,
      last.gustsKmh,
      // history `time` is "YYYY-MM-DDTHH:mm" UTC — append Z for correct parsing
      last.time.length === 16 ? `${last.time}:00Z` : last.time,
    );
  }, [history, initialWind]);

  const windSource = useMemo(() => {
    if (historySource) {
      return {
        name: historySource,
        network: networkLabelFromStationId(historySource),
      };
    }
    return initialWindSource;
  }, [historySource, initialWindSource]);

  // Auto-refresh when tab becomes visible after being hidden for 10+ min.
  // Avoids polling every 10 min in background tabs, saving ~3 API calls per cycle.
  useEffect(() => {
    let hiddenSince = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenSince = Date.now();
      } else if (hiddenSince && Date.now() - hiddenSince > 10 * 60 * 1000) {
        router.refresh();
        setLastRefreshed(new Date());
        hiddenSince = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Also refresh every 10 min while actively viewing
    const id = setInterval(
      () => {
        if (!document.hidden) {
          router.refresh();
          setLastRefreshed(new Date());
        }
      },
      10 * 60 * 1000,
    );
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(id);
    };
  }, [router]);

  const speedKmh = wind?.windSpeedKmh ?? 0;
  const gustsKmh = wind?.gustsKmh ?? null;
  const condLabel = wind ? windConditionLabel(speedKmh) : "—";
  const dirLabel = wind ? windDirectionLabel(wind.windDirection) : "—";
  const speedKts = roundKnots(speedKmh);
  const gustsKts = gustsKmh !== null ? roundKnots(gustsKmh) : null;

  const bestMonthLabels = spot.bestMonths
    .map((m) => MONTHS[parseInt(m) - 1])
    .filter(Boolean);

  const isKite = spot.sportType === "KITE";

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la carte
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(spot.id)}
              className="inline-flex items-center justify-center text-gray-400 hover:text-amber-500 transition-colors"
              title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Star
                className="h-5 w-5"
                fill={isFav ? "currentColor" : "none"}
                strokeWidth={isFav ? 0 : 2}
                style={isFav ? { color: "#f59e0b" } : undefined}
              />
            </button>
            <Link
              href={`/spots/${spot.id}/edit`}
              className="inline-flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 wrap-break-word">
                {spot.name}
              </h1>
              {spot.bestWindDirections.length > 0 && (
                <div
                  title={`Meilleures directions : ${spot.bestWindDirections.join(", ")}`}
                >
                  <WindDirectionRose
                    bestDirections={spot.bestWindDirections}
                    size={80}
                    showLabels={false}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              {(spot.country || spot.region) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[spot.region, spot.country].filter(Boolean).join(", ")}
                </span>
              )}
              <span>·</span>
              <span className="flex items-center gap-1">
                {isKite ? (
                  <Sailboat className="h-3.5 w-3.5" />
                ) : (
                  <Mountain className="h-3.5 w-3.5" />
                )}
                {isKite ? "Kitesurf" : "Parapente"}
              </span>
              <span>·</span>
              <Link
                href={`/webcams?lat=${spot.latitude}&lng=${spot.longitude}&name=${encodeURIComponent(spot.name)}&back=${encodeURIComponent(`/spots/${spot.id}`)}`}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                Webcams
              </Link>
              <span>·</span>
              <a
                href="#balises"
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Radio className="h-3.5 w-3.5" />
                Balises à proximité
              </a>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className={DIFFICULTY_COLORS[spot.difficulty]}>
                {DIFFICULTY_LABELS[spot.difficulty]}
              </Badge>
              {isKite && (
                <Badge className="bg-gray-100 text-gray-700">
                  <Waves className="h-3 w-3 mr-1" />{" "}
                  {WATER_LABELS[spot.waterType]}
                </Badge>
              )}
              <Badge className="bg-gray-100 text-gray-700">
                <Wind className="h-3 w-3 mr-1" />{" "}
                {useKnots
                  ? `${roundKnots(spot.minWindKmh)}–${roundKnots(spot.maxWindKmh)} kts`
                  : `${spot.minWindKmh}–${spot.maxWindKmh} km/h`}
              </Badge>
            </div>

            {/* Description + meta compact */}
            {spot.description && (
              <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-2xl">
                {spot.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
              {bestMonthLabels.length > 0 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {bestMonthLabels.join(", ")}
                </span>
              )}
              {spot.hazards && (
                <span className="flex items-center gap-1 text-orange-500">
                  <AlertTriangle className="h-3 w-3" />
                  {spot.hazards}
                </span>
              )}
              {spot.access && (
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  {spot.access}
                </span>
              )}
            </div>

            {lastRefreshed && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 mt-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                màj auto ·{" "}
                {lastRefreshed.toLocaleTimeString("fr", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {/* ── Right side: photos ──────────────────────────── */}
          <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-3 w-full sm:w-auto">
            {spot.images.length > 0 && (
              <div className="flex gap-1.5">
                {spot.images.slice(0, 3).map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="relative overflow-hidden rounded-lg border border-gray-200 w-20 h-20 sm:w-24 sm:h-24 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.caption || spot.name}
                      className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
                    />
                    {idx === 2 && spot.images.length > 3 && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-0.5">
                        <Images className="h-4 w-4 text-white" />
                        <span className="text-white font-semibold text-xs">
                          +{spot.images.length - 3}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-8">
        {/* Unit toggle */}
        <div className="flex justify-end mb-5">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm shadow-sm">
            <button
              onClick={() => setUseKnots(true)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                useKnots
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              kts
            </button>
            <button
              onClick={() => setUseKnots(false)}
              className={`px-4 py-1.5 font-medium transition-colors border-l border-gray-200 ${
                !useKnots
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              km/h
            </button>
          </div>
        </div>

        {/* ── Vent en direct + Info ──────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start gap-3 mb-10">
          {/* Compass */}
          <div className="hidden sm:flex flex-col items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-4 shrink-0">
            {wind ? (
              <WindCompass
                wind={wind}
                size={170}
                light
                sourceLabel={
                  windSource
                    ? `${windSource.name} · ${windSource.network}`
                    : "Open-Meteo · NWP"
                }
              />
            ) : (
              <div className="flex items-center justify-center h-48 w-48 text-sm text-gray-400">
                Données vent indisponibles
              </div>
            )}
            <p className="text-[10px] text-gray-500 text-center leading-snug">
              {windSource ? (
                <span>{windSource.network}</span>
              ) : (
                <a
                  href="https://open-meteo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-700 inline-flex items-center gap-0.5"
                >
                  Open-Meteo
                  <ExternalLink className="h-2 w-2 ml-0.5" />
                </a>
              )}
            </p>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
            <div className="flex gap-2">
              {/* Vent moyen */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 flex-1 sm:flex-none sm:w-40">
                <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium mb-3">
                  <Wind className="h-4 w-4" />
                  Vent moyen
                </div>
                {wind ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-bold tabular-nums leading-none text-gray-900">
                        {useKnots ? speedKts : Math.round(speedKmh)}
                      </span>
                      <span className="text-base text-gray-500 font-medium">
                        {useKnots ? "kts" : "km/h"}
                      </span>
                    </div>
                    {wind.updatedAt && (
                      <div className="text-[10px] text-gray-400 mt-2">
                        {relativeTime(wind.updatedAt)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-4xl sm:text-5xl font-bold text-gray-400">
                    —
                  </div>
                )}
              </div>

              {/* Rafales */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 flex-1 sm:flex-none sm:w-40">
                <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium mb-3">
                  <Zap className="h-4 w-4" />
                  Rafales
                </div>
                {gustsKts !== null && gustsKmh !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-bold tabular-nums leading-none text-gray-900">
                        {useKnots ? gustsKts : Math.round(gustsKmh)}
                      </span>
                      <span className="text-base text-gray-500 font-medium">
                        {useKnots ? "kts" : "km/h"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-4xl sm:text-5xl font-bold text-gray-400">
                    —
                  </div>
                )}
              </div>
            </div>

            {/* Direction */}
            {wind && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Direction</div>
                    <div className="flex items-center gap-3">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <g
                          transform={`rotate(${(wind.windDirection + 180) % 360}, 8, 8)`}
                        >
                          <line
                            x1="8"
                            y1="13"
                            x2="8"
                            y2="4.5"
                            stroke="#374151"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <polygon
                            points="8,1.5 4.5,6.5 11.5,6.5"
                            fill="#374151"
                          />
                        </g>
                      </svg>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900 leading-none">
                          {dirLabel}
                        </span>
                        <span className="text-base text-gray-500">
                          {wind.windDirection}°
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                    {condLabel}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 48h history chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0 flex-1">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                Historique · 48h
              </h2>
              {historySource ? (
                <span className="text-[10px] text-gray-500">
                  {historySource}
                  {nearbyStations.find((s) => s.id === historySource)
                    ? ` · ${nearbyStations.find((s) => s.id === historySource)?.source === "meteoswiss" ? "MeteoSwiss" : nearbyStations.find((s) => s.id === historySource)?.source === "pioupiou" ? "Pioupiou" : nearbyStations.find((s) => s.id === historySource)?.source === "netatmo" ? "Netatmo" : nearbyStations.find((s) => s.id === historySource)?.source === "meteofrance" ? "Météo-France" : nearbyStations.find((s) => s.id === historySource)?.source === "windball" ? "Windball" : ""}`
                    : windSource
                      ? ` · ${windSource.network}`
                      : ""}
                </span>
              ) : windSource ? (
                <span className="text-[10px] text-gray-500">
                  {windSource.name} · {windSource.network}
                </span>
              ) : (
                <a
                  href="https://open-meteo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-500 hover:text-gray-700 inline-flex items-center gap-0.5"
                >
                  Open-Meteo · NWP open source
                  <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                </a>
              )}
            </div>
            <div className="px-3 py-2">
              {historyLoading ? (
                <div className="flex items-center justify-center h-28 text-sm text-gray-400 gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Chargement…
                </div>
              ) : history && history.length > 0 ? (
                <WindHistoryChart
                  history={history}
                  forecast={forecast?.hourly}
                  useKnots={useKnots}
                  timezone={forecast?.timezone ?? "UTC"}
                />
              ) : (
                <div className="flex items-center justify-center h-28 text-sm text-gray-500">
                  Historique temporairement indisponible
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Lightbox modal ─────────────────────────────────────── */}
        {lightboxIndex !== null && spot.images.length > 0 && (
          <SpotLightbox
            images={spot.images}
            currentIndex={lightboxIndex}
            spotName={spot.name}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}

        {/* ── Graphique vent · 7 jours ───────────────────────────── */}
        {forecast && (
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">
                Prévisions vent · 7 jours
              </h2>
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gray-500 hover:text-gray-700 inline-flex items-center gap-0.5"
              >
                Open-Meteo · NWP open source
                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 pt-5">
              <WindChart
                hourly={forecast.hourly}
                timezone={forecast.timezone}
                useKnots={useKnots}
              />
            </div>
          </div>
        )}

        {/* ── Tableau détaillé ────────────────────────────────────── */}
        {forecast ? (
          <div className="mb-10">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Tableau détaillé
            </h2>
            <ForecastTable forecast={forecast} light />
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-8">
            Prévisions temporairement indisponibles
          </div>
        )}

        {/* ── Balises à proximité ─────────────────────────────── */}
        <div id="balises" className="mb-10 scroll-mt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Radio className="h-4 w-4 text-gray-500" />
            Balises à proximité
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Sélectionnez une balise pour afficher son historique 48h ci-dessus.
          </p>
          <NearbyStationsPanel
            stations={nearbyStations}
            loading={loadingStations}
            useKnots={useKnots}
            selectedId={selectedStationId}
            onSelect={(s) => setSelectedStationId(s.id)}
          />
        </div>

        {/* ── Archives vent historiques ────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Archives vent
          </h2>
          <WindArchives spotId={spot.id} useKnots={useKnots} />
        </div>

        {/* ── Situation ─────────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Situation
          </h2>
          <div className="relative rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-72 sm:h-96">
            <SpotMiniMap
              lat={spot.latitude}
              lng={spot.longitude}
              name={spot.name}
              bestDirections={spot.bestWindDirections}
            />
          </div>
        </div>

        {/* ── Coordonnées + liens ──────────────────────────────────── */}
        <div className="mt-14 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>
              {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}
            </span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${spot.latitude}&mlon=${spot.longitude}&zoom=13`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-500 transition-colors"
            >
              Voir sur OpenStreetMap →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
