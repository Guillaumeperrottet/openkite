# Architecture données vent — Openwind

> **Statut** : en vigueur depuis le 8 mai 2026 (refactor cohérence données).
> **Audience** : contributeur, prochaine session Claude, ou toi dans 6 mois.

---

## Le principe central

**Une seule source de vérité par type de donnée.**

Avant ce refactor, chaque vue de l'application (popup carte, page spot, page station, chart 48 h) faisait son propre appel réseau avec sa propre logique de fraîcheur. Résultat : trois valeurs différentes pour la même station affichées simultanément sur le même écran.

Aujourd'hui, toute donnée vent passe par un seul point d'entrée côté serveur — `src/lib/stationData.ts` — et par des hooks SWR côté client qui partagent automatiquement le même cache. Si tu affiches la station VEV à 5 endroits différents, ils affichent tous exactement la même valeur.

---

## Comment une valeur vent arrive à l'écran

### Côté serveur (SSR — rendu initial de la page)

```
Navigateur demande /spots/corseaux
        ↓
spots/[id]/page.tsx
        ↓
getSpotLive("corseaux-id")          ← stationData.ts
        ↓
  1. Cherche la station assignée au spot (nearestStationId)
  2. Résout la mesure station la plus fraîche disponible
     (StationMeasurement + overlay live Pioupiou/Windball)
  3. La mesure est fraîche ? → retourne l'obs station
     La mesure est périmée ? → appelle Open-Meteo aux coords du spot
        ↓
WindLive { windSpeedKmh, windDirection, gustsKmh, source, isFresh, ... }
        ↓
Page HTML rendue avec les valeurs initiales
```

### Côté client (mise à jour en temps réel)

```
Page affichée dans le navigateur
        ↓
useSpotLive("corseaux-id")          ← lib/useSpotLive.ts (SWR)
        ↓
GET /api/spots/corseaux-id/live     ← toutes les 60 secondes
        ↓
Même logique que getSpotLive côté serveur
        ↓
Toutes les vues qui ont appelé useSpotLive("corseaux-id")
se mettent à jour simultanément — 1 seul fetch, N composants
```

---

## Les deux hooks SWR à connaître

| Hook                        | Fichier                     | Quand l'utiliser                                            |
| --------------------------- | --------------------------- | ----------------------------------------------------------- |
| `useSpotLive(spotId)`       | `src/lib/useSpotLive.ts`    | Vent courant d'un **spot** (popup carte, page spot, cards)  |
| `useStationLive(stationId)` | `src/lib/useStationLive.ts` | Vent courant d'une **station** (popup station sur la carte) |

SWR déduplique automatiquement : si deux composants appellent `useSpotLive("corseaux-id")` en même temps, il y a **un seul** appel réseau, les deux composants reçoivent la même réponse.

---

## La règle de fraîcheur par réseau

Toutes les décisions "cette mesure est-elle encore valable ?" sont centralisées dans `src/lib/stationConstants.ts` :

| Réseau          | Fenêtre de fraîcheur | Pourquoi                                                   |
| --------------- | -------------------- | ---------------------------------------------------------- |
| MeteoSwiss      | 1 heure              | Mesures toutes les 10 min, mais pannes/retards fréquents   |
| Pioupiou        | 20 minutes           | Push ~toutes les 4 min                                     |
| Netatmo         | 30 minutes           | Station privée, mise à jour variable                       |
| Météo-France    | 4 heures             | SYNOP toutes les 3 h — normal d'avoir des données de 2-3 h |
| Windball        | 30 minutes           | —                                                          |
| FribourgÉnergie | 30 minutes           | —                                                          |

**Règle** : si la mesure est plus vieille que cette fenêtre, on bascule sur Open-Meteo (modèle NWP) pour les spots. Pour les pages station, on affiche quand même la vieille mesure avec un badge "données anciennes".

Si tu veux modifier un seuil, **ne change que `stationConstants.ts`** — tout le reste s'aligne automatiquement.

---

## Où chaque donnée est produite

### Vent courant

