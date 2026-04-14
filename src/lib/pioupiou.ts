/**
 * Pioupiou / OpenWindMap — community wind station network.
 *
 * Data source : api.pioupiou.fr (OpenWindMap SCIC SA)
 * License     : Community License — free, attribution required
 *               https://developers.pioupiou.fr/data-licensing/
 * Attribution : "(c) contributors of the OpenWindMap wind network <https://openwindmap.org>"
 * Frequency   : ~4 min per station
 * Coverage    : ~600 active stations worldwide (community-installed sensors)
 */

import type { WindStation } from "./stations";
import type { HistoryPoint } from "@/types";

const PIOUPIOU_LIVE_ALL = "https://api.pioupiou.fr/v1/live-with-meta/all";
const PIOUPIOU_ARCHIVE = "https://api.pioupiou.fr/v1/archive";

// ─── Types from the Pioupiou API ──────────────────────────────────────────────

interface PioupiouStation {
  id: number;
  meta: { name: string; description?: string | null };
  location: {
    latitude: number | null;
    longitude: number | null;
    date: string | null;
    success: boolean;
  };
  measurements: {
    date: string | null;
    wind_heading: number | null;
    wind_speed_avg: number | null;
    wind_speed_max: number | null;
    wind_speed_min: number | null;
  };
  status: {
    date: string | null;
    state: string | null;
  };
}

// ─── Fetch all active Pioupiou stations ───────────────────────────────────────

/**
 * Fetch live wind from all Pioupiou stations.
 * Filters to active stations with valid GPS and recent measurements.
 * Cached 10 minutes server-side.
 */
export async function fetchPioupiouStations(): Promise<WindStation[]> {
  const res = await fetch(PIOUPIOU_LIVE_ALL, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(8000),
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`Pioupiou API error: HTTP ${res.status}`);
  }

  const json = await res.json();
  const data: PioupiouStation[] = json.data ?? [];

  const stations: WindStation[] = [];

  for (const s of data) {
    // Skip: no GPS, inactive, no measurements, or null wind
    if (
      !s.location.success ||
      s.location.latitude == null ||
      s.location.longitude == null ||
      s.status.state !== "on" ||
      s.measurements.wind_speed_avg == null ||
      s.measurements.date == null
    )
      continue;

    // Skip stations with no wind heading (sensor issue)
    if (s.measurements.wind_heading == null) continue;

    // Skip stale measurements (older than 1 hour)
    const measureAge = Date.now() - new Date(s.measurements.date).getTime();
    if (measureAge > 60 * 60 * 1000) continue;

    stations.push({
      id: `piou-${s.id}`,
      name: s.meta.name || `Pioupiou ${s.id}`,
      description: s.meta.description || undefined,
      lat: s.location.latitude,
      lng: s.location.longitude,
      altitudeM: 0, // Pioupiou API doesn't provide altitude
      windSpeedKmh: s.measurements.wind_speed_avg,
      gustsKmh: s.measurements.wind_speed_max ?? null,
      windDirection: s.measurements.wind_heading,
      updatedAt: s.measurements.date,
      source: "pioupiou",
    });
  }

  return stations;
}

// ─── Fetch archive (48h history) for a single station ─────────────────────────

/**
 * Fetch 48h wind history for a Pioupiou station.
 * Uses the Archive API with `start=last-day` twice (2 × 24h).
 * Returns HistoryPoint[] compatible with WindHistoryChart.
 */
export async function fetchPioupiouHistory(
  pioupiouId: number,
): Promise<HistoryPoint[]> {
  // Pioupiou archive max = 31 days, we want 2 days
  const stop = new Date().toISOString();
  // Midnight UTC 2 days ago → chart always starts at 00:00
  const nowDate = new Date();
  const start = new Date(
    Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() - 2,
    ),
  ).toISOString();

  const url = `${PIOUPIOU_ARCHIVE}/${pioupiouId}?start=${encodeURIComponent(start)}&stop=${encodeURIComponent(stop)}`;

  const res = await fetch(url, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    throw new Error(`Pioupiou archive error: HTTP ${res.status}`);
  }

  const json = await res.json();
  // legend: ["time","latitude","longitude","wind_speed_min","wind_speed_avg","wind_speed_max","wind_heading","pressure"]
  const rows: (string | number | null)[][] = json.data ?? [];

  return rows
    .filter((r) => r[0] != null && r[4] != null)
    .map((r) => ({
      time: (r[0] as string).slice(0, 16).replace("T", "T"),
      windSpeedKmh: (r[4] as number) ?? 0,
      windDirection: (r[6] as number) ?? 0,
      gustsKmh: (r[5] as number) ?? (r[4] as number) ?? 0,
      temperatureC: 0, // Pioupiou doesn't provide temperature
    }));
}
