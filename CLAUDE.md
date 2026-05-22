@AGENTS.md

# Openwind — Guide IA

## Vue d'ensemble

Application open source de cartographie interactive des spots de kitesurf et parapente, avec données de vent en direct (5 réseaux de stations), prévisions météo 7 jours, archives historiques 5 ans, planificateur de voyages multi-sport et forum communautaire.

- **URL prod** : `https://openwind.ch`
- **URL locale** : `http://localhost:3000`
- **Stack** : Next.js 16.2.2 (App Router) · TypeScript strict · Tailwind v4 · MapLibre GL 5 · Prisma 7 · Supabase

---

## Commandes essentielles

```bash
pnpm dev               # dev server (localhost:3000)
pnpm build             # build de prod (inclut prisma generate)
pnpm exec tsc --noEmit # vérification TypeScript (doit retourner 0 erreur)
pnpm lint              # ESLint
pnpm prisma migrate dev # migration Prisma (utilise DIRECT_URL dans .env)
pnpm prisma studio     # interface visuelle DB
```

> **Important** : Prisma CLI lit `.env` (pas `.env.local`). Toujours garder `DATABASE_URL` et `DIRECT_URL` dans `.env`.

---

## Architecture

```
src/
  app/                  # Next.js App Router
    api/
      spots/            # CRUD spots (Prisma + Supabase)
      stations/         # GET → MeteoSwiss + Pioupiou + Netatmo + Météo-France + Windball combinés
      wind/             # Vent courant + grille batch
      plan/             # Planificateur de voyages (scoring multi-sport)
      favorites/        # Toggle favoris utilisateur
      preferences/      # Préférences UI (sport, unités)
      forum/            # Categories, topics, posts, votes
      auth/sync/        # Sync Supabase Auth → Prisma User
      cron/stations/    # Cron Vercel 10min → StationMeasurement
    spots/
      [id]/             # Détail spot (ForecastTable + WindCompass + Archives)
      new/              # Formulaire création spot
    plan/               # Trip planner
    forum/              # Forum communautaire
      [slug]/           # Catégorie / topic
    stations/
      [id]/             # Détail station + historique 48h
    auth/               # Callback OAuth + reset password
  components/
    map/
      KiteMap.tsx        # Carte principale (combined-source GL clustered)
      SpotPopup.tsx      # Popup React pour les spots
      StationPopup.tsx   # Popup station avec historique 48h
      useWindOverlay.ts  # Overlay vent GPU (particules WebGL)
      windgl/            # Shaders GLSL pour overlay GPU
    spot/
      ForecastTable.tsx  # Tableau Windguru-style 7j
      WindChart.tsx      # Graphique vent
      WindCompass.tsx     # Boussole vent
      WindArchives.tsx    # Archives mensuelles 5 ans
      WindHistoryChart.tsx # Historique 48h (area chart)
      WindDirectionRose.tsx
      WindFrequencyRose.tsx
      CreateSpotForm.tsx # Formulaire création spot (Zod)
      useNearbyStations.ts
      useSpotImages.ts
    plan/
      TripPlanner.tsx    # Planificateur avec bottom-sheet mobile
      PlanFilters.tsx    # Filtres (lieu, dates, rayon, sport)
    forum/
      NewTopicForm.tsx   # Création topic (markdown)
      PostThread.tsx     # Fil de discussion threadé
      ReplyForm.tsx      # Réponse (markdown)
      VoteButtons.tsx    # Votes +1/-1
      Markdown.tsx       # Rendu markdown (react-markdown)
    ui/
      AuthModal.tsx      # Modal connexion/inscription
      Badge.tsx          # Badge difficulté / type d'eau
      Button.tsx         # Bouton réutilisable
      Navbar.tsx         # Barre de navigation
      SearchBar.tsx      # Recherche de spots
  lib/
    stations.ts         # fetchMeteoSwissStations() + lv95ToWgs84()
    pioupiou.ts         # fetchPioupiouStations() + archive 48h
    netatmo.ts          # fetchNetatmoStations() + token rotation OAuth2
    meteofrance.ts      # fetchMeteoFranceStations() + SYNOP API
    windball.ts         # fetchWindballStations() + fetchWindballHistory()
    forecast.ts         # Open-Meteo 7j (HourlyPoint, FullForecast, kitableScore)
    wind.ts             # Barrel re-export (windFetch + windScoring + windHistory)
    windFetch.ts        # fetchCurrentWind(), fetchForecastBatch()
    windScoring.ts      # analyzeForecast(), scoreDayForecast(), analyzeMultiDay()
    windHistory.ts      # fetchWindHistoryStation() (DB + CSV + Pioupiou + Windball merge)
    archives.ts         # fetchWindArchives() (5 ans, cache 7j)
    utils.ts            # windColor(), windConditionLabel(), haversineKm(), cn()
    forum.ts            # timeAgo(), slugify()
    prisma.ts           # Singleton PrismaClient + PrismaPg adapter
    useAuth.ts          # Hook auth Supabase (non-bloquant)
    useFavorites.ts     # Hook favoris (optimistic toggle)
    FavContext.tsx       # Context global Auth + Favoris
    supabase/
      client.ts         # Supabase côté client
      server.ts         # Supabase côté serveur (cookies)
  types/                # Spot, WindData, DayAnalysis, ForecastHour, etc.
  generated/prisma/     # Client Prisma auto-généré (ne pas éditer)
prisma/
  schema.prisma         # 12 modèles + 3 enums
  migrations/           # Historique migrations SQL
  seed.ts               # Données spots initiales
  worldwide-spots.json  # Import mondial
```

