"use client";

import { useState, useEffect } from "react";
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
  X,
  ChevronLeft,
  ChevronRight,
  Images,
} from "lucide-react";
import { WindCompass } from "@/components/spot/WindCompass";
import { WindDirectionRose } from "@/components/spot/WindDirectionRose";
import { WindFrequencyRose } from "@/components/spot/WindFrequencyRose";
import { WindChart } from "@/components/spot/WindChart";
import { WindHistoryChart } from "@/components/spot/WindHistoryChart";
import { ForecastTable } from "@/components/spot/ForecastTable";
import { WindArchives } from "@/components/spot/WindArchives";
import { windConditionLabel, windDirectionLabel, MONTHS } from "@/lib/utils";
import { roundKnots } from "@/lib/forecast";
import {
  Badge,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  WATER_LABELS,
} from "@/components/ui/Badge";
import type { WindData } from "@/types";
import type { HistoryPoint } from "@/types";
import type { FullForecast } from "@/lib/forecast";

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
  forecast: FullForecast | null;
  history: HistoryPoint[] | null;
}

export function SpotPageClient({ spot, wind, forecast, history }: Props) {
  const [useKnots, setUseKnots] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const router = useRouter();

  // Close lightbox on Escape, navigate with arrow keys
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight")
        setLightboxIndex((i) =>
          i !== null ? (i + 1) % spot.images.length : null,
        );
      if (e.key === "ArrowLeft")
        setLightboxIndex((i) =>
          i !== null ? (i - 1 + spot.images.length) % spot.images.length : null,
        );
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, spot.images.length]);

  // Auto-refresh every 10 min
  useEffect(() => {
    const id = setInterval(
      () => {
        router.refresh();
        setLastRefreshed(new Date());
      },
      10 * 60 * 1000,
    );
    return () => clearInterval(id);
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
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la carte
        </Link>

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
                {spot.name}
              </h1>
              {spot.bestWindDirections.length > 0 && (
                <div
                  title={`Meilleures directions : ${spot.bestWindDirections.join(", ")}`}
                >
                  <WindFrequencyRose
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
                <Wind className="h-3 w-3 mr-1" /> {spot.minWindKmh}–
                {spot.maxWindKmh} km/h
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

          {/* ── Right side: photos + edit button ─────────────────── */}
          <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-3 w-full sm:w-auto">
            <Link
              href={`/spots/${spot.id}/edit`}
              className="inline-flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Link>

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
                sourceLabel="Open-Meteo · NWP"
              />
            ) : (
              <div className="flex items-center justify-center h-48 w-48 text-sm text-gray-400">
                Données vent indisponibles
              </div>
            )}
            <p className="text-[10px] text-gray-500 text-center leading-snug">
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 inline-flex items-center gap-0.5"
              >
                Open-Meteo
                <ExternalLink className="h-2 w-2 ml-0.5" />
              </a>
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
                    <div className="text-sm text-gray-500 mt-1.5">
                      /{" "}
                      {useKnots
                        ? `${Math.round(speedKmh)} km/h`
                        : `${speedKts} kts`}
                    </div>
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
                    <div className="text-sm text-gray-500 mt-1.5">
                      /{" "}
                      {useKnots
                        ? `${Math.round(gustsKmh)} km/h`
                        : `${gustsKts} kts`}
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
            <div className="px-3 py-2">
              {history && history.length > 0 ? (
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
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Close */}
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              onClick={() => setLightboxIndex(null)}
              aria-label="Fermer"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Counter */}
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              {lightboxIndex + 1} / {spot.images.length}
            </span>

            {/* Prev */}
            {spot.images.length > 1 && (
              <button
                className="absolute left-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (lightboxIndex - 1 + spot.images.length) %
                      spot.images.length,
                  );
                }}
                aria-label="Précédent"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
            )}

            {/* Image */}
            <div
              className="max-w-4xl max-h-[85vh] mx-16 flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={spot.images[lightboxIndex].url}
                alt={spot.images[lightboxIndex].caption || spot.name}
                className="max-h-[78vh] max-w-full object-contain rounded-lg"
              />
              {spot.images[lightboxIndex].caption && (
                <p className="text-white/60 text-sm text-center">
                  {spot.images[lightboxIndex].caption}
                </p>
              )}
            </div>

            {/* Next */}
            {spot.images.length > 1 && (
              <button
                className="absolute right-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % spot.images.length);
                }}
                aria-label="Suivant"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            )}

            {/* Thumbnail strip */}
            {spot.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-2">
                {spot.images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(idx);
                    }}
                    className={`shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-colors ${
                      idx === lightboxIndex
                        ? "border-sky-400"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
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

        {/* ── Archives vent historiques ────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Archives vent
          </h2>
          <WindArchives spotId={spot.id} useKnots={useKnots} />
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
