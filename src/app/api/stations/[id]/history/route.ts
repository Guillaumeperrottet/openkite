import { NextResponse } from "next/server";
import {
  fetchWindHistoryStation,
  fetchWindHistory,
  fetchWindForecast15min,
} from "@/lib/wind";
import { fetchMeteoSwissStations } from "@/lib/stations";
import { fetchMeteoFranceStations } from "@/lib/meteofrance";

// No force-dynamic — params already makes this route dynamic,
// and removing it lets internal fetch() calls use their ISR cache.

/**
 * GET /api/stations/:id/history
 *
 * Returns 48h wind history for a station.
 * Supports MeteoSwiss (e.g. "BER"), Pioupiou (e.g. "piou-110"),
 * Netatmo (e.g. "ntm-70:ee:50:b9:01:56"), and Météo-France (e.g. "mf-07245") stations.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const stationId = decodeURIComponent(id);

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
  };

  // ── Netatmo station (history from DB measurements + Open-Meteo forecast) ──
  if (stationId.startsWith("ntm-")) {
    try {
      // Try DB-stored measurements first (recorded by cron)
      const history = await fetchWindHistoryStation(stationId);

      // If we have DB history, get forecast for the station's coordinates
      if (history.length > 0) {
        // Extract coords from the latest Netatmo fetch
        const { fetchNetatmoStations } = await import("@/lib/netatmo");
        const stations = await fetchNetatmoStations().catch(() => []);
        const station = stations.find((s) => s.id === stationId);
        const forecast = station
          ? await fetchWindForecast15min(station.lat, station.lng).catch(
              () => [],
            )
          : [];
        const lastTime =
          history.length > 0 ? history[history.length - 1].time : "";
        const futurePoints = forecast.filter((p) => p.time > lastTime);
        return NextResponse.json([...history, ...futurePoints], {
          headers: cacheHeaders,
        });
      }

      // Fallback: no DB data yet, use Open-Meteo by coords
      const { fetchNetatmoStations } = await import("@/lib/netatmo");
      const stations = await fetchNetatmoStations();
      const station = stations.find((s) => s.id === stationId);
      if (!station) {
        return NextResponse.json(
          { error: "Netatmo station not found" },
          { status: 404 },
        );
      }
      const [omHistory, forecast] = await Promise.all([
        fetchWindHistory(station.lat, station.lng),
        fetchWindForecast15min(station.lat, station.lng).catch(() => []),
      ]);
      const lastTime =
        omHistory.length > 0 ? omHistory[omHistory.length - 1].time : "";
      const futurePoints = forecast.filter((p) => p.time > lastTime);
      return NextResponse.json([...omHistory, ...futurePoints], {
        headers: cacheHeaders,
      });
    } catch {
      return NextResponse.json(
        { error: "Netatmo history temporarily unavailable" },
        { status: 503 },
      );
    }
  }

  // ── Pioupiou station ────────────────────────────────────────────────
  if (stationId.startsWith("piou-")) {
    const numericId = parseInt(stationId.slice(5), 10);
    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: "Invalid Pioupiou ID" },
        { status: 400 },
      );
    }
    try {
      // Use merged history (DB real-time + Pioupiou Archive) to avoid
      // the ~2h delay inherent to the Pioupiou Archive API alone.
      const history = await fetchWindHistoryStation(stationId);
      return NextResponse.json(history, { headers: cacheHeaders });
    } catch {
      return NextResponse.json(
        { error: "Pioupiou history temporarily unavailable" },
        { status: 503 },
      );
    }
  }

  // ── Météo-France station (DB history + Open-Meteo forecast) ──────────
  if (stationId.startsWith("mf-")) {
    try {
      const history = await fetchWindHistoryStation(stationId);

      // Get station coords for Open-Meteo forecast
      const stations = await fetchMeteoFranceStations().catch(() => []);
      const station = stations.find((s) => s.id === stationId);

      if (history.length > 0 && station) {
        const forecast = await fetchWindForecast15min(
          station.lat,
          station.lng,
        ).catch(() => []);
        const lastTime = history[history.length - 1].time;
        const futurePoints = forecast.filter((p) => p.time > lastTime);
        return NextResponse.json([...history, ...futurePoints], {
          headers: cacheHeaders,
        });
      }

      // If no DB data yet, fallback to Open-Meteo grid history
      if (station) {
        const [omHistory, forecast] = await Promise.all([
          fetchWindHistory(station.lat, station.lng),
          fetchWindForecast15min(station.lat, station.lng).catch(() => []),
        ]);
        const lastTime =
          omHistory.length > 0 ? omHistory[omHistory.length - 1].time : "";
        const futurePoints = forecast.filter((p) => p.time > lastTime);
        return NextResponse.json([...omHistory, ...futurePoints], {
          headers: cacheHeaders,
        });
      }

      return NextResponse.json(history, { headers: cacheHeaders });
    } catch {
      return NextResponse.json(
        { error: "Météo-France history temporarily unavailable" },
        { status: 503 },
      );
    }
  }

  // ── MeteoSwiss station ──────────────────────────────────────────────
  try {
    const stations = await fetchMeteoSwissStations();
    const station = stations.find((s) => s.id === stationId);
    if (!station) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    // Fetch MeteoSwiss history + Open-Meteo 15-min forecast in parallel
    const [history, forecast] = await Promise.all([
      fetchWindHistoryStation(stationId).catch(() =>
        fetchWindHistory(station.lat, station.lng),
      ),
      fetchWindForecast15min(station.lat, station.lng).catch(() => []),
    ]);

    // Append forecast points that come after the last history point
    const lastTime = history.length > 0 ? history[history.length - 1].time : "";
    const futurePoints = forecast.filter((p) => p.time > lastTime);
    const combined = [...history, ...futurePoints];

    return NextResponse.json(combined, { headers: cacheHeaders });
  } catch {
    return NextResponse.json(
      { error: "History data temporarily unavailable" },
      { status: 503 },
    );
  }
}
