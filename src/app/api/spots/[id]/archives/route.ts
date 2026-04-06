import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchWindArchives } from "@/lib/archives";

/**
 * GET /api/spots/[id]/archives
 * Returns 5-year monthly wind statistics from the Open-Meteo Historical Archive API.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const spot = await prisma.spot.findUnique({
    where: { id },
    select: { latitude: true, longitude: true },
  });

  if (!spot) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  const data = await fetchWindArchives(spot.latitude, spot.longitude);

  if (!data) {
    return NextResponse.json(
      { error: "Archives indisponibles" },
      { status: 502 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
