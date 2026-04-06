import { prisma } from "@/lib/prisma";
import { KiteMap } from "@/components/map/KiteMap";
import type { Spot } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let spots: Spot[] = [];
  try {
    const raw = await prisma.spot.findMany({ include: { images: true } });
    spots = raw.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      images: s.images.map((img) => ({
        ...img,
        createdAt: img.createdAt.toISOString(),
      })),
    }));
  } catch {
    // DB not yet configured — map shows empty
  }

  return (
    <div className="bg-white" style={{ height: "calc(100dvh - 56px)" }}>
      <KiteMap spots={spots} />
    </div>
  );
}
