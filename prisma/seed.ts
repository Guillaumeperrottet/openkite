/**
 * Seed script — openkite spots
 * Source: letskite.ch/en (scraped manually, coordinates and descriptions verified)
 *
 * Run: npx tsx prisma/seed.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const spots = [
  // ─── Lake Geneva / kitesurf ────────────────────────────────────────────────
  {
    name: "Excenevex",
    latitude: 46.35,
    longitude: 6.359,
    country: "France",
    region: "Auvergne-Rhône-Alpes",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 70,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "Excenevex works with Bise, a North-North-East wind. The wind is on-shore and can be powerful — up to 40 knots or more. A channel is set up in summer so riders must navigate beyond 300 m and stay out of marked swimming areas.",
    hazards:
      "Kiteboarding banned 10:00–18:00 from June 15 to August 31. Stay outside the swimming corridor.",
    access:
      "Sandy beach on the south shore of Lake Geneva, park at the public beach.",
  },
  {
    name: "Boiron / Lake Geneva",
    latitude: 46.491,
    longitude: 6.48,
    country: "Switzerland",
    region: "Vaud",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 60,
    bestMonths: ["April", "May", "July"],
    description:
      "Small sand and pebble beach on the north shore of Lake Geneva near Rolle. The beach is significantly larger in winter when the lake level drops.",
    access: "Follow signs for Boiron beach from Rolle (VD).",
  },
  {
    name: "Corseaux / Lake Geneva",
    latitude: 46.468,
    longitude: 6.823,
    country: "Switzerland",
    region: "Vaud",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 60,
    bestMonths: ["April", "May", "June", "July"],
    description:
      "Kitesurf spot on Lake Geneva near Vevey. Limited information available — respect local regulations on the lake.",
    access: "Corseaux beach, Vevey area, VD.",
  },
  {
    name: "Promenthoux / Lake Geneva",
    latitude: 46.391,
    longitude: 6.27,
    country: "Switzerland",
    region: "Vaud",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 60,
    bestMonths: ["April", "May", "July"],
    description:
      "Promenthoux is a kitesurf spot on the north shore of Lake Geneva. It works mainly in south-west wind — the prevailing afternoon thermal in summer — and offers good exposure thanks to a small promontory jutting into the lake.",
    hazards:
      "Kitesurfing permitted April 1 – September 30 only on Lake Geneva.",
    access: "Promenthoux promontory between Rolle and Nyon, VD.",
  },
  {
    name: "Silvaplana",
    latitude: 46.455,
    longitude: 9.795,
    country: "Switzerland",
    region: "Graubünden",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 60,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Lake Silvaplana has been a kitesurfing spot since the very beginning of the sport. Surrounded by mountains with breathtaking views at 1800 m altitude. Wind typically picks up late morning or early afternoon. The grassy beach is easy to access but can get crowded on weekends.",
    hazards:
      "Bring a full wetsuit — the water is cold all year. Use larger kites due to altitude reducing kite performance.",
    access: "Campsite at the spot. Wild camping not tolerated in the region.",
  },
  {
    name: "Lac des Rousses",
    latitude: 46.509,
    longitude: 6.096,
    country: "France",
    region: "Bourgogne-Franche-Comté",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 60,
    bestMonths: ["March", "April", "May"],
    description:
      "Kitesurf spot in the Haut-Jura mountains at 1057 m altitude. The lake covers roughly 90 hectares in a rolling plateau landscape. In winter, when the lake freezes, the rideable area expands significantly for spectacular kite sessions on ice.",
    access:
      "From Geneva via the Col de la Faucille pass, then Les Rousses village. Follow signs for Lac des Rousses.",
  },
  // ─── Jura / snowkite ──────────────────────────────────────────────────────
  {
    name: "Les Rousses",
    latitude: 46.505,
    longitude: 6.092,
    country: "France",
    region: "Bourgogne-Franche-Comté",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 60,
    bestMonths: ["December", "January", "February"],
    description:
      "Snowkite spot located on the edge of Les Rousses lake on the Vallée de Joux side. You can ride towards the lake or along the forest edge. When the lake freezes, almost the entire plateau becomes rideable — vast flat terrain perfect for long runs.",
    access: "Col de la Faucille then Les Rousses village.",
  },
  {
    name: "Le Brassus – Vallée de Joux",
    latitude: 46.582445,
    longitude: 6.206861,
    country: "Switzerland",
    region: "Vaud",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 60,
    bestMonths: ["December", "January", "February"],
    description:
      "Snowkite spot in the Joux Valley, Vaud Jura, at about 1010 m altitude. The valley is a major snowkite destination in French-speaking Switzerland with vast flat snowy areas. Jura winds blow regularly and snow conditions are often good.",
    access: "Le Brassus village, Vallée de Joux.",
  },
  {
    name: "Lac de Joux",
    latitude: 46.639602,
    longitude: 6.287462,
    country: "Switzerland",
    region: "Vaud",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 12,
    maxWindKmh: 60,
    bestMonths: ["December", "January", "February"],
    description:
      "Not every winter, but when Lac de Joux freezes entirely it becomes a magnificent snowkite and ice-kite spot. The wind is relatively consistent and the surface is immense. On bare ice, use long race skis with sharp edges.",
    hazards:
      "Only rideable when the lake is frozen. Use a smaller kite on ice if the surface is slippery.",
  },
  // ─── Fribourg pre-Alps / snowkite ─────────────────────────────────────────
  {
    name: "Semsales",
    latitude: 46.548,
    longitude: 6.908,
    country: "Switzerland",
    region: "Fribourg",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 60,
    bestMonths: ["December", "January", "February"],
    description:
      "Semsales is a nice plateau at 850 m with a small hill that's very fun to ride. Located in a wind corridor with bise (north-easterly wind). Great backup spot when Le Niremont is in the fog.",
    access:
      "Semsales village, Canton of Fribourg, take D189 from Châtel-St-Denis.",
  },
  {
    name: "Le Niremont",
    latitude: 46.607,
    longitude: 7.014,
    country: "Switzerland",
    region: "Fribourg",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 12,
    maxWindKmh: 70,
    bestMonths: ["December", "January", "February", "March"],
    description:
      "Le Niremont is a well-known snowkite summit in the pre-Alps of Fribourg, offering exposed plateau terrain with strong and consistent winds. One of the go-to spots in the region.",
    access: "From Charmey or Jaun, hike or skin up to the Niremont plateau.",
  },
  {
    name: "Les Alpettes",
    latitude: 46.573497,
    longitude: 6.965461,
    country: "Switzerland",
    region: "Fribourg",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 60,
    bestMonths: ["December", "January", "February"],
    description:
      "Snowkite plateau at 1340 m in the Fribourg pre-Alps. Regular bise corridor makes it a reliable winter snowkite spot.",
    access: "Les Alpettes area, Fribourg pre-Alps.",
  },
  // ─── Neuchâtel / snowkite ─────────────────────────────────────────────────
  {
    name: "La Brévine",
    latitude: 46.967,
    longitude: 6.548,
    country: "Switzerland",
    region: "Neuchâtel",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 70,
    bestMonths: ["December", "January", "February"],
    description:
      "La Brévine holds temperature records — known as the 'Siberia of Switzerland'. Its open plateau at 1000 m offers large open spaces for snowkiting. The Lac des Taillières is also a riding option when frozen, though it can get very busy in winter.",
  },
  // ─── Bernese Oberland / snowkite ──────────────────────────────────────────
  {
    name: "Jaunpass",
    latitude: 46.599,
    longitude: 7.341,
    country: "Switzerland",
    region: "Berne",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 15,
    maxWindKmh: 80,
    bestMonths: ["December", "January", "February", "March"],
    description:
      "Snowkite spot at 1600 m on Jaunpass. The north side offers a nice slope for ridge soaring. The dome at the summit allows you to play in all directions.",
    hazards:
      "Do NOT ride down the south slope — a power line is located just below the summit. Stay on the north side.",
    access: "Jaunpass road (Jaun-Brünig), park at the summit area.",
  },
  // ─── Valais / snowkite ────────────────────────────────────────────────────
  {
    name: "Grimselpass",
    latitude: 46.57,
    longitude: 8.333,
    country: "Switzerland",
    region: "Valais",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 15,
    maxWindKmh: 90,
    bestMonths: ["January", "February", "March"],
    description:
      "High-altitude snowkite spot at Grimselpass (2165 m) in Valais. Exposed alpine terrain with strong and gusty winds — a challenging and rewarding spot for experienced snowkiters.",
    hazards:
      "Very exposed alpine terrain, strong wind gusts. Only for experienced riders.",
    access:
      "Grimselpass road (closed in winter — access on foot/snowmobile from the valley).",
  },
  // ─── Auvergne-Rhône-Alpes / snowkite ─────────────────────────────────────
  {
    name: "Le Salève",
    latitude: 46.134534,
    longitude: 6.181165,
    country: "France",
    region: "Auvergne-Rhône-Alpes",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 80,
    bestMonths: ["December", "January", "February", "March"],
    description:
      "Large plateau at 1375 m with a 360° panoramic view — works in all wind directions except South. Close to Geneva and relatively accessible in winter.",
    hazards:
      "Wind can become very strong — if gusts are extreme, use the fallback spot at St-Blaise (FR). Do not leave valuables visible in cars.",
    access:
      "From Geneva via Annemasse or Le Coin above Collonge-sur-Salève. Also accessible via La Croisette from Cruseilles or via La Muraz after Reignier.",
  },
  {
    name: "Crozet Lelex",
    latitude: 46.295854,
    longitude: 5.971181,
    country: "France",
    region: "Auvergne-Rhône-Alpes",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 12,
    maxWindKmh: 70,
    bestMonths: ["December", "January", "February", "March"],
    description:
      "One of the most beautiful snowkite touring spots in the region at 1500 m. Features flat areas, slopes, valleys and steep sections. The summit of Colomby de Gex marks the far end of the riding area.",
    hazards:
      "Access via Col de la Faucille is now forbidden — launch only from Colomby de Gex summit. Riding area restricted by prefectural decree.",
    access: "Via the Crozet-Lelex ski resort.",
  },

  // ─── WORLD-CLASS SPOTS ────────────────────────────────────────────────────

  // Europe
  {
    name: "Tarifa",
    latitude: 36.0144,
    longitude: -5.6014,
    country: "Spain",
    region: "Andalusia",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 20,
    maxWindKmh: 80,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "The wind capital of Europe and one of the most iconic kitesurf destinations in the world. Tarifa sits at the strait between the Atlantic and the Mediterranean, where two dominant winds alternate: the Levante (easterly, powerful and warm) and the Poniente (westerly, fresh Atlantic breeze). Both produce ideal kite conditions — sometimes too powerful, but always consistent. The town itself is lively and has a strong kite culture all year round.",
    hazards:
      "Levante can be dangerously strong (40+ knots). Currents in the strait are serious — stay inside the bay in doubt. Watch for swimmers and windsurfers at Valdevaqueros.",
    access:
      "Playa de Los Lances and Valdevaqueros are the main launch spots. 20 min from Algeciras, direct buses from Málaga. Many kite schools on-site.",
  },
  {
    name: "Fuerteventura – Sotavento",
    latitude: 28.1833,
    longitude: -14.2333,
    country: "Spain",
    region: "Canary Islands",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September", "October"],
    description:
      "Sotavento lagoon is one of the most famous flat-water kite spots on the planet — host of the annual Kite World Cup. The natural lagoon provides pristine flat water conditions thanks to a sand bar protecting it from Atlantic swells. NE trade winds blow with remarkable consistency from June to October, making it a paradise for freestylers and foilers alike.",
    hazards:
      "Shallow lagoon — watch for submerged sand bars. Can get very crowded during the World Cup period. Sharp drop-off at the lagoon edge.",
    access:
      "Costa Calma, south Fuerteventura. The Sotavento beach hotel sits right at the spot. Regular flights from mainland Spain and Europe to El Matorral airport.",
  },
  {
    name: "Essaouira",
    latitude: 31.5125,
    longitude: -9.7692,
    country: "Morocco",
    region: "Marrakech-Safi",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 20,
    maxWindKmh: 65,
    bestMonths: ["April", "May", "June", "July", "August"],
    description:
      "Known as the 'Wind City of Africa', Essaouira has been a kitesurfing hotspot since the early days of the sport. The Alizé wind — a NNE trade wind — blows almost daily from spring to late summer, often reaching 30+ knots in the afternoon. The town is a beautiful UNESCO World Heritage medina and adds a unique cultural experience to the kite trip.",
    hazards:
      "Choppy conditions and strong gusts in summer afternoons. Rocky entry points — use the designated sandy launch spots south of the medina.",
    access:
      "Sidi Kaouki and the main beach south of the ramparts. Domestic flights to Essaouira Mogador Airport from Casablanca or Marrakech.",
  },
  {
    name: "Dakhla Lagoon",
    latitude: 23.7136,
    longitude: -15.937,
    country: "Morocco",
    region: "Dakhla-Oued Ed-Dahab",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: [
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
    ],
    description:
      "Dakhla is arguably the best flat-water kite spot in the world. A vast 40 km lagoon sheltered from Atlantic swells by a sand spit, with consistent NNE trade winds blowing almost every day of the year. Knee-deep clear water, no obstacles, warm temperatures — the perfect setting for beginners learning upwind riding and for advanced riders perfecting unhooked tricks and foiling.",
    hazards:
      "Shallow sandy bottom but long swims possible in offshore gusts. Some jellyfish in summer. Strong midday heat — apply sunscreen.",
    access:
      "Multiple kite camps along the lagoon road south of Dakhla town. Flights to Dakhla Airport from Casablanca or charter from Europe.",
  },

  // Americas
  {
    name: "Cabarete",
    latitude: 19.7481,
    longitude: -70.4095,
    country: "Dominican Republic",
    region: "Puerto Plata",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
    ],
    description:
      "Cabarete is the kitesurf capital of the Caribbean. The bay is lined with kite schools and bars, and the Atlantic trade winds blow reliably side-on from late morning to sunset. The semi-enclosed bay provides manageable chop for beginners while the outer reef section offers waves for advanced riders. The town has an infectious party vibe and a large expat kite community.",
    hazards:
      "Crowded water in peak season — keep distance from swimmers. Reef at the eastern end of the bay. Late afternoon gusty conditions possible.",
    access:
      "Kite Beach is a 5 min walk east of the town center. International flights to Puerto Plata (POP) or Santiago de los Caballeros (STI). 1h drive to Cabarete.",
  },
  {
    name: "Cumbuco",
    latitude: -3.6286,
    longitude: -38.7473,
    country: "Brazil",
    region: "Ceará",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["July", "August", "September", "October", "November"],
    description:
      "Cumbuco is Brazil's most popular kitesurf destination, just 30 min north of Fortaleza. The SE Alísios trade wind blows from July to December with incredible consistency — often 20–30 knots every single day. A natural lagoon (Lagoa do Cauípe) provides flat-water conditions ideal for freestyle, while the main beach offers wave riding. Warm water, tropical setting, affordable.",
    hazards:
      "Strong thermal amplification in the afternoon. Fishing boats near the beach — stay alert. Tidal lagoon access changes with the tide.",
    access:
      "30 km north of Fortaleza (FOR) airport, 45 min drive. Dozens of kite schools at the beach.",
  },
  {
    name: "Jericoacoara",
    latitude: -2.7961,
    longitude: -40.5125,
    country: "Brazil",
    region: "Ceará",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["July", "August", "September", "October", "November"],
    description:
      "Jericoacoara ('Jeri') is one of the world's most beautiful kite destinations — a remote village in the dunes of northeast Brazil with no paved roads. The SE trade winds power long downwinders across turquoise lagoons. The spectacular Lagoa do Paraíso (a freshwater lagoon surrounded by dunes) and Lagoa Azul offer world-class flat-water sessions. The famous sunsets over the dune are a daily ritual.",
    hazards:
      "Remote location — medical care limited. Sandstorms reduce visibility. Lagoon access requires quad or buggy transport.",
    access:
      "4h bus from Fortaleza or domestic flight to Jijoca de Jericoacoara (JJD). Last 20 km via 4WD only on beach and dune tracks.",
  },
  {
    name: "Hood River – Columbia River Gorge",
    latitude: 45.7054,
    longitude: -121.5218,
    country: "United States",
    region: "Oregon",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 18,
    maxWindKmh: 70,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Hood River in the Columbia River Gorge is widely regarded as the windsurf and kitesurf capital of North America. The unique geography — a deep river canyon acting as a wind tunnel between the Cascade Mountains — produces world-class thermal winds every summer afternoon. The river chop is challenging, with strong currents and cold water, making this a spot for experienced riders.",
    hazards:
      "Very strong currents — getting back upwind is crucial. Cold water year-round (wetsuit mandatory). Shallow rock hazards near shore. Heavy boat traffic on weekends.",
    access:
      "Event Site launch area in Hood River, Oregon. Closest airport: Portland (PDX), 1h15 drive east on I-84.",
  },
  {
    name: "Maui – Kite Beach (Kanaha)",
    latitude: 20.8984,
    longitude: -156.4305,
    country: "United States",
    region: "Hawaii",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "Kanaha Beach Park (Kite Beach) in Maui is where many of the world's top kiters train. The NE trade winds are remarkably consistent, reliable side-on shore, with warm water and a dramatic backdrop of the West Maui Mountains. Plenty of room to kite, separate from the windsurfers at Ho'okipa to the east. The vibe is competitive but welcoming.",
    hazards:
      "Strong trades can catch beginners off-guard. Coral reef offshore in some areas. North shore of Maui has swell — always check surf reports before riding Ho'okipa.",
    access:
      "Kanaha Beach Park, just north of Kahului Airport (OGG). Multiple rental and lesson operations at the beach.",
  },

  // Africa & Indian Ocean
  {
    name: "Le Morne – Mauritius",
    latitude: -20.4572,
    longitude: 57.3131,
    country: "Mauritius",
    region: "Black River",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["June", "July", "August", "September", "October", "November"],
    description:
      "Le Morne Lagoon on the southwestern tip of Mauritius is a world-famous flat-water kite paradise. The natural coral reef creates a massive, sheltered lagoon with crystal-clear turquoise water, knee-deep in the famous 'One Eye' section. The consistent SE trade winds make it ideal year-round, with the southern hemisphere winter (June–November) being peak season. The iconic basalt peak of Le Morne Brabant provides a stunning backdrop.",
    hazards:
      "One Eye is a world-class wave spot (not the lagoon) — expert surfers only. Very shallow reef sections at low tide. Strong Malabar current on the outer reef.",
    access:
      "Le Morne Village, Black River district. 1h from Sir Seewoosagur Ramgoolam International Airport (MRU). Numerous kite schools and resorts on-site.",
  },
  {
    name: "Paje Beach – Zanzibar",
    latitude: -6.2737,
    longitude: 39.5311,
    country: "Tanzania",
    region: "Zanzibar",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 40,
    bestMonths: ["June", "July", "August", "September", "January", "February"],
    description:
      "Paje Beach on the east coast of Zanzibar is one of Africa's most sought-after kite destinations. A wide, shallow coral-sand flat extends hundreds of metres offshore at low tide, offering pristine flat-water conditions. Two Kaskazi (NE) and Kusi (SE) monsoon seasons provide reliable wind twice a year. The laid-back Swahili village atmosphere, white sand, and warm Indian Ocean water make it an irresistible destination.",
    hazards:
      "Access to the flat restricted at high tide. Sea urchins on the reef edge. Boat traffic from local fishing dhows. Wind can drop suddenly during transition seasons.",
    access:
      "50 km south of Stone Town (Zanzibar City) on the east coast. 1h30 drive on tarmac road. Flights to Zanzibar (ZNZ) from Dar es Salaam, Nairobi, and direct from Europe.",
  },
  {
    name: "Langebaan Lagoon",
    latitude: -33.0833,
    longitude: 18.0323,
    country: "South Africa",
    region: "Western Cape",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 18,
    maxWindKmh: 60,
    bestMonths: [
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
    ],
    description:
      "Langebaan Lagoon in the West Coast National Park is one of South Africa's top kitesurf spots. The 'Cape Doctor' — the famous SE wind — blows with great consistency from spring to autumn, often 25–35 knots. The sheltered lagoon provides flat water protected from ocean swell. The national park setting is beautiful with abundant birdlife and clear blue water.",
    hazards:
      "Very strong Cape Doctor — 9m kites common. Cold Atlantic water (15°C). The outer beaches have strong currents. Entrance fee to the national park.",
    access:
      "1.5h drive north of Cape Town. Club Mykonos / Club Shaka kite area on the western shore of the lagoon.",
  },
  {
    name: "El Gouna – Red Sea",
    latitude: 27.3949,
    longitude: 33.6867,
    country: "Egypt",
    region: "Red Sea",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: [
      "January",
      "February",
      "March",
      "October",
      "November",
      "December",
    ],
    description:
      "El Gouna is a world-class kite resort town on Egypt's Red Sea coast — often called 'the Venice of the Red Sea' for its canal system and islands. The local kite spot features butter-flat warm water in a sheltered lagoon, consistent NW thermal winds, and incredibly clear visibility. The flat water and manageable conditions make it one of the best destinations in the world to learn kitesurfing. The town itself is a beautifully maintained resort.",
    hazards:
      "Boat traffic in the lagoon channels. Some areas restricted due to coral. Sun is intense — protection essential.",
    access:
      "5 km from Hurghada International Airport (HRG). Regular charter flights from Europe. Numerous kite centers operate from the lagoon beach.",
  },

  // Asia-Pacific
  {
    name: "Mui Ne",
    latitude: 10.9333,
    longitude: 108.2833,
    country: "Vietnam",
    region: "Bình Thuận",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: [
      "November",
      "December",
      "January",
      "February",
      "March",
      "April",
    ],
    description:
      "Mui Ne in southern Vietnam is Southeast Asia's most established kitesurf destination. The NE monsoon from November to April delivers reliable side-shore winds, warm water (28°C), and golden sand dunes as a backdrop. The kite area is a long beach stretch with multiple schools and camps. Affordable, accessible, and with a strong international kite community.",
    hazards:
      "Fishing boats use the same area — stay alert especially in the morning. Choppy conditions can develop quickly with strong NE wind. Season ends abruptly in May when SW monsoon brings rain.",
    access:
      "200 km from Ho Chi Minh City (SGN), 4h by bus or 40 min by domestic flight to Phan Thiet Airport.",
  },
  {
    name: "Boracay – Bulabog Beach",
    latitude: 11.9674,
    longitude: 121.9249,
    country: "Philippines",
    region: "Aklan",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["November", "December", "January", "February", "March"],
    description:
      "Bulabog Beach on Boracay's sheltered east coast is the dedicated kitesurf side of this famous island. The Amihan (NE) season from November to March brings consistent 15–25 knot winds across a shallow coral-sand flat, making it an ideal kitesurf destination. Vibrant nightlife on the opposite White Beach and world-class cuisine add to the appeal.",
    hazards:
      "Water sports zones are regulated — stay in designated kite areas. Coral heads visible in light wind — use booties. Habagat (SW monsoon) season is rainy and not suitable for kitesurfing.",
    access:
      "Fly to Caticlan Airport (MPH) or Kalibo (KLO). Short boat transfer to Boracay Island. Bulabog Beach is a 5 min trike ride from the main pier.",
  },
  {
    name: "Kalpitiya",
    latitude: 8.2321,
    longitude: 79.7447,
    country: "Sri Lanka",
    region: "North Western Province",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: [
      "May",
      "June",
      "July",
      "August",
      "September",
      "January",
      "February",
      "March",
    ],
    description:
      "Kalpitiya on Sri Lanka's northwest coast is a rising star in the kitesurf world. Two separate wind seasons — the SW monsoon (May–October) and NE monsoon (December–March) — offer nearly year-round riding. The lagoon behind the sand spit provides pristine flat water at waist depth, while the beach side offers wave sessions. Dolphins, whale sharks, and spectacular sunsets make it one of the most unique kite destinations on earth.",
    hazards:
      "Remote location. Medical facilities limited. Strong current on the outer sandbar. Wind can be gusty close to the lagoon entrance.",
    access:
      "3h drive north of Colombo (CMB). Colombo has direct flights from Europe, Middle East, and Asia. Kite camps provide transfers from the city.",
  },

  // Oceania
  {
    name: "Perth – Safety Bay",
    latitude: -32.3188,
    longitude: 115.7469,
    country: "Australia",
    region: "Western Australia",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["November", "December", "January", "February", "March"],
    description:
      "Safety Bay near Perth is one of Australia's premier kitesurf spots, powered by the legendary 'Fremantle Doctor' — a sea breeze that kicks in reliably every afternoon from October to April. The sheltered south-facing bay provides flat water protected from ocean swell. The conditions are ideal for learning and freestyle tricks. The beach is pristine and uncrowded on weekdays.",
    hazards:
      "The Doctor can blow 30+ knots with little warning. Keep clear of the swimming zones. Jellyfish (bluebottles) present in summer.",
    access:
      "45 km south of Perth CBD, 30 min drive from Perth Airport (PER). Public beach with parking.",
  },

  // ─── FRANCE ───────────────────────────────────────────────────────────────

  {
    name: "Leucate – La Franqui",
    latitude: 42.9271,
    longitude: 3.0373,
    country: "France",
    region: "Occitanie",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 70,
    bestMonths: ["March", "April", "May", "June", "September", "October"],
    description:
      "Leucate est le spot de kite le plus célèbre de France, surnommé la capitale européenne du vent. Deux vents dominent : la Tramontane (NW, puissant et régulier) et le Marin (SE, chaud). La plage de La Franqui et l'étang de Leucate offrent des conditions variées — vagues côté mer, flat sur l'étang.",
    hazards:
      "La Tramontane peut dépasser 50 nœuds. Courants forts côté mer. Zone de baignade à respecter en été.",
    access:
      "Leucate-Plage ou La Franqui, Aude. Autoroute A9 sortie Leucate. Nombreuses écoles sur place.",
  },
  {
    name: "Almanarre – Hyères",
    latitude: 43.0578,
    longitude: 6.1192,
    country: "France",
    region: "Provence-Alpes-Côte d'Azur",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: [
      "March",
      "April",
      "May",
      "June",
      "September",
      "October",
      "November",
    ],
    description:
      "L'Almanarre est l'un des meilleurs spots de flat en Méditerranée française. La presqu'île de Giens crée un plan d'eau protégé avec du flat parfait. Le Mistral (NW) souffle régulièrement et fort. Spot idéal pour le freestyle et le foil.",
    hazards:
      "Mistral parfois très puissant (+40 nœuds). Fond vaseux par endroits.",
    access:
      "Plage de l'Almanarre, Hyères, Var. Parking le long de la route. Nombreuses écoles de kite.",
  },
  {
    name: "Gruissan",
    latitude: 43.1068,
    longitude: 3.1195,
    country: "France",
    region: "Occitanie",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 65,
    bestMonths: ["March", "April", "May", "June", "September", "October"],
    description:
      "Gruissan plage des Chalets et les étangs environnants offrent d'excellentes conditions kite. La Tramontane souffle très régulièrement. L'étang de Gruissan propose du flat parfait pour les débutants, tandis que la plage côté mer offre du chop et des vagues.",
    access:
      "Gruissan, Aude. Accès par la D332 depuis Narbonne. Parking aux Chalets.",
  },
  {
    name: "Les Saintes-Maries-de-la-Mer – Camargue",
    latitude: 43.4537,
    longitude: 4.4283,
    country: "France",
    region: "Provence-Alpes-Côte d'Azur",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 65,
    bestMonths: ["March", "April", "May", "June", "September", "October"],
    description:
      "La plage Est des Saintes-Maries est le spot kite de Camargue par excellence. Exposée au Mistral (NW) qui souffle fort et régulier, la plage immense offre beaucoup d'espace. Paysage unique entre mer et marais.",
    hazards: "Courant latéral. Mistral parfois violent. Moustiques en été.",
    access: "Plage Est, Saintes-Maries-de-la-Mer. Route D570 depuis Arles.",
  },
  {
    name: "Port-Saint-Louis-du-Rhône – Napoléon",
    latitude: 43.3553,
    longitude: 4.8187,
    country: "France",
    region: "Provence-Alpes-Côte d'Azur",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 65,
    bestMonths: ["March", "April", "May", "September", "October", "November"],
    description:
      "Le spot Napoléon à Port-Saint-Louis offre un plan d'eau plat dans l'étang, exposé au Mistral. Un des meilleurs spots de flat du sud de la France, très prisé des freestylers.",
    access: "Port-Saint-Louis-du-Rhône, plage Napoléon. Bouches-du-Rhône.",
  },
  {
    name: "Arcachon – La Salie",
    latitude: 44.548,
    longitude: -1.211,
    country: "France",
    region: "Nouvelle-Aquitaine",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "Spot de vagues sur la côte atlantique au sud d'Arcachon. Conditions ocean avec du bon swell et un vent de NW régulier. Réservé aux riders confirmés à cause des vagues et des courants.",
    hazards:
      "Fortes vagues, courants de baïne, shore break puissant. Niveau avancé requis.",
    access: "Plage de La Salie, au sud du bassin d'Arcachon. Gironde.",
  },
  {
    name: "Noirmoutier – La Guérinière",
    latitude: 46.9618,
    longitude: -2.2491,
    country: "France",
    region: "Pays de la Loire",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "L'île de Noirmoutier offre plusieurs spots de kite dont La Guérinière côté baie pour le flat, et la côte ouest pour les vagues. Vent régulier d'ouest/nord-ouest en été.",
    access:
      "Île de Noirmoutier, Vendée. Accès par le pont ou le passage du Gois à marée basse.",
  },
  {
    name: "Île de Ré – Les Portes",
    latitude: 46.2498,
    longitude: -1.5048,
    country: "France",
    region: "Nouvelle-Aquitaine",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "La pointe des Portes-en-Ré offre un plan d'eau plat formé par la flèche de sable, idéal pour les débutants et le freestyle. Vent thermique régulier l'été.",
    access:
      "Les Portes-en-Ré, extrémité nord de l'île de Ré. Charente-Maritime.",
  },
  {
    name: "Presqu'île de Giens – Plage de La Bergerie",
    latitude: 43.0383,
    longitude: 6.1192,
    country: "France",
    region: "Provence-Alpes-Côte d'Azur",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["March", "April", "May", "October", "November"],
    description:
      "La Bergerie est le pendant wave de l'Almanarre, de l'autre côté de la presqu'île de Giens. Exposée au vent d'Est, elle offre du chop et de petites vagues. Idéal en complément de l'Almanarre selon la direction du vent.",
    access: "Presqu'île de Giens, Hyères. Parking plage de la Bergerie.",
  },
  {
    name: "Fréjus – Saint-Aygulf",
    latitude: 43.4119,
    longitude: 6.7389,
    country: "France",
    region: "Provence-Alpes-Côte d'Azur",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["March", "April", "May", "October", "November"],
    description:
      "Spot de kite sur la plage de Saint-Aygulf à Fréjus. Fonctionne en Mistral (NW) et vent d'Est. Conditions chop en mer.",
    access: "Plage de Saint-Aygulf, Fréjus, Var.",
  },
  {
    name: "Saint-Laurent-du-Var",
    latitude: 43.6575,
    longitude: 7.195,
    country: "France",
    region: "Provence-Alpes-Côte d'Azur",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["October", "November", "March", "April"],
    description:
      "Spot de kite à l'embouchure du Var, entre Nice et Antibes. Fonctionne principalement en vent d'Est (marin). Conditions chop, parfois de la houle.",
    access: "Embouchure du Var, Saint-Laurent-du-Var, Alpes-Maritimes.",
  },
  {
    name: "Naussac – Lac de Naussac",
    latitude: 44.7354,
    longitude: 3.8343,
    country: "France",
    region: "Occitanie",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 50,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "Le lac de Naussac en Lozère est un spot de flat d'altitude (960 m). Vent régulier grâce à l'effet venturi du col. Cadre naturel magnifique.",
    access: "Lac de Naussac, Langogne, Lozère. Base nautique sur place.",
  },
  {
    name: "Quiberon – Port Haliguen",
    latitude: 47.4818,
    longitude: -3.0997,
    country: "France",
    region: "Bretagne",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "La presqu'île de Quiberon offre des spots variés selon la direction du vent : côte sauvage pour les waves (W), baie de Quiberon pour le chop et flat (E/NE). Vent régulier toute l'année.",
    access: "Presqu'île de Quiberon, Morbihan. Accès par la D768.",
  },
  {
    name: "La Palme",
    latitude: 42.9709,
    longitude: 3.0181,
    country: "France",
    region: "Occitanie",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 65,
    bestMonths: ["March", "April", "May", "June", "September", "October"],
    description:
      "L'étang de La Palme est un des meilleurs spots de flat du Languedoc-Roussillon, juste au nord de Leucate. Eau peu profonde, Tramontane régulière. Idéal débutants et freestyle.",
    access: "La Palme, Aude. Accès par la D709 depuis Leucate ou Sigean.",
  },
  {
    name: "La Baule – Pornichet",
    latitude: 47.2814,
    longitude: -2.345,
    country: "France",
    region: "Pays de la Loire",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "Grande baie de La Baule avec plusieurs spots : Pornichet pour le kite en vent d'ouest, Le Pouliguen côté waves. Vent thermique régulier en été.",
    access: "La Baule-Pornichet, Loire-Atlantique.",
  },

  // ─── SPAIN (hors Tarifa et Fuerteventura déjà existants) ──────────────────

  {
    name: "Delta del Ebro – Els Eucaliptus",
    latitude: 40.726,
    longitude: 0.8586,
    country: "Spain",
    region: "Catalonia",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "September", "October", "November"],
    description:
      "Le delta de l'Èbre est un immense plan d'eau plat — l'un des meilleurs spots de flat en Espagne. Les lagunes offrent des conditions idéales pour débutants et freestylers. Vent thermique fiable l'après-midi.",
    access:
      "Amposta / Riumar / Els Eucaliptus, Tarragone. 2h au sud de Barcelone.",
  },
  {
    name: "Los Alcázares – Mar Menor",
    latitude: 37.7428,
    longitude: -0.8509,
    country: "Spain",
    region: "Murcia",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["March", "April", "May", "June", "September", "October"],
    description:
      "Le Mar Menor est une lagune immense au sud-est de l'Espagne offrant un flat parfait. L'eau est chaude et peu profonde — conditions idéales pour l'apprentissage. Vent thermique régulier.",
    access:
      "Los Alcázares ou Lo Pagán, Murcia. 30 min de l'aéroport de Murcie.",
  },
  {
    name: "Roses – Empuriabrava",
    latitude: 42.2514,
    longitude: 3.1324,
    country: "Spain",
    region: "Catalonia",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 65,
    bestMonths: ["March", "April", "May", "October", "November"],
    description:
      "La baie de Roses dans le golfe du Lion reçoit la Tramontane puissante qui descend des Pyrénées. Spot de chop/waves avec du vent fort et régulier. Conditions engagées quand la Tramontane souffle fort.",
    hazards:
      "Tramontane très puissante, peut dépasser 50 nœuds. Shore break marqué.",
    access:
      "Plage de Santa Margarida à Roses, ou Empuriabrava, Gérone. 1h30 de Barcelone.",
  },
  {
    name: "Valdevaqueros",
    latitude: 36.0856,
    longitude: -5.6892,
    country: "Spain",
    region: "Andalusia",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 20,
    maxWindKmh: 80,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "Valdevaqueros est la plage kite reine de Tarifa, séparée du spot principal Los Lances. Vent Poniente (W) side-shore avec de belles vagues et une dune spectaculaire en arrière-plan. Spot avancé — vent soutenu et vagues.",
    hazards:
      "Courants du détroit de Gibraltar. Vent très puissant possible. Partage avec les windsurfers.",
    access: "Plage de Valdevaqueros, Tarifa. Parking payant en été.",
  },
  {
    name: "Lanzarote – Costa Teguise",
    latitude: 29.0021,
    longitude: -13.4933,
    country: "Spain",
    region: "Canary Islands",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["May", "June", "July", "August", "September", "October"],
    description:
      "Lanzarote est un excellent spot kite des Canaries. Costa Teguise offre du vent NE Alizé constant en été. Playa de las Cucharas est le spot principal avec du chop modéré.",
    access:
      "Playa de las Cucharas, Costa Teguise, Lanzarote. 15 min de l'aéroport.",
  },

  // ─── ITALY ────────────────────────────────────────────────────────────────

  {
    name: "Gizzeria – Hang Loose Beach",
    latitude: 38.9735,
    longitude: 16.2089,
    country: "Italy",
    region: "Calabria",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["May", "June", "July", "August", "September", "October"],
    description:
      "Gizzeria Lido en Calabre est le spot kite le plus célèbre d'Italie, hôte régulier d'étapes du GKA World Tour. Vent thermique fiable de NW en été. Conditions de vagues côté mer, flat dans la lagune.",
    access: "Gizzeria Lido, Catanzaro. 20 min de l'aéroport de Lamezia Terme.",
  },
  {
    name: "Lo Stagnone – Marsala",
    latitude: 37.8863,
    longitude: 12.4712,
    country: "Italy",
    region: "Sicily",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["May", "June", "July", "August", "September", "October"],
    description:
      "Lo Stagnone est une lagune peu profonde avec du flat parfait — le spot kite le plus populaire de Sicile. L'eau monte aux genoux sur des centaines de mètres. Vent thermique fiable de NW l'après-midi, eau chaude, coucher de soleil spectaculaire sur les îles Egadi.",
    access:
      "Lagune de Lo Stagnone, Marsala, Sicile. 20 min de l'aéroport de Trapani.",
  },
  {
    name: "Porto Pollo – Sardinia",
    latitude: 41.197,
    longitude: 9.3073,
    country: "Italy",
    region: "Sardinia",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 65,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "Porto Pollo (Porto Liscia) dans le nord de la Sardaigne est un spot mythique entre Sardaigne et Corse. Le Mistral s'engouffre dans le détroit de Bonifacio créant un effet venturi puissant. Conditions chop, vent fort et régulier.",
    hazards:
      "Vent très puissant (effet venturi), peut dépasser 45 nœuds. Rochers côté nord.",
    access: "Porto Pollo, Palau, Sardaigne. 30 min de l'aéroport d'Olbia.",
  },
  {
    name: "Lake Garda – Malcesine",
    latitude: 45.8044,
    longitude: 10.8431,
    country: "Italy",
    region: "Veneto",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "Le lac de Garde est le spot de kite lacustre le plus célèbre d'Italie. Malcesine sur la rive est bénéficie de l'Ora, un vent thermique régulier qui se lève en début d'après-midi. L'eau est flat et le décor alpin spectaculaire.",
    access:
      "Malcesine ou Campagnola, rive est du lac de Garde. 1h30 de l'aéroport de Vérone.",
  },
  {
    name: "Lago di Santa Croce",
    latitude: 46.119,
    longitude: 12.3517,
    country: "Italy",
    region: "Veneto",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 45,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "Le lac de Santa Croce dans les pré-Alpes vénitiennes offre un flat parfait avec un vent thermique fiable l'après-midi. Plus petit que le lac de Garde mais moins fréquenté — idéal pour progresser.",
    access: "Lago di Santa Croce, Alpago, Belluno. 1h de Venise.",
  },
  {
    name: "Salento – Torre San Giovanni",
    latitude: 39.9956,
    longitude: 18.0062,
    country: "Italy",
    region: "Puglia",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["May", "June", "July", "August", "September", "October"],
    description:
      "Le Salento dans les Pouilles est un excellent spot kite du sud de l'Italie. Vent thermique de NW régulier en été, eaux turquoise. Plusieurs plages adaptées selon la direction du vent.",
    access:
      "Torre San Giovanni ou Ugento, Lecce. 1h de l'aéroport de Brindisi.",
  },

  // ─── GREECE ───────────────────────────────────────────────────────────────

  {
    name: "Rhodes – Prasonisi",
    latitude: 35.888,
    longitude: 27.7756,
    country: "Greece",
    region: "South Aegean",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Prasonisi à la pointe sud de Rhodes est un spot unique : une bande de sable relie une petite île au continent, créant deux côtés — flat côté est et waves côté ouest. Le Meltemi souffle fort et régulier en été.",
    hazards:
      "Meltemi peut dépasser 40 nœuds. Courant autour de la pointe. Fond rocheux côté ouest.",
    access:
      "Prasonisi, sud de Rhodes. 90 km de Rhodes-ville. Aéroport Rhodes (RHO).",
  },
  {
    name: "Paros – Pounda Beach",
    latitude: 37.0411,
    longitude: 25.2081,
    country: "Greece",
    region: "South Aegean",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Pounda Beach à Paros est un spot de flat protégé face à l'île d'Antiparos. Le Meltemi est canalisé entre les deux îles créant un vent régulier et puissant. Eau turquoise peu profonde — paradis des débutants et freestylers.",
    access:
      "Pounda Beach, côte ouest de Paros. Ferry depuis Athènes (Pirée) ou vol domestique.",
  },
  {
    name: "Naxos – Mikri Vigla",
    latitude: 37.017,
    longitude: 25.385,
    country: "Greece",
    region: "South Aegean",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Mikri Vigla sur la côte ouest de Naxos est un des meilleurs spots des Cyclades. Le promontoire rocheux sépare deux plages — nord pour les vagues, sud pour le flat. Meltemi fiable et puissant en été.",
    access:
      "Mikri Vigla, Naxos. 18 km au sud de Naxos-ville. Ferry ou vol depuis Athènes.",
  },
  {
    name: "Limnos – Keros Beach",
    latitude: 39.8764,
    longitude: 25.2889,
    country: "Greece",
    region: "North Aegean",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Limnos (Lemnos) est considérée comme le meilleur spot kite de Grèce. La baie de Keros offre un flat parfait dans une eau cristalline et chaude. Le Meltemi y souffle avec une constance exceptionnelle — 30+ jours consécutifs en été.",
    access:
      "Keros Beach, Limnos. Vol domestique depuis Athènes ou Thessalonique vers l'aéroport de Myrina.",
  },
  {
    name: "Lefkada – Vassiliki",
    latitude: 38.6311,
    longitude: 20.5892,
    country: "Greece",
    region: "Ionian Islands",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Vassiliki à Lefkada est un des spots de vent les plus fiables de Grèce ionienne. Vent thermique très régulier l'après-midi grâce à la géographie de la baie. Conditions de chop modéré.",
    access:
      "Vassiliki, sud de Lefkada. Accessible par le pont depuis le continent. Aéroport Preveza-Aktio (PVK) à 40 km.",
  },
  {
    name: "Kos – Mastichari",
    latitude: 36.856,
    longitude: 26.992,
    country: "Greece",
    region: "South Aegean",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Mastichari sur la côte nord de Kos profite du Meltemi canalisé entre Kos et Kalymnos. Plan d'eau plat, sable fin, eau turquoise et chaude. Un des meilleurs spots pour apprendre dans les îles grecques.",
    access: "Mastichari, côte nord de Kos. 20 km de l'aéroport de Kos.",
  },

  // ─── PORTUGAL ─────────────────────────────────────────────────────────────

  {
    name: "Lagoa de Óbidos",
    latitude: 39.4095,
    longitude: -9.202,
    country: "Portugal",
    region: "Centro",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "La lagune d'Óbidos est le meilleur spot de flat du Portugal — un plan d'eau protégé avec une eau peu profonde. Vent thermique de Nortada (N/NW) fiable en été. Spot parfait pour progresser.",
    access: "Foz do Arelho, lagune d'Óbidos. 1h au nord de Lisbonne.",
  },
  {
    name: "Guincho",
    latitude: 38.7294,
    longitude: -9.4732,
    country: "Portugal",
    region: "Lisbon",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 20,
    maxWindKmh: 60,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "Guincho est un spot de waves mythique près de Cascais/Lisbonne. La Nortada (N) y souffle fort et régulier, les vagues atlantiques sont puissantes. Réservé aux riders confirmés. Cadre spectaculaire avec les falaises du Parc Sintra-Cascais.",
    hazards:
      "Vagues puissantes, vent très fort, courants dangereux. Niveau expert recommandé.",
    access: "Praia do Guincho, Cascais. 40 min à l'ouest de Lisbonne.",
  },
  {
    name: "Alvor – Algarve",
    latitude: 37.125,
    longitude: -8.595,
    country: "Portugal",
    region: "Algarve",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "L'estuaire d'Alvor en Algarve offre un plan d'eau plat et protégé avec de l'eau chaude. Vent thermique de NW régulier en été. Un des meilleurs spots du sud du Portugal pour apprendre.",
    access: "Alvor, Portimão, Algarve. 1h de l'aéroport de Faro.",
  },

  // ─── NETHERLANDS ──────────────────────────────────────────────────────────

  {
    name: "Brouwersdam",
    latitude: 51.751,
    longitude: 3.86,
    country: "Netherlands",
    region: "Zeeland",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "Brouwersdam est LE spot de kite des Pays-Bas — le barrage sépare la mer du Nord du lac Grevelingen, offrant du flat côté lac et des vagues côté mer. Vent fiable quasi toute l'année, énorme communauté kite.",
    access:
      "Brouwersdam, Zeeland. 1h30 au sud de Rotterdam. Parking payant en été.",
  },
  {
    name: "Makkum",
    latitude: 53.054,
    longitude: 5.397,
    country: "Netherlands",
    region: "Friesland",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "Makkum sur l'IJsselmeer offre un flat parfait protégé par la digue d'Afsluitdijk. Eau peu profonde, idéal débutants et freestyle. Vent régulier de SW/W.",
    access: "Makkum, Friesland. 1h30 au nord d'Amsterdam.",
  },
  {
    name: "Scheveningen",
    latitude: 52.1023,
    longitude: 4.2595,
    country: "Netherlands",
    region: "South Holland",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["March", "April", "May", "September", "October", "November"],
    description:
      "Scheveningen est le spot kite urbain de La Haye, sur la mer du Nord. Conditions de vagues, vent de SW/W régulier. Communauté kite active.",
    access:
      "Plage de Scheveningen, La Haye. Transport en commun depuis le centre-ville.",
  },
  {
    name: "Hindeloopen",
    latitude: 52.9362,
    longitude: 5.4024,
    country: "Netherlands",
    region: "Friesland",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 50,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "Hindeloopen sur l'IJsselmeer est un spot de flat très populaire en Frise. Large plage de sable, eau peu profonde, conditions idéales pour progresser.",
    access: "Hindeloopen, Friesland. 1h45 au nord d'Amsterdam.",
  },

  // ─── GERMANY ──────────────────────────────────────────────────────────────

  {
    name: "Fehmarn – Gold Beach",
    latitude: 54.4676,
    longitude: 11.1538,
    country: "Germany",
    region: "Schleswig-Holstein",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "July", "August", "September"],
    description:
      "L'île de Fehmarn dans la mer Baltique est la Mecque du kite en Allemagne. Gold Beach sur la côte sud offre du flat dans le lagon. Vent fiable, nombreuses écoles, ambiance festive. Hôte d'événements internationaux.",
    access:
      "Île de Fehmarn, Schleswig-Holstein. Accessible par le pont Fehmarnsund. 2h au nord de Hambourg.",
  },
  {
    name: "Rügen – Thiessow",
    latitude: 54.281,
    longitude: 13.714,
    country: "Germany",
    region: "Mecklenburg-Vorpommern",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "Rügen est la plus grande île d'Allemagne. Thiessow à la pointe sud offre des conditions variées — Bodden (lagune) côté ouest pour le flat, mer Baltique côté est pour le chop. Vent régulier.",
    access:
      "Thiessow, Rügen. Accessible par le pont depuis Stralsund. 3h au nord de Berlin.",
  },
  {
    name: "Sylt – Westerland",
    latitude: 54.9135,
    longitude: 8.3022,
    country: "Germany",
    region: "Schleswig-Holstein",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 18,
    maxWindKmh: 65,
    bestMonths: ["September", "October", "November", "March", "April"],
    description:
      "Sylt est l'île la plus au nord de l'Allemagne, en mer du Nord. Conditions de waves puissantes côté ouest, vent fort et régulier. Le spot emblématique de la scène wave allemande.",
    hazards:
      "Vent et vagues puissants, courants forts. Eau froide — combi intégrale nécessaire.",
    access:
      "Sylt, accessible par le train auto (Autozug) depuis Niebüll ou par avion.",
  },
  {
    name: "Chiemsee",
    latitude: 47.8961,
    longitude: 12.5274,
    country: "Germany",
    region: "Bavaria",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 12,
    maxWindKmh: 45,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "Le Chiemsee, 'mer bavaroise', est le plus grand lac de Bavière. Vent thermique l'après-midi avec un décor alpin magnifique. Spot de flat alpin populaire.",
    access: "Chieming ou Übersee, Chiemsee. 1h à l'est de Munich.",
  },

  // ─── CROATIA ──────────────────────────────────────────────────────────────

  {
    name: "Bol – Zlatni Rat",
    latitude: 43.2564,
    longitude: 16.6556,
    country: "Croatia",
    region: "Split-Dalmatia",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "La célèbre plage de Zlatni Rat (Golden Horn) sur l'île de Brač est aussi un excellent spot kite. Le Maestral (NW thermique) souffle régulièrement l'après-midi en été. Cadre absolument spectaculaire.",
    access: "Bol, île de Brač. Ferry depuis Split (1h). Aéroport de Split.",
  },
  {
    name: "Viganj – Pelješac",
    latitude: 42.9811,
    longitude: 17.0839,
    country: "Croatia",
    region: "Dubrovnik-Neretva",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Viganj sur la presqu'île de Pelješac est le spot de vent le plus fiable de Croatie. Le Maestral est canalisé par le canal entre Pelješac et Korčula, créant un effet venturi puissant. Spot historique du windsurf/kite croate.",
    access: "Viganj, presqu'île de Pelješac. 2h au nord-ouest de Dubrovnik.",
  },
  {
    name: "Nin – Queen's Beach",
    latitude: 44.2452,
    longitude: 15.182,
    country: "Croatia",
    region: "Zadar",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 45,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "La lagune de Nin près de Zadar offre un flat parfait avec de l'eau peu profonde — le meilleur spot débutant de Croatie. Vent thermique de NW l'été. Plage de boue thérapeutique à proximité.",
    access: "Nin, 15 km au nord de Zadar. Aéroport Zadar (ZAD) à 25 km.",
  },

  // ─── TURKEY ───────────────────────────────────────────────────────────────

  {
    name: "Alaçatı",
    latitude: 38.275,
    longitude: 26.365,
    country: "Turkey",
    region: "İzmir",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "Alaçatı est le spot de vent le plus célèbre de Turquie, sur la côte égéenne. Le Meltemi y souffle fort et régulier en été. La baie offre du flat dans un cadre de village ottoman pittoresque. Hôte du PWA World Tour.",
    access: "Alaçatı, presqu'île de Çeşme. 1h de l'aéroport d'Izmir.",
  },
  {
    name: "Gökova – Akyaka",
    latitude: 37.0565,
    longitude: 28.3306,
    country: "Turkey",
    region: "Muğla",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: ["June", "July", "August", "September"],
    description:
      "La baie de Gökova est un spot kite majeur de la côte sud turque. Vent thermique fiable de W/NW l'après-midi. Le delta de l'Akyaka River crée un plan d'eau peu profond et flat — conditions parfaites pour l'apprentissage.",
    access:
      "Akyaka, baie de Gökova. 30 min de l'aéroport de Dalaman ou 1h de Bodrum.",
  },

  // ─── UNITED KINGDOM ───────────────────────────────────────────────────────

  {
    name: "Camber Sands",
    latitude: 50.9298,
    longitude: 0.7915,
    country: "United Kingdom",
    region: "East Sussex",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "Camber Sands est un des meilleurs spots kite du sud de l'Angleterre. Immense plage de sable avec des dunes, conditions variées selon la marée — flat à marée basse, chop à marée haute. Vent régulier de SW.",
    access: "Camber, East Sussex. 1h30 au sud-est de Londres.",
  },
  {
    name: "Hayling Island",
    latitude: 50.7825,
    longitude: -0.977,
    country: "United Kingdom",
    region: "Hampshire",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 55,
    bestMonths: ["April", "May", "June", "September", "October"],
    description:
      "Hayling Island est un spot kite historique du sud de l'Angleterre, sur le Solent. Conditions de chop, vent de SW fiable, grande communauté de riders. Le harbour côté nord offre du flat à marée haute.",
    access: "Hayling Island, Hampshire. 1h30 au sud-ouest de Londres.",
  },

  // ─── DENMARK ──────────────────────────────────────────────────────────────

  {
    name: "Klitmøller – Cold Hawaii",
    latitude: 57.0378,
    longitude: 8.454,
    country: "Denmark",
    region: "North Jutland",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "ADVANCED" as const,
    minWindKmh: 18,
    maxWindKmh: 65,
    bestMonths: ["September", "October", "November", "March", "April"],
    description:
      "Klitmøller, surnommé 'Cold Hawaii', est le spot de référence en Scandinavie pour le kite en vagues. Exposé à l'océan Atlantique Nord, il reçoit du swell puissant et du vent fort. Réservé aux riders expérimentés.",
    hazards:
      "Eau froide, vagues puissantes, courants. Combi épaisse obligatoire.",
    access:
      "Klitmøller, nord-ouest du Jutland, Danemark. 5h au nord de Copenhague.",
  },
  {
    name: "Rømø",
    latitude: 55.089,
    longitude: 8.516,
    country: "Denmark",
    region: "South Jutland",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 55,
    bestMonths: ["May", "June", "July", "August", "September"],
    description:
      "Rømø est une île danoise de la mer des Wadden avec la plage la plus large d'Europe du Nord (Lakolk). À marée basse, un immense flat se forme — conditions parfaites pour le kite, buggy et char à voile.",
    access:
      "Île de Rømø, accessible par la route depuis le Jutland. 4h à l'ouest de Copenhague.",
  },

  // ─── ADDITIONAL WORLD SPOTS ───────────────────────────────────────────────

  {
    name: "Hua Hin – Pak Nam Pran",
    latitude: 12.4075,
    longitude: 99.9953,
    country: "Thailand",
    region: "Prachuap Khiri Khan",
    sportType: "KITE" as const,
    waterType: "CHOP" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 45,
    bestMonths: ["January", "February", "March", "April"],
    description:
      "Pak Nam Pran au sud de Hua Hin est le meilleur spot kite de Thaïlande avec un vent de NE fiable pendant la mousson sèche. Eau chaude, ambiance thaïe authentique.",
    access: "Pak Nam Pran, 30 km au sud de Hua Hin. 3h au sud de Bangkok.",
  },
  {
    name: "Buen Hombre",
    latitude: 19.9283,
    longitude: -71.5875,
    country: "Dominican Republic",
    region: "Monte Cristi",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 15,
    maxWindKmh: 50,
    bestMonths: [
      "December",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
    ],
    description:
      "Buen Hombre est un secret bien gardé de la côte nord de la République dominicaine. Lagon turquoise protégé par un récif, vent Alizé NE constant, village de pêcheurs isolé — l'antithèse de Cabarete pour les riders recherchant la tranquillité.",
    access:
      "Buen Hombre, Monte Cristi. 4h de route depuis Puerto Plata. Route partiellement non-goudronnée.",
  },
  {
    name: "Cape Town – Blouberg",
    latitude: -33.805,
    longitude: 18.45,
    country: "South Africa",
    region: "Western Cape",
    sportType: "KITE" as const,
    waterType: "WAVES" as const,
    difficulty: "INTERMEDIATE" as const,
    minWindKmh: 18,
    maxWindKmh: 65,
    bestMonths: [
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
    ],
    description:
      "Blouberg Beach face à Table Mountain est l'un des spots kite les plus emblématiques au monde. Le Cape Doctor (SE) souffle fort et régulier en été austral. Vue spectaculaire sur Table Mountain. Conditions de vagues et chop.",
    hazards:
      "Vent très fort (35+ nœuds fréquent). Eau froide (Atlantique). Requins présents dans la zone.",
    access:
      "Bloubergstrand, 20 km au nord du centre du Cap. Aéroport du Cap (CPT) à 25 min.",
  },
  {
    name: "Zanzibar – Paje",
    latitude: -6.2737,
    longitude: 39.5311,
    country: "Tanzania",
    region: "Zanzibar",
    sportType: "KITE" as const,
    waterType: "FLAT" as const,
    difficulty: "BEGINNER" as const,
    minWindKmh: 12,
    maxWindKmh: 40,
    bestMonths: ["June", "July", "August", "September", "January", "February"],
    description:
      "Paje Beach sur la côte est de Zanzibar est un des spots kite les plus demandés d'Afrique. Un immense flat corallien se découvre à marée basse — conditions parfaites de flat en eau chaude. Deux saisons de vent (mousson NE et SE).",
    hazards:
      "Flat accessible uniquement à marée basse. Oursins sur le récif. Bateaux de pêche dhow.",
    access:
      "Paje, côte est de Zanzibar. 1h30 de Stone Town. Vols vers Zanzibar (ZNZ) depuis Dar es Salaam et l'Europe.",
  },
];

async function main() {
  console.log(`Seeding ${spots.length} spots…`);

  let created = 0;
  for (const spot of spots) {
    const existing = await prisma.spot.findFirst({
      where: { name: spot.name },
    });
    if (!existing) {
      await prisma.spot.create({ data: spot });
      created++;
    } else {
      console.log(`  skip (exists): ${spot.name}`);
    }
  }

  console.log(
    `✓ Created ${created} spots (${spots.length - created} already existed).`,
  );

  // ─── Update best wind directions for all known spots ──────────────────────
  const windDirs: Record<string, string[]> = {
    // Lake Geneva – kitesurf
    Excenevex: ["N", "NNE", "NE", "ENE"],
    "Boiron / Lake Geneva": ["N", "NNE", "NE", "SW", "WSW"],
    "Corseaux / Lake Geneva": ["N", "NNE", "NE"],
    "Promenthoux / Lake Geneva": ["SSW", "SW", "WSW", "W", "WNW"],
    Silvaplana: ["W", "WSW", "WNW", "SW"],
    // Jura lakes
    "Lac des Rousses": ["N", "NNE", "NE", "ENE", "E"],
    "Les Rousses": ["N", "NNE", "NE", "ENE"],
    "Le Brassus \u2013 Vall\u00e9e de Joux": ["NNE", "NE", "ENE", "E"],
    "Lac de Joux": ["NE", "ENE", "E"],
    // Fribourg pre-Alps
    Semsales: ["N", "NNE", "NE", "ENE"],
    "Le Niremont": ["W", "WNW", "NW", "E", "ENE", "NE"],
    "Les Alpettes": ["N", "NNE", "NE"],
    "La Br\u00e9vine": ["N", "NNE", "NE", "ENE"],
    // Bernese Oberland + Valais
    Jaunpass: ["N", "NNW", "NW", "WNW", "NNE"],
    Grimselpass: ["N", "NNE", "S", "SSW", "SW"],
    // Auvergne-Rhône-Alpes
    "Le Sal\u00e8ve": [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ],
    "Crozet Lelex": ["N", "NNW", "NW", "WNW", "W", "NNE", "NE"],
    // Europe
    Tarifa: ["E", "ENE", "ESE", "W", "WSW", "WNW"],
    "Fuerteventura \u2013 Sotavento": ["N", "NNE", "NE", "ENE"],
    Essaouira: ["N", "NNE", "NE"],
    // Africa & Indian Ocean
    "Dakhla Lagoon": ["N", "NNE", "NE", "ENE"],
    "Le Morne \u2013 Mauritius": ["SE", "ESE", "SSE", "E"],
    "Paje Beach \u2013 Zanzibar": ["NNE", "NE", "ENE", "SE", "SSE", "ESE"],
    "Langebaan Lagoon": ["SE", "SSE", "ESE"],
    "El Gouna \u2013 Red Sea": ["N", "NNW", "NW", "WNW"],
    // Americas
    Cabarete: ["NNE", "NE", "ENE", "E"],
    Cumbuco: ["SE", "SSE", "ESE", "E"],
    Jericoacoara: ["SE", "SSE", "ESE"],
    "Hood River \u2013 Columbia River Gorge": ["W", "WNW", "WSW"],
    "Maui \u2013 Kite Beach (Kanaha)": ["N", "NNE", "NE", "ENE"],
    // Asia-Pacific
    "Mui Ne": ["NNE", "NE", "ENE", "E"],
    "Boracay \u2013 Bulabog Beach": ["N", "NNE", "NE", "ENE"],
    Kalpitiya: ["SW", "SSW", "WSW", "NE", "NNE", "ENE"],
    // Oceania
    "Perth \u2013 Safety Bay": ["SW", "SSW", "WSW", "S"],

    // ─── NEW EUROPEAN SPOTS ─────────────────────────────────────────────────
    // France
    "Leucate \u2013 La Franqui": ["NW", "NNW", "WNW", "SE", "SSE"],
    "Almanarre \u2013 Hyères": ["NW", "NNW", "WNW", "W"],
    Gruissan: ["NW", "NNW", "WNW", "W"],
    "Les Saintes-Maries-de-la-Mer \u2013 Camargue": ["NW", "NNW", "N"],
    "Port-Saint-Louis-du-Rhône \u2013 Napoléon": ["NW", "NNW", "N", "WNW"],
    "Arcachon \u2013 La Salie": ["NW", "WNW", "W", "NNW"],
    "Noirmoutier \u2013 La Guérinière": ["W", "WNW", "NW", "SW", "WSW"],
    "Île de Ré \u2013 Les Portes": ["NW", "WNW", "W", "NNW", "SW"],
    "Presqu'île de Giens \u2013 Plage de La Bergerie": [
      "E",
      "ENE",
      "ESE",
      "NE",
    ],
    "Fréjus \u2013 Saint-Aygulf": ["NW", "WNW", "E", "ENE"],
    "Saint-Laurent-du-Var": ["E", "ENE", "ESE"],
    "Naussac \u2013 Lac de Naussac": ["NW", "NNW", "N", "W", "WNW"],
    "Quiberon \u2013 Port Haliguen": ["W", "WNW", "NW", "SW", "WSW"],
    "La Palme": ["NW", "NNW", "WNW", "W"],
    "La Baule \u2013 Pornichet": ["W", "WNW", "SW", "WSW"],
    // Spain
    "Delta del Ebro \u2013 Els Eucaliptus": ["NW", "NNW", "N", "SE", "SSE"],
    "Los Alcázares \u2013 Mar Menor": ["NE", "ENE", "E", "NNE"],
    "Roses \u2013 Empuriabrava": ["NW", "NNW", "N", "WNW"],
    Valdevaqueros: ["W", "WNW", "WSW", "E", "ENE"],
    "Lanzarote \u2013 Costa Teguise": ["NE", "NNE", "ENE", "N"],
    // Italy
    "Gizzeria \u2013 Hang Loose Beach": ["NW", "WNW", "NNW", "W"],
    "Lo Stagnone \u2013 Marsala": ["NW", "NNW", "WNW", "N"],
    "Porto Pollo \u2013 Sardinia": ["W", "WNW", "NW", "WSW"],
    "Lake Garda \u2013 Malcesine": ["S", "SSW", "SSE"],
    "Lago di Santa Croce": ["S", "SSW", "SSE", "SE"],
    "Salento \u2013 Torre San Giovanni": ["NW", "NNW", "WNW", "N"],
    // Greece
    "Rhodes \u2013 Prasonisi": ["NW", "WNW", "NNW", "W"],
    "Paros \u2013 Pounda Beach": ["N", "NNW", "NNE", "NW"],
    "Naxos \u2013 Mikri Vigla": ["N", "NNW", "NNE", "NW"],
    "Limnos \u2013 Keros Beach": ["NE", "NNE", "ENE", "N"],
    "Lefkada \u2013 Vassiliki": ["W", "WNW", "WSW", "SW"],
    "Kos \u2013 Mastichari": ["NW", "NNW", "WNW", "N"],
    // Portugal
    "Lagoa de Óbidos": ["N", "NNW", "NW", "NNE"],
    Guincho: ["N", "NNW", "NNE", "NW"],
    "Alvor \u2013 Algarve": ["NW", "WNW", "NNW", "W"],
    // Netherlands
    Brouwersdam: ["SW", "WSW", "W", "SSW"],
    Makkum: ["SW", "WSW", "W", "SSW"],
    Scheveningen: ["SW", "WSW", "W", "SSW"],
    Hindeloopen: ["SW", "WSW", "W", "SSW", "S"],
    // Germany
    "Fehmarn \u2013 Gold Beach": ["SW", "WSW", "W", "SSW", "S"],
    "Rügen \u2013 Thiessow": ["SW", "WSW", "W", "SSW", "NE", "ENE"],
    "Sylt \u2013 Westerland": ["W", "WNW", "WSW", "SW", "NW"],
    Chiemsee: ["W", "WNW", "NW", "WSW"],
    // Croatia
    "Bol \u2013 Zlatni Rat": ["NW", "WNW", "NNW", "W"],
    "Viganj \u2013 Pelješac": ["NW", "WNW", "NNW", "W"],
    "Nin \u2013 Queen's Beach": ["NW", "WNW", "NNW", "SE", "S"],
    // Turkey
    Alaçatı: ["N", "NNW", "NNE", "NW", "NE"],
    "Gökova \u2013 Akyaka": ["W", "WNW", "NW", "WSW"],
    // UK
    "Camber Sands": ["SW", "WSW", "W", "SSW"],
    "Hayling Island": ["SW", "WSW", "W", "SSW"],
    // Denmark
    "Klitmøller \u2013 Cold Hawaii": ["W", "WNW", "NW", "WSW"],
    Rømø: ["W", "WNW", "WSW", "SW", "NW"],
    // Additional world spots
    "Hua Hin \u2013 Pak Nam Pran": ["NE", "NNE", "ENE", "N"],
    "Buen Hombre": ["NE", "ENE", "NNE", "E"],
    "Cape Town \u2013 Blouberg": ["SE", "SSE", "ESE", "S"],
    "Zanzibar \u2013 Paje": ["NE", "NNE", "ENE", "SE", "SSE", "ESE"],
  };

  let updated = 0;
  for (const [name, dirs] of Object.entries(windDirs)) {
    const r = await prisma.spot.updateMany({
      where: { name },
      data: { bestWindDirections: dirs },
    });
    if (r.count > 0) updated++;
  }
  console.log(`✓ Updated wind directions for ${updated} spots.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
