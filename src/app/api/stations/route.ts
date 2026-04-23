import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMeteoSwissStations } from "@/lib/stations";
import type { WindStation } from "@/lib/stations";
import { fetchPioupiouStations } from "@/lib/pioupiou";
import { fetchNetatmoStations } from "@/lib/netatmo";
import { fetchMeteoFranceStations } from "@/lib/meteofrance";
import { fetchWindballStations } from "@/lib/windball";

export const dynamic = "force-dynamic";

/**
 * Overlay the latest `StationMeasurement` rows on top of a stations array.
 *
 * The snapshot cache (`stations_cache`) is rewritten by the cron every
 * ~10 min and may lag the live measurements by a few minutes. The
 * `StationMeasurement` table is updated by the same cron but is also the
 * source of truth used by the 48h history chart and by the spot page's
 * "Vent moyen / Rafales" cards.
 *
 * Overlaying the latest DB rows here guarantees that the popup on the
 * map and the cards on the spot page show *exactly* the same value
 * (no more "12 kts in popup, 11 kts on page" confusion).
 */
async function overlayLatestMeasurements(
  stations: WindStation[],
): Promise<WindStation[]> {
  if (stations.length === 0) return stations;
  try {
    const ids = stations.map((s) => s.id);
    // Look only at the last 30 min — anything older is staler than the
    // snapshot itself and shouldn't override it.
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const rows = await prisma.stationMeasurement.findMany({
      where: { stationId: { in: ids }, time: { gte: since } },
      orderBy: { time: "desc" },
      select: {
        stationId: true,
        time: true,
        windSpeedKmh: true,
        windDirection: true,
        gustsKmh: true,
      },
    });

    // Keep the most recent row per stationId (rows are already DESC).
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!latest.has(r.stationId)) latest.set(r.stationId, r);
    }

    return stations.map((s) => {
      const fresh = latest.get(s.id);
      if (!fresh) return s;
      // Only override if the DB row is strictly newer than the snapshot.
      const snapshotTime = new Date(s.updatedAt).getTime();
      const dbTime = fresh.time.getTime();
      if (dbTime <= snapshotTime) return s;
      return {
        ...s,
        windSpeedKmh: fresh.windSpeedKmh,
        windDirection: fresh.windDirection,
        gustsKmh: fresh.gustsKmh ?? s.gustsKmh,
        updatedAt: fresh.time.toISOString(),
      };
    });
  } catch {
    // DB unavailable — return snapshot as-is rather than failing the request.
    return stations;
  }
}

/**
 * GET /api/stations
 *
 * Returns live wind measurements from all available station networks.
 *
 * **Fast path** (< 100ms): reads the cached JSON written by the cron job
 * every 10 minutes into `SystemConfig.stations_cache`, then overlays the
 * latest `StationMeasurement` rows so the response always matches the
 * 48h history chart on the spot pages.
 *
 * **Slow fallback**: if the cache is stale or missing, fetches live data
 * from all 5 networks (MeteoSwiss, Pioupiou, Netatmo, Météo-France,
 * Windball) with per-network timeouts, and refreshes the cache.
 */
export async function GET() {
  // ── Fast path: serve from DB cache ──────────────────────────────────────
  try {
    const cached = await prisma.systemConfig.findUnique({
      where: { key: "stations_cache" },
    });

    if (cached) {
      const age = Date.now() - cached.updatedAt.getTime();
      // Cache is fresh (< 15 min) — serve it instantly
      if (age < 15 * 60 * 1000) {
        const snapshot = JSON.parse(cached.value) as WindStation[];
        const stations = await overlayLatestMeasurements(snapshot);
        return NextResponse.json(stations, {
          headers: {
            // Drop CDN caching to 60 s so the StationMeasurement overlay
            // can refresh between cron runs (was 300 s before).
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
          },
        });
      }
    }
  } catch {
    // DB error — fall through to live fetch
  }

  // ── Slow fallback: live fetch from external APIs ────────────────────────
  const withTimeout = <T>(p: Promise<T>, ms = 8000): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), ms),
      ),
    ]);

  const results = await Promise.allSettled([
    withTimeout(fetchMeteoSwissStations()),
    withTimeout(fetchPioupiouStations()),
    withTimeout(fetchNetatmoStations(), 10_000),
    withTimeout(fetchMeteoFranceStations()),
    withTimeout(fetchWindballStations()),
  ]);

  const meteoSwiss = results[0].status === "fulfilled" ? results[0].value : [];
  const pioupiou = results[1].status === "fulfilled" ? results[1].value : [];
  const netatmo = results[2].status === "fulfilled" ? results[2].value : [];
  const meteoFrance = results[3].status === "fulfilled" ? results[3].value : [];
  const windball = results[4].status === "fulfilled" ? results[4].value : [];

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const names = [
        "MeteoSwiss",
        "Pioupiou",
        "Netatmo",
        "Météo-France",
        "Windball",
      ];
      console.error(
        `[/api/stations] ${names[i]} error:`,
        (results[i] as PromiseRejectedResult).reason,
      );
    }
  }

  const stations = [
    ...meteoSwiss,
    ...pioupiou,
    ...netatmo,
    ...meteoFrance,
    ...windball,
  ];

  if (stations.length === 0) {
    return NextResponse.json(
      { error: "Station data temporarily unavailable" },
      { status: 503 },
    );
  }

  // Update the DB cache so the next request is instant
  try {
    await prisma.systemConfig.upsert({
      where: { key: "stations_cache" },
      update: { value: JSON.stringify(stations) },
      create: { key: "stations_cache", value: JSON.stringify(stations) },
    });
  } catch {
    // Non-critical — the data is still returned to the user
  }

  // Overlay latest StationMeasurement rows for consistency with history chart
  const merged = await overlayLatestMeasurements(stations);

  return NextResponse.json(merged, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
