import { windCellStyle, roundKnots } from "@/lib/forecast";
import { windDirectionLabel } from "@/lib/utils";
import type { HistoryPoint } from "@/types";
import type { HourlyPoint } from "@/lib/forecast";

const TTW = 190;

interface Props {
  point: HistoryPoint | HourlyPoint;
  isForecast: boolean;
  useKnots: boolean;
  tooltipPos: { x: number; y: number };
  containerWidth: number;
  /** Convert a UTC time string to local TZ "YYYY-MM-DDTHH:mm" */
  toTZ: (utcTime: string) => string;
}

export function HistoryTooltip({
  point,
  isForecast,
  useKnots,
  tooltipPos,
  containerWidth,
  toTZ,
}: Props) {
  const style = windCellStyle(point.windSpeedKmh);

  const tipX = Math.max(
    4,
    Math.min(
      tooltipPos.x + 14 + TTW > containerWidth
        ? tooltipPos.x - TTW - 6
        : tooltipPos.x + 14,
      containerWidth - TTW - 4,
    ),
  );
  const tipY = Math.max(tooltipPos.y - 110, 4);

  // Format time: history uses UTC string, forecast uses local string
  const displayTime = isForecast
    ? point.time
    : toTZ((point as HistoryPoint).time);

  return (
    <div
      className="absolute z-20 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 pointer-events-none"
      style={{ left: tipX, top: tipY, width: TTW }}
    >
      {isForecast && (
        <div className="text-[9px] font-semibold text-sky-500 mb-1 uppercase tracking-wide">
          Prévision
        </div>
      )}
      <div className="text-[10px] text-gray-400 font-medium mb-2">
        {new Date(displayTime.slice(0, 10) + "T12:00:00Z").toLocaleDateString(
          "fr",
          {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          },
        )}{" "}
        — {displayTime.slice(11, 16)}
      </div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">Vent moyen</span>
        <span
          className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
          style={{ background: style.background, color: style.color }}
        >
          {useKnots
            ? roundKnots(point.windSpeedKmh)
            : Math.round(point.windSpeedKmh)}{" "}
          {useKnots ? "kts" : "km/h"}
        </span>
      </div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">Rafales</span>
        <span className="text-xs font-semibold tabular-nums text-gray-600">
          {useKnots ? roundKnots(point.gustsKmh) : Math.round(point.gustsKmh)}{" "}
          {useKnots ? "kts" : "km/h"}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Direction</span>
        <span className="text-xs text-gray-600">
          {windDirectionLabel(point.windDirection)} {point.windDirection}°
        </span>
      </div>
    </div>
  );
}
