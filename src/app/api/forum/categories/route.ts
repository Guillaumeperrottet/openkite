import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
});

function isAdmin(userId: string) {
  const ids = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  return ids.includes(userId);
}

export async function GET() {
  const categories = await prisma.forumCategory.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { topics: true } },
      topics: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { posts: true } },
        },
      },
    },
  });

  return NextResponse.json(categories);
}

/** POST /api/forum/categories — create category (admin only) */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = createCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const { name, description, icon } = parsed.data;

  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const maxOrder = await prisma.forumCategory.aggregate({
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const category = await prisma.forumCategory.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      icon: icon?.trim() || null,
      order,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
