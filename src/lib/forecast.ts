const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const MARINE_BASE = "https://marine-api.open-meteo.com/v1/marine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HourlyPoint {
  /** Local ISO datetime string, e.g. "2026-04-01T09:00" */
  time: string;
  windSpeedKmh: number;
  windSpeedKnots: number;
  gustsKmh: number;
  gustsKnots: number;
  /** Meteorological convention: direction wind comes FROM (0–360°) */
  windDirection: number;
  temperatureC: number;
  precipMmh: number;
  cloudcover: number;
  weathercode: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirection: number | null;
  isKitable: boolean;
  /** 0 = impossible · 1 = limite · 2 = correct · 3 = idéal */
  kitableScore: 0 | 1 | 2 | 3;
}

export interface FullForecast {
  hourly: HourlyPoint[];
  /** IANA timezone name, e.g. "Europe/Paris" */
  timezone: string;
  /** ISO datetime when this forecast was fetched */
  fetchedAt: string;
  /** true if marine wave data was available (coastal spots) */
  hasWaves: boolean;
}

// ─── Internal types from Open-Meteo API ───────────────────────────────────────

type OmHourly = {
  time: string[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  wind_direction_10m: number[];
  temperature_2m: number[];
  precipitation: number[];
  cloudcover: number[];
  weathercode: number[];
};

type OmMarineHourly = {
  wave_height: number[];
  wave_period: number[];
  wave_direction: number[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** km/h → knots, one decimal */
export const toKnots = (kmh: number): number =>
  Math.round((kmh / 1.852) * 10) / 10;

/** km/h → knots, rounded to nearest integer for display */
export const roundKnots = (kmh: number): number => Math.round(kmh / 1.852);

/**
 * Compute a 0-3 kite quality score for one hourly slot.
 * - 0: impossible (too calm or too strong)
 * - 1: marginal
 * - 2: correct (rideable)
 * - 3: idéal (steady wind in sweet spot)
 */
function calcKitableScore(kmh: number, gustsKmh: number): 0 | 1 | 2 | 3 {
  if (kmh < 12 || kmh > 55) return 0;
  const gustRatio = gustsKmh / Math.max(kmh, 1);
  const isIdealSpeed = kmh >= 18 && kmh <= 38;
  const isSteady = gustRatio < 1.45;

  if (kmh >= 15 && kmh <= 45 && isSteady && isIdealSpeed) return 3;
  if (kmh >= 15 && kmh <= 45 && isSteady) return 2;
  if (kmh >= 15 && kmh <= 45) return 1;
  return 0;
}

// ─── Cell color utilities (used by ForecastTable) ────────────────────────────

/**
 * Background + foreground colors for a wind-speed cell.
 * Windguru-inspired color scale, slightly muted for readability.
 * Input is km/h, thresholds in knots.
 */
export function windCellStyle(kmh: number): {
  background: string;
  color: string;
} {
  const kn = kmh / 1.852;
  if (kn < 2) return { background: "#f5f5f5", color: "#555" };
  if (kn < 5) return { background: "#d5f0d5", color: "#333" };
  if (kn < 8) return { background: "#8edb8e", color: "#1a4a1a" };
  if (kn < 12) return { background: "#3dbc3d", color: "#0a350a" };
  if (kn < 16) return { background: "#e8e540", color: "#555" };
  if (kn < 20) return { background: "#e8b830", color: "#4a2e00" };
  if (kn < 25) return { background: "#e07020", color: "#ffffff" };
  if (kn < 30) return { background: "#d42020", color: "#ffffff" };
  if (kn < 35) return { background: "#b00058", color: "#ffffff" };
  return { background: "#800080", color: "#ffffff" };
}

/** Background + foreground colors for a temperature cell (°C). */
export function tempCellStyle(celsius: number): {
  background: string;
  color: string;
} {
  if (celsius < 0) return { background: "#2563eb", color: "#ffffff" };
  if (celsius < 8) return { background: "#93c5fd", color: "#1e3a5f" };
  if (celsius < 15) return { background: "#d1fae5", color: "#064e3b" };
  if (celsius < 22) return { background: "#fef08a", color: "#78350f" };
  if (celsius < 28) return { background: "#fb923c", color: "#7c2d12" };
  return { background: "#ef4444", color: "#ffffff" };
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch a full 7-day hourly forecast for a lat/lng.
 *
 * - Weather data: Open-Meteo (no API key, CC BY 4.0)
 * - Wave data: Open-Meteo Marine API (silently ignored for inland spots)
 * - Server-side cached for 30 minutes via Next.js `fetch` cache
 */
export async function fetchFullForecast(
  lat: number,
  lng: number,
): Promise<FullForecast> {
  const weatherUrl = new URL(FORECAST_BASE);
  weatherUrl.searchParams.set("latitude", lat.toString());
  weatherUrl.searchParams.set("longitude", lng.toString());
  weatherUrl.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation,cloudcover,weathercode",
  );
  weatherUrl.searchParams.set("wind_speed_unit", "kmh");
  weatherUrl.searchParams.set("forecast_days", "7");
  weatherUrl.searchParams.set("timezone", "auto");

  const marineUrl = new URL(MARINE_BASE);
  marineUrl.searchParams.set("latitude", lat.toString());
  marineUrl.searchParams.set("longitude", lng.toString());
  marineUrl.searchParams.set(
    "hourly",
    "wave_height,wave_period,wave_direction",
  );
  marineUrl.searchParams.set("forecast_days", "7");

  const [weatherRes, marineRes] = await Promise.allSettled([
    fetch(weatherUrl.toString(), { next: { revalidate: 1800 } }),
    fetch(marineUrl.toString(), { next: { revalidate: 1800 } }),
  ]);

  if (weatherRes.status !== "fulfilled" || !weatherRes.value.ok) {
    throw new Error(
      `Open-Meteo unavailable (${weatherRes.status === "fulfilled" ? weatherRes.value.status : "network error"})`,
    );
  }

  const weather = (await weatherRes.value.json()) as {
    hourly: OmHourly;
    timezone: string;
  };

  let marineHourly: OmMarineHourly | null = null;
  if (marineRes.status === "fulfilled" && marineRes.value.ok) {
    const marine = await marineRes.value.json();
    if (marine.hourly?.wave_height)
      marineHourly = marine.hourly as OmMarineHourly;
  }

  const h = weather.hourly;

  const hourly: HourlyPoint[] = h.time.map((time, i) => {
    const kmh = h.wind_speed_10m[i];
    const gustsKmh = h.wind_gusts_10m[i];

    return {
      time,
      windSpeedKmh: kmh,
      windSpeedKnots: toKnots(kmh),
      gustsKmh,
      gustsKnots: toKnots(gustsKmh),
      windDirection: h.wind_direction_10m[i],
      temperatureC: h.temperature_2m[i],
      precipMmh: h.precipitation[i],
      cloudcover: h.cloudcover[i],
      weathercode: h.weathercode[i],
      waveHeightM: marineHourly?.wave_height[i] ?? null,
      wavePeriodS: marineHourly?.wave_period[i] ?? null,
      waveDirection: marineHourly?.wave_direction[i] ?? null,
      isKitable: kmh >= 15 && kmh <= 45,
      kitableScore: calcKitableScore(kmh, gustsKmh),
    };
  });

  const hasWaves = !!marineHourly?.wave_height.some((wh) => wh > 0.1);

  return {
    hourly,
    timezone: weather.timezone,
    fetchedAt: new Date().toISOString(),
    hasWaves,
  };
}
