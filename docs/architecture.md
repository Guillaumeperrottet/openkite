# Architecture Openwind

Vue d'ensemble technique de l'application pour les contributeurs.

---

## Stack

- **Next.js 16** (App Router) — Server Components par défaut, `"use client"` si interactivité
- **TypeScript strict** — `noEmit` vérifié à chaque commit, zéro `any`
- **Tailwind v4** + `tailwind-merge` + `clsx`
- **MapLibre GL 5** — rendu carte WebGL, couches GL uniquement (pas de DOM markers)
- **Prisma 7** — ORM PostgreSQL avec adaptateur PrismaPg
- **Supabase** — Auth (email/OAuth), PostgreSQL, Storage (bucket `spot-images`)
- **Vercel** — Hosting, Cron jobs

## Arborescence

```
src/
  app/                        # App Router (pages + API routes)
    api/                      # Endpoints REST
      spots/                  # CRUD spots + images + archives
      stations/               # Lecture stations multi-réseau
      wind/                   # Grille batch pour overlay carte (texture + grid)
      plan/                   # Planificateur de voyages
      favorites/              # Toggle favoris (auth)
      preferences/            # Préférences UI (auth)
      forum/                  # Categories, topics, posts, votes
      auth/sync/              # Sync Supabase Auth → Prisma User
      cron/stations/          # Cron 10min → DB StationMeasurement
    spots/[id]/               # Détail spot (prévisions, boussole, archives)
    plan/                     # Trip planner
    forum/                    # Forum communautaire
    stations/[id]/            # Détail station + historique 48h
  components/
    map/                      # KiteMap (GL), popups, wind overlay
    spot/                     # ForecastTable, WindCompass, WindArchives...
    plan/                     # TripPlanner, PlanFilters
    forum/                    # NewTopicForm, PostThread, ReplyForm, VoteButtons
    ui/                       # AuthModal, Badge, Button, Navbar, SearchBar
  lib/                        # Logique métier (fetch, scoring, helpers)
  types/                      # Types TypeScript partagés
  generated/prisma/           # Client Prisma auto-généré (ne pas éditer)
prisma/
  schema.prisma               # 12 modèles + 3 enums
  migrations/                 # SQL historique
```

---

## Sources de données vent

L'application combine **5 réseaux de stations en temps réel** et **1 API de prévisions/archives**.

### MeteoSwiss SwissMetNet (`lib/stations.ts`)

- Endpoint GeoJSON public : `data.geo.admin.ch`
- 154 stations suisses, mise à jour toutes les 10 minutes
- Coordonnées LV95 (EPSG:2056) converties en WGS84 via `lv95ToWgs84()` (formule swisstopo)
- Historique CSV OGD (~2h de retard), complété par les mesures en DB

### Pioupiou OpenWindMap (`lib/pioupiou.ts`)

- API REST : `api.pioupiou.fr/v1/live/all`
- ~600 stations communautaires mondiales, ~4 min de rafraîchissement
- **WebSocket push** : `socket.io` pour mises à jour temps réel côté carte
- Archive 48h : API `/v1/archive`

### Netatmo (`lib/netatmo.ts`)

- API OAuth2 : `api.netatmo.com`
- Stations publiques avec anémomètre (module NAModule2)
- Token rotation automatique : `refresh_token` persisté en DB `SystemConfig`
- Zones configurées : Suisse + Sud de la France (extensible)

### Météo-France SYNOP (`lib/meteofrance.ts`)

- API REST : `public-api.meteofrance.fr/public/DPObs/v1/synop`
- ~185 stations SYNOP en France, mise à jour toutes les 3 heures
- Auth par header `apikey` (clé permanente ~2 ans)
- Données : ff (vent m/s → km/h), dd (direction), raf10 (rafales), t (temp Kelvin → °C)
- ID préfixé `mf-{numer_sta}` pour éviter les collisions
- Historique : DB (cron 10min) + fallback Open-Meteo grille