---

## Sources de données vent

### MeteoSwiss SwissMetNet

- **Endpoint** : `https://data.geo.admin.ch/...` (GeoJSON public, gratuit)
- **154 stations** suisses, mise à jour toutes les **10 minutes**
- **Coordonnées** : LV95 (EPSG:2056) converties en WGS84 via `lv95ToWgs84()` (formule swisstopo, précision ~1m)
- **Historique** : CSV OGD (~2h de délai), complété par StationMeasurement en DB

### Pioupiou (OpenWindMap)

- **Endpoint** : `https://api.pioupiou.fr/v1/live/all`
- **~600 stations** communautaires mondiales, ~4 min
- **WebSocket push** : `socket.io` pour mises à jour temps réel
- **Archive** : API `/v1/archive` (48h)

### Netatmo

- **Endpoint** : `api.netatmo.com` (OAuth2)
- **Stations publiques** avec anémomètre (NAModule2)
- **Token rotation** : refresh_token persisté en DB `SystemConfig`
- **Zones** : CH + Sud de la France (extensible)

### Météo-France SYNOP (`lib/meteofrance.ts`)

- **Endpoint** : `https://public-api.meteofrance.fr/public/DPObs/v1/synop`
- **~185 stations** SYNOP en France, mise à jour toutes les **3 heures**
- **Auth** : header `apikey` (clé permanente ~2 ans)
- **Données** : ff (vent m/s → km/h), dd (direction °), raf10 (rafales m/s), t (temp Kelvin → °C)
- **ID préfixé** : `mf-{numer_sta}` (ex: `mf-07005`)
- **Historique** : DB (cron 10min) + fallback Open-Meteo grille

### Windball / Windfox (`lib/windball.ts`)

- **Endpoint** : `https://server.windball.ch/device/all` + `/device/one/{id}`
- **~15–25 stations** LoRa en Suisse romande (Fribourg / Vaud), mise à jour toutes les **~10 minutes**
- **Auth** : aucune (API publique, pas de clé)
- **Données** : windSpeed & windBurst (km/h), windDir (°), temperature (°C)
- **ID préfixé** : `windball-{deviceId}` (ex: `windball-wb-05`)
- **Historique** : 60 dernières mesures (~10h) via `/device/one/{id}`, complété par DB (cron)
- **Types** : Windball (anémomètre à balle) et Windfox (girouette/coupelles)

### Open-Meteo

- **Vent courant** : `current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`
- **Prévisions** : 7 jours horaires + vagues marines
- **Archives** : 5 ans de données historiques journalières
- **Batch** : jusqu'à 50 coordonnées par requête
- **Gratuit, sans clé API**

---

## Carte (KiteMap.tsx) — Règles importantes

### Rendu GL (WebGL)

- **Source unique `combined-source`** (GeoJSON clustered) pour stations + spots
- Propriété `featureType: "station" | "spot"` distingue les features
- Ne jamais migrer vers des DOM markers pour les stations — GL uniquement

### Layers

| Layer ID               | Type   | Source          | Filtre                              |
| ---------------------- | ------ | --------------- | ----------------------------------- |
| `spots-clusters`       | circle | combined-source | `["has", "point_count"]`            |
| `spots-cluster-count`  | symbol | combined-source | `["has", "point_count"]`            |
| `stations-circle`      | circle | combined-source | `featureType == "station"`          |
| `stations-tail`        | symbol | combined-source | `featureType == "station"` (flèche) |
| `stations-speed-label` | symbol | combined-source | `featureType == "station"` (kts)    |
| `stations-pulse`       | circle | combined-source | `station + wind >= 22 km/h`         |
| `spots-circle`         | circle | combined-source | `featureType == "spot"`             |
| `spots-pulse`          | circle | combined-source | `spot + wind >= 22 km/h`            |
| `spots-highlight`      | circle | combined-source | `id == highlightSpotId`             |

