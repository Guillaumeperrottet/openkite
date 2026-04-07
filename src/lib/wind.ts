import type {
  ForecastHour,
  WindData,
  HistoryPoint,
  DayAnalysis,
  SportType,
} from "@/types";
import { getWindData } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Convert a MeteoSwiss local timestamp (Europe/Zurich CET/CEST) to UTC ISO.
 * Input: "YYYY-MM-DDTHH:mm" in Swiss local time.
 * Output: "YYYY-MM-DDTHH:mm" in UTC.
 */
function swissLocalToUtc(localIso: string): string {
  // Treat the local timestamp as if it were UTC to get a reference Date
  const refUtc = new Date(localIso + ":00Z");
  // Format that UTC instant in Swiss timezone to determine the offset
  const swissFormatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(refUtc);
  // sv-SE → "2026-04-03 14:50", normalize to comparable ISO
  const swissIso = swissFormatted.replace(" ", "T");
  const offsetMs = Date.parse(swissIso + ":00Z") - refUtc.getTime();
  // Real UTC = local time minus the Swiss→UTC offset
  return new Date(refUtc.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Fetch with a single retry on transient errors (429, 5xx, network).
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const opts: RequestInit = {
    ...init,
    signal: AbortSignal.timeout(4000),
  };
  try {
    const res = await fetch(url, opts);
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 300));
      return fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
    }
    return res;
  } catch {
    // Network/timeout error — retry once
    await new Promise((r) => setTimeout(r, 300));
    return fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
  }
}

/**
 * Fetch current wind at a lat/lng from Open-Meteo (no API key needed).
 */
