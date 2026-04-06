/**
 * Import worldwide kite/windsurf spots from scraped data (Windguru + OSM).
 *
 * Run:
 *   env $(grep -v '^#' .env | xargs) npx tsx prisma/import-worldwide.ts
 *
 * This script:
 * 1. Reads worldwide-spots.json (774 spots from Windguru + OSM)
 * 2. Skips spots that already exist in the database (by name OR proximity < 3km)
 * 3. Inserts new spots with sensible defaults
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

interface RawSpot {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  source: string;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Guess region from country for common cases */
function guessRegion(country: string): string | undefined {
  const regions: Record<string, string> = {
    France: "France",
    Spain: "Spain",
    Italy: "Italy",
    Greece: "Greece",
    Portugal: "Portugal",
    Netherlands: "Netherlands",
    Germany: "Germany",
    Croatia: "Croatia",
    Turkey: "Turkey",
    "United Kingdom": "United Kingdom",
    Denmark: "Denmark",
    Sweden: "Sweden",
    Norway: "Norway",
    Poland: "Poland",
    "Czech Republic": "Czech Republic",
    "United States": "United States",
    Canada: "Canada",
    Brazil: "Brazil",
    Australia: "Australia",
    Thailand: "Thailand",
    Mexico: "Mexico",
    Argentina: "Argentina",
    "South Africa": "South Africa",
    Egypt: "Egypt",
    Morocco: "Morocco",
    Israel: "Israel",
  };
  return regions[country];
}

/** Determine waterType from proximity to coast (rough heuristic) */
function guessWaterType(name: string): "FLAT" | "CHOP" | "WAVES" | "MIXED" {
  const lower = name.toLowerCase();
  if (
    lower.includes("lake") ||
    lower.includes("lac") ||
    lower.includes("lago") ||
    lower.includes("lagoon") ||
    lower.includes("laguna") ||
    lower.includes("dam") ||
    lower.includes("reservoir") ||
    lower.includes("river") ||
    lower.includes("étang") ||
    lower.includes("jezero") ||
    lower.includes("meer")
  ) {
    return "FLAT";
  }
  if (
    lower.includes("bay") ||
    lower.includes("baie") ||
    lower.includes("harbour") ||
    lower.includes("harbor")
  ) {
    return "CHOP";
  }
  if (
    lower.includes("ocean") ||
    lower.includes("atlantic") ||
    lower.includes("pacific")
  ) {
    return "WAVES";
  }
  return "CHOP"; // default — most kite spots are coastal with chop
}

async function main() {
  const raw: RawSpot[] = JSON.parse(
    readFileSync(join(__dirname, "worldwide-spots.json"), "utf-8"),
  );

  console.log(`📦 Loaded ${raw.length} spots from worldwide-spots.json`);

  // Get existing spots from DB
  const existing = await prisma.spot.findMany({
    select: { name: true, latitude: true, longitude: true },
  });
  console.log(`📍 ${existing.length} spots already in database`);

  let created = 0;
  let skipped = 0;

  for (const spot of raw) {
    // Skip if name already exists
    if (existing.some((e) => e.name === spot.name)) {
      skipped++;
      continue;
    }

    // Skip if too close to an existing spot (< 3km)
    const tooClose = existing.some(
      (e) =>
        haversineKm(spot.latitude, spot.longitude, e.latitude, e.longitude) <
        3.0,
    );
    if (tooClose) {
      skipped++;
      continue;
    }

    try {
      await prisma.spot.create({
        data: {
          name: spot.name,
          latitude: spot.latitude,
          longitude: spot.longitude,
          country: spot.country,
          region: guessRegion(spot.country),
          sportType: "KITE",
          waterType: guessWaterType(spot.name),
          difficulty: "INTERMEDIATE",
          minWindKmh: 15,
          maxWindKmh: 40,
          bestMonths: [],
          description: `Wind sport spot in ${spot.country}. Data sourced from ${spot.source === "osm" ? "OpenStreetMap" : "community contributions"}.`,
        },
      });

      // Add to existing list for proximity checks on subsequent spots
      existing.push({
        name: spot.name,
        latitude: spot.latitude,
        longitude: spot.longitude,
      });
      created++;
    } catch (err) {
      console.error(`  ✗ Failed to create "${spot.name}":`, err);
    }
  }

  console.log(
    `\n✅ Created ${created} new spots (${skipped} skipped as duplicates)`,
  );
  console.log(`📊 Total spots in database: ${existing.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
