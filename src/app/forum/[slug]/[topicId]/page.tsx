import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { TopicPageClient } from "./TopicPageClient";

interface Props {
  params: Promise<{ slug: string; topicId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug, topicId } = await params;
  try {
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { title: true, body: true, category: { select: { name: true } } },
    });
    if (!topic) return { title: "Sujet introuvable" };
    const desc =
      topic.body.length > 155 ? topic.body.slice(0, 152) + "…" : topic.body;
    return {
      title: topic.title,
      description: desc,
      alternates: {
        canonical: `https://openwind.ch/forum/${slug}/${topicId}`,
      },
      openGraph: {
        title: `${topic.title} — Forum Openwind`,
        description: desc,
        type: "article" as const,
      },
    };
  } catch {
    return { title: "Forum" };
  }
}

export default async function TopicPage({ params }: Props) {
  const { slug, topicId } = await params;

  const topic = await prisma.forumTopic.findUnique({
    where: { id: topicId },
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

  if (!topic || topic.category.slug !== slug) notFound();

  // Build tree
  interface PostNode {
    id: string;
    body: string;
    authorId: string;
    author: { id: string; name: string | null; avatarUrl: string | null };
    parentId: string | null;
    createdAt: string;
    score: number;
    votes: { value: number; userId: string }[];
    children: PostNode[];
  }

  const postMap = new Map<string, PostNode>();
  const roots: PostNode[] = [];

  for (const p of topic.posts) {
    postMap.set(p.id, {
      id: p.id,
      body: p.body,
      authorId: p.authorId,
      author: p.author,
      parentId: p.parentId,
      createdAt: p.createdAt.toISOString(),
      score: p.votes.reduce(
        (s: number, v: { value: number }) => s + v.value,
        0,
      ),
      votes: p.votes,
      children: [],
    });
  }

  for (const node of postMap.values()) {
    if (node.parentId && postMap.has(node.parentId)) {
      postMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const serialized = {
    id: topic.id,
    title: topic.title,
    slug: topic.slug,
    body: topic.body,
    pinned: topic.pinned,
    locked: topic.locked,
    authorId: topic.authorId,
    author: topic.author,
    category: topic.category,
    score: topic.votes.reduce(
      (s: number, v: { value: number }) => s + v.value,
      0,
    ),
    votes: topic.votes,
    createdAt: topic.createdAt.toISOString(),
    posts: roots,
  };

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .filter(Boolean);
  const isAdmin = !!authUser && adminIds.includes(authUser.id);

  return (
    <TopicPageClient topic={serialized} categorySlug={slug} isAdmin={isAdmin} />
  );
}
