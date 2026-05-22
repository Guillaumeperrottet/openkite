# Référence API

Tous les endpoints sont sous `/api/`. Les réponses sont en JSON.

---

## Spots

### `GET /api/spots`

Liste tous les spots. Optionnel : filtre par distance.

| Param    | Type   | Description                  |
| -------- | ------ | ---------------------------- |
| `lat`    | number | Latitude centre (optionnel)  |
| `lng`    | number | Longitude centre (optionnel) |
| `radius` | number | Rayon en km (optionnel)      |

**Réponse** : `Spot[]` avec `images[]`. Si filtre distance, ajoute `distanceKm`.

### `POST /api/spots`

Crée un spot. Validation Zod.

| Champ                | Type               | Requis |
| -------------------- | ------------------ | ------ |
| `name`               | string (min 2)     | Oui    |
| `latitude`           | number (-90..90)   | Oui    |
| `longitude`          | number (-180..180) | Oui    |
| `difficulty`         | Difficulty enum    | Oui    |
| `waterType`          | WaterType enum     | Oui    |
| `sportType`          | SportType enum     | Oui    |
| `minWindKmh`         | number (0..100)    | Oui    |
| `maxWindKmh`         | number (0..150)    | Oui    |
| `bestMonths`         | string[]           | Oui    |
| `bestWindDirections` | string[]           | Oui    |
| `hazards`            | string             | Non    |
| `access`             | string             | Non    |
| `nearestStationId`   | string             | Non    |

**Réponse** : `201` avec le spot créé.

### `GET /api/spots/[id]`

Détail d'un spot avec `images[]` et les 20 derniers `reports[]`.

### `PATCH /api/spots/[id]`

Met à jour un spot. Tous les champs sont optionnels. Validation : `maxWindKmh ≥ minWindKmh`.

### `DELETE /api/spots/[id]`

Supprime un spot. Réponse : `{ ok: true }`.

### `GET /api/spots/[id]/live`

Vent courant pour un spot. Résout automatiquement `nearestStationId` → station → Open-Meteo si stale ou absent.

| Param | Type | Requis | Description |
| --- | --- | --- | --- |
| `stationId` | string | Non | Override la station assignée au spot |

**Réponse** : `WindLive` (windSpeedKmh, windDirection, gustsKmh, updatedAt, source, isFresh, staleAt). Cache 60 s.

### `GET /api/spots/[id]/archives`

Archives vent 5 ans. Cache 7 jours (`s-maxage=604800`).

**Réponse** : `WindArchiveData` (stats mensuelles par année + combinées).

### `POST /api/spots/[id]/images`

Upload multipart/form-data. Champ `file` requis.

**Réponse** : `201` avec `SpotImage`.

### `DELETE /api/spots/[id]/images`

Suppression d'images. Body : `{ imageIds: string[] }`.

---

## Stations

### `GET /api/stations`

Toutes les stations combinées (MeteoSwiss + Pioupiou + Netatmo + Météo-France + Windball). Cache 60 s.

**Réponse** : `WindStation[]`

```ts
{
  (id,
    name,
    lat,
    lng,
    altitudeM,
    windSpeedKmh,
    windDirection,
    updatedAt,
    source);
}
```

### `GET /api/stations/[id]/live`

Vent courant pour une station (dernière vraie mesure station : DB + overlay live Pioupiou/Windball, jamais NWP). Utile pour rafraîchir l'en-tête de la popup carte sans polluer le chart.

**Réponse** : `WindLive` (windSpeedKmh, windDirection, gustsKmh, updatedAt, source, isFresh, staleAt). Cache 60 s.

### `GET /api/stations/[id]/history`

Historique 48h + prévisions futures. Le préfixe de l'ID détermine la source :

- `piou-*` → Pioupiou (DB + Archive API)
- `ntm-*` → Netatmo (DB + Open-Meteo fallback)
- `mf-*` → Météo-France (DB + Open-Meteo fallback)
- `windball-*` → Windball (DB + API archive + Open-Meteo fallback)
- Autre → MeteoSwiss (DB + CSV OGD + Open-Meteo forecast)

