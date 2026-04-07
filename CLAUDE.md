@AGENTS.md

# Openwind — Guide IA

## Vue d'ensemble

Application open source de cartographie interactive des spots de kitesurf, avec données de vent en direct et prévisions météo.

- **URL locale** : `http://localhost:3000`
- **Stack** : Next.js 16.2.2 (App Router) · TypeScript strict · Tailwind v4 · MapLibre GL 5 · Prisma 7 · Supabase

---

## Commandes essentielles

```bash
pnpm dev               # dev server (localhost:3000)
pnpm build             # build de prod
pnpm exec tsc --noEmit # vérification TypeScript (doit retourner 0 erreur)
pnpm lint              # ESLint
pnpm prisma db push    # sync schéma Prisma → Supabase (utilise .env, pas .env.local)
pnpm prisma studio     # interface visuelle DB
```

> **Important** : Prisma CLI lit `.env` (pas `.env.local`). Toujours garder `DATABASE_URL` dans les deux fichiers.

---

## Architecture

```
src/
  app/                  # Next.js App Router
    api/
      spots/            # CRUD spots (Prisma + Supabase)
      stations/         # GET /api/stations → 154 stations MeteoSwiss
      plan/             # Planificateur de voyages
    spots/
      [id]/             # Détail spot (ForecastTable + WindCompass)
      new/              # Formulaire création spot
    plan/               # Trip planner
  components/
    map/
      KiteMap.tsx       # Carte principale (WebGL GL layers)
      SpotPopup.tsx     # Popup React pour les spots kite
    ui/
      Badge.tsx         # Badge difficulté / type d'eau
  lib/
    stations.ts         # fetchMeteoSwissStations() + lv95ToWgs84()
    forecast.ts         # Open-Meteo 7j (HourlyPoint, FullForecast)
    utils.ts            # windColor(), windConditionLabel(), windDirectionLabel()
    supabase/
      client.ts         # Supabase côté client (PUBLISHABLE_DEFAULT_KEY)
      server.ts         # Supabase côté serveur
  types/                # Spot, WindData, etc.
  generated/prisma/     # Client Prisma auto-généré (ne pas éditer)
prisma/
  schema.prisma         # Modèles : Spot, SpotImage, WindReport
```

---

## Intégrations externes

### MeteoSwiss SwissMetNet

- **Endpoint** : `https://data.geo.admin.ch/...` (GeoJSON public, gratuit)
- **154 stations** suisses, mise à jour toutes les **10 minutes**
- **Coordonnées** : LV95 (EPSG:2056) converties en WGS84 via `lv95ToWgs84()` (formule swisstopo, précision ~1m)
- **Cache côté API** : `next: { revalidate: 600 }` + `Cache-Control: public, s-maxage=600`

### Open-Meteo

- **Vent courant** : `current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`
- **Prévisions** : 7 jours horaires + vagues marines
- **Gratuit, sans clé API**

### Supabase