export async function fetchCurrentWind(
  lat: number,
  lng: number,
): Promise<WindData> {
  const url = new URL(BASE);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set(
    "current",
    "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");

  const res = await fetchWithRetry(url.toString(), {
    next: { revalidate: 600 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${res.statusText}`);

  const data = await res.json();
  const c = data.current;

  return {
    ...getWindData(c.wind_speed_10m, c.wind_direction_10m, c.wind_gusts_10m),
    updatedAt: (c.time as string | undefined) ?? undefined,
  };
}

/**
 * Fetch hourly wind forecast for a specific date at lat/lng.
 * Returns 24 hourly entries for the given date.
 */
export async function fetchForecastForDate(
  lat: number,
  lng: number,
  date: string, // "YYYY-MM-DD"
): Promise<ForecastHour[]> {
  return fetchForecastRange(lat, lng, date, date);
}

/**
 * Fetch hourly wind forecast for a date range (up to 16 days ahead via Open-Meteo).
 * Returns all hourly entries across the range.
 */
export async function fetchForecastRange(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<ForecastHour[]> {
  const url = new URL(BASE);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json();
  const { time, wind_speed_10m, wind_direction_10m, wind_gusts_10m } =
    data.hourly;

  return (time as string[]).map((t: string, i: number) => ({
    time: t,
    windSpeedKmh: wind_speed_10m[i],
    windDirection: wind_direction_10m[i],
    gustsKmh: wind_gusts_10m[i],
  }));
}

/**
 * Batch-fetch forecasts for multiple spots in a single Open-Meteo request
 * (comma-separated latitudes/longitudes). Returns one ForecastHour[] per spot.
 * Batches of up to 50 to stay within URL limits.
 */
export async function fetchForecastBatch(
  coords: { lat: number; lng: number }[],
  startDate: string,
  endDate: string,
): Promise<(ForecastHour[] | null)[]> {
  if (!coords.length) return [];
  const BATCH = 50;
  const allResults: (ForecastHour[] | null)[] = new Array(coords.length).fill(
    null,
  );

  for (let i = 0; i < coords.length; i += BATCH) {
    const batch = coords.slice(i, i + BATCH);
    const lats = batch.map((c) => c.lat).join(",");
    const lngs = batch.map((c) => c.lng).join(",");

    const url = new URL(BASE);
    url.searchParams.set("latitude", lats);
    url.searchParams.set("longitude", lngs);
    url.searchParams.set(
      "hourly",
      "wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloudcover,precipitation",
    );
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    try {
      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) continue;

      const raw: unknown = await res.json();
      // Single coord → object, multiple → array
      const items = Array.isArray(raw)
        ? (raw as Array<{
            hourly: {
              time: string[];
              wind_speed_10m: number[];
              wind_direction_10m: number[];
              wind_gusts_10m: number[];
              cloudcover?: number[];
              precipitation?: number[];
            };
          }>)
        : [
            raw as {
              hourly: {
                time: string[];
                wind_speed_10m: number[];
                wind_direction_10m: number[];
                wind_gusts_10m: number[];
                cloudcover?: number[];
                precipitation?: number[];
              };
            },
          ];

      items.forEach((item, j) => {
        if (!item?.hourly) return;
        const {
          time,
          wind_speed_10m,
          wind_direction_10m,
          wind_gusts_10m,
          cloudcover,
          precipitation,
        } = item.hourly;
        allResults[i + j] = (time as string[]).map((t: string, k: number) => ({
          time: t,
          windSpeedKmh: wind_speed_10m[k],
          windDirection: wind_direction_10m[k],
          gustsKmh: wind_gusts_10m[k],
          cloudCoverPct: cloudcover?.[k],
          precipMm: precipitation?.[k],
        }));
      });
    } catch {
      // Batch failed — spots remain null (handled by caller)
    }
  }
  return allResults;
}

/** Wind thresholds per sport type */
const SPORT_THRESHOLDS = {
  KITE: { min: 15, max: 45, idealMin: 20, idealMax: 35, idealCenter: 27 },
  /** Paraglide: calm wind is ideal. "rideable" = 0–15 km/h. */
  PARAGLIDE: { min: 0, max: 15, idealMin: 0, idealMax: 10, idealCenter: 5 },
} as const;

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
    // ── Paraglide scoring ──────────────────────────────────────────
    // 1. Calm hours (wind < 15 km/h) — 30%
    const calmHours = daytime.filter((f) => f.windSpeedKmh < 15).length;
    const calmScore = Math.min(calmHours / 10, 1); // 10+ calm hours = perfect

    // 2. Sunshine — low cloud cover = good thermals — 30%
    const hasCloudData = daytime.some((f) => f.cloudCoverPct !== undefined);
    let sunshineScore = 0.5; // neutral fallback if no data
    if (hasCloudData) {
      const avgCloud =
        daytime.reduce((s, f) => s + (f.cloudCoverPct ?? 50), 0) /
        daytime.length;
      // 0% cloud = 1.0, 100% cloud = 0.0
      sunshineScore = Math.max(0, 1 - avgCloud / 100);
    }

    // 3. Low gusts — steady calm = safe para — 20%
    const maxGust = Math.max(...daytime.map((f) => f.gustsKmh));
    // <15 km/h gusts = 1.0, >40 km/h = 0.0
    const gustScore = Math.max(0, 1 - maxGust / 40);

    // 4. No rain — 20%
    const hasRainData = daytime.some((f) => f.precipMm !== undefined);
    let rainScore = 0.5; // neutral fallback
    if (hasRainData) {
      const totalPrecip = daytime.reduce((s, f) => s + (f.precipMm ?? 0), 0);
      // 0mm = 1.0, ≥5mm = 0.0
      rainScore = Math.max(0, 1 - totalPrecip / 5);
    }

    const score = Math.round(
      calmScore * 30 + sunshineScore * 30 + gustScore * 20 + rainScore * 20,
    );

    // Best hour for para = calmest hour with sunshine
    const best = daytime.reduce<ForecastHour | null>((acc, f) => {
      if (!acc) return f;
      const score_f =
        15 - f.windSpeedKmh + (100 - (f.cloudCoverPct ?? 50)) / 10;
      const score_a =
        15 - acc.windSpeedKmh + (100 - (acc.cloudCoverPct ?? 50)) / 10;
      return score_f > score_a ? f : acc;
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

  // ── Kite scoring (unchanged) ──────────────────────────────────
  // 1. Rideable hours ratio — weight 35%
  const hoursScore = Math.min(rideableHours / 8, 1);
  // 2. Wind quality — how close avg rideable wind is to ideal center — weight 25%
  const avgRideable = rideable.length
    ? rideable.reduce((s, f) => s + f.windSpeedKmh, 0) / rideable.length
    : 0;
  const idealDist = Math.abs(avgRideable - t.idealCenter);
  const windQuality = rideable.length
    ? Math.max(0, 1 - idealDist / (t.idealMax - t.idealMin))
    : 0;
  // 3. Regularity — low gust factor = steady wind — weight 20%
  const regularity = Math.max(0, 1 - (gustFactor - 1) / 1.5);
  // 4. Wind direction match — weight 20%
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
  // Group by date
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

/**
 * Fetch 48h real station measurements (10-min).
 *
 * Strategy (fast → slow):
 *   1. Database (StationMeasurement) — populated by /api/cron/stations every 10 min, real-time
 *   2. MeteoSwiss OGD CSV (_now + _recent) — ~2h publication delay, fills older gaps
 *
 * The two sources are merged and deduplicated by timestamp.
 */
export async function fetchWindHistoryStation(
  stationId: string,
): Promise<HistoryPoint[]> {
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2),
  );

  // ── 1. Database (real-time, no delay) ──────────────────────────────────
  let dbPoints: HistoryPoint[] = [];
  try {
    const rows = await prisma.stationMeasurement.findMany({
      where: {
        stationId,
        time: { gte: cutoff },
      },
      orderBy: { time: "asc" },
    });
    dbPoints = rows.map((r) => ({
      time: r.time.toISOString().slice(0, 16), // "YYYY-MM-DDTHH:mm"
      windSpeedKmh: r.windSpeedKmh,
      windDirection: r.windDirection,
      gustsKmh: r.gustsKmh ?? r.windSpeedKmh,
      temperatureC: r.temperatureC ?? 0,
    }));
  } catch {
    /* DB unavailable — continue with OGD CSV only */
  }

  // ── 2. OGD CSV (delayed ~2h, but covers full 48h once published) ──────
  let csvPoints: HistoryPoint[] = [];
  try {
    csvPoints = await fetchWindHistoryStationCsv(stationId);
  } catch {
    /* CSV unavailable — use DB only */
  }

  // ── Merge & dedup ─────────────────────────────────────────────────────
  const seen = new Set<string>();
  // DB points take priority (more recent) — add them last so they overwrite CSV
  const all = [...csvPoints, ...dbPoints]
    .filter((p) => {
      if (seen.has(p.time)) return false;
      seen.add(p.time);
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const cutoffStr = cutoff.toISOString().slice(0, 16);
  return all.filter((p) => p.time >= cutoffStr);
}

/**
 * Fetch 48h history from MeteoSwiss OGD CSV files.
 * These have a ~2h publication delay but are complete once available.
 */
async function fetchWindHistoryStationCsv(
  stationId: string,
): Promise<HistoryPoint[]> {
  const id = stationId.toLowerCase();
  const base = `https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/${id}/ogd-smn_${id}_t_`;

  // Fetch today's file (small ~10 KB) + tail of recent file (~100 KB covers 3+ days)
  const [nowRes, recentRes] = await Promise.all([
    fetch(`${base}now.csv`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(6000),
    }),
    fetch(`${base}recent.csv`, {
      headers: { Range: "bytes=-100000" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(6000),
    }),
  ]);

  const nowText = nowRes.ok ? await nowRes.text() : "";
  const recentText =
    recentRes.ok || recentRes.status === 206 ? await recentRes.text() : "";

  if (!nowText && !recentText) {
    throw new Error(`MeteoSwiss OGD data unavailable for station ${stationId}`);
  }

  const splitRows = (text: string): string[][] =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(";"));

  const nowRows = splitRows(nowText);
  // _recent tail starts mid-file — first row may be a partial line, skip it.
  // The Range response also never includes the header row, so reuse indices from _now.
  const recentRows = splitRows(recentText).slice(1);

  // Resolve column indices from _now header
  const header = nowRows[0] ?? [];
  const idx = (name: string) => header.indexOf(name);

  const COL_WIND_KMH = idx("fu3010z0"); // 10-min mean speed km/h
  const COL_DIR = idx("dkl010z0"); // 10-min mean direction °
  const COL_GUST = idx("fu3010z1"); // 1s gust peak km/h
  const COL_TEMP = idx("tre200s0"); // air temperature 2m °C

  if (COL_WIND_KMH === -1 || COL_DIR === -1) {
    throw new Error("MeteoSwiss CSV column layout unexpected");
  }

  const parseRow = (row: string[]): HistoryPoint | null => {
    // row[1] = reference_timestamp "dd.MM.yyyy HH:mm" in Swiss local time
    const rawTime = row[1];
    if (!rawTime || row.length < 5) return null;
    const [datePart, timePart] = rawTime.split(" ");
    if (!datePart || !timePart) return null;
    const [day, month, year] = datePart.split(".");
    if (!day || !month || !year) return null;
    const isoLocal = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`;
    // Convert Swiss local time (CET/CEST) to UTC
    const isoTime = swissLocalToUtc(isoLocal);

    const km = parseFloat(row[COL_WIND_KMH] ?? "");
    if (isNaN(km)) return null;

    return {
      time: isoTime,
      windSpeedKmh: km,
      windDirection: parseFloat(row[COL_DIR] ?? "") || 0,
      gustsKmh: parseFloat(row[COL_GUST] ?? "") || km,
      temperatureC: parseFloat(row[COL_TEMP] ?? "") || 0,
    };
  };

  // Data rows: _now (skip header at index 0), _recent tail (already sliced)
  const nowPoints = nowRows
    .slice(1)
    .filter((r) => r[0] && r[0] !== "station_abbr")
    .map(parseRow)
    .filter((p): p is HistoryPoint => p !== null);

  const recentPoints = recentRows
    .filter((r) => r[0] && r[0] !== "station_abbr" && r[0].length <= 10)
    .map(parseRow)
    .filter((p): p is HistoryPoint => p !== null);

  // Combine, dedup by time, sort, keep last 48h
  const seen = new Set<string>();
  const all = [...recentPoints, ...nowPoints]
    .filter((p) => {
      if (seen.has(p.time)) return false;
      seen.add(p.time);
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  // Midnight UTC 2 days ago → chart always starts at 00:00
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2),
  )
    .toISOString()
    .slice(0, 16); // "YYYY-MM-DDT00:00"
  return all.filter((p) => p.time >= cutoff);
}

/**
 * Fetch 48-hour wind history at 15-minute resolution via Open-Meteo
 * `minutely_15` with `past_days=2`. Times are UTC ISO strings.
 * Cached for 10 minutes server-side.
 */
export async function fetchWindHistory(
  lat: number,
  lng: number,
): Promise<HistoryPoint[]> {
  const url = new URL(BASE);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set(
    "minutely_15",
    "wind_speed_10m,wind_gusts_10m,temperature_2m,wind_direction_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("past_days", "2");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "UTC");

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Open-Meteo history error: ${res.status}`);

  const data = await res.json();
  const {
    time,
    wind_speed_10m,
    wind_gusts_10m,
    temperature_2m,
    wind_direction_10m,
  } = data.minutely_15 as {
    time: string[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    temperature_2m: number[];
    wind_direction_10m: number[];
  };

  // Return all points (past + near-future forecast) — the chart
  // renders future bars with reduced opacity based on the "now" marker.
  return time.map((t, i) => ({
    time: t,
    windSpeedKmh: wind_speed_10m[i] ?? 0,
    windDirection: wind_direction_10m[i] ?? 0,
    gustsKmh: wind_gusts_10m[i] ?? 0,
    temperatureC: temperature_2m[i] ?? 0,
  }));
}

/**
 * Fetch near-future 15-minute wind forecast via Open-Meteo.
 * Returns HistoryPoint[] for the next ~24h at 15-min resolution.
 */
export async function fetchWindForecast15min(
  lat: number,
  lng: number,
): Promise<HistoryPoint[]> {
  const url = new URL(BASE);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set(
    "minutely_15",
    "wind_speed_10m,wind_gusts_10m,temperature_2m,wind_direction_10m",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("past_days", "0");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "UTC");

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`);

  const data = await res.json();
  const {
    time,
    wind_speed_10m,
    wind_gusts_10m,
    temperature_2m,
    wind_direction_10m,
  } = data.minutely_15 as {
    time: string[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    temperature_2m: number[];
    wind_direction_10m: number[];
  };

  return time.map((t, i) => ({
    time: t,
    windSpeedKmh: wind_speed_10m[i] ?? 0,
    windDirection: wind_direction_10m[i] ?? 0,
    gustsKmh: wind_gusts_10m[i] ?? 0,
    temperatureC: temperature_2m[i] ?? 0,
  }));
}
