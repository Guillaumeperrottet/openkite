"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  Mountain,
  MapPin,
  Wind,
  Zap,
  ExternalLink,
  TrendingUp,
  Camera,
} from "lucide-react";
import { WindCompass } from "@/components/spot/WindCompass";
import { WindChart } from "@/components/spot/WindChart";
import { ForecastTable } from "@/components/spot/ForecastTable";
import { WindHistoryChart } from "@/components/spot/WindHistoryChart";
import { barColors, windDirectionLabel, windConditionKey } from "@/lib/utils";
import { roundKnots } from "@/lib/forecast";
import { useStationLive } from "@/lib/useStationLive";
import type { WindStation } from "@/lib/stations";
import type { FullForecast } from "@/lib/forecast";
import type { HistoryPoint, WindLive } from "@/types";

interface Props {
  station: WindStation;
  live: WindLive | null;
  forecast: FullForecast | null;
  history: HistoryPoint[] | null;
}

/* ── Source metadata for dynamic labels ─────────────────────────── */
const SOURCE_META: Record<
  string,
  { label: string; freq: string; url: string; attribution: string }
> = {
  meteoswiss: {
    label: "MeteoSwiss SwissMetNet",
    freq: "10 min",
    url: "https://www.meteoswiss.admin.ch",
    attribution:
      "154 stations météo automatiques en Suisse, mesures vent toutes les 10 min.",
  },
  pioupiou: {
    label: "Pioupiou OpenWindMap",
    freq: "~4 min",
    url: "https://www.pioupiou.fr",
    attribution: "~600 stations communautaires mondiales, données ouvertes.",
  },
  netatmo: {
    label: "Netatmo",
    freq: "~10 min",
    url: "https://weathermap.netatmo.com",
    attribution:
      "Stations météo personnelles avec anémomètre, données publiques.",
  },
  meteofrance: {
    label: "Météo-France SYNOP",
    freq: "3 h",
    url: "https://donneespubliques.meteofrance.fr",
    attribution:
      "~185 stations SYNOP en France, observations toutes les 3 heures.",
  },
  windball: {
    label: "Windball / Windfox",
    freq: "~10 min",
    url: "https://windball.ch",
    attribution:
      "Anémomètres LoRa communautaires en Suisse romande, données publiques.",
  },
  "fr-energy": {
    label: "FribourgÉnergie",
    freq: "10 min",
    url: "https://opendata.fr.ch",
    attribution:
      "Mâts de mesure du canton de Fribourg, données ouvertes publiées par lot.",
  },
};

function getSourceMeta(source: string) {
  return (
    SOURCE_META[source] ?? {
      label: source,
      freq: "—",
      url: "#",
      attribution: "",
    }
  );
}

function pickNewestLive(
  a: WindLive | null,
  b: WindLive | null,
): WindLive | null {
  if (!a) return b;
  if (!b) return a;
  const aTime = new Date(a.updatedAt).getTime();
  const bTime = new Date(b.updatedAt).getTime();
  if (isNaN(aTime)) return b;
  if (isNaN(bTime)) return a;
  return bTime > aTime ? b : a;
}

