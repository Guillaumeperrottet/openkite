import type { MonthStats, YearArchive, WindArchiveData } from "@/types";

const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";

/**
 * Fetch daily wind aggregates from Open-Meteo Historical Archive API.
 * Uses `daily` endpoint for efficiency (~365 rows/year vs 8760 hourly).
 */
async function fetchDailyArchive(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<{
  time: string[];
  windSpeedMax: number[];
  windGustsMax: number[];
  windDirDominant: number[];
} | null> {
  const url = new URL(ARCHIVE_BASE);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set(
    "daily",
    "wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 604800 } }); // cache 7 days
    if (!res.ok) return null;
    const data = await res.json();
    const d = data.daily;
    if (!d?.time) return null;
    return {
      time: d.time,
      windSpeedMax: d.wind_speed_10m_max,
      windGustsMax: d.wind_gusts_10m_max,
      windDirDominant: d.wind_direction_10m_dominant,
    };
  } catch {
    return null;
  }
}

/** Wind threshold (km/h) to count a day as "good" */
const GOOD_DAY_THRESHOLD = 15;

/**
 * Compute monthly stats from daily data for one year.
 */
function computeMonthStats(
  time: string[],
  windSpeedMax: number[],
  windGustsMax: number[],
  windDirDominant: number[],
): MonthStats[] {
  // Accumulate per month (index 0 = Jan ... 11 = Dec)
  const buckets: {
    speeds: number[];
    gusts: number[];
    dirs: number[];
    goodDays: number;
  }[] = Array.from({ length: 12 }, () => ({
    speeds: [],
    gusts: [],
    dirs: [],
    goodDays: 0,
  }));

  for (let i = 0; i < time.length; i++) {
    const m = new Date(time[i] + "T12:00:00").getMonth(); // 0-based
    const speed = windSpeedMax[i];
    const gust = windGustsMax[i];
    const dir = windDirDominant[i];
    if (speed == null || isNaN(speed)) continue;

    buckets[m].speeds.push(speed);
    buckets[m].gusts.push(gust ?? speed);
    if (dir != null && !isNaN(dir)) buckets[m].dirs.push(dir);
    if (speed >= GOOD_DAY_THRESHOLD) buckets[m].goodDays++;
  }

  return buckets.map((b, i) => {
    const n = b.speeds.length;
    if (n === 0) {
      return {
        month: i + 1,
        avgWindKmh: 0,
        avgGustsKmh: 0,
        maxWindKmh: 0,
        dominantDirection: 0,
        goodDaysPct: 0,
        dataDays: 0,
      };
    }
    return {
      month: i + 1,
      avgWindKmh:
        Math.round((b.speeds.reduce((a, v) => a + v, 0) / n) * 10) / 10,
      avgGustsKmh:
        Math.round((b.gusts.reduce((a, v) => a + v, 0) / n) * 10) / 10,
      maxWindKmh: Math.round(Math.max(...b.speeds) * 10) / 10,
      dominantDirection: dominantDir(b.dirs),
      goodDaysPct: Math.round((b.goodDays / n) * 100),
      dataDays: n,
    };
  });
}

/** Compute dominant (most common) wind direction from an array of degrees. */
function dominantDir(dirs: number[]): number {
  if (!dirs.length) return 0;
  // Bucket into 8 sectors (N, NE, E, SE, S, SW, W, NW)
  const sectors = new Array(8).fill(0);
  for (const d of dirs) {
    const idx = Math.round(d / 45) % 8;
    sectors[idx]++;
  }
  const maxIdx = sectors.indexOf(Math.max(...sectors));
  return maxIdx * 45;
}

/**
 * Fetch 5 years of wind archives for a spot and compute monthly stats.
 * Returns per-year and combined (averaged) data.
 */
export async function fetchWindArchives(
  lat: number,
  lng: number,
): Promise<WindArchiveData | null> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;
  const endYear = currentYear - 1; // Full years only (current year is incomplete)

  // Fetch all years in one request (Open-Meteo supports large date ranges)
  const raw = await fetchDailyArchive(
    lat,
    lng,
    `${startYear}-01-01`,
    `${endYear}-12-31`,
  );

  if (!raw || !raw.time.length) return null;

  // Split data by year
  const yearBuckets = new Map<
    number,
    { time: string[]; speeds: number[]; gusts: number[]; dirs: number[] }
  >();

  for (let i = 0; i < raw.time.length; i++) {
    const y = new Date(raw.time[i] + "T12:00:00").getFullYear();
    if (!yearBuckets.has(y)) {
      yearBuckets.set(y, { time: [], speeds: [], gusts: [], dirs: [] });
    }
    const b = yearBuckets.get(y)!;
    b.time.push(raw.time[i]);
    b.speeds.push(raw.windSpeedMax[i]);
    b.gusts.push(raw.windGustsMax[i]);
    b.dirs.push(raw.windDirDominant[i]);
  }

  // Compute per-year stats
  const years: YearArchive[] = [];
  for (const [year, data] of yearBuckets) {
    years.push({
      year,
      months: computeMonthStats(data.time, data.speeds, data.gusts, data.dirs),
    });
  }
  years.sort((a, b) => a.year - b.year);

  // Compute combined (average across years)
  const combined: MonthStats[] = Array.from({ length: 12 }, (_, m) => {
    const monthData = years
      .map((y) => y.months[m])
      .filter((ms) => ms.dataDays > 0);
    if (!monthData.length) {
      return {
        month: m + 1,
        avgWindKmh: 0,
        avgGustsKmh: 0,
        maxWindKmh: 0,
        dominantDirection: 0,
        goodDaysPct: 0,
        dataDays: 0,
      };
    }
    const n = monthData.length;
    return {
      month: m + 1,
      avgWindKmh:
        Math.round((monthData.reduce((s, d) => s + d.avgWindKmh, 0) / n) * 10) /
        10,
      avgGustsKmh:
        Math.round(
          (monthData.reduce((s, d) => s + d.avgGustsKmh, 0) / n) * 10,
        ) / 10,
      maxWindKmh:
        Math.round(Math.max(...monthData.map((d) => d.maxWindKmh)) * 10) / 10,
      dominantDirection: dominantDir(monthData.map((d) => d.dominantDirection)),
      goodDaysPct: Math.round(
        monthData.reduce((s, d) => s + d.goodDaysPct, 0) / n,
      ),
      dataDays: monthData.reduce((s, d) => s + d.dataDays, 0),
    };
  });

  const bestMonth =
    combined.reduce(
      (best, m, i) =>
        m.goodDaysPct > (combined[best]?.goodDaysPct ?? 0) ? i : best,
      0,
    ) + 1;

  return {
    years,
    combined,
    bestMonth,
    yearRange: [startYear, endYear],
  };
}
