import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const SPORT_FILTERS = ["ALL", "KITE", "PARAGLIDE"] as const;

/**
 * GET /api/preferences — return current user's preferences
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ sportFilter: "ALL", useKnots: true });
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    sportFilter: pref?.sportFilter ?? "ALL",
    useKnots: pref?.useKnots ?? true,
  });
}

/**
 * PATCH /api/preferences — update one or more preferences
 * Body: { sportFilter?: "ALL"|"KITE"|"PARAGLIDE", useKnots?: boolean }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.sportFilter !== undefined) {
    if (!SPORT_FILTERS.includes(body.sportFilter)) {
      return NextResponse.json(
        { error: "sportFilter invalide" },
        { status: 400 },
      );
    }
    data.sportFilter = body.sportFilter;
  }

  if (body.useKnots !== undefined) {
    if (typeof body.useKnots !== "boolean") {
      return NextResponse.json(
        { error: "useKnots doit être un booléen" },
        { status: 400 },
      );
    }
    data.useKnots = body.useKnots;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Rien à mettre à jour" },
      { status: 400 },
    );
  }

  // Ensure user exists in DB (auto-sync from Supabase Auth)
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

  const pref = await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return NextResponse.json({
    sportFilter: pref.sportFilter,
    useKnots: pref.useKnots,
  });
}