### Windball / Windfox (`lib/windball.ts`)

- ~15–25 stations LoRa en Suisse romande (Fribourg / Vaud)
- API publique : `server.windball.ch/device/all` + `/device/one/{id}`
- Mesures toutes les ~10 minutes (LoRaWAN)
- Données : windSpeed & windBurst (km/h), windDir (°), temperature (°C)
- ID préfixé `windball-{deviceId}` (ex: `windball-wb-05`)
- Historique : 60 dernières mesures (~10h) via l'API, complété par DB (cron)

### Open-Meteo (`lib/forecast.ts`, `lib/windFetch.ts`, `lib/archives.ts`)

- Prévisions horaires 7 jours : vent, rafales, température, précipitations, vagues
- Archives historiques 5 ans : données journalières pour les roses des vents
- Vent courant : `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`
- Gratuit, sans clé API. Batch jusqu'à 50 coordonnées par requête

---

## Carte — KiteMap.tsx

### Source unique combinée

Toutes les features (stations + spots) sont dans une **source GeoJSON unique** nommée `combined-source` :

```
combined-source (GeoJSON, clustered)
  ├── featureType: "station"   → cercles colorés + flèches + labels vitesse
  └── featureType: "spot"      → cercles + highlightement + pulse
```

La fusion est gérée par `updateCombinedSource()` qui merge `stationFeaturesRef.current` et `spotFeaturesRef.current`.

### Clustering

| Paramètre        | Valeur                              |
| ---------------- | ----------------------------------- |
| `clusterMaxZoom` | 7 (déclustering à partir du zoom 8) |
| `clusterRadius`  | 60                                  |
| Niveaux          | 3 : < 20, 20–100, 100+              |

### Layers GL

| Layer ID               | Type   | Filtre                                           |
| ---------------------- | ------ | ------------------------------------------------ |
| `spots-clusters`       | circle | `["has", "point_count"]`                         |
| `spots-cluster-count`  | symbol | `["has", "point_count"]`                         |
| `stations-circle`      | circle | `featureType == "station"`                       |
| `stations-tail`        | symbol | `featureType == "station"` (flèche direction)    |
| `stations-speed-label` | symbol | `featureType == "station"` (vitesse en kts/km/h) |
| `stations-pulse`       | circle | station + vent ≥ 22 km/h                         |
| `spots-circle`         | circle | `featureType == "spot"`                          |
| `spots-pulse`          | circle | spot + vent ≥ 22 km/h                            |
| `spots-highlight`      | circle | id == highlightSpotId                            |

### Wind Overlay GPU (`useWindOverlay.ts`)

Couche WebGL2 de particules animées :

- Grille adaptative selon le zoom (3.0° à < zoom 4, 0.35° à ≥ zoom 7)
- Fetch via `POST /api/wind/grid` (rate limité à 80 appels/min côté serveur)
- Texture encodée par `buildWindTexture()`, rendue via shaders GLSL dans `windgl/`

### Pioupiou WebSocket

Connexion `socket.io` vers `api.pioupiou.fr/v1/push` :

- Événement `"measurement"` → mise à jour in-place de `stationsRef.current` → re-render GL

---

## Cohérence des valeurs de vent (popup carte ↔ page spot ↔ chart)

**Règle d'or** : popup carte, cards "Vent moyen / Rafales / Direction" de la page spot et **dernière barre du chart 48 h** doivent toujours afficher la même valeur et le même horodatage.

### Source unique : `stationData.ts` (server-only)

Toute la logique de résolution du vent courant est centralisée dans `src/lib/stationData.ts` :

| Fonction                      | Rôle                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `getStationLive(id, opts)`    | DB + overlay live Pioupiou/Windball → fraîcheur → fallback |
| `getSpotLive(spotId)`         | `nearestStationId` → `getStationLive` → fallback Open-Meteo |
| `getStationHistory(id, opts)` | Observations DB + prévisions NWP strictement séparées       |
| `getStationFromCache(id)`     | Lecture snapshot `SystemConfig.stations_cache`              |

