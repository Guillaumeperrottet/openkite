import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFullForecast } from "@/lib/forecast";
import {
  fetchWindHistory,
  fetchWindHistoryStation,
  fetchWindForecast15min,
} from "@/lib/wind";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  // Optional: override station for history (when user selects a nearby station)
  const overrideStationId = url.searchParams.get("stationId");

  const spot = await prisma.spot.findUnique({
    where: { id },
    select: {
      latitude: true,
      longitude: true,
      nearestStationId: true,
    },
  });

  if (!spot) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const stationId = overrideStationId || spot.nearestStationId;

  // Build history promise: station data first, Open-Meteo grid only if no station
  let historyPromise: Promise<import("@/types").HistoryPoint[]>;
  if (stationId) {
    historyPromise = fetchWindHistoryStation(stationId).then(
      async (stationHistory) => {
        // Append 15-min forecast after last station measurement
        const forecast15 = await fetchWindForecast15min(
          spot.latitude,
          spot.longitude,
        ).catch(() => []);
        if (stationHistory.length > 0 && forecast15.length > 0) {
          const lastTime = stationHistory[stationHistory.length - 1].time;
          const futurePoints = forecast15.filter((p) => p.time > lastTime);
          return [...stationHistory, ...futurePoints];
        }
        return stationHistory;
      },
    );
  } else {
    historyPromise = fetchWindHistory(spot.latitude, spot.longitude);
  }

  const [forecastResult, historyResult] = await Promise.allSettled([
    fetchFullForecast(spot.latitude, spot.longitude),
    historyPromise,
  ]);

  return NextResponse.json(
    {
      forecast:
        forecastResult.status === "fulfilled" ? forecastResult.value : null,
      history:
        historyResult.status === "fulfilled" ? historyResult.value : null,
      stationId: stationId ?? null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
      },
    },
  );
}
