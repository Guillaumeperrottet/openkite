import type { FullForecast, HourlyPoint } from "@/lib/forecast";
import { windCellStyle, tempCellStyle, roundKnots } from "@/lib/forecast";

// ─── Data helpers ─────────────────────────────────────────────────────────────

/** Keep only the entries at 00h, 03h, 06h … 21h (every 3 hours). */
function filterEvery3h(hourly: HourlyPoint[]): HourlyPoint[] {
  return hourly.filter((pt) => {
    const hour = parseInt(pt.time.slice(11, 13), 10);
    return hour % 3 === 0;
  });
}

type DayGroup = {
  /** "2026-04-01" */
  date: string;
  /** "Me 1.4" */
  label: string;
  points: HourlyPoint[];
};

function groupByDay(points: HourlyPoint[]): DayGroup[] {
  const map = new Map<string, HourlyPoint[]>();
  for (const pt of points) {
    const date = pt.time.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(pt);
  }
  const DAYS = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
  return Array.from(map.entries()).map(([date, pts]) => {
    // Parse as local noon to avoid DST edge cases
    const d = new Date(`${date}T12:00:00`);
    const label = `${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
    return { date, label, points: pts };
  });
}

/** true if this point is the first column of a new day (00h, not the very first column). */
function isDayStart(pt: HourlyPoint, idx: number): boolean {
  return idx > 0 && parseInt(pt.time.slice(11, 13), 10) === 0;
}

// ─── Sub-components (server-safe, no "use client") ────────────────────────────

/** Inline SVG wind-direction arrow. Rotated so it points where the wind BLOWS TO. */
function WindArrow({ direction }: { direction: number }) {
  const rotation = (direction + 180) % 360;
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      style={{ display: "block", margin: "0 auto" }}
      aria-hidden="true"
    >
      <g transform={`rotate(${rotation}, 8, 8)`}>
        <line
          x1="8"
          y1="13"
          x2="8"
          y2="4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polygon points="8,1.5 4.5,6.5 11.5,6.5" fill="currentColor" />
      </g>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  forecast: FullForecast;
  /** Use light (white) background instead of dark zinc-900 */
  light?: boolean;
}

/**
 * Windguru-style 7-day forecast table.
 *
 * Rows: Vent (kn) · Rafales (kn) · Direction · Temp (°C) ·
 *       Nuages (%) · Précip (mm) · [Vagues (m)] · Kite score
 *
 * Displayed values are in **knots** (industry standard for kitesurfing).
 * Colors are computed from km/h thresholds for accuracy.
 */
export function ForecastTable({ forecast, light = true }: Props) {
  const points = filterEvery3h(forecast.hourly);
  const days = groupByDay(points);
  const allPoints = days.flatMap((d) => d.points);

  const LABEL_CELL = light
    ? "sticky left-0 z-10 bg-white text-[10px] text-gray-500 font-medium px-2 py-1 text-right whitespace-nowrap border-r border-gray-100 select-none"
    : "sticky left-0 z-10 bg-zinc-900 text-[10px] text-zinc-400 font-medium px-2 py-1 text-right whitespace-nowrap border-r border-white/10 select-none";
  const DATA_CELL = light
    ? "text-center text-[10px] font-bold tabular-nums px-0 py-1 min-w-[30px] border-b border-gray-50"
    : "text-center text-[10px] font-bold tabular-nums px-0 py-1 min-w-[30px] border-b border-white/5";
  const DAY_BORDER = light
    ? "border-l-2 border-gray-300"
    : "border-l-2 border-white/30";
  const ROW_BORDER = light
    ? "border-b border-gray-100"
    : "border-b border-white/10";

  return (
    <div
      className={
        light
          ? "rounded-xl border border-gray-100 overflow-hidden bg-white"
          : "rounded-xl border border-white/10 overflow-hidden bg-zinc-900"
      }
    >
      <div className="overflow-x-auto">
        <table className="border-collapse w-max">
          {/* ── Header: day names ────────────────────────────── */}
          <thead>
            <tr>
              {/* Top-left empty cell — aligns with label column */}
              <th
                className={`${LABEL_CELL} ${ROW_BORDER} ${light ? "bg-gray-50" : "bg-zinc-900/90"}`}
                rowSpan={2}
              >
                <span
                  className={`${light ? "text-gray-400" : "text-zinc-600"} text-[8px] font-normal tracking-wide uppercase`}
                >
                  kn · °C
                </span>
              </th>

              {days.map((day) => (
                <th
                  key={day.date}
                  colSpan={day.points.length}
                  className={`text-center text-[10px] font-semibold ${light ? "text-gray-700" : "text-zinc-200"} px-1 py-1 ${ROW_BORDER} ${light ? "border-l-2 border-gray-300" : "border-l-2 border-white/30"}`}
                >
                  {day.label}
                </th>
              ))}
            </tr>

            {/* Hour labels */}
            <tr>
              {allPoints.map((pt, i) => {
                const hourStr = pt.time.slice(11, 13) + "h";
                return (
                  <td
                    key={i}
                    className={`text-center text-[9px] ${light ? "text-gray-400" : "text-zinc-500"} px-0 py-0.5 ${ROW_BORDER} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                  >
                    {hourStr}
                  </td>
                );
              })}
            </tr>
          </thead>

          {/* ── Body rows ────────────────────────────────────── */}
          <tbody>
            {/* Wind speed (knots) */}
            <tr>
              <td className={LABEL_CELL}>Vent (kn)</td>
              {allPoints.map((pt, i) => (
                <td
                  key={i}
                  style={windCellStyle(pt.windSpeedKmh)}
                  className={`${DATA_CELL} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                  title={`${Math.round(pt.windSpeedKmh)} km/h`}
                >
                  {roundKnots(pt.windSpeedKmh)}
                </td>
              ))}
            </tr>

            {/* Gusts (knots) */}
            <tr>
              <td className={LABEL_CELL}>Rafales (kn)</td>
              {allPoints.map((pt, i) => (
                <td
                  key={i}
                  style={windCellStyle(pt.gustsKmh)}
                  className={`${DATA_CELL} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                  title={`${Math.round(pt.gustsKmh)} km/h`}
                >
                  {roundKnots(pt.gustsKmh)}
                </td>
              ))}
            </tr>

            {/* Wind direction (SVG arrows) */}
            <tr>
              <td className={LABEL_CELL}>Direction</td>
              {allPoints.map((pt, i) => (
                <td
                  key={i}
                  className={`${DATA_CELL} ${light ? "text-gray-500" : "text-zinc-400"} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                  title={`${pt.windDirection}°`}
                >
                  <WindArrow direction={pt.windDirection} />
                </td>
              ))}
            </tr>

            {/* Temperature */}
            <tr>
              <td className={LABEL_CELL}>Temp (°C)</td>
              {allPoints.map((pt, i) => (
                <td
                  key={i}
                  style={tempCellStyle(pt.temperatureC)}
                  className={`${DATA_CELL} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                >
                  {Math.round(pt.temperatureC)}
                </td>
              ))}
            </tr>

            {/* Cloud cover */}
            <tr>
              <td className={LABEL_CELL}>Nuages (%)</td>
              {allPoints.map((pt, i) => (
                <td
                  key={i}
                  className={`${DATA_CELL} font-normal ${light ? "text-gray-500" : "text-zinc-500"} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                >
                  {pt.cloudcover > 0 ? pt.cloudcover : ""}
                </td>
              ))}
            </tr>

            {/* Precipitation */}
            <tr>
              <td className={LABEL_CELL}>Précip (mm)</td>
              {allPoints.map((pt, i) => {
                const hasPrecip = pt.precipMmh >= 0.1;
                return (
                  <td
                    key={i}
                    className={`${DATA_CELL} font-normal ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                    style={
                      hasPrecip
                        ? { background: "#1e40af", color: "#bfdbfe" }
                        : {}
                    }
                  >
                    {hasPrecip ? pt.precipMmh.toFixed(1) : ""}
                  </td>
                );
              })}
            </tr>

            {/* Waves — only shown for coastal spots */}
            {forecast.hasWaves && (
              <>
                <tr>
                  <td className={LABEL_CELL}>Vagues (m)</td>
                  {allPoints.map((pt, i) => (
                    <td
                      key={i}
                      className={`${DATA_CELL} font-normal ${light ? "text-gray-400" : "text-zinc-400"} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                    >
                      {pt.waveHeightM != null ? pt.waveHeightM.toFixed(1) : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={LABEL_CELL}>Période (s)</td>
                  {allPoints.map((pt, i) => (
                    <td
                      key={i}
                      className={`${DATA_CELL} font-normal ${light ? "text-gray-400" : "text-zinc-500"} ${isDayStart(pt, i) ? DAY_BORDER : ""}`}
                    >
                      {pt.wavePeriodS != null
                        ? Math.round(pt.wavePeriodS)
                        : "—"}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — wind color legend */}
      <div
        className={`px-4 py-2.5 border-t ${light ? "border-gray-100" : "border-white/10"}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          {[
            { bg: "#d5f0d5", label: "Calme", range: "< 5 kn" },
            { bg: "#8edb8e", label: "Léger", range: "5–8" },
            { bg: "#3dbc3d", label: "Modéré", range: "8–12" },
            { bg: "#e8e540", label: "Kitable", range: "12–16" },
            { bg: "#e8b830", label: "Bon", range: "16–20" },
            { bg: "#e07020", label: "Fort", range: "20–25" },
            { bg: "#d42020", label: "Très fort", range: "25–30", white: true },
            { bg: "#b00058", label: "Extrême", range: "30–35", white: true },
            { bg: "#800080", label: "Danger", range: "> 35", white: true },
          ].map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: item.bg }}
              />
              <span className={light ? "text-gray-500" : "text-zinc-400"}>
                {item.label}{" "}
                <span className={light ? "text-gray-400" : "text-zinc-500"}>
                  {item.range}
                </span>
              </span>
            </span>
          ))}
        </div>
        <div
          className={`mt-1.5 text-[9px] ${light ? "text-gray-400" : "text-zinc-600"}`}
        >
          Open-Meteo · CC BY 4.0 · Fuseau : {forecast.timezone}
        </div>
      </div>
    </div>
  );
}
