import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createTopicSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  categorySlug: z.string().min(1),
});

/** GET /api/forum/topics?category=slug&page=1 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const categorySlug = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;

  const where = categorySlug ? { category: { slug: categorySlug } } : {};

  const [topics, total] = await Promise.all([
    prisma.forumTopic.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        category: { select: { name: true, slug: true } },
        _count: { select: { posts: true, votes: true } },
        votes: { select: { value: true } },
      },
    }),
    prisma.forumTopic.count({ where }),
  ]);

  const enriched = topics.map((t: (typeof topics)[number]) => ({
    ...t,
    score: t.votes.reduce(
      (sum: number, v: { value: number }) => sum + v.value,
      0,
    ),
    votes: undefined,
  }));

  return NextResponse.json({
    topics: enriched,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

/** POST /api/forum/topics — create a topic */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = createTopicSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const { title, body: topicBody, categorySlug } = parsed.data;

  const category = await prisma.forumCategory.findUnique({
    where: { slug: categorySlug },
  });
  if (!category) {
    return NextResponse.json(
      { error: "Catégorie introuvable" },
      { status: 404 },
    );
  }

  // Ensure user exists in DB
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

  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const topic = await prisma.forumTopic.create({
    data: {
      title: title.trim(),
      slug: `${slug}-${Date.now().toString(36)}`,
      body: topicBody.trim(),
      authorId: user.id,
      categoryId: category.id,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      category: { select: { name: true, slug: true } },
    },
  });

  return NextResponse.json(topic, { status: 201 });
}
