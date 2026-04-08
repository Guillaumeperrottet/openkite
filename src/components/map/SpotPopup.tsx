"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Wind, Waves, ExternalLink } from "lucide-react";
import type { Spot, WindData } from "@/types";
import { windArrow, windDirectionLabel } from "@/lib/utils";
import {
  Badge,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  WATER_LABELS,
} from "@/components/ui/Badge";

interface SpotPopupProps {
  spot: Spot;
  wind: WindData | null;
  loadingWind: boolean;
  useKnots?: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export function SpotPopup({
  spot,
  wind,
  loadingWind,
  useKnots = true,
  position,
  onClose,
}: SpotPopupProps) {
  /** Format a km/h value in the preferred unit */
  const fmt = (kmh: number) =>
    useKnots ? `${Math.round(kmh / 1.852)} kts` : `${Math.round(kmh)} km/h`;
  const ref = useRef<HTMLDivElement>(null);
  const [flipBelow, setFlipBelow] = useState(false);
  const [popupH, setPopupH] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Measure popup height and flip below if not enough room above
  useEffect(() => {
    if (!ref.current) return;
    const h = ref.current.offsetHeight;
    setPopupH(h);
    // Check against parent container height (absolute positioned within map)
    setFlipBelow(position.y - 8 - h < 10);
  }, [position.y, wind, loadingWind]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("pointerdown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [onClose]);

  const style: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
      }
    : {
        position: "absolute",
        left: position.x,
        top: flipBelow ? position.y + 12 : position.y - 8,
        transform: flipBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
        zIndex: 100,
      };

  return (
    <div
      ref={ref}
      style={style}
      className="w-72 max-w-[calc(100vw-24px)] rounded-xl bg-white border border-gray-200 shadow-2xl text-sm text-gray-900 overflow-hidden"
    >
      {/* Image */}
      {spot.images[0] && (
        <div className="h-28 overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={spot.images[0].url}
            alt={spot.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <div>
            <h3 className="font-semibold text-base leading-tight">
              {spot.name}
            </h3>
            {(spot.country || spot.region) && (
              <p className="text-gray-500 text-xs mt-0.5">
                {[spot.region, spot.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge className={DIFFICULTY_COLORS[spot.difficulty]}>
            {DIFFICULTY_LABELS[spot.difficulty]}
          </Badge>
          <Badge className="bg-gray-100 text-gray-600">
            <Waves className="h-3 w-3 mr-1" />
            {WATER_LABELS[spot.waterType]}
          </Badge>
          <Badge className="bg-gray-100 text-gray-600">
            <Wind className="h-3 w-3 mr-1" />
            {useKnots
              ? `${Math.round(spot.minWindKmh / 1.852)}–${Math.round(spot.maxWindKmh / 1.852)} kts`
              : `${spot.minWindKmh}–${spot.maxWindKmh} km/h`}
          </Badge>
        </div>

        {/* Wind NOW */}
        <div className="rounded-lg p-3 bg-gray-50 border border-gray-100 mb-3">
          <div className="text-xs text-gray-500 mb-1.5">Vent en direct</div>
          {loadingWind ? (
            <div className="text-gray-400 text-xs animate-pulse">
              Chargement...
            </div>
          ) : wind ? (
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl border-2 shrink-0"
                style={{
                  background: wind.color + "22",
                  borderColor: wind.color,
                  color: wind.color,
                }}
              >
                {windArrow(wind.windDirection)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-xl text-gray-900">
                    {fmt(wind.windSpeedKmh)}
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    {useKnots
                      ? `${Math.round(wind.windSpeedKmh)} km/h`
                      : `${Math.round(wind.windSpeedKmh / 1.852)} kts`}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {windDirectionLabel(wind.windDirection)} · rafales{" "}
                  {fmt(wind.gustsKmh)}
                </div>
                <div
                  className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: wind.isKitable
                      ? "rgba(22,163,74,0.15)"
                      : "rgba(113,113,122,0.1)",
                    color: wind.isKitable ? "#4ade80" : "#71717a",
                  }}
                >
                  {wind.isKitable ? "✓ Kitable" : "✗ " + wind.conditionLabel}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-xs">Données non disponibles</div>
          )}
        </div>

        {spot.description && (
          <p className="text-gray-500 text-xs mb-3 line-clamp-2">
            {spot.description}
          </p>
        )}

        <Link
          href={`/spots/${spot.id}`}
          className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors py-2 text-xs font-medium"
        >
          Voir le spot <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