Les seuils de fraîcheur par réseau sont dans `src/lib/stationConstants.ts` (importable côté client) :

| Réseau        | Fenêtre de fraîcheur |
| ------------- | -------------------- |
| `pioupiou`    | 20 min               |
| `meteoswiss`  | 1 h                  |
| `netatmo`     | 30 min              |
| `windball`    | 30 min              |
| `meteofrance` | 4 h                  |

### SWR côté client

Deux hooks SWR remplacent tous les `useEffect` de polling manuel :

| Hook                             | Endpoint                      | Interval | Utilisé dans                  |
| -------------------------------- | ----------------------------- | -------- | ----------------------------- |
| `useSpotLive(spotId, override?)` | `GET /api/spots/[id]/live`    | 60 s     | SpotPageClient, KiteMap popup |
| `useStationLive(stationId)`      | `GET /api/stations/[id]/live` | 60 s     | StationPopup header           |

Deduplication SWR : si SpotPageClient et KiteMap ont le même spot sélectionné simultanément, un seul fetch est émis (`dedupingInterval: 30 s`).

### Flux complet (spot avec station)

```
DB StationMeasurement + overlay live Pioupiou/Windball
  └── getStationLive()           ← fraîcheur per-network (stationConstants.ts)
        ├── frais  → WindLive { source: "réseau", isFresh: true }
        └── périmé → fetchCurrentWind() → WindLive { source: "openmeteo", isFresh: true }
                    ↕
          /api/spots/[id]/live   (cache CDN 60 s)
                    ↕
   useSpotLive()  →  wind useMemo  →  cards + popup carte + boussole
```

### SSR vs client

- **SSR** (`page.tsx`) : appelle `getSpotLive(spotId)` ou `getStationLive(stationId)` → valeur initiale hydratée immédiatement.
- **Client** : `useSpotLive` / `useStationLive` prennent le relais dès le montage, polling toutes les 60 s.
- Le fallback SSR reste visible jusqu'au premier fetch SWR réussi (`keepPreviousData: true`).

### Spot sans station (`nearestStationId = null`)

`getSpotLive()` saute directement à Open-Meteo via les coordonnées du spot. Assigner une station via `PATCH /api/spots/[id]` invalide le cache SSR (`revalidatePath`) ; SWR refetch en ≤ 60 s — propagation automatique partout.

### Caches alignés à 60 s

| Cache                                     | TTL  |
| ----------------------------------------- | ---- |
| `/api/spots/[id]/live` (CDN)              | 60 s |
| `/api/stations/[id]/live` (CDN)           | 60 s |
| `/api/stations/[id]/history` (CDN)        | 60 s |
| `/api/stations` (CDN)                     | 60 s |
| SWR client (useSpotLive / useStationLive) | 60 s |

---

## Scoring vent — Trip Planner

### Deux chemins

| Horizon    | Source                    | Méthode                                              |
| ---------- | ------------------------- | ---------------------------------------------------- |
| ≤ 16 jours | Open-Meteo prévisions     | `fetchForecastBatch()` → `analyzeMultiDay()`         |
| > 16 jours | Open-Meteo archives 5 ans | `fetchWindArchives()` → scores mensuels synthétiques |

### Kite (seuils 15–45 km/h, idéal 20–35)

- **35%** heures rideable (15–45 km/h)
- **25%** qualité vent (gaussienne centrée à 27 km/h)
- **20%** régularité (ratio rafales < 1.45)
- **20%** direction (match `bestWindDirections`)

### Parapente (seuils 0–15 km/h, idéal 0–10)

