# Contribuer à OpenWind 🪁

Merci de ton intérêt pour OpenWind ! Ce projet est 100% open source et communautaire.

## 🌍 Philosophie

OpenWind doit rester **gratuit pour toujours** — pas de paywall, pas d'API payante cachée. Chaque dépendance doit être open source ou avoir un free tier généreux.

## 🐛 Signaler un bug

1. Vérifie que l'issue n'existe pas déjà
2. Ouvre une [nouvelle issue](https://github.com/Guillaumeperrottet/openwind/issues/new)
3. Inclus : description, étapes pour reproduire, comportement attendu, captures d'écran

## 💡 Proposer une feature

Ouvre une issue avec le label `enhancement` avant de coder. Ça évite le travail en double et permet de discuter de l'approche.

## 🔧 Setup développement

```bash
git clone https://github.com/Guillaumeperrottet/openwind.git
cd openwind
pnpm install
cp .env.example .env
cp .env.example .env.local
# Configure tes credentials Supabase dans les deux fichiers
pnpm exec prisma migrate dev
pnpm dev
```

## 📋 Workflow

1. Fork le repo
2. Crée une branche : `git checkout -b feat/ma-feature` ou `fix/mon-bug`
3. Code et teste localement
4. Commit avec un message clair : `feat: ajout du filtre par difficulté`
5. Push et ouvre une Pull Request

### Conventions de commits

```
feat:     nouvelle fonctionnalité
fix:      correction de bug
docs:     documentation seulement
style:    formatting, pas de changement de logique
refactor: refactoring sans nouvelle feature ni bug fix
perf:     amélioration de performance
test:     ajout de tests
```

## 🗂️ Où contribuer ?

### Spots de kite

Tu connais des spots pas encore dans la base ? [Ajoute-les directement](http://localhost:3000/spots/new) depuis l'interface !

### Code

| Zone          | Fichiers                                       | Description                           |
| ------------- | ---------------------------------------------- | ------------------------------------- |
| Carte         | `src/components/map/`                          | MapLibre GL, clustering, wind overlay |
| Vent          | `src/lib/wind*.ts`                             | Fetch, scoring, historique            |
| Stations      | `src/lib/stations.ts, pioupiou.ts, netatmo.ts` | 3 réseaux de mesures                  |
| Spots         | `src/components/spot/`                         | Prévisions, boussole, archives        |
| Planificateur | `src/components/plan/`                         | Trip planner multi-sport              |
| Forum         | `src/components/forum/`                        | Topics, posts threadés, votes         |
| API           | `src/app/api/`                                 | Endpoints REST                        |
| DB            | `prisma/schema.prisma`                         | 12 modèles + 3 enums                  |

### Idées de contributions bienvenues

- [ ] Filtres sur la carte (difficulté, type d'eau, vent actuel)
- [ ] Prévisions vague surf (API Stormglass open tier)
- [ ] Mode PWA / offline-first
- [ ] Import/export de données spots (JSON/GeoJSON)
- [ ] Traduction EN/ES/DE (i18n avec next-intl)
- [ ] Tests unitaires (vitest) et E2E (Playwright)
- [ ] Dark mode toggle
- [ ] Webcams (liens vers webcams publiques)
- [ ] Carte hors-ligne pour zones remote
- [ ] Nouvelles sources de stations vent (voir [docs/contributing-guide.md](./docs/contributing-guide.md))
- [ ] Nouveaux types de sport — windsurf, wing foil (voir [docs/contributing-guide.md](./docs/contributing-guide.md))

## 🏗️ Architecture décisions

### Pourquoi MapLibre et pas Leaflet ?

MapLibre supporte les styles vectoriels (plus léger, plus beau), les tuiles 3D, et est maintenu par une fondation open source. Leaflet reste plus simple mais moins puissant.

### Pourquoi Open-Meteo ?

100% gratuit, aucune clé API, données ERA5 + modèles météo de qualité pro, API REST simple. Alternative : OpenWeatherMap (limites plus strictes sur le free tier).

### Pourquoi Supabase ?

PostgreSQL managé + Auth + Storage dans un seul service, free tier généreux, et auto-hébergeable (open source). On pourrait migrer vers n'importe quel Postgres.

### Pourquoi pas de base de données spots intégrée ?

On démarre vide intentionnellement — les spots sont ajoutés par la communauté. Pour seeder des données de démo, voir `prisma/seed.ts` (à créer).

## 📐 Standards de code

- TypeScript strict (`noUncheckedIndexedAccess`)
- Pas de `any` sauf cas exceptionnel documenté
- Composants client (`"use client"`) uniquement quand nécessaire
- Server Components par défaut pour les pages
- Validation Zod sur toutes les API routes

## 🔒 Sécurité

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- Valider tous les inputs API avec Zod
- Pas d'URLs de redirection non validées
- Signaler les failles de sécurité en privé via les issues GitHub (label `security`)

## 📄 Licence

En contribuant, tu acceptes que ton code soit sous licence AGPL v3.
