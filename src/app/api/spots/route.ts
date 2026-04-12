import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSpotSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().optional(),
  region: z.string().optional(),
  difficulty: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"])
    .default("INTERMEDIATE"),
  waterType: z.enum(["FLAT", "CHOP", "WAVES", "MIXED"]).default("CHOP"),
  sportType: z.enum(["KITE", "PARAGLIDE"]).default("KITE"),
  minWindKmh: z.number().min(0).max(100).default(15),
  maxWindKmh: z.number().min(0).max(150).default(35),
  bestMonths: z.array(z.string()).default([]),
  bestWindDirections: z.array(z.string()).default([]),
  hazards: z.string().optional(),
  access: z.string().optional(),
  nearestStationId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = parseFloat(searchParams.get("radius") || "0");

  const spots = await prisma.spot.findMany({
    include: { images: true },
    orderBy: { createdAt: "desc" },
  });

  // If lat/lng/radius provided, filter by distance (haversine)
  if (lat && lng && radius > 0) {
    const lat0 = parseFloat(lat);
    const lng0 = parseFloat(lng);

    const nearby = spots
      .map((spot: (typeof spots)[number]) => {
        const dLat = toRad(spot.latitude - lat0);
        const dLng = toRad(spot.longitude - lng0);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat0)) *
            Math.cos(toRad(spot.latitude)) *
            Math.sin(dLng / 2) ** 2;
        const distanceKm =
          6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...spot, distanceKm };
      })
      .filter((s: { distanceKm: number }) => s.distanceKm <= radius)
      .sort(
        (a: { distanceKm: number }, b: { distanceKm: number }) =>
          a.distanceKm - b.distanceKm,
      );

    return NextResponse.json(nearby);
  }

  return NextResponse.json(spots);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSpotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const spot = await prisma.spot.create({
      data: parsed.data,
      include: { images: true },
    });
    revalidatePath("/");
    return NextResponse.json(spot, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P1001") {
      return NextResponse.json(
        { error: "Base de données injoignable — réessayez plus tard" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Erreur serveur lors de la création du spot" },
      { status: 500 },
    );
  }
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