- **30%** heures calmes (< 15 km/h)
- **30%** ensoleillement (couverture nuageuse inversée)
- **20%** faibles rafales (< 40 km/h max)
- **20%** pas de pluie (< 5 mm total)

---

## Authentification

### Flux

1. **AuthModal** → `supabase.auth.signInWithPassword()` ou OAuth (Google/GitHub)
2. Callback → `/auth/callback` → échange du code
3. Post-login → `POST /api/auth/sync` → upsert `User` en DB Prisma
4. `useAuth()` → hook non-bloquant qui expose `{ user, loading, signOut }`
5. `FavProvider` → context global combinant auth + favoris + modal

### Protection des routes

| Ressource                 | Auth requise ?         |
| ------------------------- | ---------------------- |
| Spots (lecture, création) | Non                    |
| Favoris (POST)            | Oui                    |
| Préférences (PATCH)       | Oui                    |
| Forum (lecture)           | Non                    |
| Forum (écriture)          | Oui                    |
| Forum admin               | Oui + `ADMIN_USER_IDS` |
| Cron                      | Bearer `CRON_SECRET`   |

---

## Forum

### Hiérarchie

```
ForumCategory
  └── ForumTopic (markdown, pinned, locked)
        ├── ForumVote (+1/-1)
        └── ForumPost (replies, threadées via parentId)
              ├── ForumVote (+1/-1)
              └── ForumPost (enfants récursifs)
```

### Threading

Les posts utilisent `parentId` (self-referential). L'arbre est construit côté serveur dans `GET /api/forum/topics/[id]` :

1. Fetch plat ordonné par `createdAt`
2. Construction `Map<id, PostNode>` avec `children[]`
3. Rattachement des enfants aux parents → retour des racines

### Votes

- Valeur exactement `+1` ou `-1`
- Même valeur = suppression du vote, valeur différente = mise à jour
- Contrainte unique `[userId, topicId]` et `[userId, postId]`

---

## Base de données (Prisma)

### 12 modèles

| Modèle               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `Spot`               | Lieu kite/parapente avec sportType, bestWindDirections, nearestStationId |
| `SpotImage`          | Photos Supabase Storage (cascade delete)                                 |
| `WindReport`         | Observations communautaires (rating 1–5)                                 |
| `User`               | Sync Supabase Auth (UUID)                                                |
| `UserPreference`     | sportFilter + useKnots                                                   |
| `Favorite`           | Bookmarks (unique userId+spotId)                                         |
| `StationMeasurement` | Mesures temps réel (cron 10min, pruning 3j)                              |
| `SystemConfig`       | Key-value (token Netatmo rotatif)                                        |
| `ForumCategory`      | Sections (slug, ordre, icône)                                            |
| `ForumTopic`         | Discussions (markdown, pinned, locked)                                   |
| `ForumPost`          | Réponses threadées (parentId récursif)                                   |
| `ForumVote`          | Votes +1/-1 (uniques par user)                                           |

### 3 enums

- `Difficulty` : BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
- `WaterType` : FLAT, CHOP, WAVES, MIXED
- `SportType` : KITE, PARAGLIDE

### Relations principales

- Spot → SpotImage, WindReport, Favorite (1:N, cascade)
- User → Favorite, ForumTopic, ForumPost, ForumVote, UserPreference (1:N/1:1, cascade)
- ForumCategory → ForumTopic (1:N, cascade)
- ForumTopic → ForumPost, ForumVote (1:N, cascade)
- ForumPost → ForumPost (self-referential via `parentId`, cascade)

---

## Cron Job

`GET /api/cron/stations` — exécuté toutes les **10 minutes** par Vercel Cron.

1. Fetch 5 réseaux via `Promise.allSettled()`
2. Filtre les valeurs invalides (vitesse > 500, direction > 360)
3. Insert batch par chunks de 500 (`skipDuplicates`)
4. Prune les enregistrements > 3 jours

Protégé par header `Authorization: Bearer {CRON_SECRET}`.
