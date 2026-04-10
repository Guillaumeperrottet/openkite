import { NextResponse } from "next/server";
import { fetchMeteoSwissStations } from "@/lib/stations";
import { fetchPioupiouStations } from "@/lib/pioupiou";
import { fetchNetatmoStations } from "@/lib/netatmo";
import { fetchMeteoFranceStations } from "@/lib/meteofrance";
import { fetchWindballStations } from "@/lib/windball";

// ISR: cache the entire response for 10 min, revalidate in the background.
// This avoids hammering MeteoSwiss + Pioupiou on every single browser request.
export const revalidate = 600;
export const dynamic = "force-dynamic";

/**
 * GET /api/stations
 *
 * Returns live wind measurements from all available station networks:
 * - MeteoSwiss SwissMetNet (154 stations, 10-min updates)
 * - Pioupiou / OpenwindMap (~600 community stations, ~4-min updates)
 * - Netatmo (public stations with wind module, ~10-min updates)
 * - Météo-France SYNOP (~188 stations across France, 3-hourly)
 * - Windball / Windfox (~15–25 LoRa stations in western Switzerland, ~10-min)
 *
 * Each station includes a `source` field for attribution and history routing.
 */
export async function GET() {
  const results = await Promise.allSettled([
    fetchMeteoSwissStations(),
    fetchPioupiouStations(),
    fetchNetatmoStations(),
    fetchMeteoFranceStations(),
    fetchWindballStations(),
  ]);

  const meteoSwiss = results[0].status === "fulfilled" ? results[0].value : [];
  const pioupiou = results[1].status === "fulfilled" ? results[1].value : [];
  const netatmo = results[2].status === "fulfilled" ? results[2].value : [];
  const meteoFrance = results[3].status === "fulfilled" ? results[3].value : [];
  const windball = results[4].status === "fulfilled" ? results[4].value : [];

  if (results[0].status === "rejected") {
    console.error("[/api/stations] MeteoSwiss error:", results[0].reason);
  }
  if (results[1].status === "rejected") {
    console.error("[/api/stations] Pioupiou error:", results[1].reason);
  }
  if (results[2].status === "rejected") {
    console.error("[/api/stations] Netatmo error:", results[2].reason);
  }
  if (results[3].status === "rejected") {
    console.error("[/api/stations] Météo-France error:", results[3].reason);
  }
  if (results[4].status === "rejected") {
    console.error("[/api/stations] Windball error:", results[4].reason);
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

  return NextResponse.json(stations, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
    },
  });
}
