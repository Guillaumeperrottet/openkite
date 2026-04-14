import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMeteoSwissStations } from "@/lib/stations";
import { fetchPioupiouStations } from "@/lib/pioupiou";
import { fetchNetatmoStations } from "@/lib/netatmo";
import { fetchMeteoFranceStations } from "@/lib/meteofrance";
import { fetchWindballStations } from "@/lib/windball";

/**
 * GET /api/cron/stations
 *
 * Called by Vercel Cron every 10 minutes.
 * Fetches live wind readings from MeteoSwiss + Pioupiou + Netatmo + Météo-France + Windball and stores them
 * in StationMeasurement so we can build a real-time 48h history chart.
 *
 * Protected by CRON_SECRET header (Vercel injects this automatically).
 */
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret (Vercel sends this header automatically)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [meteoResult, piouResult, netatmoResult, mfResult, wbResult] =
      await Promise.allSettled([
        fetchMeteoSwissStations(),
        fetchPioupiouStations(),
        fetchNetatmoStations(),
        fetchMeteoFranceStations(),
        fetchWindballStations(),
      ]);

    const meteoStations =
      meteoResult.status === "fulfilled" ? meteoResult.value : [];
    const piouStations =
      piouResult.status === "fulfilled" ? piouResult.value : [];
    const netatmoStations =
      netatmoResult.status === "fulfilled" ? netatmoResult.value : [];
    const mfStations = mfResult.status === "fulfilled" ? mfResult.value : [];
    const wbStations = wbResult.status === "fulfilled" ? wbResult.value : [];

    const allStations = [
      ...meteoStations,
      ...piouStations,
      ...netatmoStations,
      ...mfStations,
      ...wbStations,
    ];

    if (allStations.length === 0) {
      return NextResponse.json(
        { error: "No stations fetched" },
        { status: 503 },
      );
    }

    // Build upsert data — one row per station per timestamp
    const rows = allStations
      .filter((s) => s.windSpeedKmh != null && s.updatedAt)
      .map((s) => ({
        stationId: s.id,
        time: new Date(s.updatedAt),
        windSpeedKmh: s.windSpeedKmh,
        windDirection: s.windDirection,
        gustsKmh: s.gustsKmh ?? null,
        temperatureC: null as number | null,
        source: s.source,
      }))
      .filter(
        (r) =>
          !isNaN(r.time.getTime()) &&
          r.windSpeedKmh < 500 &&
          r.windDirection < 360.1,
      );

    // Batch insert, skip duplicates (unique constraint on stationId+time)
    let inserted = 0;
    const CHUNK = 500;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const result = await prisma.stationMeasurement.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    // Prune old data (> 3 days) to keep the table small
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const pruned = await prisma.stationMeasurement.deleteMany({
      where: { time: { lt: threeDaysAgo } },
    });

    // Cache the full station list as JSON so /api/stations can serve it
    // instantly from DB without calling external APIs.
    await prisma.systemConfig.upsert({
      where: { key: "stations_cache" },
      update: { value: JSON.stringify(allStations) },
      create: { key: "stations_cache", value: JSON.stringify(allStations) },
    });

    return NextResponse.json({
      ok: true,
      stations: allStations.length,
      inserted,
      pruned: pruned.count,
    });
  } catch (err) {
    console.error("[cron/stations] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
