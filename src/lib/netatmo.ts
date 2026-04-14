/**
 * Netatmo — public weather station network.
 *
 * Data source : api.netatmo.com (Netatmo Connect)
 * License     : Free tier, OAuth2 required, rate-limited
 * Frequency   : ~10 min per station
 * Coverage    : Thousands of stations worldwide (only those with NAModule2 anemometer have wind)
 * Attribution : "Netatmo <https://weathermap.netatmo.com>"
 *
 * Token management:
 *   Netatmo rotates the refresh_token on every use (the old one is invalidated).
 *   We persist the latest refresh_token in the `SystemConfig` table so it
 *   survives Vercel cold starts. The access_token (~3h) is kept in memory.
 */

import type { WindStation } from "./stations";
import { prisma } from "./prisma";

const TOKEN_URL = "https://api.netatmo.com/oauth2/token";
const PUBLIC_DATA_URL = "https://api.netatmo.com/api/getpublicdata";

const CONFIG_KEY = "netatmo_refresh_token";

// ─── Token management ─────────────────────────────────────────────────────────

let cachedToken: { access_token: string; expires_at: number } | null = null;

/** In-flight refresh promise to prevent concurrent token rotations. */
let refreshPromise: Promise<string> | null = null;

/**
 * Get a valid access token, refreshing if needed.
 * Reads the refresh_token from DB (persisted across deploys/cold starts).
 * After each refresh, the NEW refresh_token is saved back to DB.
 * Uses a shared promise to prevent concurrent refresh race conditions.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s margin)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  // If a refresh is already in-flight, wait for it instead of starting another
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshAccessToken();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.NETATMO_CLIENT_ID;
  const clientSecret = process.env.NETATMO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Netatmo credentials not configured");
  }

  // Read the current refresh_token from DB
  const row = await prisma.systemConfig.findUnique({
    where: { key: CONFIG_KEY },
  });
  const refreshToken = row?.value ?? process.env.NETATMO_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("Netatmo refresh token not found (DB or env)");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Netatmo token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  // Persist the rotated refresh_token to DB
  if (data.refresh_token) {
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: data.refresh_token },
      create: { key: CONFIG_KEY, value: data.refresh_token },
    });
  }

  return cachedToken.access_token;
}

// ─── Geographic zones to fetch ────────────────────────────────────────────────

interface BoundingBox {
  lat_ne: number;
  lon_ne: number;
  lat_sw: number;
  lon_sw: number;
}

/**
 * Zones to query. Netatmo limits each request to a geographic bounding box.
 * We cover Switzerland + nearby France/Germany/Italy/Austria.
 */
const ZONES: BoundingBox[] = [
  // Switzerland + borders
  { lat_ne: 48.0, lon_ne: 10.6, lat_sw: 45.7, lon_sw: 5.9 },
  // Southern France (Camargue, Méditerranée)
  { lat_ne: 44.0, lon_ne: 5.5, lat_sw: 43.0, lon_sw: 3.5 },
];

// ─── Fetch public wind stations ───────────────────────────────────────────────

/**
 * Netatmo getpublicdata response shape (wind-specific fields).
 * Each "body" item represents one Netatmo station.
 */
interface NetatmoPublicStation {
  _id: string;
  place: {
    location: [number, number]; // [lng, lat]
    altitude?: number;
    city?: string;
    street?: string;
  };
  measures: Record<
    string,
    {
      type?: string[];
      res?: Record<string, number[]>;
      wind_strength?: number; // current wind speed km/h
      wind_angle?: number; // current wind direction degrees
      wind_timeutc?: number; // timestamp of wind measurement
      gust_strength?: number;
      gust_angle?: number;
    }
  >;
}

/**
 * Fetch public Netatmo stations with wind data in configured zones.
 * Cached 10 minutes server-side.
 */
export async function fetchNetatmoStations(): Promise<WindStation[]> {
  // Skip if credentials not configured
  if (!process.env.NETATMO_CLIENT_ID || !process.env.NETATMO_CLIENT_SECRET) {
    return [];
  }

  const accessToken = await getAccessToken();
  const stations: WindStation[] = [];
  const seenIds = new Set<string>();

  for (const zone of ZONES) {
    try {
      const params = new URLSearchParams({
        lat_ne: zone.lat_ne.toString(),
        lon_ne: zone.lon_ne.toString(),
        lat_sw: zone.lat_sw.toString(),
        lon_sw: zone.lon_sw.toString(),
        required_data: "wind",
        filter: "true",
      });

      const res = await fetch(`${PUBLIC_DATA_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(10_000),
      } as RequestInit);

      if (!res.ok) {
        console.error(
          `[Netatmo] getpublicdata error for zone: HTTP ${res.status}`,
        );
        continue;
      }

      const json = await res.json();
      const body: NetatmoPublicStation[] = json.body ?? [];

      for (const s of body) {
        if (seenIds.has(s._id)) continue;

        // Find wind module in measures
        let windSpeed: number | null = null;
        let windDirection: number | null = null;
        let gustStrength: number | null = null;
        let windTime: number | null = null;

        for (const mod of Object.values(s.measures)) {
          if (mod.wind_strength != null && mod.wind_angle != null) {
            windSpeed = mod.wind_strength;
            windDirection = mod.wind_angle;
            gustStrength = mod.gust_strength ?? null;
            windTime = mod.wind_timeutc ?? null;
            break;
          }
        }

        // Skip stations without wind data
        if (windSpeed == null || windDirection == null) continue;

        // Skip stale data (older than 1 hour)
        if (windTime && Date.now() / 1000 - windTime > 3600) continue;

        const [lng, lat] = s.place.location;
        const city = s.place.city ?? s.place.street ?? "";
        const updatedAt = windTime
          ? new Date(windTime * 1000).toISOString()
          : new Date().toISOString();

        seenIds.add(s._id);
        stations.push({
          id: `ntm-${s._id}`,
          name: city || `Netatmo ${s._id.slice(-4)}`,
          lat,
          lng,
          altitudeM: s.place.altitude ?? 0,
          windSpeedKmh: windSpeed,
          gustsKmh: gustStrength,
          windDirection: windDirection,
          updatedAt,
          source: "netatmo",
        });
      }
    } catch (err) {
      console.error("[Netatmo] Zone fetch error:", err);
    }
  }

  return stations;
}
