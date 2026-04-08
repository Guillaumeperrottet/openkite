import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ForumPageClient } from "./ForumPageClient";

export const metadata: Metadata = {
  title: "Forum",
  description:
    "Forum communautaire Openwind — discussions sur les spots, le matos, le projet et entraide entre riders.",
  alternates: { canonical: "https://openwind.ch/forum" },
};

export default async function ForumPage() {
  const categories = await prisma.forumCategory.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { topics: true } },
      topics: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          author: { select: { name: true, avatarUrl: true } },
        },
      },
    },
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .filter(Boolean);
  const isAdmin = !!user && adminIds.includes(user.id);

  const serialized = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
    order: cat.order,
    topicCount: cat._count.topics,
    lastTopic: cat.topics[0]
      ? {
          title: cat.topics[0].title,
          authorName: cat.topics[0].author.name ?? "Anonyme",
        }
      : null,
  }));

  return <ForumPageClient categories={serialized} isAdmin={isAdmin} />;
}
