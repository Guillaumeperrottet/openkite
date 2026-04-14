"use client";

import { useRef, useEffect, useState } from "react";
import { windCellStyle, roundKnots } from "@/lib/forecast";

/**
 * Vibrant / neon color pair for history bars.
 * Returns [solid, light] — solid for the bar fill, light for the luminous top fade.
 */
function barColors(kmh: number): [string, string] {
  const kn = kmh / 1.852;
  if (kn < 2) return ["#c0cdda", "#e0e8ef"];
  if (kn < 5) return ["#90e86a", "#c8f4b0"];
  if (kn < 8) return ["#6de840", "#b0f590"];
  if (kn < 12) return ["#50d818", "#8eed60"];
  if (kn < 16) return ["#e6d620", "#f2ec78"];
  if (kn < 20) return ["#f0a818", "#f8cc60"];
  if (kn < 25) return ["#fc762d", "#fda56a"];
  if (kn < 30) return ["#e04010", "#f48050"];
  if (kn < 35) return ["#8f0905", "#c83830"];
  return ["#6a0020", "#a83050"];
}
import { HistoryTooltip } from "./HistoryTooltip";
import type { HistoryPoint } from "@/types";
import type { HourlyPoint } from "@/lib/forecast";

interface Props {
  history: HistoryPoint[];
  forecast?: HourlyPoint[];
  useKnots: boolean;
  /** IANA timezone for display, e.g. "Europe/Zurich" */
  timezone?: string;
}

