"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { X, ExternalLink } from "lucide-react";
import { windConditionLabel, windDirectionLabel, barColors } from "@/lib/utils";
import { WindHistoryChart } from "@/components/spot/WindHistoryChart";
import type { HistoryPoint } from "@/types";
import { useStationLive } from "@/lib/useStationLive";

interface StationInfo {
  id: string;
  name: string;
  description?: string;
  windSpeedKmh: number;
  windDirection: number;
  gustsKmh: number;
  altitudeM: number;
  updatedAt: string;
  colorHex: string;
  dirLabel: string;
  source: string;
  lat: number;
  lng: number;
}

interface StationPopupProps {
  station: StationInfo;
  useKnots: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  /** Called when the popup detects a fresher measurement than the GL feature
   *  was carrying — lets the parent map re-color the arrow to match. */
  onLiveUpdate?: (update: {
    id: string;
    windSpeedKmh: number;
    windDirection: number;
    gustsKmh: number;
    updatedAt: string;
  }) => void;
}

export function StationPopup({
  station,
  useKnots,
  position,
  onClose,
  onLiveUpdate,
}: StationPopupProps) {
  const { data: stationLive } = useStationLive(station.id);
  const t = useTranslations("StationPage");
  const tCommon = useTranslations("Common");
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [flipBelow, setFlipBelow] = useState(false);
  const [popupH, setPopupH] = useState(0);
  const [isMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  // Fetch 48h history (API now returns combined past + 15-min forecast)
  useEffect(() => {
    let cancelled = false;
    const encodedId = encodeURIComponent(station.id);

    fetch(`/api/stations/${encodedId}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((histData) => {
        if (cancelled) return;
        if (Array.isArray(histData)) setHistory(histData);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [station.id]);

  // Measure popup height and flip below if not enough room above
  useEffect(() => {
    if (!ref.current) return;
    const h = ref.current.offsetHeight;
    setPopupH(h);
    setFlipBelow(position.y - 8 - h < 10);
  }, [position.y, history, loading]);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    // Delay adding click listener so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClick);
    }, 0);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("click", handleClick);
      clearTimeout(timer);
    };
  }, [onClose]);

  // Live header values: from useStationLive (polls /api/stations/${id}/live).
  // Falls back to GL-feature props while the first SWR fetch is in-flight.
  // This eliminates the VEV bug: header never reads from NWP forecast points.
  const stationLiveTime = stationLive
    ? new Date(stationLive.updatedAt).getTime()
    : NaN;
  const featureTime = new Date(station.updatedAt).getTime();
  const stationLiveIsNewest = Boolean(
    stationLive &&
      !isNaN(stationLiveTime) &&
      (isNaN(featureTime) || stationLiveTime >= featureTime),
  );
  const liveForDisplay =
    stationLive && stationLiveIsNewest ? stationLive : null;
  const liveSpeed = liveForDisplay?.windSpeedKmh ?? station.windSpeedKmh;
  const liveDirection = liveForDisplay?.windDirection ?? station.windDirection;
  const liveGusts = liveForDisplay?.gustsKmh ?? station.gustsKmh;
  const liveUpdatedAt = liveForDisplay?.updatedAt ?? station.updatedAt;

  // Push fresher values back to the map so the GL arrow color matches.
  useEffect(() => {
    if (!onLiveUpdate || !stationLive || !stationLiveIsNewest) return;
    if (
      stationLive.windSpeedKmh === station.windSpeedKmh &&
      stationLive.windDirection === station.windDirection &&
      stationLive.gustsKmh === station.gustsKmh
    ) {
      return;
    }
    onLiveUpdate({
      id: station.id,
      windSpeedKmh: stationLive.windSpeedKmh,
      windDirection: stationLive.windDirection,
      gustsKmh: stationLive.gustsKmh,
      updatedAt: stationLive.updatedAt,
    });
  }, [
    stationLive,
    station.id,
    station.windSpeedKmh,
    station.windDirection,
    station.gustsKmh,
    stationLiveIsNewest,
    onLiveUpdate,
  ]);

  const chartHistory = useMemo<HistoryPoint[] | null>(() => {
    if (!history) return history;
    const pointTime = new Date(liveUpdatedAt).toISOString().slice(0, 16);
    const currentPoint: HistoryPoint = {
      time: pointTime,
      windSpeedKmh: liveSpeed,
      windDirection: liveDirection,
      gustsKmh: liveGusts,
      temperatureC: liveForDisplay?.temperatureC ?? 0,
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
    liveUpdatedAt,
    liveSpeed,
    liveDirection,
    liveGusts,
    liveForDisplay,
  ]);

  const speedKmh = Math.round(liveSpeed);
  const speedKts = Math.round(speedKmh / 1.852);
  const gustsKmh = Math.round(liveGusts);
  const gustsKts = Math.round(gustsKmh / 1.852);
  // Same palette as the 48h history chart (barColors) for visual consistency
  const color = barColors(speedKmh)[0];
  const dir = liveDirection;
  const arrowRot = (dir + 180) % 360;
  const dirLabel = windDirectionLabel(dir);
  const primary = useKnots ? `${speedKts} kts` : `${speedKmh} km/h`;
  const gusts = useKnots ? `${gustsKts} kts` : `${gustsKmh} km/h`;
  const condLabel = windConditionLabel(speedKmh);
  const time = new Date(liveUpdatedAt).toLocaleTimeString("fr", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isPioupiou = station.source === "pioupiou";
  const isNetatmo = station.source === "netatmo";
  const isMF = station.source === "meteofrance";
  const isWB = station.source === "windball";
  const isFrEnergy = station.source === "fr-energy";
  const sourceLabel = isPioupiou
    ? "OpenWindMap"
    : isNetatmo
      ? "Netatmo"
      : isMF
        ? "Météo-France"
        : isWB
          ? "Windball"
          : isFrEnergy
            ? "FribourgÉnergie"
            : "MeteoSwiss";
  const sourceFreq = isPioupiou
    ? "~4 min"
    : isMF
      ? "3 h"
      : isFrEnergy
        ? "10 min"
        : "~10 min";

  // Position: compute actual top clamped to viewport
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const margin = 10;
  // Popup width clamped to 90vw — compute half for centering
  const popupW = Math.min(420, vw * 0.9);
  const halfW = popupW / 2;

  let top: number;
  if (!flipBelow) {
    top = Math.max(margin, position.y - 8 - popupH);
  } else {
    top = Math.min(position.y + 12, vh - popupH - margin);
  }
  top = Math.max(margin, Math.min(top, vh - popupH - margin));

  const maxH = vh - 2 * margin;

  const style: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        maxHeight: maxH,
      }
    : {
        position: "fixed",
        left: Math.min(
          Math.max(position.x, halfW + margin),
          vw - halfW - margin,
        ),
        top,
        transform: "translate(-50%, 0)",
        zIndex: 100,
        maxHeight: maxH,
      };

  return (
    <div
      ref={ref}
      style={style}
      className="w-105 max-w-[90vw] rounded-xl bg-white border border-gray-200 shadow-2xl text-sm overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-900 text-sm leading-tight">
            {station.name}
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {isPioupiou
              ? station.id.replace("piou-", "Pioupiou #")
              : `${station.id} · ${station.altitudeM} m alt.`}
          </p>
          {station.description && (
            <p className="text-[10px] text-gray-500 mt-0.5 italic line-clamp-2">
              {station.description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 shrink-0 mt-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Wind info row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
          <circle
            cx="20"
            cy="20"
            r="19"
            fill={`${color}18`}
            stroke={color}
            strokeWidth="1.5"
          />
          <g transform={`rotate(${arrowRot},20,20)`}>
            <line
              x1="20"
              y1="30"
              x2="20"
              y2="12"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <polygon points="20,6 15,15 25,15" fill={color} />
          </g>
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: barColors(speedKmh)[0] }}
            >
              {primary}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {dirLabel} · {dir}°
            {station.gustsKmh > 0 ? ` · ${t("gustsLabel")} ${gusts}` : ""}
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
          {condLabel}
        </span>
      </div>

      {/* 48h History Chart */}
      <div className="border-t border-gray-100">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-gray-700">
            {t("history48h")}
          </span>
          <span className="text-[9px] text-gray-400">
            {t("lastUpdate", { time })}
          </span>
        </div>
        <div className="px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-xs text-gray-400 animate-pulse">
              {tCommon("loading")}
            </div>
          ) : chartHistory && chartHistory.length > 0 ? (
            <WindHistoryChart
              history={chartHistory}
              useKnots={useKnots}
              timezone="Europe/Zurich"
            />
          ) : (
            <div className="flex items-center justify-center h-24 text-xs text-gray-400">
              {t("historyEmpty")}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <span className="text-[10px] text-gray-400">
          {sourceLabel} · {t("everyN", { freq: sourceFreq })}
        </span>
        {!isPioupiou && !isNetatmo ? (
          <a
            href={`/stations/${encodeURIComponent(station.id)}`}
            className="text-xs font-semibold text-sky-500 hover:text-sky-600 inline-flex items-center gap-1 transition-colors"
          >
            {t("allData")} <ExternalLink className="h-3 w-3" />
          </a>
        ) : isNetatmo ? (
          <a
            href="https://weathermap.netatmo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-400 hover:text-sky-500 inline-flex items-center gap-1 transition-colors"
          >
            weathermap.netatmo.com <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : (
          <a
            href="https://openwindmap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-400 hover:text-sky-500 inline-flex items-center gap-1 transition-colors"
          >
            openwindmap.org <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}
