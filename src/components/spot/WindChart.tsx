"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { windCellStyle } from "@/lib/forecast";
import { windDirectionLabel } from "@/lib/utils";
import type { HourlyPoint } from "@/lib/forecast";

interface Props {
  hourly: HourlyPoint[];
  /** IANA timezone of the station location, e.g. "Europe/Zurich" */
  timezone: string;
  useKnots: boolean;
}

// ── Mini compass (hover panel) ─────────────────────────────────────────────────

function MiniCompass({
  point,
  useKnots,
}: {
  point: HourlyPoint;
  useKnots: boolean;
}) {
  const rotation = (point.windDirection + 180) % 360;
  const speedVal = useKnots
    ? point.windSpeedKnots
    : Math.round(point.windSpeedKmh);
  const gustVal = useKnots ? point.gustsKnots : Math.round(point.gustsKmh);
  const unit = useKnots ? "kts" : "km/h";
  const dirLabel = windDirectionLabel(point.windDirection);

  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: 80 + r * Math.cos(rad), y: 80 + r * Math.sin(rad) };
  };

  const cardinals = [
    { label: "N", angle: 0 },
    { label: "NE", angle: 45 },
    { label: "E", angle: 90 },
    { label: "SE", angle: 135 },
    { label: "S", angle: 180 },
    { label: "SW", angle: 225 },
    { label: "W", angle: 270 },
    { label: "NW", angle: 315 },
  ];

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <svg viewBox="0 0 160 160" width="152" height="152">
        {/* Outer ring */}
        <circle
          cx="80"
          cy="80"
          r="76"
          fill="#f9fafb"
          stroke="#e5e7eb"
          strokeWidth="1.5"
        />
        <circle
          cx="80"
          cy="80"
          r="57"
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="1"
        />

        {/* Tick marks */}
        {Array.from({ length: 36 }, (_, i) => {
          const a = i * 10;
          const isMajor = a % 45 === 0;
          const outer = toXY(a, 73);
          const inner = toXY(a, isMajor ? 66 : 70);
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={isMajor ? "#9ca3af" : "#d1d5db"}
              strokeWidth={isMajor ? 1.5 : 1}
            />
          );
        })}

        {/* Cardinal labels */}
        {cardinals.map(({ label, angle }) => {
          const isMain = label.length === 1;
          const pos = toXY(angle, isMain ? 52 : 50);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isMain ? "#4b5563" : "#9ca3af"}
              fontSize={isMain ? 11 : 8}
              fontWeight={isMain ? "600" : "400"}
              fontFamily="system-ui, sans-serif"
            >
              {label}
            </text>
          );
        })}

        {/* Arrow pointing TO (direction + 180°) */}
        <g transform={`rotate(${rotation}, 80, 80)`}>
          <line
            x1="80"
            y1="90"
            x2="80"
            y2="36"
            stroke="#374151"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon points="80,24 73,42 87,42" fill="#374151" />
        </g>

        {/* Center cap */}
        <circle
          cx="80"
          cy="80"
          r="20"
          fill="white"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
        <text
          x="80"
          y="78"
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#111827"
          fontSize={Math.round(speedVal) >= 100 ? 12 : 16}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {Math.round(speedVal)}
        </text>
        <text
          x="80"
          y="91"
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#9ca3af"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
        >
          {unit}
        </text>
      </svg>

      {/* Labels below compass */}
      <div className="w-full text-[11px] space-y-1 px-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Vent</span>
          <span className="font-bold tabular-nums text-gray-900">
            {typeof speedVal === "number" && !Number.isInteger(speedVal)
              ? speedVal.toFixed(1)
              : speedVal}{" "}
            {unit}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Rafales</span>
          <span className="font-semibold tabular-nums text-gray-600">
            {typeof gustVal === "number" && !Number.isInteger(gustVal)
              ? gustVal.toFixed(1)
              : gustVal}{" "}
            {unit}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Direction</span>
          <span className="font-medium text-gray-700">
            {dirLabel}&nbsp;·&nbsp;{point.windDirection}°
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main chart component ───────────────────────────────────────────────────────