export function WindHistoryChart({
  history,
  forecast,
  useKnots,
  timezone = "UTC",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: Date.now() differs between server and client
  useEffect(() => setMounted(true), []);

  // Measure container width responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (history.length === 0) return null;

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: 259 }}
      />
    );
  }

  // ── Layout constants ──────────────────────────────────────────────────────
  const CHART_H = 230;
  const DAY_H = 16;
  const TIME_H = 13;
  const AXIS_W = 30;
  const totalH = DAY_H + TIME_H + CHART_H;

  // ── Timezone helper: UTC "YYYY-MM-DDTHH:mm" → location-local "YYYY-MM-DDTHH:mm" ──────
  const toTZ = (utcTime: string): string => {
    const d = new Date(utcTime + ":00Z");
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(d)
      .replace(" ", "T");
  };

  // ── Time boundaries (location TZ) ──────────────────────────────────────────
  const nowInTZ = toTZ(new Date().toISOString().slice(0, 16));
  const todayInTZ = nowInTZ.slice(0, 10); // "YYYY-MM-DD" in location TZ
  const [ty, tm, td] = todayInTZ.split("-").map(Number);

  // Yesterday midnight in location TZ → start of the 48h window
  const yesterdayMidnightInTZ =
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.UTC(ty, tm - 1, td - 1))) + "T00:00";

  // Tomorrow midnight in location TZ → end of the forecast extension
  const tomorrowMidnightInTZ =
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.UTC(ty, tm - 1, td + 1))) + "T00:00";

  // Filter history to start from yesterday midnight (local TZ) → true 48h window
  const filteredHistory = history.filter(
    (p) => toTZ(p.time) >= yesterdayMidnightInTZ,
  );

  // Use filteredHistory everywhere below instead of raw history
  // Check if history already contains future points (15-min forecast from API)
  const historyHasFuture = filteredHistory.some((p) => toTZ(p.time) > nowInTZ);

  const lastHistoryTZ =
    filteredHistory.length > 0
      ? toTZ(filteredHistory[filteredHistory.length - 1].time)
      : yesterdayMidnightInTZ;

  // Only use hourly forecast fallback if history doesn't already have future data
  const futureForecast: HourlyPoint[] =
    !historyHasFuture && forecast
      ? forecast.filter(
          (pt) => pt.time > lastHistoryTZ && pt.time <= tomorrowMidnightInTZ,
        )
      : [];

  // ── Time-proportional X positioning ───────────────────────────────────────
  // Parse a local TZ string "YYYY-MM-DDTHH:mm" into epoch ms for proportional placement
  const tzToMs = (s: string) => Date.parse(s + ":00Z"); // treat as UTC for relative math
  const timeStart = tzToMs(yesterdayMidnightInTZ);
  const timeEnd = tzToMs(tomorrowMidnightInTZ);
  const timeSpan = timeEnd - timeStart || 1;

  // Responsive: fill the container width; fallback 600px before first measure
  const effectiveW = containerWidth > 0 ? containerWidth : 600;
  const DRAW_W = effectiveW - AXIS_W - 4;

  // Time → X coordinate (proportional to position within the 48h window)
  const timeToX = (localTimeStr: string) =>
    AXIS_W + ((tzToMs(localTimeStr) - timeStart) / timeSpan) * DRAW_W;

  // Bar width: based on average interval of history data
  const avgIntervalMs =
    filteredHistory.length > 1
      ? (tzToMs(toTZ(filteredHistory[filteredHistory.length - 1].time)) -
          tzToMs(toTZ(filteredHistory[0].time))) /
        (filteredHistory.length - 1)
      : 10 * 60_000; // default 10 min
  const BAR_W = Math.max(
    1,
    Math.round((avgIntervalMs / timeSpan) * DRAW_W) - 1,
  );
  const totalW = Math.round(effectiveW);

  // X position helper: history uses UTC→TZ conversion, forecast is already local
  const histX = (i: number) => timeToX(toTZ(filteredHistory[i].time));
  const fcstX = (i: number) => timeToX(futureForecast[i].time);

  // ── Wind Y scale ──────────────────────────────────────────────────────────
  const toDisp = (kmh: number) => (useKnots ? roundKnots(kmh) : kmh);
  const dataMax = Math.max(
    ...filteredHistory.flatMap((p) => [
      toDisp(p.windSpeedKmh),
      toDisp(p.gustsKmh),
    ]),
    ...futureForecast.flatMap((p) => [
      toDisp(p.windSpeedKmh),
      toDisp(p.gustsKmh),
    ]),
    useKnots ? 5 : 10,
  );
  const yMax = Math.ceil(dataMax / 5) * 5 + 5;
  const bH = (kmh: number) => Math.max((toDisp(kmh) / yMax) * CHART_H, 1);

  // ── Day groups (full 48h window) ───────────────────────────────────────────
  // Generate all days covering the entire window, regardless of data availability
  const allDays: string[] = [];
  {
    const startDay = yesterdayMidnightInTZ.slice(0, 10);
    const endDay = tomorrowMidnightInTZ.slice(0, 10);
    let d = startDay;
    while (d < endDay) {
      allDays.push(d);
      // Next day
      const [yy, mm, dd] = d.split("-").map(Number);
      const next = new Date(Date.UTC(yy, mm - 1, dd + 1));
      d = next.toISOString().slice(0, 10);
    }
  }
  type DayGroup = { date: string; x: number; w: number };
  const dayGroups: DayGroup[] = allDays.map((d, i) => {
    const dayStart = timeToX(d + "T00:00");
    const nextDay = allDays[i + 1];
    const dayEnd = nextDay ? timeToX(nextDay + "T00:00") : AXIS_W + DRAW_W;
    return {
      date: d,
      x: Math.max(dayStart, AXIS_W),
      w: dayEnd - Math.max(dayStart, AXIS_W),
    };
  });

  const fmtDay = (d: string) => {
    const [y, m, dv] = d.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, dv, 12));
    const days = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
    return `${days[dt.getUTCDay()]} ${dv}.${m}`;
  };

  // ── Y ticks ───────────────────────────────────────────────────────────────
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 5) yTicks.push(v);

  // Auto-scroll removed: chart now fills container width (no scroll needed)

  // "Now" X position: time-proportional
  const nowX = timeToX(nowInTZ);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  // Build a sorted array of all X positions + data for quick lookup on hover
  const allPoints: Array<{
    x: number;
    isForecast: boolean;
    histIdx?: number;
    fcstIdx?: number;
  }> = [
    ...filteredHistory.map((_, i) => ({
      x: histX(i),
      isForecast: false,
      histIdx: i,
    })),
    ...futureForecast.map((_, i) => ({
      x: fcstX(i),
      isForecast: true,
      fcstIdx: i,
    })),
  ];
  const handlePointer = (
    svgEl: SVGSVGElement,
    clientX: number,
    clientY: number,
  ) => {
    const svgRect = svgEl.getBoundingClientRect();
    const svgX =
      (clientX - svgRect.left) * (totalW / (svgRect.width || totalW));
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < allPoints.length; i++) {
      const dist = Math.abs(allPoints[i].x - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      setHoveredIdx(bestIdx);
      const containerRect = containerRef.current!.getBoundingClientRect();
      setTooltipPos({
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) =>
    handlePointer(e.currentTarget, e.clientX, e.clientY);

  const handleSvgTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    const touch = e.touches[0];
    if (touch) handlePointer(e.currentTarget, touch.clientX, touch.clientY);
  };

  // Hover point: history or forecast?
  const hovPt = hoveredIdx !== null ? allPoints[hoveredIdx] : null;
  const isHoverForecast = hovPt?.isForecast ?? false;
  const hovHistPoint =
    hovPt && !hovPt.isForecast && hovPt.histIdx !== undefined
      ? filteredHistory[hovPt.histIdx]
      : null;
  const hovFcstPoint =
    hovPt?.isForecast && hovPt.fcstIdx !== undefined
      ? futureForecast[hovPt.fcstIdx]
      : null;
  const hovPoint = hovHistPoint ?? null;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onMouseLeave={() => setHoveredIdx(null)}
      onTouchEnd={() => setHoveredIdx(null)}
      onTouchCancel={() => setHoveredIdx(null)}
    >
      {/* ── Hover tooltip ───────────────────────────────────────────────── */}
      {(hovPoint ?? hovFcstPoint) && (
        <HistoryTooltip
          point={(hovPoint ?? hovFcstPoint)!}
          isForecast={hovFcstPoint !== null}
          useKnots={useKnots}
          tooltipPos={tooltipPos}
          containerWidth={containerRef.current?.clientWidth ?? 0}
          toTZ={toTZ}
        />
      )}

      {/* ── Main SVG chart ───────────────────────────────────────────────── */}
      <svg
        width="100%"
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        preserveAspectRatio="none"
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onTouchStart={handleSvgTouch}
        onTouchMove={handleSvgTouch}
      >
        <defs />
        {/* Grid lines + Y-axis labels */}
        {yTicks.map((tick) => {
          if (tick === 0) return null;
          const y = DAY_H + TIME_H + CHART_H - (tick / yMax) * CHART_H;
          return (
            <g key={tick}>
              <line
                x1={AXIS_W}
                y1={y}
                x2={totalW}
                y2={y}
                stroke={tick % 10 === 0 ? "#e5e7eb" : "#f9fafb"}
                strokeWidth="1"
              />
              {tick % 10 === 0 && (
                <text
                  x={AXIS_W - 5}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9"
                  fill="#d1d5db"
                  fontFamily="system-ui, sans-serif"
                >
                  {tick}
                </text>
              )}
            </g>
          );
        })}

        {/* Y-axis unit rotated */}
        <text
          x={10}
          y={DAY_H + TIME_H + CHART_H / 2}
          textAnchor="middle"
          fontSize="8"
          fill="#d1d5db"
          fontFamily="system-ui, sans-serif"
          transform={`rotate(-90, 10, ${DAY_H + TIME_H + CHART_H / 2})`}
        >
          {useKnots ? "kts" : "km/h"}
        </text>

        {/* Day separators + labels */}
        {dayGroups.map((g, gi) => {
          return (
            <g key={g.date}>
              {gi > 0 && (
                <line
                  x1={g.x}
                  y1={0}
                  x2={g.x}
                  y2={totalH}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              )}
              <text
                x={g.x + g.w / 2}
                y={DAY_H / 2 + 5}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
                fontFamily="system-ui, sans-serif"
                fontWeight="500"
              >
                {fmtDay(g.date)}
              </text>
            </g>
          );
        })}

        {/* Hour labels: every 3h across the full 48h window */}
        {(() => {
          const labels: React.ReactNode[] = [];
          const startMs = tzToMs(yesterdayMidnightInTZ);
          const endMs = tzToMs(tomorrowMidnightInTZ);
          for (let ms = startMs; ms < endMs; ms += 3 * 3600_000) {
            const isoStr = new Date(ms).toISOString().slice(0, 16);
            const hourStr = isoStr.slice(11, 13);
            const x = timeToX(isoStr);
            if (x < AXIS_W || x > AXIS_W + DRAW_W) continue;
            labels.push(
              <text
                key={`t-${isoStr}`}
                x={x}
                y={DAY_H + TIME_H - 3}
                textAnchor="middle"
                fontSize="8"
                fill="#9ca3af"
                fontFamily="system-ui, sans-serif"
              >
                {hourStr}h
              </text>,
            );
          }
          return labels;
        })()}

        {/* ── Forecast background zone (after NOW) ──────────────────── */}
        <rect
          x={nowX}
          y={DAY_H + TIME_H}
          width={Math.max(0, AXIS_W + DRAW_W - nowX)}
          height={CHART_H}
          fill="rgba(14,165,233,0.04)"
        />

        {/* Hover column highlight — subtle */}
        {hovPt && (
          <line
            x1={hovPt.x}
            y1={DAY_H + TIME_H}
            x2={hovPt.x}
            y2={DAY_H + TIME_H + CHART_H}
            stroke={
              isHoverForecast ? "rgba(14,165,233,0.2)" : "rgba(0,0,0,0.1)"
            }
            strokeWidth="1"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Wind + gust bars — history past (vibrant neon style) */}
        {filteredHistory.map((p, i) => {
          const [solid, light] = barColors(p.windSpeedKmh);
          const [gustSolid, gustLight] = barColors(p.gustsKmh);
          const x = histX(i);
          const windH_ = bH(p.windSpeedKmh);
          const gustH_ = bH(p.gustsKmh);
          const baseY = DAY_H + TIME_H + CHART_H;
          const isFuture = toTZ(p.time) > nowInTZ;
          const isHovered = hovPt && !hovPt.isForecast && hovPt.histIdx === i;
          const gradId = `wg-${i}`;
          const gustGradId = `gg-${i}`;
          return (
            <g key={`b-${i}`} opacity={isFuture ? 0.5 : 1}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={isFuture ? "#60a5fa" : solid} />
                  <stop
                    offset="70%"
                    stopColor={isFuture ? "#60a5fa" : solid}
                    stopOpacity="0.9"
                  />
                  <stop
                    offset="100%"
                    stopColor={isFuture ? "#93c5fd" : light}
                    stopOpacity={isHovered ? "0.95" : "0.6"}
                  />
                </linearGradient>
                {p.gustsKmh > p.windSpeedKmh && (
                  <linearGradient id={gustGradId} x1="0" y1="1" x2="0" y2="0">
                    <stop
                      offset="0%"
                      stopColor={isFuture ? "#93c5fd" : gustLight}
                      stopOpacity="0.5"
                    />
                    <stop
                      offset="100%"
                      stopColor={isFuture ? "#bfdbfe" : gustLight}
                      stopOpacity={isHovered ? "0.4" : "0.15"}
                    />
                  </linearGradient>
                )}
              </defs>
              {/* Gust extension — lighter gradient above main bar */}
              {p.gustsKmh > p.windSpeedKmh && (
                <rect
                  x={x - BAR_W / 2}
                  y={baseY - gustH_}
                  width={BAR_W}
                  height={gustH_ - windH_}
                  fill={`url(#${gustGradId})`}
                  rx="0.5"
                  style={{ transition: "opacity 0.15s" }}
                />
              )}
              {/* Main wind bar — vivid gradient */}
              <rect
                x={x - BAR_W / 2}
                y={baseY - windH_}
                width={BAR_W}
                height={windH_}
                fill={`url(#${gradId})`}
                opacity={isHovered ? 1 : 0.92}
                rx="0.5"
                style={{ transition: "opacity 0.12s" }}
              />
              {/* Hover bright cap — small bright rectangle on top of bar */}
              {isHovered && !isFuture && (
                <rect
                  x={x - BAR_W / 2}
                  y={baseY - windH_ - 2}
                  width={BAR_W}
                  height={4}
                  fill={light}
                  opacity="0.9"
                  rx="0.5"
                />
              )}
            </g>
          );
        })}

        {/* Forecast bars (blue gradient, semi-transparent) */}
        {futureForecast.map((p, i) => {
          const x = fcstX(i);
          const windH_ = bH(p.windSpeedKmh);
          const gustH_ = bH(p.gustsKmh);
          const baseY = DAY_H + TIME_H + CHART_H;
          const isHovered = hovPt?.isForecast && hovPt.fcstIdx === i;
          const fgId = `fg-${i}`;
          return (
            <g key={`fb-${i}`} opacity={0.5}>
              <defs>
                <linearGradient id={fgId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="70%" stopColor="#60a5fa" stopOpacity="0.9" />
                  <stop
                    offset="100%"
                    stopColor="#93c5fd"
                    stopOpacity={isHovered ? "0.9" : "0.5"}
                  />
                </linearGradient>
              </defs>
              {p.gustsKmh > p.windSpeedKmh && (
                <rect
                  x={x - BAR_W / 2}
                  y={baseY - gustH_}
                  width={BAR_W}
                  height={gustH_ - windH_}
                  fill="#93c5fd"
                  opacity={isHovered ? 0.5 : 0.25}
                  rx="0.5"
                  style={{ transition: "opacity 0.15s" }}
                />
              )}
              <rect
                x={x - BAR_W / 2}
                y={baseY - windH_}
                width={BAR_W}
                height={windH_}
                fill={`url(#${fgId})`}
                opacity={isHovered ? 1 : 0.9}
                rx="0.5"
                style={{ transition: "opacity 0.12s" }}
              />
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={AXIS_W}
          y1={DAY_H + TIME_H + CHART_H}
          x2={totalW}
          y2={DAY_H + TIME_H + CHART_H}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* ── NOW vertical line (always visible) ─────────────────────── */}
        <line
          x1={nowX}
          y1={DAY_H}
          x2={nowX}
          y2={DAY_H + TIME_H + CHART_H}
          stroke="#f97316"
          strokeWidth="3"
          strokeDasharray="8 4"
          opacity="0.85"
        />
      </svg>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 border-l-[3px] border-dashed border-orange-400" />
          Maintenant
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-400/50" />
          Prévision
        </span>
      </div>
    </div>
  );
}