### Clustering

- `clusterMaxZoom: 7` — déclustering à partir du zoom 8
- `clusterRadius: 60` — fusion agressive dézoomé
- 3 niveaux de taille : <20, 20–100, 100+

### Popups GL

- MapLibre enveloppe le HTML dans `.maplibregl-popup-content` (fond blanc par défaut)
- **Fix** : injection CSS dans `<head>` via `<style id="ml-popup-reset">` dans `map.on("load")`
- Ne pas utiliser `.setPopup()` avec du HTML qui dépend d'un state React — utiliser `useKnotsRef.current` (ref)

### Comportement par défaut

- **Balises live** : ON au chargement
- **Géolocalisation** : auto-trigger au load (première visite uniquement)
- **Unité** : kts par défaut
- **Filtre sport** : ALL par défaut, persisté via /api/preferences

---

## Scoring vent (Trip Planner)

### Kite (seuils 15–45 km/h, idéal 20–35)

- Heures rideable : **35%**
- Qualité vent (gaussienne centrée 27 km/h) : **25%**
- Régularité (ratio rafales < 1.45) : **20%**
- Direction (match bestWindDirections) : **20%**

### Parapente (seuils 0–15 km/h, idéal 0–10)

- Heures calme : **30%**
- Ensoleillement (couverture nuageuse inverse) : **30%**
- Faibles rafales : **20%**
- Pas de pluie : **20%**

### Mode planner

- **≤ 16 jours** : prévisions Open-Meteo temps réel + `analyzeMultiDay()`
- **> 16 jours** : archives historiques 5 ans + scores mensuels synthétiques
- **Jours cliquables** : clic sur un rond de jour → la carte entière se met à jour

---

## Unités de vent

- **Toujours afficher en kts par défaut**
- km/h en secondaire (muted)
- Toggle `[km/h | kts]` dans la légende en bas à gauche
- `useKnotsRef` (ref) garde les handlers GL en sync avec le state React
- Conversion : `kts = Math.round(kmh / 1.852)`
- Préférence persistée en DB via /api/preferences

---

## UI / Design

- **Thème** : light uniquement
- **Langue interface** : français
- Composants Tailwind — pas de librairie UI externe
- `tailwind-merge` + `clsx` pour les classes conditionnelles
- **Icônes** : `lucide-react`
- **Markdown** : `react-markdown` (forum)

### Palette couleurs vent — Balises (par km/h)

| Plage km/h | Couleur   | Usage         |
| ---------- | --------- | ------------- |
| < 8        | `#c8d4dc` | Très calme    |
| 8–15       | `#d0d0d0` | Calme         |
| 15–22      | `#a8bdd4` | Léger         |
| 22–30      | `#6a9cbd` | Modéré        |
| 30–38      | `#3a7fa8` | Bon (kitable) |
| 38–50      | `#e07720` | Fort          |
| > 50       | `#cc3333` | Danger        |

---

## Schéma DB (Prisma) — 12 modèles

### Enums

- `Difficulty` : BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
- `WaterType` : FLAT | CHOP | WAVES | MIXED
- `SportType` : KITE | PARAGLIDE

### Modèles principaux

- **Spot** — Lieu kite/parapente avec sportType, bestWindDirections, nearestStationId
- **SpotImage** — Photos (cascade delete)
- **WindReport** — Observations communautaires (rating 1–5)
- **User** — Sync Supabase Auth (UUID)
- **UserPreference** — sportFilter + useKnots
- **Favorite** — Bookmarks (unique userId+spotId)
- **StationMeasurement** — Mesures temps réel (cron 10min, pruning 3j)
- **SystemConfig** — Key-value (token Netatmo rotatif)

### Forum

- **ForumCategory** — Sections (slug, ordre, icône)
- **ForumTopic** — Discussions (markdown, pinned, locked)
- **ForumPost** — Réponses threadées (parentId → récursif)
- **ForumVote** — +1/-1 (unique userId + topicId/postId)

---

## Cron Jobs

- `/api/cron/stations` — Toutes les **10 minutes** via Vercel Cron
  - Fetch MeteoSwiss + Pioupiou + Netatmo + Météo-France + Windball
  - Store en StationMeasurement
  - Prune > 3 jours
  - Protégé par `CRON_SECRET` (Bearer token)

---

## Cohérence vent (popup carte ↔ page spot ↔ chart 48h)

