"use client";

import { barColors, windDirectionLabel } from "@/lib/utils";
import { roundKnots } from "@/lib/forecast";
import type { WindData } from "@/types";

interface Props {
  wind: WindData;
  /** Pixel size of the SVG compass circle (default 200) */
  size?: number;
  /** Light (white) theme instead of the default dark theme */
  light?: boolean;
  /** Source attribution label (default "Open-Meteo · NWP") */
  sourceLabel?: string;
}

/**
 * SVG compass rose showing the current wind direction and speed.
 *
 * Convention: the needle points in the direction the wind BLOWS TOWARD.
 *   windDirection = 270° (FROM west) → arrow points east (→)
 *   Rotation formula: arrowRotation = (windDirection + 180) % 360
 */
function svgNum(value: number): number {
  return Number(value.toFixed(3));
}

export function WindCompass({
  wind,
  size = 200,
  light = false,
  sourceLabel,
}: Props) {
  const speedKnots = roundKnots(wind.windSpeedKmh);
  const gustsKnots = roundKnots(wind.gustsKmh);
  const arrowRotation = (wind.windDirection + 180) % 360;
  const color = barColors(wind.windSpeedKmh)[0] || wind.color;
  const dirLabel = windDirectionLabel(wind.windDirection);
  const arrowColor = light ? "#475569" : color;
  const surfaceFill = light ? "#f8fafc" : "#0f172a";
  const centerFill = light ? "#ffffff" : "#111827";
  const baseStroke = light ? "#d9e2ea" : "rgba(255,255,255,0.14)";
  const gridStroke = light ? "#dbe4ea" : "rgba(255,255,255,0.1)";
  const tickStroke = light ? "#64748b" : "rgba(255,255,255,0.72)";
  const primaryLabel = light
    ? "rgba(15,23,42,0.82)"
    : "rgba(255,255,255,0.86)";
  const secondaryLabel = light
    ? "rgba(100,116,139,0.62)"
    : "rgba(255,255,255,0.4)";

  // Build cardinal + intercardinal labels
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

  // Convert a compass angle (0=N clockwise) to SVG x,y at radius r from center
  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: svgNum(100 + r * Math.cos(rad)),
      y: svgNum(100 + r * Math.sin(rad)),
    };
  };

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: size }}>
      {/* ── SVG compass ──────────────────────────────────────── */}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        aria-label={`Vent : ${speedKnots} nœuds, rafales ${gustsKnots} nœuds, direction ${dirLabel}${sourceLabel ? `, source ${sourceLabel}` : ""}`}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Open, data-first compass surface */}
        <circle cx="100" cy="100" r="96" fill={surfaceFill} />
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke={baseStroke}
          strokeWidth="2"
        />
        <circle
          cx="100"
          cy="100"
          r="91"
          fill="none"
          stroke={gridStroke}
          strokeWidth="4"
        />
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke={gridStroke}
          strokeWidth="2"
        />
        <circle
          cx="100"
          cy="100"
          r="64"
          fill="none"
          stroke={gridStroke}
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="42"
          fill="none"
          stroke={gridStroke}
          strokeWidth="1"
        />

        {/* Tick marks every 10° (major every 45°) */}
        {Array.from({ length: 36 }, (_, i) => {
          const angle = i * 10;
          const isMajor = angle % 45 === 0;
          const outer = toXY(angle, 91);
          const inner = toXY(angle, isMajor ? 82 : 87);
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={tickStroke}
              opacity={isMajor ? (light ? 0.55 : 0.48) : light ? 0.22 : 0.16}
              strokeWidth={isMajor ? 1.5 : 1}
            />
          );
        })}

        {/* Cardinal & intercardinal labels */}
        {cardinals.map(({ label, angle }) => {
          const isMain = label.length === 1;
          const pos = toXY(angle, isMain ? 69 : 67);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isMain ? primaryLabel : secondaryLabel}
              fontSize={isMain ? 12 : 8}
              fontWeight={isMain ? "600" : "400"}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {label}
            </text>
          );
        })}

        {/* Wind arrow — rotated so it points where the wind goes */}
        <g transform={`rotate(${arrowRotation}, 100, 100)`}>
          <line
            x1="100"
            y1="110"
            x2="100"
            y2="54"
            stroke={arrowColor}
            strokeOpacity={light ? 0.74 : 0.88}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M100 42 L106 56 L100 52 L94 56 Z"
            fill={arrowColor}
            fillOpacity={light ? 0.8 : 0.92}
            strokeLinejoin="round"
          />
        </g>

        {/* Center cap — hides the arrow tail, shows speed */}
        <circle
          cx="100"
          cy="100"
          r="30"
          fill={surfaceFill}
        />
        <circle
          cx="100"
          cy="100"
          r="27"
          fill={centerFill}
          stroke={baseStroke}
          strokeWidth="2"
        />

        {/* Speed (knots) — centered in the cap */}
        <text
          x="100"
          y="97"
          textAnchor="middle"
          dominantBaseline="auto"
          fill={color}
          fontSize={speedKnots >= 100 ? 16 : 20}
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {speedKnots}
        </text>
        <text
          x="100"
          y="113"
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#64748b"
          fontSize="8"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          kts
        </text>
      </svg>

      {/* ── Stats below compass ───────────────────────────────── */}
      <div className="text-center leading-snug w-full">
        {/* Speed + direction */}
        <div
          className={`text-base font-semibold tabular-nums ${light ? "text-gray-900" : "text-white"}`}
        >
          {speedKnots}&thinsp;/&thinsp;{gustsKnots} kts
        </div>
        <div
          className={`text-xs mt-0.5 font-medium ${light ? "text-gray-500" : "text-zinc-400"}`}
        >
          {dirLabel} · {Math.round(wind.windDirection)}°
        </div>
      </div>
    </div>
  );
}
