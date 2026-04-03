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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