**Règle absolue** : la valeur affichée dans le popup carte, sur les cards "Vent moyen / Rafales / Direction" de la page spot et la **dernière barre du chart 48 h** doivent toujours être identiques (mêmes kts, même `il y a X min`).

### Source unique : `stationData.ts`

- `getStationLive()` sélectionne la vraie mesure station la plus fraîche : DB `StationMeasurement` + overlay live Pioupiou/Windball, puis compare les timestamps.
- `getSpotLive()` réutilise `getStationLive()` pour la station assignée (`nearestStationId`) et ne bascule sur Open-Meteo que si cette mesure est stale.
- `SpotPageClient.tsx`, `KiteMap` et `StationPopup.tsx` consomment `useSpotLive()` / `useStationLive()` côté client (polling 60 s, cache SWR partagé).
- `chartHistory` injecte le point live quand il est plus récent que la dernière barre mesurée → dernière barre = cards/popup.

### Overlays dans `/api/stations`

1. Snapshot `SystemConfig.stations_cache` (cron 10 min)
2. `overlayLatestMeasurements()` — DB `StationMeasurement` ≤ 30 min
3. `overlayLiveNetworks()` — re-fetch live Windball + Pioupiou (60 s)

CDN : `s-maxage=60, stale-while-revalidate=300`.

### SSR page spot

- Appelle `getSpotLive()`. Station assignée fraîche → vraie mesure station. Station stale/absente → Open-Meteo aux coordonnées du spot.

### Caches calés sur 60 s

Tous les TTL en bord de chaîne (Windball, Pioupiou, `/api/stations`, `/api/spots/[id]/weather`, `/api/stations/[id]/history`, polling client) sont à **60 s**.

### Chart 48 h : bypass DB pour Windball/Pioupiou

`fetchWindHistoryStation()` (dans `lib/windHistory.ts`) n'utilise **que l'API** pour ces deux réseaux (pas de merge DB+API) → plus de doubles barres.

### Règles à respecter

1. Ne jamais réimplémenter le fallback Open-Meteo dans une UI : il appartient à `getSpotLive()`.
2. Ne pas dériver les cards depuis `history` (ce qui re-introduirait un décalage avec le popup).
3. Si tu touches au TTL d'un cache amont (`windball.ts`, `pioupiou.ts`, route handlers), garde 60 s pour ne pas désaligner les fenêtres CDN.
4. Toute nouvelle UI affichant le vent courant d'une balise doit lire `useStationLive()` ou `useSpotLive()` (jamais reconstruire à partir de l'historique).

---

## Règles de développement

1. **Ne jamais casser le build** — toujours vérifier avec `pnpm exec tsc --noEmit`
2. **Pas de `any` TypeScript** — utiliser `unknown` si nécessaire
3. **Pas de console.log en production** — `try/catch` silencieux pour erreurs non-critiques
4. **Server Components par défaut** — `"use client"` uniquement si interactivité/hooks
5. **API routes** : `NextResponse.json()` + bons codes HTTP (400, 401, 404, 503)
6. **Images Supabase** : bucket `spot-images`, service role côté serveur uniquement
7. **Migrations** : `prisma migrate dev` (pas `db push`)
8. **Validation** : Zod sur toutes les API POST/PATCH
9. **GL layers** : jamais de DOM markers pour stations/spots en masse
10. **ISR / cache** : 60 s pour tout ce qui touche au vent courant (`/api/stations`, `/api/spots/[id]/weather`, `/api/stations/[id]/history`, `windball.ts`, `pioupiou.ts`). 30 min pour les prévisions, 7 j pour les archives. Voir « Cohérence vent » plus bas.

---

## Variables d'environnement

```bash
# .env (Prisma CLI)
DATABASE_URL=postgresql://...        # Connection pooler (pgBouncer)
DIRECT_URL=postgresql://...          # Direct (migrations)

# .env.local (Next.js runtime)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_STORAGE_BUCKET=spot-images
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_MAP_STYLE=https://tiles.openfreemap.org/styles/liberty
NEXT_PUBLIC_OWM_API_KEY=...          # OpenWeatherMap (overlay optionnel)
CRON_SECRET=...                      # Protège /api/cron/*
ADMIN_USER_IDS=uuid1,uuid2           # Admins forum
NETATMO_CLIENT_ID=...
NETATMO_CLIENT_SECRET=...
NETATMO_REFRESH_TOKEN=...            # Initial, ensuite rotaté via DB
METEOFRANCE_API_KEY=...              # Clé API permanente (portail-api.meteofrance.fr)
```

> **⚠️ Ne jamais committer `.env` ou `.env.local`** — utiliser `.env.example` comme template.
