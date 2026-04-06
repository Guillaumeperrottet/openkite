import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchForecastBatch, analyzeMultiDay } from "@/lib/wind";
import { fetchWindArchives } from "@/lib/archives";
import { haversineKm } from "@/lib/utils";
import type { SportType } from "@/types";

/**
 * Trip planner endpoint.
 * Query: ?lat=...&lng=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&radius=150&sport=KITE
 * lat/lng are optional — if omitted, returns the best-scored spots globally.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  const hasLocation = latStr !== null && lngStr !== null;
  let lat = 0;
  let lng = 0;
  if (hasLocation) {
    lat = parseFloat(latStr);
    lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng must be numbers" },
        { status: 400 },
      );
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const startDate = searchParams.get("startDate") || today;
  const endDate = searchParams.get("endDate") || startDate;
  const radius = parseFloat(searchParams.get("radius") || "150");
  const sport = (searchParams.get("sport") as SportType) || undefined;
  const LIMIT = 30;

  let nearby: (Awaited<ReturnType<typeof prisma.spot.findMany>>[number] & {
    distanceKm: number;
  })[];

  if (hasLocation) {
    // Bounding box pre-filter: ~1° lat ≈ 111 km, 1° lng varies by latitude
    const latDeg = radius / 111;
    const lngDeg = radius / (111 * Math.cos((lat * Math.PI) / 180));

    const allSpots = await prisma.spot.findMany({
      where: {
        ...(sport ? { sportType: sport } : {}),
        latitude: { gte: lat - latDeg, lte: lat + latDeg },
        longitude: { gte: lng - lngDeg, lte: lng + lngDeg },
      },
    });

    nearby = allSpots
      .map((spot) => ({
        ...spot,
        distanceKm: haversineKm(lat, lng, spot.latitude, spot.longitude),
      }))
      .filter((s) => s.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, LIMIT);
  } else {
    // No location — return a global sample of spots (spread geographically)
    const allSpots = await prisma.spot.findMany({
      where: sport ? { sportType: sport } : {},
      take: 200,
    });
    // Pick up to LIMIT evenly distributed spots
    const step = Math.max(1, Math.floor(allSpots.length / LIMIT));
    nearby = allSpots
      .filter((_, i) => i % step === 0)
      .slice(0, LIMIT)
      .map((spot) => ({ ...spot, distanceKm: 0 }));
  }

  // Determine if dates are within Open-Meteo forecast range (≤16 days)
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const endMs = new Date(endDate + "T00:00:00").getTime();
  const daysAhead = Math.ceil((endMs - todayMs) / 86400000);
  const useForecast = daysAhead <= 16;

  const coords = nearby.map((s) => ({ lat: s.latitude, lng: s.longitude }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spotsWithForecast: any[];

  if (useForecast) {
    // Real-time forecast path
    const forecasts = await fetchForecastBatch(coords, startDate, endDate);

    spotsWithForecast = nearby.map((spot, i) => {
      const forecast = forecasts[i];
      if (!forecast) {
        return {
          ...spot,
          forecast: [],
          days: [],
          bestScore: 0,
          bestDayIndex: 0,
          forecastError: true,
          dataSource: "forecast" as const,
        };
      }
      const sportType = (spot.sportType as SportType) || "KITE";
      const dirs = (spot.bestWindDirections as string[]) || [];
      const days = analyzeMultiDay(forecast, sportType, dirs);
      const bestDayIndex = days.reduce(
        (best, d, idx) => (d.score > (days[best]?.score ?? 0) ? idx : best),
        0,
      );
      return {
        ...spot,
        forecast: days[bestDayIndex]?.forecast ?? [],
        days,
        bestScore: days[bestDayIndex]?.score ?? 0,
        bestDayIndex,
        forecastError: false,
        dataSource: "forecast" as const,
      };
    });
  } else {
    // Archive-based path — use historical monthly averages
    // Determine which months the date range covers
    const rangeStart = new Date(startDate + "T12:00:00");
    const rangeEnd = new Date(endDate + "T12:00:00");
    const monthsInRange = new Set<number>();
    const d = new Date(rangeStart);
    while (d <= rangeEnd) {
      monthsInRange.add(d.getMonth() + 1); // 1-based
      d.setDate(d.getDate() + 1);
    }

    // Fetch archives for all spots (in parallel, limited concurrency)
    const ARCHIVE_BATCH = 10;
    const archiveResults: (Awaited<
      ReturnType<typeof fetchWindArchives>
    > | null)[] = new Array(nearby.length).fill(null);

    for (let i = 0; i < nearby.length; i += ARCHIVE_BATCH) {
      const batch = nearby.slice(i, i + ARCHIVE_BATCH);
      const results = await Promise.allSettled(
        batch.map((s) => fetchWindArchives(s.latitude, s.longitude)),
      );
      results.forEach((r, j) => {
        archiveResults[i + j] = r.status === "fulfilled" ? r.value : null;
      });
    }

    spotsWithForecast = nearby.map((spot, i) => {
      const archive = archiveResults[i];
      if (!archive) {
        return {
          ...spot,
          forecast: [],
          days: [],
          bestScore: 0,
          bestDayIndex: 0,
          forecastError: true,
          dataSource: "archive" as const,
        };
      }

      // Score based on monthly stats for months in range
      const relevantMonths = archive.combined.filter((m) =>
        monthsInRange.has(m.month),
      );
      if (!relevantMonths.length) {
        return {
          ...spot,
          forecast: [],
          days: [],
          bestScore: 0,
          bestDayIndex: 0,
          forecastError: true,
          dataSource: "archive" as const,
        };
      }

      // Compute an aggregate score from the archive data
      const avgGoodDays =
        relevantMonths.reduce((s, m) => s + m.goodDaysPct, 0) /
        relevantMonths.length;
      const avgWind =
        relevantMonths.reduce((s, m) => s + m.avgWindKmh, 0) /
        relevantMonths.length;

      const spotSport = (spot.sportType as SportType) || "KITE";

      // Build a synthetic day per month in range
      const days = relevantMonths.map((m) => {
        const monthNames = [
          "Jan",
          "Fév",
          "Mar",
          "Avr",
          "Mai",
          "Juin",
          "Juil",
          "Août",
          "Sep",
          "Oct",
          "Nov",
          "Déc",
        ];

        let score: number;
        if (spotSport === "PARAGLIDE") {
          // Paraglide: less wind = better; good days (≥15 km/h) are BAD for parapente
          const calmScore = Math.max(0, 1 - avgWind / 25) * 100;
          const badDaysPct = 100 - avgGoodDays; // % days with < 15 km/h = GOOD for para
          score = Math.round(badDaysPct * 0.5 + calmScore * 0.5);
        } else {
          // Kite: combine good days % + avg wind intensity
          const windScore = Math.min(100, (avgWind / 30) * 100);
          score = Math.round(avgGoodDays * 0.6 + windScore * 0.4);
        }

        return {
          date: `${monthNames[m.month - 1]} (arch.)`,
          score,
          kitableHours:
            spotSport === "PARAGLIDE"
              ? Math.round(((100 - m.goodDaysPct) / 100) * 8) // calm hours for para
              : Math.round((m.goodDaysPct / 100) * 8),
          peakWindKmh: m.maxWindKmh,
          avgWindKmh: m.avgWindKmh,
          gustFactor: m.avgGustsKmh / Math.max(m.avgWindKmh, 1),
          bestHour: null,
          forecast: [],
        };
      });

      const bestDayIndex = days.reduce(
        (best, d, idx) => (d.score > (days[best]?.score ?? 0) ? idx : best),
        0,
      );

      return {
        ...spot,
        forecast: [],
        days,
        bestScore: days[bestDayIndex]?.score ?? 0,
        bestDayIndex,
        forecastError: false,
        dataSource: "archive" as const,
      };
    });
  }

  // Sort by score for archive results (forecast path already sorted by distance)
  if (!useForecast) {
    spotsWithForecast.sort(
      (a: { bestScore: number }, b: { bestScore: number }) =>
        (b.bestScore ?? 0) - (a.bestScore ?? 0),
    );
  }

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
  };
  return NextResponse.json(spotsWithForecast, { headers: cacheHeaders });
}
