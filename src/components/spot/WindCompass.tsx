"use client";

import { windDirectionLabel } from "@/lib/utils";
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
export function WindCompass({
  wind,
  size = 200,
  light = false,
  sourceLabel = "Open-Meteo · NWP",
}: Props) {
  const speedKnots = roundKnots(wind.windSpeedKmh);
  const gustsKnots = roundKnots(wind.gustsKmh);
  const arrowRotation = (wind.windDirection + 180) % 360;
  const color = wind.color; // use pre-computed color from server to avoid hydration mismatch
  const dirLabel = windDirectionLabel(wind.windDirection);

  // Format "14:45" from "2026-04-01T14:45"
  const updateTime = wind.updatedAt?.slice(11, 16) ?? null;

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
    return { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) };
  };

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: size }}>
      {/* ── SVG compass ──────────────────────────────────────── */}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        aria-label={`Vent : ${speedKnots} nœuds direction ${dirLabel}`}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Background circle */}
        <circle cx="100" cy="100" r="96" fill="#0f1117" />

        {/* Outer intensity ring — color reflects wind strength */}
        <circle
          cx="100"
          cy="100"
          r="96"
          fill="none"
          stroke={color}
          strokeWidth="3"
          opacity="0.35"
        />

        {/* Intermediate circles */}
        <circle
          cx="100"
          cy="100"
          r="79"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="57"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
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
              stroke={
                isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"
              }
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
              fill={
                isMain ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)"
              }
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
          {/* Arrow shaft */}
          <line
            x1="100"
            y1="108"
            x2="100"
            y2="42"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Arrow head */}
          <polygon points="100,28 91,50 109,50" fill={color} />
          {/* Tail notches for depth */}
          <line
            x1="93"
            y1="108"
            x2="100"
            y2="97"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.65"
          />
          <line
            x1="107"
            y1="108"
            x2="100"
            y2="97"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.65"
          />
        </g>

        {/* Center cap — hides the arrow tail, shows speed */}
        <circle
          cx="100"
          cy="100"
          r="24"
          fill={light ? "white" : "#0f1117"}
          stroke={light ? "#e5e7eb" : "none"}
          strokeWidth="1"
        />

        {/* Speed (knots) — centered in the cap */}
        <text
          x="100"
          y="97"
          textAnchor="middle"
          dominantBaseline="auto"
          fill={light ? "#111827" : "white"}
          fontSize={speedKnots >= 100 ? 16 : 20}
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          {speedKnots}
        </text>
        <text
          x="100"
          y="113"
          textAnchor="middle"
          dominantBaseline="auto"
          fill={light ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.4)"}
          fontSize="8"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          kts
        </text>
      </svg>

      {/* ── Stats below compass ───────────────────────────────── */}
      <div className="text-center leading-snug w-full">
        {/* Speed + direction */}
        <div
          className={`text-base font-semibold ${light ? "text-gray-900" : "text-white"}`}
        >
          {speedKnots}&thinsp;/&thinsp;{gustsKnots} kts
        </div>
        <div
          className={`text-xs mt-0.5 ${light ? "text-gray-400" : "text-zinc-400"}`}
        >
          {Math.round(wind.windSpeedKmh)}&thinsp;/&thinsp;
          {Math.round(wind.gustsKmh)} km/h &nbsp;·&nbsp;{dirLabel}
        </div>

        {/* Kite status badge */}
        <div
          className="inline-block mt-2 rounded-full px-3 py-0.5 text-xs font-medium"
          style={{
            background: wind.isKitable
              ? "rgba(22,163,74,0.15)"
              : light
                ? "rgba(0,0,0,0.06)"
                : "rgba(113,113,122,0.2)",
            color: wind.isKitable ? "#4ade80" : light ? "#6b7280" : "#71717a",
          }}
        >
          {wind.isKitable ? "✓ Kitable" : wind.conditionLabel}
        </div>

        {/* Source + update time */}
        <div
          className={`mt-2 text-[10px] ${light ? "text-gray-300" : "text-zinc-600"}`}
        ></div>
      </div>
    </div>
  );
}
