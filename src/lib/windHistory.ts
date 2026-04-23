/**
 * Wind history — station measurements (DB + MeteoSwiss CSV + Pioupiou + Météo-France + Windball)
 * and 15-minute Open-Meteo history/forecast.
 */
import type { HistoryPoint } from "@/types";
import { prisma } from "@/lib/prisma";
import { fetchPioupiouHistory } from "@/lib/pioupiou";
import { fetchWindballHistory } from "@/lib/windball";

const BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Convert a MeteoSwiss local timestamp (Europe/Zurich CET/CEST) to UTC ISO.
 * Input: "YYYY-MM-DDTHH:mm" in Swiss local time.
 * Output: "YYYY-MM-DDTHH:mm" in UTC.
 */
function swissLocalToUtc(localIso: string): string {
  const refUtc = new Date(localIso + ":00Z");
  const swissFormatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(refUtc);
  const swissIso = swissFormatted.replace(" ", "T");
  const offsetMs = Date.parse(swissIso + ":00Z") - refUtc.getTime();
  return new Date(refUtc.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Fetch 48h real station measurements (10-min).
 *
 * Strategy (fast → slow):
 *   1. Database (StationMeasurement) — populated by /api/cron/stations every 10 min, real-time
 *   2. MeteoSwiss OGD CSV (_now + _recent) — ~2h publication delay, fills older gaps
 *      OR Pioupiou Archive API for piou-* stations
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
  const isPioupiou = stationId.startsWith("piou-");
  const isWindball = stationId.startsWith("windball-");

  // For networks with a rich public API (Windball, Pioupiou), we bypass the
  // database entirely and trust ONLY what the balise returns. This ensures
  // that the chart's last bar and the popup/card header always read the
  // exact same measurement (same endpoint, same trame, same value).
  if (isPioupiou) {
    const piouId = parseInt(stationId.replace("piou-", ""), 10);
    const points = await fetchPioupiouHistory(piouId).catch(
      () => [] as HistoryPoint[],
    );
    const cutoffStr = cutoff.toISOString().slice(0, 16);
    return points
      .filter((p) => p.time >= cutoffStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  }
  if (isWindball) {
    const measures = await fetchWindballHistory(stationId).catch(() => []);
    const cutoffStr = cutoff.toISOString().slice(0, 16);
    return measures
      .map((m) => ({
        time: new Date(m.updatedAt).toISOString().slice(0, 16),
        windSpeedKmh: m.windSpeed ?? 0,
        windDirection: m.windDir ?? 0,
        gustsKmh: m.windBurst ?? m.windSpeed ?? 0,
        temperatureC: m.temperature ?? 0,
      }))
      .filter((p) => p.time >= cutoffStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // Other networks (MeteoSwiss, Netatmo, Météo-France) don't expose a rich
  // public history API — we fall back to DB (populated by cron) + CSV
  // archive to fill the 48h window.

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
    dbPoints = rows.map((r: (typeof rows)[number]) => ({
      time: r.time.toISOString().slice(0, 16),
      windSpeedKmh: r.windSpeedKmh,
      windDirection: r.windDirection,
      gustsKmh: r.gustsKmh ?? r.windSpeedKmh,
      temperatureC: r.temperatureC ?? 0,
    }));
  } catch {
    /* DB unavailable — continue with archive sources */
  }

  // ── 2. Archive source (fills gaps before cron started) ────────────────
  let archivePoints: HistoryPoint[] = [];
  try {
    archivePoints = await fetchWindHistoryStationCsv(stationId);
  } catch {
    /* Archive unavailable — use DB only */
  }

  // ── Merge & dedup ─────────────────────────────────────────────────────
  const seen = new Set<string>();
  const all = [...archivePoints, ...dbPoints]
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
  const recentRows = splitRows(recentText).slice(1);

  const header = nowRows[0] ?? [];
  const idx = (name: string) => header.indexOf(name);

  const COL_WIND_KMH = idx("fu3010z0");
  const COL_DIR = idx("dkl010z0");
  const COL_GUST = idx("fu3010z1");
  const COL_TEMP = idx("tre200s0");

  if (COL_WIND_KMH === -1 || COL_DIR === -1) {
    throw new Error("MeteoSwiss CSV column layout unexpected");
  }

  const parseRow = (row: string[]): HistoryPoint | null => {
    const rawTime = row[1];
    if (!rawTime || row.length < 5) return null;
    const [datePart, timePart] = rawTime.split(" ");
    if (!datePart || !timePart) return null;
    const [day, month, year] = datePart.split(".");
    if (!day || !month || !year) return null;
    const isoLocal = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`;
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

  const nowPoints = nowRows
    .slice(1)
    .filter((r) => r[0] && r[0] !== "station_abbr")
    .map(parseRow)
    .filter((p): p is HistoryPoint => p !== null);

  const recentPoints = recentRows
    .filter((r) => r[0] && r[0] !== "station_abbr" && r[0].length <= 10)
    .map(parseRow)
    .filter((p): p is HistoryPoint => p !== null);

  const seen = new Set<string>();
  const all = [...recentPoints, ...nowPoints]
    .filter((p) => {
      if (seen.has(p.time)) return false;
      seen.add(p.time);
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2),
  )
    .toISOString()
    .slice(0, 16);
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
