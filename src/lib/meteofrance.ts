/**
 * Météo-France — DonneesPubliquesObservation API (SYNOP stations).
 *
 * Data source : portail-api.meteofrance.fr
 * License     : Licence Ouverte Etalab — free, attribution required
 *               Source: Météo-France
 * Frequency   : SYNOP messages every 3 hours (00,03,06,09,12,15,18,21 UTC)
 * Coverage    : ~188 SYNOP stations (metropolitan France + overseas)
 *
 * Auth: API Key passed via `apikey` header (not Bearer).
 * Env : METEOFRANCE_API_KEY
 */

import type { WindStation } from "./stations";

const MF_BASE = "https://public-api.meteofrance.fr/public/DPObs";

// ─── Types from the Météo-France SYNOP API ────────────────────────────────────

interface MFSynopObs {
  lat: number;
  lon: number;
  geo_id_wmo: string;
  name: string;
  validity_time: string;
  dd: number | null; // Wind direction (degrees)
  ff: number | null; // Wind speed (m/s, 10-min average)
  raf10: number | null; // Gust speed over 10 min (m/s)
  t: number | null; // Temperature (Kelvin)
  u: number | null; // Humidity (%)
  pmer: number | null; // Sea-level pressure (Pa)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DDTHH:00:00Z (hour-rounded, UTC). */
function fmtHour(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:00:00Z`;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch live wind from Météo-France SYNOP stations.
 * Uses one bulk API call for all ~188 stations across France.
 * Requests the last 6 hours of observations and keeps the most recent per station.
 * Cached 10 minutes server-side.
 */
export async function fetchMeteoFranceStations(): Promise<WindStation[]> {
  const apiKey = process.env.METEOFRANCE_API_KEY;
  if (!apiKey) return [];

  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    format: "json",
    date_debut: fmtHour(sixHoursAgo),
    date_fin: fmtHour(now),
  });

  const res = await fetch(`${MF_BASE}/v1/synop?${params}`, {
    headers: { apikey: apiKey },
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(8_000),
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`Météo-France SYNOP API error: HTTP ${res.status}`);
  }

  const observations: MFSynopObs[] = await res.json();

  // Group by station, keep the most recent observation
  const latest = new Map<string, MFSynopObs>();
  for (const obs of observations) {
    if (!obs.geo_id_wmo || obs.lat == null || obs.lon == null) continue;

    const id = obs.geo_id_wmo;
    const existing = latest.get(id);
    if (
      !existing ||
      (obs.validity_time ?? "") > (existing.validity_time ?? "")
    ) {
      latest.set(id, obs);
    }
  }

  const stations: WindStation[] = [];

  for (const obs of latest.values()) {
    // Skip stations without wind data
    if (obs.ff == null || obs.dd == null) continue;

    // Skip invalid readings
    if (obs.dd < 0 || obs.dd > 360 || obs.ff < 0 || obs.ff > 150) continue;

    // Skip stale observations (older than 6 hours)
    if (obs.validity_time) {
      const age = Date.now() - new Date(obs.validity_time).getTime();
      if (age > 6 * 60 * 60 * 1000) continue;
    }

    stations.push({
      id: `mf-${obs.geo_id_wmo}`,
      name: obs.name || `Météo-France ${obs.geo_id_wmo}`,
      lat: obs.lat,
      lng: obs.lon,
      altitudeM: 0, // SYNOP response doesn't include altitude
      windSpeedKmh: Math.round(obs.ff * 3.6),
      gustsKmh: obs.raf10 != null ? Math.round(obs.raf10 * 3.6) : null,
      windDirection: obs.dd,
      updatedAt: obs.validity_time ?? new Date().toISOString(),
      source: "meteofrance",
    });
  }

  return stations;
}
