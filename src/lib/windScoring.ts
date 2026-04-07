/**
 * Wind scoring & analysis — composite score computation for kite and paraglide.
 * Pure functions, no data fetching or external API calls.
 */
import type { ForecastHour, DayAnalysis, SportType } from "@/types";

/** Wind thresholds per sport type */
export const SPORT_THRESHOLDS = {
  KITE: { min: 15, max: 45, idealMin: 20, idealMax: 35, idealCenter: 27 },
  /** Paraglide: calm wind is ideal. "rideable" = 0–15 km/h. */
  PARAGLIDE: { min: 0, max: 15, idealMin: 0, idealMax: 10, idealCenter: 5 },
} as const;

/** Map compass label → degrees */
const DIR_DEGREES: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

/**
 * Get the best window of rideable hours from a forecast array.
 * Sport-aware: kite 15–45 km/h, paraglide 0–15 km/h (calm).
 */
export function analyzeForecast(
  forecast: ForecastHour[],
  sport: SportType = "KITE",
): {
  kitableHours: number;
  peakWindKmh: number;
  bestHour: ForecastHour | null;
} {
  const t = SPORT_THRESHOLDS[sport];
  const rideable = forecast.filter(
    (f) => f.windSpeedKmh >= t.min && f.windSpeedKmh <= t.max,
  );
  const best = forecast.reduce<ForecastHour | null>((acc, f) => {
    if (!acc) return f;
    const score = (s: number) =>
      s >= t.idealMin && s <= t.idealMax
        ? 10 - Math.abs(s - t.idealCenter)
        : -Math.abs(s - t.idealCenter);
    return score(f.windSpeedKmh) > score(acc.windSpeedKmh) ? f : acc;
  }, null);

  return {
    kitableHours: rideable.length,
    peakWindKmh: forecast.length
      ? Math.max(...forecast.map((f) => f.windSpeedKmh))
      : 0,
    bestHour: best,
  };
}

/**
 * How well forecast wind direction matches the spot's best directions.
 * Returns 0–1 (1 = perfect match).
 */
function windDirectionMatch(
  forecastDirs: number[],
  bestDirs: string[],
): number {
  if (!bestDirs.length || !forecastDirs.length) return 0.5; // neutral if unknown
  const bestDegs = bestDirs
    .map((d) => DIR_DEGREES[d.toUpperCase()])
    .filter((d) => d !== undefined);
  if (!bestDegs.length) return 0.5;

  let totalMatch = 0;
  for (const fd of forecastDirs) {
    let minDiff = 180;
    for (const bd of bestDegs) {
      const diff = Math.abs(fd - bd);
      minDiff = Math.min(minDiff, diff > 180 ? 360 - diff : diff);
    }
    // 0° diff = 1.0, 90° diff = 0.0, 180° diff = 0.0
    totalMatch += Math.max(0, 1 - minDiff / 90);
  }
  return totalMatch / forecastDirs.length;
}

/**
 * Compute a 0–100 composite score for a day's forecast.
 *
 * **KITE**: rideable hours 35% + wind quality 25% + regularity 20% + direction 20%
 * **PARAGLIDE**: calm hours 30% + sunshine 30% + low-gust 20% + no-rain 20%
 *   — Paragliders need: low wind (<15 km/h), sun (thermals), no precipitation.
 */
export function scoreDayForecast(
  forecast: ForecastHour[],
  sport: SportType = "KITE",
  bestWindDirections: string[] = [],
): DayAnalysis {
  const t = SPORT_THRESHOLDS[sport];
  const date = forecast[0]?.time?.split("T")[0] ?? "";

  // Focus on daytime hours (7h–20h)
  const daytime = forecast.filter((f) => {
    const h = new Date(f.time).getHours();
    return h >= 7 && h <= 20;
  });
  if (!daytime.length) {
    return {
      date,
      score: 0,
      kitableHours: 0,
      peakWindKmh: 0,
      avgWindKmh: 0,
      gustFactor: 1,
      bestHour: null,
      forecast,
      breakdown: {
        hours: 0,
        quality: 0,
        regularity: 0,
        direction: 0,
        sunshine: 0,
      },
    };
  }

  const rideable = daytime.filter(
    (f) => f.windSpeedKmh >= t.min && f.windSpeedKmh <= t.max,
  );
  const rideableHours = rideable.length;

  const avgWind =
    daytime.reduce((s, f) => s + f.windSpeedKmh, 0) / daytime.length;
  const avgGusts = daytime.reduce((s, f) => s + f.gustsKmh, 0) / daytime.length;
  const gustFactor = avgWind > 0 ? avgGusts / avgWind : 1;
  const peakWindKmh = Math.max(...daytime.map((f) => f.windSpeedKmh));

  if (sport === "PARAGLIDE") {
    return scoreParaglide(
      daytime,
      forecast,
      date,
      peakWindKmh,
      avgWind,
      gustFactor,
    );
  }

  return scoreKite(
    daytime,
    rideable,
    rideableHours,
    forecast,
    date,
    peakWindKmh,
    avgWind,
    gustFactor,
    bestWindDirections,
    t,
  );
}

