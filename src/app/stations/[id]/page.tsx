import { notFound } from "next/navigation";
import { fetchMeteoSwissStations } from "@/lib/stations";
import { fetchPioupiouStations } from "@/lib/pioupiou";
import { fetchNetatmoStations } from "@/lib/netatmo";
import { fetchMeteoFranceStations } from "@/lib/meteofrance";
import {
  fetchWindHistory,
  fetchWindHistoryStation,
  fetchWindForecast15min,
} from "@/lib/wind";
import { fetchFullForecast } from "@/lib/forecast";
import { StationPageClient } from "./StationPageClient";

// No force-dynamic — params already makes this route dynamic.
// Removing it lets internal fetch() calls use their ISR cache (revalidate settings).

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const name = decodeURIComponent(id);
  const description = `Balise vent ${name} — vent en direct, historique 48h et prévisions 7 jours.`;
  return {
    title: `Station ${name}`,
    description,
    alternates: {
      canonical: `https://openwind.ch/stations/${encodeURIComponent(name)}`,
    },
    openGraph: {
      title: `Station ${name} — Openwind`,
      description,
      url: `https://openwind.ch/stations/${encodeURIComponent(name)}`,
      type: "website",
    },
  };
}

export default async function StationPage({ params }: Props) {
  const { id } = await params;
  const stationId = decodeURIComponent(id);

  // Fetch all 4 networks to find the station
  const [meteo, piou, ntm, mf] = await Promise.allSettled([
    fetchMeteoSwissStations(),
    fetchPioupiouStations(),
    fetchNetatmoStations(),
    fetchMeteoFranceStations(),
  ]);
  const allStations = [
    ...(meteo.status === "fulfilled" ? meteo.value : []),
    ...(piou.status === "fulfilled" ? piou.value : []),
    ...(ntm.status === "fulfilled" ? ntm.value : []),
    ...(mf.status === "fulfilled" ? mf.value : []),
  ];
  const station = allStations.find((s) => s.id === stationId);

  if (!station) notFound();

  // Fetch 7-day forecast + 48h history + 15-min forecast in parallel.
  // History: real MeteoSwiss 10-min measurements, falling back to Open-Meteo NWP.
  // Current wind + gusts come from the station data itself (no extra Open-Meteo call).
  const [forecastResult, historyResult, forecast15Result] =
    await Promise.allSettled([
      fetchFullForecast(station.lat, station.lng),
      fetchWindHistoryStation(station.id).catch(() =>
        fetchWindHistory(station.lat, station.lng),
      ),
      fetchWindForecast15min(station.lat, station.lng),
    ]);

  // Append 15-min forecast points after last history point
  const rawHistory =
    historyResult.status === "fulfilled" ? historyResult.value : null;
  const forecast15 =
    forecast15Result.status === "fulfilled" ? forecast15Result.value : [];
  let combinedHistory = rawHistory;
  if (rawHistory && rawHistory.length > 0 && forecast15.length > 0) {
    const lastTime = rawHistory[rawHistory.length - 1].time;
    const futurePoints = forecast15.filter((p) => p.time > lastTime);
    combinedHistory = [...rawHistory, ...futurePoints];
  }

  // Estimate gusts from station wind speed (~1.3× mean, standard approximation)
  const gustsKmh = Math.round(station.windSpeedKmh * 1.3);

  return (
    <StationPageClient
      station={station}
      gustsKmh={gustsKmh}
      openMeteoUpdatedAt={station.updatedAt}
      forecast={
        forecastResult.status === "fulfilled" ? forecastResult.value : null
      }
      history={combinedHistory}
    />
  );
}