export function StationPageClient({
  station,
  live: initialLive,
  forecast,
  history,
}: Props) {
  const t = useTranslations("StationPage");
  const tWind = useTranslations("WindConditions");
  const [useKnots, setUseKnots] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const router = useRouter();
  const { data: polledLive } = useStationLive(station.id);

  const srcMeta = getSourceMeta(station.source);

  // Auto-refresh when tab becomes visible after being hidden for 10+ min.
  // Avoids polling in background tabs, saving ~4 API calls per cycle.
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

  // Pick freshest values: unified WindLive if newer/equal, else snapshot.
  const live = pickNewestLive(initialLive, polledLive);
  const stationTime = new Date(station.updatedAt).getTime();
  const liveTime = live ? new Date(live.updatedAt).getTime() : NaN;
  const liveIsNewer = Boolean(
    live && !isNaN(liveTime) && (isNaN(stationTime) || liveTime >= stationTime),
  );
  const curWindKmh = liveIsNewer
    ? live!.windSpeedKmh
    : station.windSpeedKmh;
  const curDir = liveIsNewer
    ? live!.windDirection
    : station.windDirection;
  const curGustsKmh = liveIsNewer
    ? live!.gustsKmh
    : station.gustsKmh;
  const curUpdatedAt = liveIsNewer ? live!.updatedAt : station.updatedAt;
  const isCurrentStale = liveIsNewer ? !live!.isFresh : false;

  // Derived display values — use the same `barColors` palette as the chart
  // bars and the map flag so the colour is identical everywhere.
  const color = barColors(curWindKmh)[0];
  type WindCondKey =
    | "calm"
    | "light"
    | "gentle"
    | "good"
    | "strong"
    | "veryStrong"
    | "danger";
  const condLabel = tWind(
    windConditionKey(curWindKmh).split(".")[1] as WindCondKey,
  );
  const dirLabel = windDirectionLabel(curDir);
  const speedKts = roundKnots(curWindKmh);
  const gustsKts = curGustsKmh !== null ? roundKnots(curGustsKmh) : null;

  const updateTime = new Date(curUpdatedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const updateDate = new Date(curUpdatedAt).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // WindCompass uses station speed + direction, estimated gusts (fallback to speed)
  const wind = {
    windSpeedKmh: curWindKmh,
    windDirection: curDir,
    gustsKmh: curGustsKmh ?? curWindKmh,
    isKitable: curWindKmh >= 22 && curWindKmh <= 45,
    conditionLabel: condLabel,
    color,
    updatedAt: curUpdatedAt,
  };

  const chartHistory = useMemo<HistoryPoint[] | null>(() => {
    if (!history) return history;
    const pointTime = new Date(curUpdatedAt).toISOString().slice(0, 16);
    const currentPoint: HistoryPoint = {
      time: pointTime,
      windSpeedKmh: curWindKmh,
      windDirection: curDir,
      gustsKmh: curGustsKmh ?? curWindKmh,
      temperatureC: liveIsNewer ? (live!.temperatureC ?? 0) : 0,
    };

    const nowIso = new Date().toISOString().slice(0, 16);
    let lastMeasuredIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].time <= nowIso) {
        lastMeasuredIdx = i;
        break;
      }
    }
    if (lastMeasuredIdx === -1) return [currentPoint, ...history];
    const last = history[lastMeasuredIdx];
    if (pointTime <= last.time) return history;
    return [
      ...history.slice(0, lastMeasuredIdx + 1),
      currentPoint,
      ...history.slice(lastMeasuredIdx + 1),
    ];
  }, [
    history,
    curUpdatedAt,
    curWindKmh,
    curDir,
    curGustsKmh,
    live,
    liveIsNewer,
  ]);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToMap")}
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
                {t("lastMeasurement")} {updateDate} à {updateTime}
              </p>
              {isCurrentStale && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  {t("staleData")}
                </span>
              )}
              {lastRefreshed && (
                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {t("autoRefresh", {
                    time: lastRefreshed.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/webcams?lat=${station.lat}&lng=${station.lng}&name=${encodeURIComponent(station.name)}&back=${encodeURIComponent(`/stations/${station.id}`)}`}
              className="inline-flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
              title={t("webcams")}
            >
              <Camera className="h-4 w-4" />
            </Link>
            <div className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
              {condLabel}
            </div>
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
          <div className="hidden sm:flex flex-col items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-4 shrink-0">
            <WindCompass
              wind={wind}
              size={170}
              light
              sourceLabel={`${srcMeta.label} · ${srcMeta.freq}`}
            />
            <p className="text-[10px] text-gray-500 text-center leading-snug">
              <a
                href={srcMeta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 inline-flex items-center gap-0.5"
              >
                {srcMeta.label}
                <ExternalLink className="h-2 w-2 ml-0.5" />
              </a>
              {` · ${t("measureEvery", { freq: srcMeta.freq })}`}
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
                  {t("windAverage")}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold tabular-nums leading-none text-gray-900">
                    {useKnots ? speedKts : Math.round(curWindKmh)}
                  </span>
                  <span className="text-base text-gray-500 font-medium">
                    {useKnots ? "kts" : "km/h"}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1.5">
                  /{" "}
                  {useKnots
                    ? `${Math.round(curWindKmh)} km/h`
                    : `${speedKts} kts`}
                </div>
              </div>

              {/* Rafales */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 flex-1 sm:flex-none sm:w-40">
                <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium mb-3">
                  <Zap className="h-4 w-4" />
                  {t("gusts")}
                </div>
                {gustsKts !== null && curGustsKmh !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-bold tabular-nums leading-none text-gray-900">
                        {useKnots ? gustsKts : Math.round(curGustsKmh)}
                      </span>
                      <span className="text-base text-gray-500 font-medium">
                        {useKnots ? "kts" : "km/h"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1.5">
                      /{" "}
                      {useKnots
                        ? `${Math.round(curGustsKmh)} km/h`
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
                  <div className="text-sm text-gray-600 mb-2">
                    {t("direction")}
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <g transform={`rotate(${(curDir + 180) % 360}, 8, 8)`}>
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
                      <span className="text-base text-gray-500">{curDir}°</span>
                    </div>
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
                {t("history48h")}
              </h2>
              <a
                href={srcMeta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gray-500 hover:text-gray-700 inline-flex items-center gap-0.5"
              >
                {srcMeta.label} · {srcMeta.freq}
                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            </div>
            <div className="px-3 py-2">
              {chartHistory && chartHistory.length > 0 ? (
                <WindHistoryChart
                  history={chartHistory}
                  useKnots={useKnots}
                  timezone="Europe/Zurich"
                />
              ) : (
                <div className="flex items-center justify-center h-28 text-sm text-gray-500">
                  {t("historyUnavailable")}
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
                {t("forecast7d")}
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
              {t("detailedTable")}
            </h2>
            <ForecastTable forecast={forecast} light />
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-8">
            {t("forecastUnavailable")}
          </div>
        )}

        {/* ── Attributions ─────────────────────────────────────────── */}
        <div className="mt-14 pt-6 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">
            {t("dataSources")}
          </p>
          <div className="flex flex-col gap-2 text-[11px] text-gray-500 leading-relaxed">
            <p>
              <span className="font-medium text-gray-700">{srcMeta.label}</span>{" "}
              — {srcMeta.attribution}{" "}
              <a
                href={srcMeta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {srcMeta.url.replace(/^https?:\/\//, "")}
              </a>
            </p>
            <p>
              <span className="font-medium text-gray-700">Open-Meteo</span> —
              {t("openMeteoDesc")}{" "}
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
