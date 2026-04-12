import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWindData } from "@/lib/utils";
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
      if (latest && Date.now() - latest.time.getTime() < 30 * 60 * 1000) {
        wind = getWindData(
          latest.windSpeedKmh,
          latest.windDirection,
          latest.gustsKmh ?? Math.round(latest.windSpeedKmh * 1.3),
        );
        windSource = {
          name: spot.nearestStationId,
          network: NETWORK_LABELS[latest.source] ?? latest.source,
        };
      }
    } catch {
      /* DB error — wind stays null, client will fetch */
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
      />
    </>
  );
}
