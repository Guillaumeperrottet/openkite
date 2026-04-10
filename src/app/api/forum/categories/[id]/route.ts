import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
});

function isAdmin(userId: string) {
  const ids = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  return ids.includes(userId);
}

interface Ctx {
  params: Promise<{ id: string }>;
}

/** PATCH /api/forum/categories/[id] — edit category (admin only) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const cat = await prisma.forumCategory.findUnique({ where: { id } });
  if (!cat) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const raw = await req.json();
  const parsed = updateCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const { name, description, icon, order } = parsed.data;

  const data: {
    name?: string;
    slug?: string;
    description?: string | null;
    icon?: string | null;
    order?: number;
  } = {};

  if (typeof name === "string" && name.trim()) {
    data.name = name.trim();
    data.slug = name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  if (typeof description === "string") {
    data.description = description.trim() || null;
  }
  if (typeof icon === "string") {
    data.icon = icon.trim() || null;
  }
  if (typeof order === "number") {
    data.order = order;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const updated = await prisma.forumCategory.update({ where: { id }, data });
  return NextResponse.json(updated);
}

/** DELETE /api/forum/categories/[id] — delete category (admin only) */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const cat = await prisma.forumCategory.findUnique({ where: { id } });
  if (!cat) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  await prisma.forumCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
