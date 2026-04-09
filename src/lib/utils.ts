import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { WindData } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Haversine distance between two lat/lng points, returns km */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Wind direction degrees → compass label */
export function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Wind speed → color (Windguru-inspired palette, slightly muted)
 * Used for chart bars, map markers, and other graphical elements.
 */
export function windColor(kmh: number): string {
  const kn = kmh / 1.852;
  if (kn < 2) return "#d0d0d0";
  if (kn < 5) return "#d5f0d5";
  if (kn < 8) return "#8edb8e";
  if (kn < 12) return "#3dbc3d";
  if (kn < 16) return "#e8e540";
  if (kn < 20) return "#e8b830";
  if (kn < 25) return "#e07020";
  if (kn < 30) return "#d42020";
  if (kn < 35) return "#b00058";
  return "#800080";
}

export function windConditionLabel(kmh: number): string {
  if (kmh < 8) return "Calme";
  if (kmh < 15) return "Faible";
  if (kmh < 22) return "";
  if (kmh < 30) return "Bon";
  if (kmh < 38) return "Fort";
  if (kmh < 50) return "Très fort";
  return "Danger";
}

export function getWindData(
  windSpeedKmh: number,
  windDirection: number,
  gustsKmh: number,
): WindData {
  return {
    windSpeedKmh,
    windDirection,
    gustsKmh,
    isKitable: windSpeedKmh >= 15 && windSpeedKmh <= 45,
    conditionLabel: windConditionLabel(windSpeedKmh),
    color: windColor(windSpeedKmh),
  };
}

/** Arrow unicode for wind direction — points where the wind BLOWS TO */
export function windArrow(deg: number): string {
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round(deg / 45) % 8];
}

export const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
