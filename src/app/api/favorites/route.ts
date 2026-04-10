import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const toggleFavoriteSchema = z.object({
  spotId: z.string().min(1),
});

/**
 * GET /api/favorites — list current user's favorites
 * Returns spotIds[] for quick lookup.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ spotIds: [] });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { spotId: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    spotIds: favorites.map((f: { spotId: string }) => f.spotId),
  });
}

/**
 * POST /api/favorites — toggle a favorite
 * Body: { spotId: string }
 * If already favorited → remove. If not → add.
 * Returns { favorited: boolean }.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = toggleFavoriteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "spotId requis" },
      { status: 400 },
    );
  }
  const { spotId } = parsed.data;

  // Check if already favorited
  const existing = await prisma.favorite.findUnique({
    where: { userId_spotId: { userId: user.id, spotId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  // Ensure user exists in DB (auto-sync)
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    },
  });

  await prisma.favorite.create({
    data: { userId: user.id, spotId },
  });

  return NextResponse.json({ favorited: true });
}