/** Paraglide scoring: calm, sun, low gusts, no rain */
function scoreParaglide(
  daytime: ForecastHour[],
  forecast: ForecastHour[],
  date: string,
  peakWindKmh: number,
  avgWind: number,
  gustFactor: number,
): DayAnalysis {
  // 1. Calm hours (wind < 15 km/h) — 30%
  const calmHours = daytime.filter((f) => f.windSpeedKmh < 15).length;
  const calmScore = Math.min(calmHours / 10, 1);

  // 2. Sunshine — low cloud cover = good thermals — 30%
  const hasCloudData = daytime.some((f) => f.cloudCoverPct !== undefined);
  let sunshineScore = 0.5;
  if (hasCloudData) {
    const avgCloud =
      daytime.reduce((s, f) => s + (f.cloudCoverPct ?? 50), 0) / daytime.length;
    sunshineScore = Math.max(0, 1 - avgCloud / 100);
  }

  // 3. Low gusts — steady calm = safe para — 20%
  const maxGust = Math.max(...daytime.map((f) => f.gustsKmh));
  const gustScore = Math.max(0, 1 - maxGust / 40);

  // 4. No rain — 20%
  const hasRainData = daytime.some((f) => f.precipMm !== undefined);
  let rainScore = 0.5;
  if (hasRainData) {
    const totalPrecip = daytime.reduce((s, f) => s + (f.precipMm ?? 0), 0);
    rainScore = Math.max(0, 1 - totalPrecip / 5);
  }

  const score = Math.round(
    calmScore * 30 + sunshineScore * 30 + gustScore * 20 + rainScore * 20,
  );

  const best = daytime.reduce<ForecastHour | null>((acc, f) => {
    if (!acc) return f;
    const sf = 15 - f.windSpeedKmh + (100 - (f.cloudCoverPct ?? 50)) / 10;
    const sa = 15 - acc.windSpeedKmh + (100 - (acc.cloudCoverPct ?? 50)) / 10;
    return sf > sa ? f : acc;
  }, null);

  return {
    date,
    score: Math.min(100, Math.max(0, score)),
    kitableHours: calmHours,
    peakWindKmh,
    avgWindKmh: Math.round(avgWind * 10) / 10,
    gustFactor: Math.round(gustFactor * 100) / 100,
    bestHour: best,
    forecast,
    breakdown: {
      hours: Math.round(calmScore * 100),
      quality: Math.round(rainScore * 100),
      regularity: Math.round(gustScore * 100),
      direction: 0,
      sunshine: Math.round(sunshineScore * 100),
    },
  };
}

/** Kite scoring: rideable hours + wind quality + regularity + direction */
function scoreKite(
  daytime: ForecastHour[],
  rideable: ForecastHour[],
  rideableHours: number,
  forecast: ForecastHour[],
  date: string,
  peakWindKmh: number,
  avgWind: number,
  gustFactor: number,
  bestWindDirections: string[],
  t: (typeof SPORT_THRESHOLDS)[SportType],
): DayAnalysis {
  // 1. Rideable hours ratio — 35%
  const hoursScore = Math.min(rideableHours / 8, 1);

  // 2. Wind quality — how close avg rideable wind is to ideal center — 25%
  const avgRideable = rideable.length
    ? rideable.reduce((s, f) => s + f.windSpeedKmh, 0) / rideable.length
    : 0;
  const idealDist = Math.abs(avgRideable - t.idealCenter);
  const windQuality = rideable.length
    ? Math.max(0, 1 - idealDist / (t.idealMax - t.idealMin))
    : 0;

  // 3. Regularity — low gust factor = steady wind — 20%
  const regularity = Math.max(0, 1 - (gustFactor - 1) / 1.5);

  // 4. Wind direction match — 20%
  const rideableDirs = rideable.map((f) => f.windDirection);
  const dirMatch = windDirectionMatch(rideableDirs, bestWindDirections);

  const score = Math.round(
    hoursScore * 35 + windQuality * 25 + regularity * 20 + dirMatch * 20,
  );

  const best = rideable.reduce<ForecastHour | null>((acc, f) => {
    if (!acc) return f;
    const sc = (s: number) =>
      s >= t.idealMin && s <= t.idealMax
        ? 10 - Math.abs(s - t.idealCenter)
        : -Math.abs(s - t.idealCenter);
    return sc(f.windSpeedKmh) > sc(acc.windSpeedKmh) ? f : acc;
  }, null);

  return {
    date,
    score: Math.min(100, Math.max(0, score)),
    kitableHours: rideableHours,
    peakWindKmh,
    avgWindKmh: Math.round(avgWind * 10) / 10,
    gustFactor: Math.round(gustFactor * 100) / 100,
    bestHour: best,
    forecast,
    breakdown: {
      hours: Math.round(hoursScore * 100),
      quality: Math.round(windQuality * 100),
      regularity: Math.round(regularity * 100),
      direction: Math.round(dirMatch * 100),
    },
  };
}

/**
 * Split a multi-day forecast array into per-day DayAnalysis objects.
 */
export function analyzeMultiDay(
  forecast: ForecastHour[],
  sport: SportType = "KITE",
  bestWindDirections: string[] = [],
): DayAnalysis[] {
  const byDay = new Map<string, ForecastHour[]>();
  for (const f of forecast) {
    const day = f.time.split("T")[0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(f);
  }
  return Array.from(byDay.entries()).map(([, hours]) =>
    scoreDayForecast(hours, sport, bestWindDirections),
  );
}
