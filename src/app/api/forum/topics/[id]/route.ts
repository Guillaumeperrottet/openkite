import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateTopicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(50000).optional(),
  pinned: z.boolean().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/forum/topics/[id] — single topic with all posts */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  const topic = await prisma.forumTopic.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      category: { select: { id: true, name: true, slug: true } },
      votes: { select: { value: true, userId: true } },
      posts: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          votes: { select: { value: true, userId: true } },
        },
      },
    },
  });

  if (!topic) {
    return NextResponse.json({ error: "Topic introuvable" }, { status: 404 });
  }

  const topicScore = topic.votes.reduce(
    (s: number, v: { value: number }) => s + v.value,
    0,
  );

  // Build nested tree from flat posts
  interface PostNode {
    id: string;
    body: string;
    authorId: string;
    author: { id: string; name: string | null; avatarUrl: string | null };
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    score: number;
    votes: { value: number; userId: string }[];
    children: PostNode[];
  }

  const postMap = new Map<string, PostNode>();
  const roots: PostNode[] = [];

  for (const p of topic.posts) {
    const node: PostNode = {
      id: p.id,
      body: p.body,
      authorId: p.authorId,
      author: p.author,
      parentId: p.parentId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      score: p.votes.reduce(
        (s: number, v: { value: number }) => s + v.value,
        0,
      ),
      votes: p.votes,
      children: [],
    };
    postMap.set(p.id, node);
  }

  for (const node of postMap.values()) {
    if (node.parentId && postMap.has(node.parentId)) {
      postMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json({
    ...topic,
    score: topicScore,
    posts: roots,
  });
}

/** PATCH /api/forum/topics/[id] — edit own topic (title + body) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const topic = await prisma.forumTopic.findUnique({ where: { id } });
  if (!topic) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .filter(Boolean);
  const isAdmin = adminIds.includes(user.id);
  const isAuthor = topic.authorId === user.id;

  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = updateTopicSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const { title, body, pinned } = parsed.data;

  const data: {
    title?: string;
    body?: string;
    slug?: string;
    pinned?: boolean;
  } = {};
  // Author or admin can edit title/body
  if (isAuthor || isAdmin) {
    if (title) {
      data.title = title.trim();
      data.slug = title
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (body) {
      data.body = body.trim();
    }
  }
  // Only admin can pin
  if (pinned !== undefined && isAdmin) {
    data.pinned = pinned;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const updated = await prisma.forumTopic.update({ where: { id }, data });
  return NextResponse.json(updated);
}

/** DELETE /api/forum/topics/[id] — delete own topic */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const topic = await prisma.forumTopic.findUnique({ where: { id } });
  if (!topic) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .filter(Boolean);
  if (topic.authorId !== user.id && !adminIds.includes(user.id)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await prisma.forumTopic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
