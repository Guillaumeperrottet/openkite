import { NextRequest, NextResponse } from "next/server";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
/** Max locations per Open-Meteo request (free tier caps around 30). */
const SUB_BATCH = 25;
/** Pause between sequential sub-batches to avoid 429s (ms). */
const BATCH_DELAY = 500;

// ── Simple sliding-window rate limiter (per Vercel instance) ────────────
// Tracks Open-Meteo sub-batch calls to stay within free-tier limits.
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 80; // leave headroom below Open-Meteo's 600/min
const callTimestamps: number[] = [];

function canMakeCall(count: number): boolean {
  const now = Date.now();
  // Prune old entries
  while (callTimestamps.length > 0 && callTimestamps[0] < now - WINDOW_MS) {
    callTimestamps.shift();
  }
  return callTimestamps.length + count <= MAX_PER_WINDOW;
}

function recordCalls(count: number) {
  const now = Date.now();
  for (let i = 0; i < count; i++) callTimestamps.push(now);
}

/**
 * POST /api/wind/grid
 * Body: { lats: number[], lngs: number[] }
 *
 * Server-side proxy for batch wind requests to Open-Meteo.
 * Splits large requests into sub-batches fetched in parallel,
 * then merges results. Avoids CORS and benefits from Vercel caching.
 * Uses POST to handle large coordinate arrays that exceed URL length limits.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    lats?: number[];
    lngs?: number[];
  };
  const allLats = body.lats?.map(String);
  const allLngs = body.lngs?.map(String);

  if (!allLats?.length || !allLngs?.length) {
    return NextResponse.json(
      { error: "lats and lngs required" },
      { status: 400 },
    );
  }
  const n = Math.min(allLats.length, allLngs.length);

  if (n === 0) {
    return NextResponse.json({ error: "empty coordinates" }, { status: 400 });
  }

  // Rate-limit check: how many sub-batches would this request need?
  const subBatchCount = Math.ceil(n / SUB_BATCH);
  if (!canMakeCall(subBatchCount)) {
    return NextResponse.json(
      { error: "Rate limited — try again in a minute" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    // Split into sub-batches and fetch sequentially to respect Open-Meteo rate limits
    const results: unknown[] = new Array(n).fill(null);

    for (let i = 0; i < n; i += SUB_BATCH) {
      const end = Math.min(i + SUB_BATCH, n);
      const lats = allLats.slice(i, end).join(",");
      const lngs = allLngs.slice(i, end).join(",");
      const batchSize = end - i;

      const url = `${OPEN_METEO}?latitude=${lats}&longitude=${lngs}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh`;

      try {
        const res = await fetch(url, {
          next: { revalidate: 600 },
          signal: AbortSignal.timeout(8000),
        } as RequestInit);
        if (res.ok) {
          const raw: unknown = await res.json();
          const data = Array.isArray(raw) ? raw : [raw];
          for (let j = 0; j < Math.min(data.length, batchSize); j++) {
            results[i + j] = data[j];
          }
        } else {
          const text = await res.text().catch(() => "");
          console.error(
            `[/api/wind/grid] sub-batch ${i}–${end} failed: HTTP ${res.status} ${text.slice(0, 200)}`,
          );
        }
      } catch (err) {
        console.error(
          `[/api/wind/grid] sub-batch ${i}–${end} error:`,
          err instanceof Error ? err.message : err,
        );
      }

      // Small delay between batches to avoid hitting Open-Meteo's per-second limit
      if (i + SUB_BATCH < n) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    recordCalls(subBatchCount);

    // Check if we got at least some data
    const hasData = results.some((r) => r !== null);
    if (!hasData) {
      console.error("[/api/wind/grid] all sub-batches failed");
      return NextResponse.json(
        { error: "Wind grid data unavailable" },
        { status: 502 },
      );
    }

    // Return single object for 1 location, array for multiple (Open-Meteo compat)
    const response = n === 1 ? results[0] : results;
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[/api/wind/grid]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Wind grid data unavailable" },
      { status: 502 },
    );
  }
}