```
src/lib/stationData.ts
├── getSpotLive(spotId)         → pour les spots (page + carte)
├── getStationLive(stationId)   → DB + overlay live Pioupiou/Windball + fallback
└── getStationFromCache(id)     → lookup rapide métadonnées (1 query DB)

src/app/api/spots/[id]/live/route.ts      → endpoint HTTP pour useSpotLive
src/app/api/stations/[id]/live/route.ts   → endpoint HTTP pour useStationLive
```

### Historique 48 h + prévisions

L'historique est produit par `getStationHistory()` dans `stationData.ts`. Il retourne deux tableaux **strictement séparés** :

- `observations` : vraies mesures de l'anémomètre, dans le passé
- `forecast` : points NWP Open-Meteo, dans le futur uniquement

Cette séparation élimine le bug VEV du 8 mai 2026 (voir ci-dessous) : il est maintenant **impossible** de confondre un point de prévision avec une observation réelle.

### Catalogue des stations (liste + métadonnées)

Le cron `/api/cron/stations` tourne toutes les 10 minutes, appelle les 5 réseaux et écrit deux choses en DB :

1. **`SystemConfig.stations_cache`** : snapshot JSON de toutes les stations avec leur vent actuel
2. **`StationMeasurement`** : chaque mesure individuellement, pour l'historique

`/api/stations` lit ce snapshot (60 s de cache CDN) et le sert à la carte. C'est rapide car c'est une seule lecture DB, pas 5 appels API.

---

## Où toucher quoi selon le besoin

| Besoin                                                | Fichier(s) à modifier                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Changer le seuil de fraîcheur d'un réseau             | `src/lib/stationConstants.ts` → `FRESHNESS_BY_NETWORK`                                                    |
| Ajouter un nouveau réseau de balises                  | `stationConstants.ts` (type + constante) + `stationData.ts` (logique) + `windFetch.ts` / `windHistory.ts` |
| Modifier la logique "station stale → fallback"        | `stationData.ts` → `getStationLive()`                                                                     |
| Modifier ce que voit la page spot au premier rendu    | `src/app/spots/[id]/page.tsx`                                                                             |
| Modifier ce que voit la page station au premier rendu | `src/app/stations/[id]/page.tsx`                                                                          |
| Modifier le popup station sur la carte                | `src/components/map/StationPopup.tsx`                                                                     |
| Modifier le popup spot sur la carte                   | `src/components/map/KiteMap.tsx` + `src/components/map/SpotPopup.tsx`                                     |
| Modifier le chart 48 h                                | `src/components/spot/WindHistoryChart.tsx`                                                                |

---

## Ce qui reste en dehors de cette architecture

Ces fonctionnalités utilisent des APIs différentes, pas liées au vent station :

- **Overlay vent grille** (la texture animée sur la carte) : `/api/wind/texture` + `/api/wind/grid` → `src/components/map/useWindOverlay.ts`. C'est Open-Meteo grille, pas des balises.
- **Prévisions 7 jours** (page spot) : `src/lib/forecast.ts` → Open-Meteo. Indépendant.
- **Webcams** : source externe, sans lien avec les données vent.

---

## Bug VEV — postmortem (8 mai 2026)

Le bug qui a déclenché ce refactor : sur la carte, le popup de la station VEV (Vevey, MeteoSwiss) affichait **1 kts** alors que la page station affichait **2 kts** au même moment.

**Cause** : le popup recalculait la "dernière valeur" en cherchant le dernier point de l'historique 48 h antérieur à maintenant (`lastPast`). Or l'historique mélangait observations et prévisions NWP dans le même tableau. Un point NWP de 09h15 (postérieur à la dernière vraie mesure de 09h00) était sélectionné à la place de l'observation réelle.

**Correction structurelle** : le popup station lit maintenant `useStationLive()`, qui appelle `/api/stations/[id]/live` → `getStationLive()` → lit les vraies mesures station uniquement (DB + overlay live selon réseau, jamais du NWP sur une page station). Il est structurellement impossible d'afficher une valeur NWP dans le header du popup station.
