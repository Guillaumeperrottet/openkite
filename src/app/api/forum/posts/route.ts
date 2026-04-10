import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createPostSchema = z.object({
  topicId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  body: z.string().min(1).max(10000),
});

/** POST /api/forum/posts — create a reply */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = createPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const { topicId, parentId, body: postBody } = parsed.data;

  const topic = await prisma.forumTopic.findUnique({ where: { id: topicId } });
  if (!topic) {
    return NextResponse.json({ error: "Topic introuvable" }, { status: 404 });
  }
  if (topic.locked) {
    return NextResponse.json({ error: "Topic verrouillé" }, { status: 403 });
  }

  // Validate parentId if provided
  if (parentId) {
    const parent = await prisma.forumPost.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.topicId !== topicId) {
      return NextResponse.json(
        { error: "Parent introuvable" },
        { status: 404 },
      );
    }
  }

  // Ensure user exists
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

  const post = await prisma.forumPost.create({
    data: {
      body: postBody.trim(),
      authorId: user.id,
      topicId,
      parentId: parentId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
}
