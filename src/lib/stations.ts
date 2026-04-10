/**
 * Live wind stations from MeteoSwiss (SwissMetNet).
 *
 * Data source : data.geo.admin.ch — Swiss Federal Office of Meteorology
 * License     : opendata.swiss (free, attribution required)
 * Frequency   : updated every 10 minutes
 * Coverage    : 154 automatic stations across Switzerland
 */

const METEOSWISS_BASE =
  "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min";

const METEOSWISS_URL = `${METEOSWISS_BASE}/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min_de.json`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WindStation {
  /** Station ID — MeteoSwiss e.g. "BER", Pioupiou e.g. "piou-110" */
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Altitude above sea level in metres */
  altitudeM: number;
  /** Mean wind speed over last 10 minutes (km/h) */
  windSpeedKmh: number;
  /** Meteorological direction: where wind comes FROM (0–360°) */
  windDirection: number;
  /** ISO 8601 datetime of the measurement, e.g. "2026-04-01T18:20:00Z" */
  updatedAt: string;
  /** Data source — used for attribution and history fetching */
  source: "meteoswiss" | "pioupiou" | "netatmo" | "meteofrance";
}

// ─── Coordinate conversion ────────────────────────────────────────────────────

/**
 * Convert Swiss LV95 (EPSG:2056) coordinates to WGS84.
 *
 * Uses the approximate formula published by swisstopo (accuracy ≈ 1 m).
 * Reference: https://www.swisstopo.admin.ch/content/swisstopo-internet/en/
 *            topics/survey/e-geodesy/geodesy/_jcr_content/contentPar/
 *            tabs/items/dokumente_und_publi/tabPar/downloadlist/
 *            downloadItems/19_1467104393233.download/ch1903wgs84_e.pdf
 */
function lv95ToWgs84(e: number, n: number): { lat: number; lng: number } {
  // Normalised auxiliary values (difference from reference point Bern)
  const e_ = (e - 2_600_000) / 1_000_000;
  const n_ = (n - 1_200_000) / 1_000_000;

  // Longitude in arc-seconds (1/36 degree)
  const lon =
    2.6779094 +
    4.728982 * e_ +
    0.791484 * e_ * n_ +
    0.1306 * e_ * n_ * n_ -
    0.0436 * e_ * e_ * e_;

  // Latitude in arc-seconds (1/36 degree)
  const lat =
    16.9023892 +
    3.238272 * n_ -
    0.270978 * e_ * e_ -
    0.002528 * n_ * n_ -
    0.0447 * e_ * e_ * n_ -
    0.014 * n_ * n_ * n_;

  return {
    lng: (lon * 100) / 36,
    lat: (lat * 100) / 36,
  };
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch live wind measurements from all 154 MeteoSwiss SwissMetNet stations.
 * Results are cached by Next.js for 10 minutes (revalidate: 600).
 */
export async function fetchMeteoSwissStations(): Promise<WindStation[]> {
  const res = await fetch(METEOSWISS_URL, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(8000),
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`MeteoSwiss fetch failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const stations: WindStation[] = [];

  for (const feature of data.features ?? []) {
    const { coordinates } = feature.geometry ?? {};
    const p = feature.properties ?? {};

    // Skip stations with missing wind data
    if (p.value == null || p.wind_direction == null || !coordinates) continue;

    // Skip MeteoSwiss sentinel values (99999 = sensor offline / no data)
    if (p.value >= 9999 || p.wind_direction >= 9999) continue;

    const { lat, lng } = lv95ToWgs84(coordinates[0], coordinates[1]);

    stations.push({
      id: feature.id as string,
      name: p.station_name as string,
      lat,
      lng,
      altitudeM: parseFloat(p.altitude ?? "0") || 0,
      windSpeedKmh: p.value as number,
      windDirection: p.wind_direction as number,
      updatedAt: p.reference_ts as string,
      source: "meteoswiss",
    });
  }

  return stations;
}
