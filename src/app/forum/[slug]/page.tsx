import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPageClient } from "./CategoryPageClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const cat = await prisma.forumCategory.findUnique({
      where: { slug },
      select: { name: true, description: true },
    });
    if (!cat) return { title: "Catégorie introuvable" };
    return {
      title: cat.name,
      description:
        cat.description || `Discussions ${cat.name} sur le forum Openwind.`,
      alternates: {
        canonical: `https://openwind.ch/forum/${slug}`,
      },
    };
  } catch {
    return { title: "Forum" };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const category = await prisma.forumCategory.findUnique({
    where: { slug },
  });

  if (!category) notFound();

  const topics = await prisma.forumTopic.findMany({
    where: { categoryId: category.id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { posts: true } },
      votes: { select: { value: true } },
    },
  });

  const enriched = topics.map((t: (typeof topics)[number]) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    pinned: t.pinned,
    locked: t.locked,
    author: t.author,
    postCount: t._count.posts,
    score: t.votes.reduce((s: number, v: { value: number }) => s + v.value, 0),
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <CategoryPageClient
      category={{
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      }}
      topics={enriched}
    />
  );
}
