/**
 * Windball — LoRa-based anemometers for kitesurf & paragliding.
 *
 * Data source : server.windball.ch (public REST API, no key required)
 * License     : Data provided as-is by Windball / Pierre Gremaud
 * Frequency   : ~10 minutes (LoRaWAN transmission interval)
 * Coverage    : ~15–25 stations in western Switzerland (Fribourg / Vaud)
 *
 * Device types: "windball" (ball anemometer) and "windfox" (cup/vane)
 * Wind data   : windSpeed & windBurst in km/h, windDir in degrees
 */

import type { WindStation } from "./stations";

const WINDBALL_API = "https://server.windball.ch";

// ─── Types from the Windball API ──────────────────────────────────────────────

interface WBDevice {
  deviceId: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  lastActivityAt: string;
  type?: string; // "windball" | "windfox"
  showOnWindball?: boolean;
}

interface WBMeasure {
  windSpeed: number; // km/h
  windBurst: number; // km/h (gust)
  windDir: number; // degrees (0–360)
  temperature?: number; // °C
  updatedAt: string; // ISO 8601
}

interface WBDeviceDetail extends WBDevice {
  measures: WBMeasure[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check if lastActivityAt is within the last 2 hours. */
function isRecent(isoDate: string): boolean {
  const diff = Date.now() - new Date(isoDate).getTime();
  return diff >= 0 && diff < 2 * 60 * 60 * 1000;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch all active Windball/Windfox stations with their latest wind data.
 *
 * 1. GET /device/all → list of all devices with coordinates
 * 2. For each recently active device, GET /device/one/{id} → measures[]
 * 3. Return WindStation[] with most recent measure per device
 *
 * Cached 10 minutes server-side via Next.js fetch cache.
 */
export async function fetchWindballStations(): Promise<WindStation[]> {
  // Step 1: Get all devices
  const listRes = await fetch(`${WINDBALL_API}/device/all`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(8_000),
  });

  if (!listRes.ok) return [];

  const devices: WBDevice[] = await listRes.json();

  // Filter to recently active devices with valid coordinates
  const active = devices.filter(
    (d) =>
      d.latitude &&
      d.longitude &&
      d.lastActivityAt &&
      isRecent(d.lastActivityAt),
  );

  if (active.length === 0) return [];

  // Step 2: Fetch detail for each active device (max 5 concurrent, 5s timeout each)
  const MAX_CONCURRENT = 5;
  const stations: WindStation[] = [];

  for (let i = 0; i < active.length; i += MAX_CONCURRENT) {
    const batch = active.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map(async (device): Promise<WindStation | null> => {
        try {
          const res = await fetch(
            `${WINDBALL_API}/device/one/${encodeURIComponent(device.deviceId)}`,
            {
              next: { revalidate: 600 },
              signal: AbortSignal.timeout(5_000),
            },
          );

          if (!res.ok) return null;

          const detail: WBDeviceDetail = await res.json();

          if (!detail.measures || detail.measures.length === 0) return null;

          const latest = detail.measures[0];

          return {
            id: `windball-${device.deviceId}`,
            name: device.name || device.deviceId,
            lat: device.latitude,
            lng: device.longitude,
            altitudeM: device.altitude || 0,
            windSpeedKmh: latest.windSpeed ?? 0,
            gustsKmh: latest.windBurst ?? null,
            windDirection: latest.windDir ?? 0,
            updatedAt: latest.updatedAt,
            source: "windball" as const,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) stations.push(r.value);
    }
  }

  return stations;
}

/**
 * Fetch the last 60 measures (~10h) for a single Windball device.
 * Used for station history charts. Returns measures sorted oldest→newest.
 */
export async function fetchWindballHistory(
  deviceId: string,
): Promise<WBMeasure[]> {
  // deviceId comes as "windball-wb-05" → extract "wb-05"
  const rawId = deviceId.replace(/^windball-/, "");

  const res = await fetch(
    `${WINDBALL_API}/device/one/${encodeURIComponent(rawId)}`,
    {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) return [];

  const detail: WBDeviceDetail = await res.json();
  if (!detail.measures || detail.measures.length === 0) return [];

  // API returns newest first → reverse for chronological order
  return [...detail.measures].reverse();
}
