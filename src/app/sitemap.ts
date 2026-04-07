import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://openwind.ch";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    {
      url: `${baseUrl}/plan`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/spots/new`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Dynamic spot pages
  let spotPages: MetadataRoute.Sitemap = [];
  try {
    const spots = await prisma.spot.findMany({
      select: { id: true, updatedAt: true },
    });
    spotPages = spots.map((spot) => ({
      url: `${baseUrl}/spots/${spot.id}`,
      lastModified: spot.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB unavailable — return static pages only
  }

  return [...staticPages, ...spotPages];
}
