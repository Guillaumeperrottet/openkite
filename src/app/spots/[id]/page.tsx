import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fetchCurrentWind, fetchWindHistory } from "@/lib/wind";
import { fetchFullForecast } from "@/lib/forecast";
import { SpotPageClient } from "./SpotPageClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const spot = await prisma.spot.findUnique({
      where: { id },
      select: {
        name: true,
        country: true,
        region: true,
        difficulty: true,
        sportType: true,
        images: { select: { url: true }, take: 1 },
      },
    });
    if (!spot) return { title: "Spot introuvable" };
    const location = [spot.region, spot.country].filter(Boolean).join(", ");
    const sport = spot.sportType === "KITE" ? "kitesurf" : "parapente";
    const description = `Spot de ${sport} ${spot.name}${location ? ` à ${location}` : ""}. Vent en direct, prévisions 7 jours et archives historiques.`;
    return {
      title: spot.name,
      description,
      openGraph: {
        title: `${spot.name} — OpenKite`,
        description,
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
    spot = await prisma.spot.findUnique({
      where: { id },
      include: {
        images: true,
        reports: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  } catch {
    notFound();
  }

  if (!spot) notFound();

  // Fetch current wind + 7-day forecast + 48h history in parallel
  const [windResult, forecastResult, historyResult] = await Promise.allSettled([
    fetchCurrentWind(spot.latitude, spot.longitude),
    fetchFullForecast(spot.latitude, spot.longitude),
    fetchWindHistory(spot.latitude, spot.longitude),
  ]);

  return (
    <SpotPageClient
      spot={JSON.parse(JSON.stringify(spot))}
      wind={windResult.status === "fulfilled" ? windResult.value : null}
      forecast={
        forecastResult.status === "fulfilled" ? forecastResult.value : null
      }
      history={
        historyResult.status === "fulfilled" ? historyResult.value : null
      }
    />
  );
}
