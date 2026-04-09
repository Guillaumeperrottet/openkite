import { NextResponse } from "next/server";
import { fetchMeteoSwissStations } from "@/lib/stations";
import { fetchPioupiouStations } from "@/lib/pioupiou";
import { fetchNetatmoStations } from "@/lib/netatmo";

// ISR: cache the entire response for 10 min, revalidate in the background.
// This avoids hammering MeteoSwiss + Pioupiou on every single browser request.
export const revalidate = 600;

/**
 * GET /api/stations
 *
 * Returns live wind measurements from all available station networks:
 * - MeteoSwiss SwissMetNet (154 stations, 10-min updates)
 * - Pioupiou / OpenwindMap (~600 community stations, ~4-min updates)
 * - Netatmo (public stations with wind module, ~10-min updates)
 *
 * Each station includes a `source` field ("meteoswiss" | "pioupiou" | "netatmo")
 * for attribution and history routing.
 */
export async function GET() {
  const results = await Promise.allSettled([
    fetchMeteoSwissStations(),
    fetchPioupiouStations(),
    fetchNetatmoStations(),
  ]);

  const meteoSwiss = results[0].status === "fulfilled" ? results[0].value : [];
  const pioupiou = results[1].status === "fulfilled" ? results[1].value : [];
  const netatmo = results[2].status === "fulfilled" ? results[2].value : [];

  if (results[0].status === "rejected") {
    console.error("[/api/stations] MeteoSwiss error:", results[0].reason);
  }
  if (results[1].status === "rejected") {
    console.error("[/api/stations] Pioupiou error:", results[1].reason);
  }
  if (results[2].status === "rejected") {
    console.error("[/api/stations] Netatmo error:", results[2].reason);
  }

  const stations = [...meteoSwiss, ...pioupiou, ...netatmo];

  if (stations.length === 0) {
    return NextResponse.json(
      { error: "Station data temporarily unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json(stations, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
    },
  });
}
