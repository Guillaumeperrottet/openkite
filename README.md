# OpenWind

**Carte open source des spots de kitesurf et parapente — vent en direct, prévisions, archives, planificateur de voyages.**

[openwind.ch](https://openwind.ch)

![Status](https://img.shields.io/badge/status-alpha-orange)
![License](https://img.shields.io/badge/license-AGPL--v3-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

---

## Fonctionnalités

- **Carte interactive** — spots et stations de vent sur une carte MapLibre GL (clustering WebGL)
- **Vent en direct** — 3 réseaux combinés : MeteoSwiss (154 stations), Pioupiou (~600 mondiales), Netatmo
- **Prévisions 7 jours** — tableau Windguru-style avec scoring kite/parapente (Open-Meteo)
- **Archives 5 ans** — roses des vents mensuelles, fréquences et directions dominantes
- **Planificateur de voyage** — lieu + dates + sport → spots proches triés par score
- **Forum communautaire** — catégories, topics, réponses threadées, votes
- **Ajouter un spot** — formulaire avec photos, difficulté, type d'eau, directions idéales
- **Multi-sport** — kitesurf et parapente, scoring adapté par discipline
- **100 % gratuit** — 0 € d'infrastructure (free tiers uniquement)

## Stack technique

| Technologie                              | Usage                            | Coût              |
| ---------------------------------------- | -------------------------------- | ----------------- |
| [Next.js 16](https://nextjs.org)         | Framework fullstack (App Router) | Gratuit           |
| [TypeScript](https://typescriptlang.org) | Typage strict                    | —                 |
| [Tailwind v4](https://tailwindcss.com)   | Styles                           | —                 |
| [MapLibre GL 5](https://maplibre.org)    | Carte WebGL                      | Open source       |
| [OpenFreeMap](https://openfreemap.org)   | Tuiles de carte                  | Gratuit           |
| [Open-Meteo](https://open-meteo.com)     | Prévisions + archives vent       | Gratuit, sans clé |
| [Prisma 7](https://prisma.io)            | ORM PostgreSQL                   | Open source       |
| [Supabase](https://supabase.com)         | PostgreSQL + Auth + Storage      | Free tier         |
| [Vercel](https://vercel.com)             | Hosting + Cron                   | Free tier         |

## Démarrage rapide

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
cp .env.example .env
cp .env.example .env.local
```

Remplis les deux fichiers avec tes credentials :

1. Crée un projet sur [supabase.com](https://supabase.com)
2. **Settings > API** → `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. **Settings > Database** → `DATABASE_URL` (pooler) et `DIRECT_URL` (direct)
4. Crée un bucket `spot-images` dans **Storage** (Public bucket)

Voir [.env.example](.env.example) pour la liste complète des variables.

### Base de données

```bash
pnpm exec prisma migrate dev
pnpm exec prisma generate
```

### Lancer en développement

```bash
pnpm dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## Structure du projet

```
src/
  app/                        # Next.js App Router
    api/
      spots/                  # CRUD spots (Prisma + Supabase Storage)
      stations/               # MeteoSwiss + Pioupiou + Netatmo combinés
      wind/                   # Vent courant + grille batch
      plan/                   # Planificateur de voyages (scoring multi-sport)
      favorites/              # Toggle favoris utilisateur
      preferences/            # Préférences UI (sport, unités)
      forum/                  # Categories, topics, posts, votes
      auth/sync/              # Sync Supabase Auth → Prisma User
      cron/stations/          # Cron Vercel 10min → StationMeasurement
    spots/[id]/               # Détail spot (prévisions + boussole + archives)
    plan/                     # Trip planner
    forum/                    # Forum communautaire
    stations/[id]/            # Détail station + historique 48h
  components/
    map/                      # KiteMap (GL), SpotPopup, StationPopup, windgl/
    spot/                     # ForecastTable, WindChart, WindCompass, WindArchives
    plan/                     # TripPlanner, PlanFilters
    forum/                    # NewTopicForm, PostThread, ReplyForm, VoteButtons
    ui/                       # AuthModal, Badge, Button, Navbar, SearchBar
  lib/
    stations.ts               # MeteoSwiss SwissMetNet (LV95 → WGS84)
    pioupiou.ts               # Pioupiou OpenWindMap + WebSocket
    netatmo.ts                # Netatmo OAuth2 + token rotation
    forecast.ts               # Open-Meteo 7j (scoring kite/parapente)
    wind*.ts                  # Fetch, scoring, historique vent
    archives.ts               # Archives 5 ans (cache 7j)
    prisma.ts                 # Singleton PrismaClient
    supabase/                 # Client/Server Supabase
  types/                      # Types TypeScript partagés
prisma/
  schema.prisma               # 12 modèles + 3 enums
  migrations/                 # Historique migrations SQL
```

Pour plus de détails, voir la [documentation architecture](./docs/architecture.md).

## Contribuer

Voir [CONTRIBUTING.md](./CONTRIBUTING.md) — toute aide est la bienvenue !

## Licence

[AGPL v3](./LICENSE) — libre d'utiliser, modifier et héberger. Toute version modifiée hébergée publiquement doit publier son code source.
