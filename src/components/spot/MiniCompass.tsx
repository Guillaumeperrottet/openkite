"use client";

import { windDirectionLabel } from "@/lib/utils";
import type { HourlyPoint } from "@/lib/forecast";

interface MiniCompassProps {
  point: HourlyPoint;
  useKnots: boolean;
}

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

export function MiniCompass({ point, useKnots }: MiniCompassProps) {
  const rotation = (point.windDirection + 180) % 360;
  const speedVal = useKnots
    ? point.windSpeedKnots
    : Math.round(point.windSpeedKmh);
  const gustVal = useKnots ? point.gustsKnots : Math.round(point.gustsKmh);
  const unit = useKnots ? "kts" : "km/h";
  const dirLabel = windDirectionLabel(point.windDirection);

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
