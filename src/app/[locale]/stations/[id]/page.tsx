import { notFound } from "next/navigation";
import {
  getStationFromCache,
  getStationLive,
  getStationHistory,
} from "@/lib/stationData";
import { fetchFullForecast } from "@/lib/forecast";
import { StationPageClient } from "./StationPageClient";

// No force-dynamic — params already makes this route dynamic.
// Removing it lets internal fetch() calls use their ISR cache (revalidate settings).

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id, locale } = await params;
  const name = decodeURIComponent(id);

  const stationTitle: Record<string, string> = {
    en: `Station ${name}`,
    de: `Station ${name}`,
    it: `Stazione ${name}`,
    fr: `Station ${name}`,
  };
  const stationDesc: Record<string, string> = {
    en: `Wind station ${name} — live wind, 48h history and 7-day forecasts.`,
    de: `Windstation ${name} — Live-Wind, 48h-Verlauf und 7-Tage-Vorhersagen.`,
    it: `Stazione vento ${name} — vento in diretta, storico 48h e previsioni 7 giorni.`,
    fr: `Balise vent ${name} — vent en direct, historique 48h et prévisions 7 jours.`,
  };
  const description = stationDesc[locale] ?? stationDesc.fr;
  const title = stationTitle[locale] ?? stationTitle.fr;
  const base = `https://openwind.ch`;
  const encodedId = encodeURIComponent(id);
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/stations/${encodedId}`,
      languages: {
        "x-default": `${base}/fr/stations/${encodedId}`,
        fr: `${base}/fr/stations/${encodedId}`,
        en: `${base}/en/stations/${encodedId}`,
        de: `${base}/de/stations/${encodedId}`,
        it: `${base}/it/stations/${encodedId}`,
      },
    },
    openGraph: {
      title: `${title} — Openwind`,
      description,
      url: `${base}/${locale}/stations/${encodedId}`,
      type: "website",
    },
  };
}

export default async function StationPage({ params }: Props) {
  const { id } = await params;
  const stationId = decodeURIComponent(id);

  // Look up station metadata from the 10-min cron snapshot — single DB query,
  // ~5× faster than re-fetching all 5 networks on every page hit.
  const station = await getStationFromCache(stationId);
  if (!station) notFound();

  // Fetch live wind, 48h history and 7-day forecast in parallel.
  // allowOpenMeteoFallback=false → show stale obs with isFresh=false badge
  // rather than an Open-Meteo estimate (page is dedicated to THIS station).
  const [liveResult, bundleResult, forecastResult] = await Promise.allSettled([
    getStationLive(stationId, {
      lat: station.lat,
      lng: station.lng,
      allowOpenMeteoFallback: false,
    }),
    getStationHistory(stationId, { lat: station.lat, lng: station.lng }),
    fetchFullForecast(station.lat, station.lng),
  ]);

  // StationPageClient still consumes a flat HistoryPoint[] — keep that contract
  // while Phase 4 hasn't migrated it to WindHistoryBundle.
  const bundle =
    bundleResult.status === "fulfilled" ? bundleResult.value : null;
  const history = bundle ? [...bundle.observations, ...bundle.forecast] : null;

  const live = liveResult.status === "fulfilled" ? liveResult.value : null;

  return (
    <StationPageClient
      station={station}
      live={live}
      forecast={
        forecastResult.status === "fulfilled" ? forecastResult.value : null
      }
      history={history}
    />
  );
}
