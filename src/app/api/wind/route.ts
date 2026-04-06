import { NextRequest, NextResponse } from "next/server";
import { fetchCurrentWind } from "@/lib/wind";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 },
    );
  }

  try {
    const wind = await fetchCurrentWind(lat, lng);
    return NextResponse.json(wind, {
      headers: { "Cache-Control": "public, s-maxage=600" },
    });
  } catch {
    return NextResponse.json(
      { error: "Wind data unavailable" },
      { status: 502 },
    );
  }
}
