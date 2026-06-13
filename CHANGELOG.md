# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Rien en attente. Prochain : Sprint B4 (inventory — stocks aliments/médicaments,
fournisseurs, achats, formules)._

> Note : le changelog n'a pas été tenu entre 0.1.0 et 0.7.0 ; l'historique
> intermédiaire (A2 → B1) est tracé par les tags Git et les PRs. Reprise du
> journal à 0.7.0.

## [0.8.0-health] — 2026-06-13

Sprint B3 complet — module **Santé** (jalon B.M3). Un éleveur peut assigner des
programmes vaccinaux, saisir vaccinations / observations / traitements (avec
délais d'attente exposés), gérer son annuaire de vétérinaires et leurs visites,
et consulter des alertes consolidées. Gating `module.health.basic` /
`module.health.advanced`.

### Added — Santé (backend, B3-1 → B3-4)

- Migration `V12` : catalogue plateforme (10 vaccins, 6 traitements, 4 programmes
  vaccinaux par souche) via `catalog_items` (D15) + `ParametersFacade` (D16).
- Migration `V13` : `vaccinations` (UNIQUE unit/vaccin/date), `vaccination_programs_lot`
  (1 programme/lot, `schedule_overrides` JSONB), `health_observations` (severity
  NORMAL/WARNING/CRITICAL). `computeScheduleStatus` → DONE/UPCOMING/LATE.
- Migration `V14` : `treatments_executed` (snapshot figé des délais d'attente),
  `veterinarians` (annuaire par ferme, `farm_id` par id), `vet_visits` (suivi
  follow-up).
- API REST `/api/v1/farms/{farmId}/health/*` (8 controllers) ; `HealthAccess`
  (6 constantes SpEL) split **basic** (vaccinations, observations, programmes) vs
  **advanced** (traitements, vétérinaires, visites) + RBAC granulaire + garde
  cross-farm (404) ; `AlertService` compute-on-read (vaccins en retard, délais
  actifs, suivis à venir, observations critiques).
- Tests : `HealthFlowIT` (Testcontainers, split gating + cross-farm) ; unitaires
  services (couverture CI réelle).

### Added — Santé (frontend, B3-5)

- Page `/elevage/sanitaire` : 4 KPI d'alertes, timeline d'événements, programmes
  + raccourci bibliothèque.
- Composant partagé `HealthTab` (chair + ponte) : `VaccinationCalendar` (planning
  visuel DONE/UPCOMING/LATE, marqueur « Aujourd'hui Jn »), `ActiveTreatmentsList`
  (countdown délai d'attente), `ObservationsList`, `VetVisitsTimeline`.
- Page `/reglages/sanitaire` : 4 onglets (vaccins / traitements / programmes en
  lecture seule, vétérinaires en CRUD).
- 5 dialogs : `VaccinationDialog`, `TreatmentDialog` (encadré orange withdrawal,
  dates min de vente auto), `ObservationDialog`, `VetVisitDialog`, `VeterinarianDialog`.
- Slice RTK Query `healthApi` ; gating frontend miroir du backend (sections
  advanced masquées si inactives, le 403 backend restant la garantie).

### Decisions

- **ADR-007** : délais d'attente médicamenteux **calculés + exposés (warning),
  jamais bloquants** en V1 (responsabilité de l'éleveur).
- Bibliothèque pré-seedée plateforme (custom différé V2) ; programmes par souche
  clonables par lot via overrides JSONB ; vétérinaires par ferme (partage V2) ;
  alertes in-app V1 (email/SMS différés).

## [0.7.0-poultry-layer] — 2026-06-11

Sprint B2 complet — module **Volaille ponte** (jalon B.M2). Production d'œufs
opérationnelle de bout en bout, plus deux décisions structurantes (Plan→Modules
backend, focus de production par ferme).

### Added — Volaille ponte (backend)

- Migrations `V8` (egg_collections + egg_tray_stocks), `V9` (daily_egg_productions),
  `V10` (breeds.type), `V11` (seed plans).
- API REST `egg-production` (collectes, stock plateaux, clôture journalière,
  config) gatée `module.poultry.layer` ; `POST /production-units` (création de lot
  pondeuse, OWNER/MANAGER) ; exposition de `breed.type` (broiler/layer).
- ITs Testcontainers : `LayerFlowIT` (flux ponte HTTP complet), `ProductionUnitCreateIT`.

### Added — Volaille ponte (frontend)

- Pages `/elevage/oeufs` (overview + détail 4 onglets, courbe taux de ponte),
  `CreateLayerBatchDialog`, `EggCollectionDialog`, `CloseDayButton`, `/reglages/ponte`.

### Added — Décision 16 (Plan → Modules backend)

- `GET /subscription/plans` (public) + `POST /farms/{id}/subscription/plan` (apply,
  réconciliation) ; mapping source de vérité dans le catalogue `bundles` (ADR-005).
  Le frontend consomme l'API ; `bundles.ts` réduit aux libellés.

### Added — Décision 17 (production_focus par ferme)

- `productionFocus[]` sur les fermes (stocké en `farm_settings`, sans migration) ;
  sélecteur « Type d'élevage » à la création ; sidebar = modules abonnés ∩ focus
  de la ferme courante (ADR-006).

### Fixed

- `breedsApi` envoie le paramètre `species` requis (dropdown souches vide).
- `V11` : précédence du cast `::jsonb` dans le seed des plans.

## [0.1.0-setup] — 2026-05-25

Sprint A1 complete. Mono-repo en place avec backend Spring Boot, web Next.js, mobile Expo, infrastructure Docker locale et CI/CD GitHub Actions. Aucun code applicatif encore — uniquement le squelette technique.

### Added — Repository & documentation

- Structure mono-repo : `backend/`, `web/`, `mobile/`, `shared/`, `infra/`, `docs/`, `.github/`
- Fichiers racine : `.gitignore`, `.editorconfig`, `.gitattributes`, `README.md`, `LICENSE` (propriétaire), `CONTRIBUTING.md`, `Makefile`, `CHANGELOG.md`, `avicare-platform.code-workspace`
- Documents fondateurs dans `docs/` : `INDEX.md`, `00-vision-strategique.md`, `01-roadmap-v1.md`, `02-setup-monorepo.md`, `03-architecture-spring-boot.md`, `04-schema-db-initial.md`
- `docs/legacy-reference/ARCHITECTURE.md` : référence métier GINAARTECH (V0 AdonisJS), importée depuis le repo `avicare-pro`
- `docs/decisions/001-monolithe-modulaire.md` : premier ADR validant l'architecture monolithe modulaire Spring Boot

### Added — Infrastructure locale

- `infra/docker-compose.yml` : Postgres 16 + Redis 7 + MailHog (healthchecks, volumes nommés)
- `infra/scripts/reset-db.sh` : helper pour réinitialiser les volumes locaux
- `Makefile` : raccourcis `up`/`down`/`restart`/`logs`/`reset-db` + placeholders backend/web/mobile

### Added — Backend (Spring Boot 3.4 + Java 21)

- `backend/pom.xml` : parent Maven multi-module (BOM Spring Boot 3.4.1, versions centralisées Spring Cloud / JJWT / MapStruct / Lombok / SpringDoc / Testcontainers / Spotless)
- 4 modules `common-*` (api, security, tenancy, i18n) avec POM minimal et classes placeholders — le code réel arrive au sprint A2
- `backend/avicare-app/` : module principal avec `AvicareApplication`, `application.yml`, `application-dev.yml`
- Backend démarre, expose `/actuator/health` → `{"status":"UP"}`, `/v3/api-docs` opérationnel, Flyway baseline sur DB vide
- Maven Wrapper Takari (distribuant Maven 3.9.9) — `./mvnw` versionné, pas besoin de Maven local pour build

### Added — Web (Next.js 16 + React 19 + TypeScript)

- `web/` scaffold via `create-next-app` : App Router, ESLint flat config, src/ layout, alias `@/*`, Turbopack par défaut
- Dépendances additionnelles : MUI v9, Emotion, Redux Toolkit, react-redux, Axios
- `web/.prettierrc` : style maison (singleQuote, trailingComma all, printWidth 100, tabWidth 2, semi true)
- Build, lint, dev server testés OK

### Added — Mobile (Expo SDK 56 + React Native 0.85 + TypeScript 6)

- `mobile/` scaffold via `create-expo-app --template blank-typescript`
- `mobile/.prettierrc` : même style maison que web
- `mobile/.gitignore` complété (`.expo-shared/`)
- Metro démarre OK sur le port configuré

### Added — CI/CD

- `.github/workflows/backend.yml` : build Maven + tests avec service Postgres 16, upload des surefire-reports
- `.github/workflows/web.yml` : `npm ci` + lint + `tsc --noEmit` + build
- `.github/workflows/mobile.yml` : `npm ci` + lint (soft) + `tsc --noEmit`
- Les 3 workflows verts au push de clôture A1
- Pas de `paths:` filters sur les triggers : chaque CI tourne sur chaque push/PR, condition nécessaire pour des required status checks stricts (cf. ADR 002)

### Notes — Écarts documentés vs doc 02 (cohabitation locale)

Cinq services tournent déjà sur les ports standards (postgresql@18 Homebrew, ginaartech_postgres, ginaartech_redis, autre next-server, UVDistribution.Mobile expo). Plutôt que les stopper, le dev local utilise des ports décalés :

| Service | Doc | Local (host) | Container |
|---|---|---|---|
| Postgres | 5432 | **5434** | 5432 |
| Redis | 6379 | **6380** | 6379 |
| Next.js dev | 3000 | **3001** | — |
| Expo Metro | 8081 | **8082** | — |

La CI utilise les ports standards (5432) — pas de conflit dans un environnement isolé.

### Notes — Branch protection différée

La protection serveur de la branche `main` (required PR, required status checks stricts, no force-push, no delete) **n'est pas activée** à la clôture A1 : les endpoints GitHub (branch protection ET rulesets) renvoient HTTP 403 sur les repos privés en plan free. Voir [`docs/decisions/002-branch-protection-deferred.md`](docs/decisions/002-branch-protection-deferred.md) — la commande `gh api` est prête à l'emploi pour le jour où on upgrade GitHub Pro ou on passe le repo public.

### Notes — Spring Security

`AvicareApplication` exclut temporairement `SecurityAutoConfiguration` ET `ManagementWebSecurityAutoConfiguration` pour que `/actuator/health` ne soit pas verrouillé derrière HTTP Basic au démarrage. **À retirer au Sprint A2/A3** quand `common-security` fournira le vrai `SecurityFilterChain` + `JwtFilter`.

### Notes — Versions installées

- Backend : Spring Boot **3.4.1**, Java **21.0.9** (Temurin / JBR), Maven **3.9.9** via wrapper
- Web : Next.js **16.2.6**, React **19.2.4**, TypeScript **5.x**, MUI **9.0.1** (doc disait v7 — flexibilité prévue par doc 00)
- Mobile : Expo **56.0.4**, React Native **0.85.3**, TypeScript **6.0.3**

### Outils installés via Homebrew (pré-requis dev locaux)

- Maven 3.9.16 (pour générer le wrapper initial)
- Watchman 2026.05.18.00 (recommandé Expo/Metro)

---

[Unreleased]: https://github.com/abdoumalickcisse3/avicare-platform/compare/v0.7.0-poultry-layer...main
[0.7.0-poultry-layer]: https://github.com/abdoumalickcisse3/avicare-platform/compare/v0.6.0-poultry-chair...v0.7.0-poultry-layer
[0.1.0-setup]: https://github.com/abdoumalickcisse3/avicare-platform/releases/tag/v0.1.0-setup
