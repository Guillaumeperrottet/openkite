import { notFound } from "next/navigation";
import { fetchMeteoSwissStations } from "@/lib/stations";
import {
  fetchCurrentWind,
  fetchWindHistory,
  fetchWindHistoryStation,
  fetchWindForecast15min,
} from "@/lib/wind";
import { fetchFullForecast } from "@/lib/forecast";
import { StationPageClient } from "./StationPageClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const name = decodeURIComponent(id);
  return {
    title: `Station ${name}`,
    description: `Station météo ${name} — vent en direct, historique 48h et prévisions 7 jours.`,
  };
}

export default async function StationPage({ params }: Props) {
  const { id } = await params;
  const stationId = decodeURIComponent(id);

  const stations = await fetchMeteoSwissStations();
  const station = stations.find((s) => s.id === stationId);

  if (!station) notFound();

  // Fetch Open-Meteo gusts + full 7-day forecast + 48h history + 15-min forecast in parallel.
  // History: real MeteoSwiss 10-min measurements, falling back to Open-Meteo NWP.
  const [openMeteoResult, forecastResult, historyResult, forecast15Result] =
    await Promise.allSettled([
      fetchCurrentWind(station.lat, station.lng),
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

  const gustsKmh =
    openMeteoResult.status === "fulfilled"
      ? openMeteoResult.value.gustsKmh
      : null;

  const openMeteoUpdatedAt =
    openMeteoResult.status === "fulfilled"
      ? (openMeteoResult.value.updatedAt ?? null)
      : null;

  return (
    <StationPageClient
      station={station}
      gustsKmh={gustsKmh}
      openMeteoUpdatedAt={openMeteoUpdatedAt}
      forecast={
        forecastResult.status === "fulfilled" ? forecastResult.value : null
      }
      history={combinedHistory}
    />
  );
}
