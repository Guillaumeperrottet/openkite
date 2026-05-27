"use client";

/**
 * WindDirectionRose
 *
 * Open-source-style wind rose with tick marks, cross-hairs,
 * and highlighted sectors for best wind directions.
 */

const DIRS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export type CompassDir = (typeof DIRS)[number];

function svgNum(value: number): number {
  return Number(value.toFixed(3));
}

function compassPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: svgNum(cx + r * Math.cos(rad)),
    y: svgNum(cy + r * Math.sin(rad)),
  };
}

function sectorPath(
  index: number,
  cx: number,
  cy: number,
  ri: number,
  ro: number,
  gapDeg = 1.2,
): string {
  const centerDeg = index * 22.5;
  const startDeg = centerDeg - 11.25 + gapDeg;
  const endDeg = centerDeg + 11.25 - gapDeg;
  const o1 = compassPoint(cx, cy, ro, startDeg);
  const o2 = compassPoint(cx, cy, ro, endDeg);
  const i2 = compassPoint(cx, cy, ri, endDeg);
  const i1 = compassPoint(cx, cy, ri, startDeg);

  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${ro} ${ro} 0 0 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    `A ${ri} ${ri} 0 0 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

interface Props {
  bestDirections: string[];
  size?: number;
  interactive?: boolean;
  onChange?: (dirs: string[]) => void;
  showLabels?: boolean;
  /**
   * Visual style. `minimal` is a compact dial with a thin ring,
   * blue arcs on the active directions with their labels outside.
   * Use it where space is tight and you only want to convey the
   * favorable direction(s) at a glance. `full` is the original
   * compass (ticks, wedges, cross-hairs).
   */
  variant?: "full" | "minimal";
  transparentBackground?: boolean;
}

export function WindDirectionRose({
  bestDirections,
  size = 80,
  interactive = false,
  onChange,
  showLabels = true,
  variant = "full",
  transparentBackground = false,
}: Props) {
  if (variant === "minimal" && !interactive) {
    return (
      <MinimalRose
        bestDirections={bestDirections}
        size={size}
        showLabels={showLabels}
      />
    );
  }
  return (
    <FullRose
      bestDirections={bestDirections}
      size={size}
      interactive={interactive}
      onChange={onChange}
      showLabels={showLabels}
      transparentBackground={transparentBackground}
    />
  );
}

function FullRose({
  bestDirections,
  size = 80,
  interactive = false,
  onChange,
  showLabels = true,
  transparentBackground = false,
}: Omit<Props, "variant">) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.43;
  const best = new Set(bestDirections.map((d) => d.toUpperCase()));

  const toggle = (dir: string) => {
    if (!interactive || !onChange) return;
    const next = best.has(dir)
      ? bestDirections.filter((d) => d.toUpperCase() !== dir)
      : [...bestDirections, dir];
    onChange(next);
  };

  const labelR = size * 0.47;
  const tickOuter = R * 0.98;
  const tickMajor = R * 0.85;
  const tickMinor = R * 0.91;
  const sw = Math.max(1, size * 0.008);

  // 8 compass labels (cardinal + intercardinal)
  const labels = [
    { label: "N", angle: 0 },
    { label: "NE", angle: 45 },
    { label: "E", angle: 90 },
    { label: "SE", angle: 135 },
    { label: "S", angle: 180 },
    { label: "SW", angle: 225 },
    { label: "W", angle: 270 },
    { label: "NW", angle: 315 },
  ];

  const fontSize = size * 0.09;
  const fontSizeCardinal = size * 0.11;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Rose des vents"
    >
      <circle
        cx={cx}
        cy={cy}
        r={R * 1.04}
        fill={transparentBackground ? "none" : "#f8fafc"}
        stroke="#d9e2ea"
        strokeWidth={sw * 1.3}
      />

      <circle
        cx={cx}
        cy={cy}
        r={R * 0.92}
        fill="none"
        stroke="#dbe4ea"
        strokeWidth={sw}
      />

      {/* Best direction sectors */}
      {DIRS.map((dir, i) => {
        const active = best.has(dir);
        if (!active && !interactive) return null;
        return (
          <path
            key={`w-${dir}`}
            d={sectorPath(i, cx, cy, R * 0.2, R * 0.82)}
            fill={active ? "#0ea5e9" : "#f8fafc"}
            stroke={active ? "#0284c7" : "transparent"}
            strokeWidth={sw}
            opacity={active ? 0.18 : 0.28}
            style={interactive ? { cursor: "pointer" } : undefined}
            onClick={() => toggle(dir)}
          >
            {interactive && <title>{dir}</title>}
          </path>
        );
      })}

      {/* Main rings */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="#94a3b8"
        strokeOpacity="0.45"
        strokeWidth={sw * 1.25}
      />

      {/* Tick marks */}
      {Array.from({ length: 32 }, (_, i) => {
        const angleDeg = i * 11.25;
        const isMajor = i % 4 === 0;
        const isMedium = i % 2 === 0;
        const inner = isMajor ? tickMajor : tickMinor;
        const outer = compassPoint(cx, cy, tickOuter, angleDeg);
        const innerPoint = compassPoint(
          cx,
          cy,
          isMedium ? inner : R * 0.94,
          angleDeg,
        );
        return (
          <line
            key={`tick-${i}`}
            x1={innerPoint.x}
            y1={innerPoint.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#475569"
            strokeOpacity={isMajor ? 0.46 : isMedium ? 0.24 : 0.12}
            strokeWidth={isMajor ? sw * 1.8 : sw}
          />
        );
      })}

      {/* Small exterior beacons for best directions */}
      {DIRS.map((dir, i) => {
        if (!best.has(dir)) return null;
        const p = compassPoint(cx, cy, R * 0.98, i * 22.5);
        return (
          <circle
            key={`mark-${dir}`}
            cx={p.x}
            cy={p.y}
            r={Math.max(1.5, size * 0.018)}
            fill="#0ea5e9"
            stroke="#ffffff"
            strokeWidth={sw}
          />
        );
      })}

      {/* Interactive hit areas (invisible, over wedges) */}
      {interactive &&
        DIRS.map((dir, i) => (
          <path
            key={`hit-${dir}`}
            d={sectorPath(i, cx, cy, R * 0.08, R, 0.2)}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={() => toggle(dir)}
          >
            <title>{dir}</title>
          </path>
        ))}

      {/* Compass labels */}
      {showLabels &&
        labels.map(({ label, angle }) => {
          const p = compassPoint(cx, cy, labelR, angle);
          const isCardinal = label.length === 1;
          return (
            <text
              key={label}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={isCardinal ? fontSizeCardinal : fontSize}
              fontWeight={label === "N" ? "800" : isCardinal ? "700" : "600"}
              fill={label === "N" ? "#dc2626" : "#475569"}
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {label}
            </text>
          );
        })}
    </svg>
  );
}

/**
 * Interactive picker version with surrounding label + count badge.
 * Used inside CreateSpotForm.
 */
interface PickerProps {
  value: string[];
  onChange: (dirs: string[]) => void;
  size?: number;
}

export function WindDirectionPicker({
  value,
  onChange,
  size = 130,
}: PickerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <WindDirectionRose
        bestDirections={value}
        size={size}
        interactive
        onChange={onChange}
        showLabels
      />
      <p className="text-[11px] text-gray-400 text-center leading-tight">
        Cliquez pour sélectionner les
        <br />
        meilleures directions de vent
        {value.length > 0 && (
          <span className="ml-1 text-sky-600 font-medium">
            · {value.length} sélectionnée{value.length > 1 ? "s" : ""}
          </span>
        )}
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center max-w-40">
          {value.map((d) => (
            <span
              key={d}
              className="text-[10px] font-medium bg-sky-100 text-sky-700 rounded px-1.5 py-0.5"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MinimalRose
 *
 * Compact compass: thin ring, 4 cardinal labels, ticks,
 * and simple blue arcs for each favorable wind direction.
 */
function MinimalRose({
  bestDirections,
  size,
  showLabels,
}: {
  bestDirections: string[];
  size: number;
  showLabels: boolean;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const ringStroke = Math.max(1, size * 0.014);
  const best = new Set(bestDirections.map((d) => d.toUpperCase()));
  const labelR = size * 0.43;
  const cardinalFont = Math.max(9, size * 0.13);

  const cardinals = [
    { label: "N", angle: 0, color: "#dc2626" },
    { label: "E", angle: 90, color: "#475569" },
    { label: "S", angle: 180, color: "#475569" },
    { label: "W", angle: 270, color: "#475569" },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Vent favorable depuis : ${bestDirections.join(", ") || "aucune direction"}`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={R * 1.08}
        fill="#f8fafc"
        stroke="#d9e2ea"
        strokeWidth={ringStroke * 1.2}
      />
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={ringStroke * 1.5}
      />

      {Array.from({ length: 16 }, (_, i) => {
        const deg = i * 22.5;
        const isMajor = i % 2 === 0;
        const outer = compassPoint(cx, cy, R * 0.96, deg);
        const inner = compassPoint(cx, cy, isMajor ? R * 0.84 : R * 0.89, deg);
        return (
          <line
            key={`mini-tick-${i}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#475569"
            strokeOpacity={isMajor ? 0.42 : 0.2}
            strokeWidth={isMajor ? ringStroke * 1.35 : ringStroke}
          />
        );
      })}

      {/* Favorable direction trapezoids */}
      {DIRS.map((dir, i) =>
        best.has(dir) ? (
          <path
            key={`mini-sector-${dir}`}
            d={sectorPath(i, cx, cy, R * 0.25, R * 0.75, 1.6)}
            fill="#0ea5e9"
            fillOpacity="0.18"
            stroke="#0284c7"
            strokeOpacity="0.34"
            strokeWidth={ringStroke}
          />
        ) : null,
      )}

      {/* Cardinal labels */}
      {showLabels &&
        cardinals.map(({ label, angle, color }) => {
          const p = compassPoint(cx, cy, labelR, angle);
          return (
            <text
              key={label}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={cardinalFont}
              fontWeight={label === "N" ? 800 : 700}
              fill={color}
              style={{ userSelect: "none" }}
            >
              {label}
            </text>
          );
        })}
    </svg>
  );
}