- **Projet** : `fnndeoqzqfxpznhcundq`
- **PostgreSQL** : tables `Spot`, `SpotImage`, `WindReport` (live)
- **Storage** : bucket `spot-images` (public)
- **Clé client** : `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

---

## Carte (KiteMap.tsx) — Règles importantes

### Rendu GL (WebGL)

- Les **stations sont des GL layers** (source GeoJSON + couches `circle` + `symbol`), **pas des DOM markers** — pour éviter le jitter au zoom
- Ne jamais migrer vers des DOM markers pour les stations
- Les spots kite restent des `maplibregl.Marker` DOM (peu nombreux, ok)

### Layers

| Layer ID          | Type           | Source                                                  |
| ----------------- | -------------- | ------------------------------------------------------- |
| `stations-source` | GeoJSON source | `/api/stations`                                         |
| `stations-circle` | circle         | couleur par `windSpeedKmh`                              |
| `stations-arrow`  | symbol         | image `wind-arrow` (canvas 32×32), rotée par `rotation` |

### Popups GL

- MapLibre enveloppe le HTML dans `.maplibregl-popup-content` (fond blanc par défaut)
- **Fix** : injection CSS dans `<head>` via `<style id="ml-popup-reset">` dans `map.on("load")`
- Ne pas utiliser `.setPopup()` avec du HTML qui dépend d'un state React — utiliser `useKnotsRef.current` (ref) dans les handlers GL

### Comportement par défaut

- **Balises live** : ON au chargement (`useState(true)`)
- **Géolocalisation** : auto-trigger au load (`geolocate.trigger()` dans `map.on("load")`)
- **Unité** : kts par défaut (`useState(true)` pour `useKnots`)

---

## Unités de vent

- **Toujours afficher en kts en premier**
- km/h en secondaire (muted)
- Toggle `[km/h | kts]` dans la légende en bas à gauche
- `useKnotsRef` (ref) garde les handlers GL en sync avec le state React
- Conversion : `kts = Math.round(kmh / 1.852)`

---

## UI / Design

- **Thème** : light uniquement
- **Langue interface** : français
- Composants Tailwind — pas de librairie UI externe (pas shadcn, pas Chakra)
- `tw-merge` + `clsx` pour les classes conditionnelles

### Palette couleurs vent — Windguru style atténué (par kn)

| Plage kn | Couleur               | Label      |
| -------- | --------------------- | ---------- |
| < 2      | `#d0d0d0` (gris)      | Calme      |
| 2–5      | `#d5f0d5` (vert pâle) | Très léger |
| 5–8      | `#8edb8e` (vert)      | Léger      |
| 8–12     | `#3dbc3d` (vert vif)  | Modéré     |
| 12–16    | `#e8e540` (jaune)     | Kitable    |
| 16–20    | `#e8b830` (ambre)     | Bon        |
| 20–25    | `#e07020` (orange)    | Fort       |
| 25–30    | `#d42020` (rouge)     | Très fort  |
| 30–35    | `#b00058` (magenta)   | Extrême    |
| > 35     | `#800080` (violet)    | Danger     |

---

## Schéma DB (Prisma)

```prisma
model Spot {
  id          String      @id @default(cuid())
  name        String
  latitude    Float
  longitude   Float
  country     String?
  region      String?
  difficulty  Difficulty  @default(INTERMEDIATE)  // BEGINNER|INTERMEDIATE|ADVANCED|EXPERT
  waterType   WaterType   @default(CHOP)           // FLAT|CHOP|WAVES|MIXED
  minWindKmh  Int         @default(15)
  maxWindKmh  Int         @default(35)
  bestMonths  String[]
  images      SpotImage[]
  reports     WindReport[]
}
```

---

## Règles de développement

1. **Ne jamais casser le build** — toujours vérifier avec `pnpm exec tsc --noEmit` après des changements
2. **Pas de `any` TypeScript** — typer correctement, utiliser `unknown` si nécessaire
3. **Pas de console.log** en production — utiliser des `try/catch` silencieux pour les erreurs non-critiques (ex: MeteoSwiss down)
4. **Server Components par défaut** — n'ajouter `"use client"` que si nécessaire (interactivité, hooks)
5. **API routes** : toujours retourner `NextResponse.json()`, gérer les erreurs avec les bons codes HTTP
6. **Images Supabase** : passer par le bucket `spot-images`, utiliser le service role key côté serveur uniquement
7. **Pas de migration Prisma** (`prisma migrate`) — utiliser `prisma db push` (DB Supabase cloud)

---

## Variables d'environnement

```bash
# .env.local (runtime Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://fnndeoqzqfxpznhcundq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_STORAGE_BUCKET=spot-images
DATABASE_URL=postgresql://postgres:...@db.fnndeoqzqfxpznhcundq.supabase.co:5432/postgres
NEXT_PUBLIC_MAP_STYLE=https://tiles.openfreemap.org/styles/liberty

# .env (Prisma CLI — même DATABASE_URL)
DATABASE_URL=...
```
