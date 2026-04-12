import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFullForecast } from "@/lib/forecast";
import { fetchWindHistory, fetchWindHistoryStation } from "@/lib/wind";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const historyPromise = spot.nearestStationId
    ? fetchWindHistoryStation(spot.nearestStationId).catch(() =>
        fetchWindHistory(spot.latitude, spot.longitude),
      )
    : fetchWindHistory(spot.latitude, spot.longitude);

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
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
      },
    },
  );
}