**Réponse** : `HistoryPoint[]`. Cache 60 s.

---

## Vent

### `POST /api/wind/grid`

Batch vent pour une grille de coordonnées. Rate limité (80 appels/min).

**Body** : `{ lats: number[], lngs: number[] }`

**Réponse** : Array de données vent Open-Meteo. Erreur `429` si rate limité.

---

## Planificateur

### `GET /api/plan`

Spots triés par score vent pour une période donnée.

| Param       | Type           | Défaut | Description                           |
| ----------- | -------------- | ------ | ------------------------------------- |
| `lat`       | number         | —      | Centre recherche (optionnel → global) |
| `lng`       | number         | —      | Centre recherche                      |
| `startDate` | YYYY-MM-DD     | —      | Début période                         |
| `endDate`   | YYYY-MM-DD     | —      | Fin période                           |
| `radius`    | number         | 150    | Rayon en km                           |
| `sport`     | KITE/PARAGLIDE | —      | Type de sport                         |

**Réponse** : Spots avec `days[]`, `bestScore`, `bestDayIndex`, `dataSource` ("forecast" ou "archive").

- ≤ 16 jours : prévisions Open-Meteo temps réel
- \> 16 jours : archives historiques 5 ans

---

## Favoris

### `GET /api/favorites`

**Auth** : optionnelle (retourne `{ spotIds: [] }` si non connecté).

### `POST /api/favorites`

**Auth** : requise.

**Body** : `{ spotId: string }`

Toggle : ajoute si absent, supprime si présent. **Réponse** : `{ favorited: boolean }`.

---

## Préférences

### `GET /api/preferences`

**Auth** : optionnelle (retourne défauts si non connecté).

**Réponse** : `{ sportFilter: "ALL"|"KITE"|"PARAGLIDE", useKnots: boolean }`

### `PATCH /api/preferences`

**Auth** : requise.

**Body** : `{ sportFilter?, useKnots? }`

---

## Forum

### `GET /api/forum/categories`

Liste des catégories avec compteurs et dernier topic.

### `POST /api/forum/categories`

**Admin uniquement**. Body : `{ name, description, icon?, order? }`.

### `PATCH/DELETE /api/forum/categories/[id]`

**Admin uniquement**.

### `GET /api/forum/topics?category=slug&page=1`

Topics paginés (20/page) avec score, auteur, compteur posts.

### `POST /api/forum/topics`

**Auth requise**. Body : `{ title, body, categorySlug }`.

### `GET /api/forum/topics/[id]`

Topic avec arbre de posts threadés (construction serveur).

### `PATCH /api/forum/topics/[id]`

**Auteur ou admin**. Body : `{ title?, body? }`. Seul l'admin peut modifier `pinned`.

### `DELETE /api/forum/topics/[id]`

**Auteur ou admin**.

### `POST /api/forum/posts`

**Auth requise**. Body : `{ topicId, parentId?, body }`.

### `PATCH/DELETE /api/forum/posts/[id]`

**Auteur ou admin**.

### `POST /api/forum/votes`

**Auth requise**. Body : `{ topicId?, postId?, value: 1|-1 }`.

Toggle : même valeur = suppression, valeur différente = mise à jour.

**Réponse** : `{ voted: 1|-1|null }`.

---

## Auth

### `POST /api/auth/sync`

**Auth requise**. Synchronise l'utilisateur Supabase Auth → table Prisma `User`. Appelé automatiquement après chaque connexion.

---

## Cron

### `GET /api/cron/stations`

**Auth** : Bearer `CRON_SECRET`. Exécuté toutes les 10 min par Vercel Cron.

Fetch les 5 réseaux → insert batch en DB → prune > 3 jours.

**Réponse** : `{ ok, stations, inserted, pruned }`.
