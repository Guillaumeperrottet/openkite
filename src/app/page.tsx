import { prisma } from "@/lib/prisma";
import { KiteMap } from "@/components/map/KiteMap";
import type { Spot } from "@/types";

// ISR: spots change rarely — cache HTML for 10 min, revalidate in background.
// This eliminates a Prisma query on every single homepage load.
export const revalidate = 600;

export default async function HomePage() {
  let spots: Spot[] = [];
  try {
    const raw = await prisma.spot.findMany({ include: { images: true } });
    spots = raw.map((s: (typeof raw)[number]) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      images: s.images.map((img: (typeof s.images)[number]) => ({
        ...img,
        createdAt: img.createdAt.toISOString(),
      })),
    }));
  } catch (err) {
    console.error(
      "[HomePage] DB error:",
      err instanceof Error ? err.message : err,
    );
  }

  return (
    <div className="bg-white" style={{ height: "calc(100dvh - 56px)" }}>
      <h1 className="sr-only">
        Openwind — Balises vent en direct, carte des spots de kitesurf et
        parapente
      </h1>
      <KiteMap spots={spots} />
    </div>
  );
}
