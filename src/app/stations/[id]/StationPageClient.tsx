"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mountain,
  MapPin,
  Wind,
  Zap,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { WindCompass } from "@/components/spot/WindCompass";
import { WindChart } from "@/components/spot/WindChart";
import { ForecastTable } from "@/components/spot/ForecastTable";
import { WindHistoryChart } from "@/components/spot/WindHistoryChart";
import { windColor, windConditionLabel, windDirectionLabel } from "@/lib/utils";
import { roundKnots } from "@/lib/forecast";
import type { WindStation } from "@/lib/stations";
import type { FullForecast } from "@/lib/forecast";
import type { HistoryPoint } from "@/types";

interface Props {
  station: WindStation;
  /** Gusts from Open-Meteo (MeteoSwiss doesn't provide gusts) */
  gustsKmh: number | null;
  /** ISO timestamp from Open-Meteo current data, e.g. "2026-04-02T09:15" */
  openMeteoUpdatedAt: string | null;
  forecast: FullForecast | null;
  history: HistoryPoint[] | null;
}

export function StationPageClient({
  station,
  gustsKmh,
  openMeteoUpdatedAt,
  forecast,
  history,
}: Props) {
  const [useKnots, setUseKnots] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const router = useRouter();

  // Auto-refresh server data every 10 minutes (MeteoSwiss update frequency)
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

  // Derived display values
  const color = windColor(station.windSpeedKmh);
  const condLabel = windConditionLabel(station.windSpeedKmh);
  const dirLabel = windDirectionLabel(station.windDirection);
  const speedKts = roundKnots(station.windSpeedKmh);
  const gustsKts = gustsKmh !== null ? roundKnots(gustsKmh) : null;

  const updateTime = new Date(station.updatedAt).toLocaleTimeString("fr", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const updateDate = new Date(station.updatedAt).toLocaleDateString("fr", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const openMeteoTime = openMeteoUpdatedAt?.slice(11, 16) ?? null;

  // WindCompass uses MeteoSwiss speed + direction, Open-Meteo gusts (fallback to speed)
  const wind = {
    windSpeedKmh: station.windSpeedKmh,
    windDirection: station.windDirection,
    gustsKmh: gustsKmh ?? station.windSpeedKmh,
    isKitable: station.windSpeedKmh >= 15 && station.windSpeedKmh <= 45,
    conditionLabel: condLabel,
    color,
    updatedAt: station.updatedAt,
  };

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

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {station.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Mountain className="h-3.5 w-3.5" />
                {station.altitudeM} m alt.
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {station.lat.toFixed(4)}°N, {station.lng.toFixed(4)}°E
              </span>
              <span>·</span>
              <span className="font-mono text-gray-500">{station.id}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-xs text-gray-500">
                Dernière mesure : {updateDate} à {updateTime}
              </p>
              {lastRefreshed && (
                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  màj auto ·{" "}
                  {lastRefreshed.toLocaleTimeString("fr", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
            {condLabel}
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

        {/* ── Vent en direct + 48h Historique ────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start gap-3 mb-10">
          {/* Compass */}
          <div className="flex flex-col items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-4 shrink-0">
            <WindCompass
              wind={wind}
              size={170}
              light
              sourceLabel="MeteoSwiss · 10 min"
            />
            <p className="text-[10px] text-gray-500 text-center leading-snug">
              <a
                href="https://www.meteoswiss.admin.ch"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 inline-flex items-center gap-0.5"
              >
                MeteoSwiss SwissMetNet
                <ExternalLink className="h-2 w-2 ml-0.5" />
              </a>
              {" · mesure 10 min"}
            </p>
          </div>

          {/* Vent + Rafales + Direction en colonne */}
          <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
            {/* Vent + Rafales côte à côte */}
            <div className="flex gap-2">
              {/* Vent */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 flex-1 sm:flex-none sm:w-40">
                <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium mb-3">
                  <Wind className="h-4 w-4" />
                  Vent moyen
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold tabular-nums leading-none text-gray-900">
                    {useKnots ? speedKts : Math.round(station.windSpeedKmh)}
                  </span>
                  <span className="text-base text-gray-500 font-medium">
                    {useKnots ? "kts" : "km/h"}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1.5">
                  /{" "}
                  {useKnots
                    ? `${Math.round(station.windSpeedKmh)} km/h`
                    : `${speedKts} kts`}
                </div>
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

            {/* Direction pleine largeur en dessous */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-2">Direction</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900 leading-none">
                      {dirLabel}
                    </span>
                    <span className="text-base text-gray-500">
                      {station.windDirection}°
                    </span>
                  </div>
                </div>
                <div className="text-sm font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                  {condLabel}
                </div>
              </div>
            </div>
          </div>

          {/* 48h history chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0 flex-1">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                Historique · 48h
              </h2>
              <a
                href="https://www.meteoswiss.admin.ch/services-and-publications/applications/measured-values.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gray-500 hover:text-gray-700 inline-flex items-center gap-0.5"
              >
                MeteoSwiss SwissMetNet · 10 min
                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            </div>
            <div className="px-3 py-2">
              {history && history.length > 0 ? (
                <WindHistoryChart
                  history={history}
                  useKnots={useKnots}
                  timezone="Europe/Zurich"
                />
              ) : (
                <div className="flex items-center justify-center h-28 text-sm text-gray-500">
                  Historique temporairement indisponible
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Graphique vent Open-Meteo · 7 jours ─────────────────── */}
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
          <div>
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

        {/* ── Attributions ─────────────────────────────────────────── */}
        <div className="mt-14 pt-6 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">
            Sources de données ouvertes
          </p>
          <div className="flex flex-col gap-2 text-[11px] text-gray-500 leading-relaxed">
            <p>
              <span className="font-medium text-gray-700">
                MeteoSwiss SwissMetNet
              </span>{" "}
              — 154 stations météo automatiques en Suisse, mesures vent toutes
              les 10 min.{" "}
              <a
                href="https://opendata.swiss/fr/dataset/automatische-wetterstationen-aktuelle-messwerte"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                opendata.swiss
              </a>{" "}
              · Licence CC BY
            </p>
            <p>
              <span className="font-medium text-gray-700">Open-Meteo</span> —
              Prévisions numériques météo 7 jours (NWP), sans clé API, open
              source et gratuit.{" "}
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                open-meteo.com
              </a>{" "}
              · Licence CC BY 4.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
