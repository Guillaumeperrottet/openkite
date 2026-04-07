# OpenWind 🪁

**La carte open source des spots de kitesurf et snowkite.**

Vent en direct · Spots communautaires · Planificateur de voyages · 100% gratuit — pour toujours.

![OpenWind Map](https://img.shields.io/badge/status-alpha-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

---

## ✨ Fonctionnalités

- 🗺️ **Carte interactive** — tous les spots du monde sur une carte MapLibre + OpenStreetMap (0€)
- 💨 **Vent en direct** — données Open-Meteo actualisées, sans clé API
- 📍 **Ajouter un spot** — formulaire complet avec photos, difficulté, conditions idéales
- 🧳 **Planificateur de voyage** — "je serai là le XX/XX" → spots proches + prévisions vent J+7
- 🎨 **Palette blanc-gris** — indicateurs de vent intuitifs, du blanc (calme) au rouge (danger)

## 🛠️ Stack technique

| Technologie                            | Usage                       | Coût                |
| -------------------------------------- | --------------------------- | ------------------- |
| [Next.js 16](https://nextjs.org)       | Framework fullstack         | Gratuit             |
| [MapLibre GL](https://maplibre.org)    | Carte interactive           | Open source         |
| [OpenFreeMap](https://openfreemap.org) | Tuiles de carte             | Gratuit             |
| [Open-Meteo](https://open-meteo.com)   | API météo/vent              | Gratuit, sans clé   |
| [Supabase](https://supabase.com)       | PostgreSQL + Auth + Storage | Gratuit (free tier) |
| [Prisma](https://prisma.io)            | ORM                         | Open source         |
| [Vercel](https://vercel.com)           | Hosting                     | Gratuit (free tier) |
| [Nominatim/OSM](https://nominatim.org) | Géocodage inverse           | Gratuit             |

**Total coût d'infrastructure : 0€/mois** pour un usage raisonnable.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- pnpm
- Un compte [Supabase](https://supabase.com) (gratuit)

### Installation

```bash
git clone https://github.com/Guillaumeperrottet/openwind.git
cd openwind
pnpm install
```

### Configuration

```bash
cp .env.local.example .env.local
```

Remplis `.env.local` avec tes credentials Supabase :

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Va dans **Settings > API** pour récupérer l'URL et les clés
3. Va dans **Settings > Database** pour la `DATABASE_URL`
4. Active l'extension **PostGIS** dans l'éditeur SQL : `CREATE EXTENSION postgis;` (optionnel, pour requêtes géo avancées)
5. Crée un bucket `spot-images` dans **Storage** (cocher "Public bucket")

### Base de données

```bash
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

### Lancer en développement

```bash
pnpm dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## 📁 Structure du projet

```
src/
├── app/
│   ├── page.tsx              # Carte principale (full-screen)
│   ├── plan/page.tsx         # Planificateur de voyage
│   ├── spots/
│   │   ├── new/page.tsx      # Créer un spot
│   │   └── [id]/page.tsx     # Fiche d'un spot (vent live + infos)
│   └── api/
│       ├── spots/            # CRUD spots + images
│       └── plan/             # Endpoint planificateur
├── components/
│   ├── map/                  # KiteMap, SpotPopup
│   ├── spot/                 # CreateSpotForm
│   ├── plan/                 # TripPlanner
│   └── ui/                   # Button, Badge, Navbar
├── lib/
│   ├── wind.ts               # Open-Meteo helpers
│   ├── utils.ts              # cn(), haversine, windColor…
│   ├── prisma.ts             # Singleton Prisma client
│   └── supabase/             # Client/Server Supabase
└── types/                    # Types TypeScript partagés
prisma/
└── schema.prisma             # Schéma DB (Spot, SpotImage, WindReport)
```

## 🤝 Contribuer

Voir [CONTRIBUTING.md](./CONTRIBUTING.md) — toute aide est la bienvenue !

## 📄 Licence

MIT — libre à utiliser, modifier, héberger.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
