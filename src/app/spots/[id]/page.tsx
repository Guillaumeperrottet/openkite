import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWindData } from "@/lib/utils";
import {
  buildSpotDescription,
  buildArticleSchema,
  buildPlaceSchema,
  buildBreadcrumbSchema,
  combineSchemas,
} from "@/lib/seo";
import type { WindData } from "@/types";
import { SpotPageClient } from "./SpotPageClient";

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

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const spot = await getSpot(id);
    if (!spot) return { title: "Spot introuvable" };

    // Build optimized, keyword-focused description
    const description = buildSpotDescription(spot);

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
        // Dynamic og:image generated via /api/og endpoint
        images: [
          {
            url: `https://openwind.ch/api/og?id=${id}`,
            width: 1200,
            height: 630,
            alt: spot.name,
          },
        ],
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

  // ── Current wind from DB (instant — no external API calls) ─────────────
  // StationMeasurement is populated every 10 min by the cron job.
  // This makes the page render immediately instead of waiting for external APIs.
  const NETWORK_LABELS: Record<string, string> = {
    meteoswiss: "MeteoSwiss",
    pioupiou: "Pioupiou",
    netatmo: "Netatmo",
    meteofrance: "Météo-France",
    windball: "Windball",
  };

  let wind: WindData | null = null;
  let windSource: { name: string; network: string } | null = null;

  if (spot.nearestStationId) {
    try {
      const latest = await prisma.stationMeasurement.findFirst({
        where: { stationId: spot.nearestStationId },
        orderBy: { time: "desc" },
      });
      // Only use the DB row if it's fresh (≤ 5 min old). Otherwise leave
      // `wind = null` so the client side fetches /api/stations and we
      // avoid showing a stale value that would contradict the live popup.
      if (latest && Date.now() - latest.time.getTime() < 5 * 60 * 1000) {
        wind = getWindData(
          latest.windSpeedKmh,
          latest.windDirection,
          latest.gustsKmh ?? Math.round(latest.windSpeedKmh * 1.3),
          latest.time.toISOString(),
        );
        windSource = {
          name: spot.nearestStationId,
          network: NETWORK_LABELS[latest.source] ?? latest.source,
        };
      }
    } catch {
      /* DB error — wind stays null, the page shows "données indisponibles" */
    }
  }

  // No fallback to Open-Meteo grid: if the spot's station has no recent
  // measurement, we'd rather show "Données vent indisponibles" than a
  // forecast value that disagrees with the 48h history chart.

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            combineSchemas(
              buildArticleSchema(spot),
              buildPlaceSchema(spot),
              buildBreadcrumbSchema(
                spot.id,
                spot.name,
                spot.sportType,
                spot.region,
              ),
            ),
          ),
        }}
      />
      <SpotPageClient
        spot={JSON.parse(JSON.stringify(spot))}
        wind={wind}
        windSource={windSource}
      />
    </>
  );
}
