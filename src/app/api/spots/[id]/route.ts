import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    country: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    difficulty: z
      .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"])
      .optional(),
    waterType: z.enum(["FLAT", "CHOP", "WAVES", "MIXED"]).optional(),
    sportType: z.enum(["KITE", "PARAGLIDE"]).optional(),
    minWindKmh: z.number().min(0).max(100).optional(),
    maxWindKmh: z.number().min(0).max(150).optional(),
    bestMonths: z.array(z.string()).optional(),
    bestWindDirections: z.array(z.string()).optional(),
    hazards: z.string().optional().nullable(),
    access: z.string().optional().nullable(),
    nearestStationId: z.string().optional().nullable(),
  })
  .refine(
    (d) =>
      d.maxWindKmh === undefined ||
      d.minWindKmh === undefined ||
      d.maxWindKmh >= d.minWindKmh,
    { message: "Le vent max doit être ≥ au vent min", path: ["maxWindKmh"] },
  );

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const spot = await prisma.spot.findUnique({
    where: { id },
    include: {
      images: true,
      reports: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!spot)
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  return NextResponse.json(spot);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.spot.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Spot introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const spot = await prisma.spot.update({
    where: { id },
    data: parsed.data,
    include: { images: true },
  });
  revalidatePath("/");
  return NextResponse.json(spot);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.spot.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Spot introuvable" }, { status: 404 });

  await prisma.spot.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
