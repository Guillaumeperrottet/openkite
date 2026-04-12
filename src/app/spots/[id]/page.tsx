import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  fetchCurrentWind,
  fetchWindHistory,
  fetchWindHistoryStation,
} from "@/lib/wind";
import { fetchFullForecast } from "@/lib/forecast";
import { getWindData, haversineKm } from "@/lib/utils";
import type { WindStation } from "@/lib/stations";
import type { WindData } from "@/types";
import { SpotPageClient } from "./SpotPageClient";

// No force-dynamic — params already makes this route dynamic.
// Without it, the internal fetch() calls honor their { next: { revalidate } }
// settings, so Open-Meteo data is ISR-cached instead of fetched on every request.

// Deduplicated Prisma query: shared across generateMetadata() and SpotPage()
// within the same request, so the DB is hit only once.
const getSpot = cache(async (id: string) => {
  return prisma.spot.findUnique({
    where: { id },
    include: {
      images: true,
      reports: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
});

/** Fetch stations from the ISR-cached API route (0ms on cache hit)
 *  instead of calling all 5 source modules individually. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

async function fetchCachedStations(): Promise<WindStation[]> {
  try {
    const res = await fetch(`${SITE_URL}/api/stations`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const spot = await getSpot(id);
    if (!spot) return { title: "Spot introuvable" };
    const location = [spot.region, spot.country].filter(Boolean).join(", ");
    const sport = spot.sportType === "KITE" ? "kitesurf" : "parapente";
    const description = `Spot de ${sport} ${spot.name}${location ? ` à ${location}` : ""}. Vent en direct, prévisions 7 jours et archives historiques.`;
    return {
      title: spot.name,
      description,
      alternates: {
        canonical: `https://openwind.ch/spots/${id}`,
      },
      openGraph: {
        title: `${spot.name} — Openwind`,
        description,
        url: `https://openwind.ch/spots/${id}`,
        type: "article",
        ...(spot.images[0] && { images: [{ url: spot.images[0].url }] }),
      },
    };
  } catch {
    return { title: "Spot" };
  }
}

export default async function SpotPage({ params }: Props) {
  const { id } = await params;

  let spot;
  try {
    spot = await getSpot(id);
  } catch {
    notFound();
  }

  if (!spot) notFound();

  // ── Fetch everything in parallel: stations, forecast, history ──────────
  // Previously stations were fetched via 5 individual source modules (~2-5s).
  // Now we use the ISR-cached /api/stations (0ms on cache hit).
  const historyPromise = spot.nearestStationId
    ? fetchWindHistoryStation(spot.nearestStationId).catch(() =>
        fetchWindHistory(spot.latitude, spot.longitude),
      )
    : fetchWindHistory(spot.latitude, spot.longitude);

  const [stationsResult, forecastResult, historyResult] =
    await Promise.allSettled([
      fetchCachedStations(),
      fetchFullForecast(spot.latitude, spot.longitude),
      historyPromise,
    ]);

  // ── Current wind: prefer nearest station (instant lookup) ──────────────
  let wind: WindData | null = null;
  let windSource: { name: string; network: string } | null = null;

  const allStations =
    stationsResult.status === "fulfilled" ? stationsResult.value : [];

  if (spot.nearestStationId && allStations.length > 0) {
    const station = allStations.find((s) => s.id === spot.nearestStationId);
    if (station) {
      wind = getWindData(
        station.windSpeedKmh,
        station.windDirection,
        Math.round(station.windSpeedKmh * 1.3),
      );
      const NETWORK_LABELS: Record<string, string> = {
        meteoswiss: "MeteoSwiss",
        pioupiou: "Pioupiou",
        netatmo: "Netatmo",
        meteofrance: "Météo-France",
        windball: "Windball",
      };
      windSource = {
        name: station.name,
        network: NETWORK_LABELS[station.source] ?? station.source,
      };
    }
  }

  // Fallback: Open-Meteo (if no station found)
  if (!wind) {
    try {
      wind = await fetchCurrentWind(spot.latitude, spot.longitude);
    } catch {
      /* wind stays null */
    }
  }

  const sport = spot.sportType === "KITE" ? "kitesurf" : "parapente";
  const location = [spot.region, spot.country].filter(Boolean).join(", ");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            name: spot.name,
            description: `Spot de ${sport}${location ? ` à ${location}` : ""}. Vent en direct et prévisions.`,
            geo: {
              "@type": "GeoCoordinates",
              latitude: spot.latitude,
              longitude: spot.longitude,
            },
            ...(spot.images[0] && { image: spot.images[0].url }),
          }),
        }}
      />
      <SpotPageClient
        spot={JSON.parse(JSON.stringify(spot))}
        wind={wind}
        windSource={windSource}
        forecast={
          forecastResult.status === "fulfilled" ? forecastResult.value : null
        }
        history={
          historyResult.status === "fulfilled" ? historyResult.value : null
        }
        nearbyStations={allStations
          .map((s) => ({
            ...s,
            dist: haversineKm(spot.latitude, spot.longitude, s.lat, s.lng),
          }))
          .filter((s) => s.dist <= 10)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5)}
      />
    </>
  );
}
