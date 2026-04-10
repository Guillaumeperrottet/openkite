/**
 * Wind data fetching — Open-Meteo current & forecast.
 * Pure data fetching, no analysis or scoring logic.
 */
import type { ForecastHour, WindData } from "@/types";
import { getWindData } from "@/lib/utils";

const BASE = "https://api.open-meteo.com/v1/forecast";

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
      return await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
    }
    return res;
  } catch {
    // Network/timeout error — retry once
    await new Promise((r) => setTimeout(r, 300));
    return await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
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
