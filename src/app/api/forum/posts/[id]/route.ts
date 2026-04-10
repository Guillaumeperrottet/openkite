import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updatePostSchema = z.object({
  body: z.string().min(1).max(10000),
});

/** PATCH /api/forum/posts/[id] — edit own post body */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const post = await prisma.forumPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .filter(Boolean);
  if (post.authorId !== user.id && !adminIds.includes(user.id)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = updatePostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const { body } = parsed.data;

  const updated = await prisma.forumPost.update({
    where: { id },
    data: { body: body.trim() },
  });
  return NextResponse.json(updated);
}

/** DELETE /api/forum/posts/[id] — delete own post */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const post = await prisma.forumPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .filter(Boolean);
  if (post.authorId !== user.id && !adminIds.includes(user.id)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await prisma.forumPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
