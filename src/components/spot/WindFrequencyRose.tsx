"use client";

/**
 * WindFrequencyRose
 *
 * Displays best wind directions for a spot as orange sectors on a polar rose.
 * Directions come from the spot's bestWindDirections field (set at creation).
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

interface Props {
  bestDirections: string[];
  size?: number;
  showLabels?: boolean;
}

export function WindFrequencyRose({
  bestDirections,
  size = 120,
  showLabels = true,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;

  const best = new Set(bestDirections.map((d) => d.toUpperCase()));
  if (best.size === 0) return null;

  // ── Geometry ──────────────────────────────────────────────────────
  const minR = size * 0.12;
  const maxR = size * 0.42;
  const circleR = size * 0.44;
  const labelR = size * 0.48;

  const step = (2 * Math.PI) / 16;
  const gapRad = (2 * Math.PI) / 180;

  // Build sector paths
  const sectors = DIRS.map((dir, i) => {
    const isBest = best.has(dir);
    const ro = isBest ? maxR : minR;
    const base = i * step - Math.PI / 2; // N at top
    const a1 = base + gapRad;
    const a2 = base + step - gapRad;

    return {
      dir,
      isBest,
      d: [
        `M ${(cx + minR * Math.cos(a1)).toFixed(2)} ${(cy + minR * Math.sin(a1)).toFixed(2)}`,
        `L ${(cx + ro * Math.cos(a1)).toFixed(2)} ${(cy + ro * Math.sin(a1)).toFixed(2)}`,
        `A ${ro} ${ro} 0 0 1 ${(cx + ro * Math.cos(a2)).toFixed(2)} ${(cy + ro * Math.sin(a2)).toFixed(2)}`,
        `L ${(cx + minR * Math.cos(a2)).toFixed(2)} ${(cy + minR * Math.sin(a2)).toFixed(2)}`,
        `A ${minR} ${minR} 0 0 0 ${(cx + minR * Math.cos(a1)).toFixed(2)} ${(cy + minR * Math.sin(a1)).toFixed(2)}`,
        "Z",
      ].join(" "),
    };
  });

  // Cardinal labels
  const cardinals = showLabels
    ? [
        { label: "N", angle: -Math.PI / 2 },
        { label: "NE", angle: -Math.PI / 4 },
        { label: "E", angle: 0 },
        { label: "SE", angle: Math.PI / 4 },
        { label: "S", angle: Math.PI / 2 },
        { label: "SW", angle: (3 * Math.PI) / 4 },
        { label: "W", angle: Math.PI },
        { label: "NW", angle: (-3 * Math.PI) / 4 },
      ]
    : [];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      {/* Reference circle */}
      <circle
        cx={cx}
        cy={cy}
        r={circleR}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />

      {/* Cross lines N-S, E-W */}
      <line
        x1={cx}
        y1={cy - circleR}
        x2={cx}
        y2={cy + circleR}
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
      <line
        x1={cx - circleR}
        y1={cy}
        x2={cx + circleR}
        y2={cy}
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />

      {/* Sectors */}
      {sectors.map((s) => (
        <path
          key={s.dir}
          d={s.d}
          fill={s.isBest ? "#f59e0b" : "#e5e7eb"}
          opacity={s.isBest ? 0.85 : 0.3}
          stroke="white"
          strokeWidth="0.5"
        />
      ))}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={size * 0.02} fill="#9ca3af" />

      {/* Labels */}
      {cardinals.map((c) => (
        <text
          key={c.label}
          x={cx + labelR * Math.cos(c.angle)}
          y={cy + labelR * Math.sin(c.angle) + 3}
          textAnchor="middle"
          fontSize={size * 0.09}
          fontWeight={c.label.length === 1 ? "600" : "500"}
          fill="#6b7280"
          fontFamily="system-ui, sans-serif"
        >
          {c.label}
        </text>
      ))}
    </svg>
  );
}