/** SVG bar chart — wind speed + gusts, hourly, 7 days, with hover compass. */
export function WindChart({ hourly, timezone, useKnots }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nowIdx, setNowIdx] = useState(-1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Use all hourly points (168 = 7 days × 24h)
  const points = hourly;

  // Determine "now" bar index in station local time (avoid hydration mismatch)
  useEffect(() => {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? "00";
      const localHour = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
      const idx = points.findIndex((p) => p.time.slice(0, 13) >= localHour);
      setNowIdx(idx >= 0 ? idx : -1);
    } catch {
      const utcHour = new Date().toISOString().slice(0, 13);
      const idx = points.findIndex((p) => p.time.slice(0, 13) >= utcHour);
      setNowIdx(idx >= 0 ? idx : -1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Layout constants (needed by hooks below) ─────────────────────────────
  const BAR_W = 7;
  const BAR_GAP = 1;
  const BAR_SLOT = BAR_W + BAR_GAP;
  const Y_AXIS_W = 38;

  // Touch handler for mobile — floating tooltip (blocks scroll on chart area)
  const handleSvgTouch = useCallback(
    (e: TouchEvent) => {
      e.preventDefault(); // block scroll on chart bars — scroll via bottom grip
      const touch = e.touches[0];
      if (!touch) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = touch.clientX - rect.left;
      const idx = Math.floor((svgX - Y_AXIS_W) / BAR_SLOT);
      if (idx >= 0 && idx < points.length) {
        setHoveredIdx(idx);
        const container = containerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          setTooltipPos({
            x: touch.clientX - containerRect.left,
            y: touch.clientY - containerRect.top,
          });
        }
      }
    },
    [points.length, BAR_SLOT],
  );

  // Attach non-passive touch listeners so preventDefault works
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("touchstart", handleSvgTouch, { passive: false });
    svg.addEventListener("touchmove", handleSvgTouch, { passive: false });
    return () => {
      svg.removeEventListener("touchstart", handleSvgTouch);
      svg.removeEventListener("touchmove", handleSvgTouch);
    };
  }, [handleSvgTouch]);

  if (points.length === 0) return null;

  // Active point: hovered > now > first
  const activeIdx = hoveredIdx !== null ? hoveredIdx : nowIdx >= 0 ? nowIdx : 0;
  const activePoint = points[activeIdx];

  // ── Remaining layout constants ────────────────────────────────────────────
  const CHART_H = 150;
  const DAY_H = 24;
  const TIME_H = 18;
  const KITE_H = 14;

  const allVals = points.flatMap((p) =>
    useKnots ? [p.windSpeedKnots, p.gustsKnots] : [p.windSpeedKmh, p.gustsKmh],
  );
  const dataMax = Math.max(...allVals, useKnots ? 5 : 10);
  const yMax = Math.ceil(dataMax / 5) * 5 + 5;

  const totalW = Y_AXIS_W + points.length * BAR_SLOT + BAR_GAP;
  const totalH = DAY_H + CHART_H + TIME_H + KITE_H;

  const bH = (val: number) => Math.max((val / yMax) * CHART_H, 1);
  const bY = (val: number) => DAY_H + CHART_H - bH(val);

  // ── Day groups ────────────────────────────────────────────────────────────
  const dayGroups: { date: string; startIdx: number; count: number }[] = [];
  let prevDay = "";
  points.forEach((p, i) => {
    const day = p.time.slice(0, 10);
    if (day !== prevDay) {
      dayGroups.push({ date: day, startIdx: i, count: 1 });
      prevDay = day;
    } else {
      dayGroups[dayGroups.length - 1].count++;
    }
  });

  const fmtDay = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    });

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 5) yTicks.push(v);

  const kiteColor = (score: 0 | 1 | 2 | 3) => {
    if (score === 3) return "#16a34a";
    if (score === 2) return "#4ade80";
    if (score === 1) return "#fbbf24";
    return "#e5e7eb";
  };

  // Active time label for compass panel
  const activeTime = activePoint.time;
  const dateLabel = new Date(activeTime + ":00").toLocaleDateString("fr", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = activeTime.slice(11, 16);

  // Mouse move on SVG: compute bar index
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const idx = Math.floor((svgX - Y_AXIS_W) / BAR_SLOT);
    if (idx >= 0 && idx < points.length) {
      setHoveredIdx(idx);
    }
  };

  const TTW = 190;

  return (
    <div className="flex gap-4 items-start">
      {/* Left: scrollable bar chart */}
      <div
        ref={containerRef}
        className="relative flex-1 min-w-0 overflow-x-auto"
        onMouseLeave={() => setHoveredIdx(null)}
        onTouchEnd={() => setHoveredIdx(null)}
        onTouchCancel={() => setHoveredIdx(null)}
      >
        <div style={{ minWidth: `${totalW}px` }}>
          <svg
            ref={svgRef}
            width={totalW}
            height={totalH}
            viewBox={`0 0 ${totalW} ${totalH}`}
            style={{
              display: "block",
              cursor: "crosshair",
              touchAction: "none",
            }}
            onMouseMove={handleSvgMouseMove}
          >
            {/* Gridlines + Y-axis labels */}
            {yTicks.map((tick) => {
              const y = DAY_H + CHART_H - (tick / yMax) * CHART_H;
              return (
                <g key={tick}>
                  <line
                    x1={Y_AXIS_W - 3}
                    y1={y}
                    x2={totalW}
                    y2={y}
                    stroke={tick === 0 ? "#e5e7eb" : "#f3f4f6"}
                    strokeWidth="1"
                  />
                  {tick % 10 === 0 && (
                    <text
                      x={Y_AXIS_W - 7}
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

            {/* Y-axis unit label */}
            <text
              x={7}
              y={DAY_H + CHART_H / 2}
              textAnchor="middle"
              fontSize="8"
              fill="#d1d5db"
              fontFamily="system-ui, sans-serif"
              transform={`rotate(-90, 7, ${DAY_H + CHART_H / 2})`}
            >
              {useKnots ? "kts" : "km/h"}
            </text>

            {/* Day headers + vertical separators */}
            {dayGroups.map((g, gi) => {
              const x = Y_AXIS_W + g.startIdx * BAR_SLOT;
              const w = g.count * BAR_SLOT;
              return (
                <g key={g.date}>
                  {gi > 0 && (
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={DAY_H + CHART_H}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  )}
                  <text
                    x={x + w / 2}
                    y={DAY_H / 2 + 4}
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

            {/* Hovered column highlight */}
            {hoveredIdx !== null && (
              <rect
                x={Y_AXIS_W + hoveredIdx * BAR_SLOT - BAR_GAP / 2}
                y={DAY_H}
                width={BAR_SLOT}
                height={CHART_H}
                fill="rgba(0,0,0,0.05)"
                rx="2"
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Bars (gust extension + wind bar) + kite score strip */}
            {points.map((p, i) => {
              const windVal = useKnots ? p.windSpeedKnots : p.windSpeedKmh;
              const gustVal = useKnots ? p.gustsKnots : p.gustsKmh;
              const style = windCellStyle(p.windSpeedKmh);
              const x = Y_AXIS_W + i * BAR_SLOT + BAR_GAP / 2;
              return (
                <g key={p.time}>
                  {gustVal > windVal && (
                    <rect
                      x={x}
                      y={bY(gustVal)}
                      width={BAR_W}
                      height={bH(gustVal) - bH(windVal)}
                      fill={style.background}
                      opacity="0.28"
                      rx="1"
                    />
                  )}
                  <rect
                    x={x}
                    y={bY(windVal)}
                    width={BAR_W}
                    height={bH(windVal)}
                    fill={style.background}
                    rx="1"
                  />
                  <rect
                    x={x + 1}
                    y={DAY_H + CHART_H + TIME_H + 2}
                    width={BAR_W - 2}
                    height={KITE_H - 4}
                    rx="1.5"
                    fill={kiteColor(p.kitableScore)}
                  />
                </g>
              );
            })}

            {/* Now line */}
            {nowIdx >= 0 && nowIdx < points.length && (
              <line
                x1={Y_AXIS_W + nowIdx * BAR_SLOT + BAR_SLOT / 2}
                y1={DAY_H}
                x2={Y_AXIS_W + nowIdx * BAR_SLOT + BAR_SLOT / 2}
                y2={DAY_H + CHART_H}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Time labels every 3 h */}
            {points.map((p, i) => {
              const h = parseInt(p.time.slice(11, 13));
              if (h % 3 !== 0) return null;
              return (
                <text
                  key={`t-${p.time}`}
                  x={Y_AXIS_W + i * BAR_SLOT + BAR_SLOT / 2}
                  y={DAY_H + CHART_H + 13}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#d1d5db"
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {h === 0 ? "0h" : `${h}h`}
                </text>
              );
            })}
          </svg>

          {/* Scroll grip — covers time labels + kite strip; allows horizontal swipe on mobile */}
          <div
            className="absolute left-0 sm:hidden"
            style={{
              top: DAY_H + CHART_H,
              height: TIME_H + KITE_H + 4,
              width: totalW,
              touchAction: "pan-x",
              zIndex: 5,
            }}
          />

          {/* Mobile floating tooltip */}
          {hoveredIdx !== null &&
            (() => {
              const pt = activePoint;
              const style = windCellStyle(pt.windSpeedKmh);
              const container = containerRef.current;
              const containerW = container?.clientWidth ?? 0;
              const scrollLeft = container?.scrollLeft ?? 0;
              // tooltipPos.x is relative to the visible viewport of the container,
              // but "left" in absolute positioning is relative to scrollable content.
              // Add scrollLeft to convert viewport-relative → content-relative.
              const posX = tooltipPos.x + scrollLeft;
              const tipX = Math.max(
                scrollLeft + 4,
                Math.min(
                  posX + 14 + TTW > scrollLeft + containerW
                    ? posX - TTW - 6
                    : posX + 14,
                  scrollLeft + containerW - TTW - 4,
                ),
              );
              const tipY = Math.max(tooltipPos.y - 110, 4);
              const rotation = (pt.windDirection + 180) % 360;
              return (
                <div
                  className="sm:hidden absolute z-20 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 pointer-events-none"
                  style={{ left: tipX, top: tipY, width: TTW }}
                >
                  <div className="text-[10px] text-gray-400 font-medium mb-2">
                    {dateLabel} — {timeLabel}
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Vent moyen</span>
                    <span
                      className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
                      style={{
                        background: style.background,
                        color: style.color,
                      }}
                    >
                      {useKnots
                        ? pt.windSpeedKnots
                        : Math.round(pt.windSpeedKmh)}{" "}
                      {useKnots ? "kts" : "km/h"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Rafales</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-600">
                      {useKnots ? pt.gustsKnots : Math.round(pt.gustsKmh)}{" "}
                      {useKnots ? "kts" : "km/h"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Direction</span>
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <g transform={`rotate(${rotation}, 8, 8)`}>
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
                      {windDirectionLabel(pt.windDirection)} {pt.windDirection}°
                    </span>
                  </div>
                </div>
              );
            })()}

          {/* Legend */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 ml-10 text-[9px] text-gray-400"
            style={{ touchAction: "pan-x" }}
          >
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-4 h-2 rounded-sm"
                style={{ background: "#d1d5db" }}
              />
              Calme
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-4 h-2 rounded-sm"
                style={{ background: "#5cb85c" }}
              />
              Kitable
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-4 h-2 rounded-sm"
                style={{ background: "#ffa726" }}
              />
              Fort
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-4 h-2 rounded-sm"
                style={{ background: "#b71c1c" }}
              />
              Danger
            </span>
            <span className="flex items-center gap-1 pl-3 border-l border-gray-100">
              <span
                className="inline-block w-4 h-0.5 rounded"
                style={{ background: "#ef4444" }}
              />
              Maintenant
            </span>
            <span className="flex items-center gap-1">
              <span className="flex gap-0.5">
                <span
                  className="inline-block w-2.5 h-2 rounded-sm"
                  style={{ background: "#16a34a" }}
                />
                <span
                  className="inline-block w-2.5 h-2 rounded-sm"
                  style={{ background: "#4ade80" }}
                />
                <span
                  className="inline-block w-2.5 h-2 rounded-sm"
                  style={{ background: "#fbbf24" }}
                />
              </span>
              Score kite
            </span>
          </div>
        </div>
      </div>

      {/* Right: hover compass panel */}
      <div className="hidden sm:flex flex-col items-center gap-1 w-44 shrink-0 pt-4">
        <div className="text-center mb-1">
          <div className="text-[10px] text-gray-400 font-medium">
            {dateLabel}
          </div>
          <div className="text-xs font-bold text-gray-700 tabular-nums">
            {timeLabel}
          </div>
        </div>
        <MiniCompass point={activePoint} useKnots={useKnots} />
        <p className="text-[9px] text-gray-300 mt-1 text-center">
          {hoveredIdx !== null ? "survol" : "maintenant"}
        </p>
      </div>
    </div>
  );
}
