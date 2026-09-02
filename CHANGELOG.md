# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Clôture de bande et bilan de fin de cycle (2026-09-02)

Un gérant pouvait suivre une bande jour après jour, mais jamais la conclure :
`closeUnit()` existait sans contrôleur ni bouton, et le filtre « Clôturés » de
`/elevage/lots` ne pouvait rien contenir. Cf.
`docs/superpowers/specs/2026-09-02-cloture-bande-bilan-design.md`.

#### Added

- **Clôture d'une unité de production** (`V52`) — table `unit_closures`, trois
  endpoints (`POST .../close`, `GET`/`DELETE .../closure`), bouton et onglet
  « Bilan » sur la fiche lot. Le bilan est **figé** : une dépense saisie après
  coup ne le modifie plus. Réservé à OWNER/MANAGER ; rouvrir supprime le bilan.
- **Coût par bande** — les dépenses et les recettes portaient déjà
  `production_unit_id`, mais l'aliment sort du stock en kilos et jamais en
  francs. La consommation est donc **valorisée à la clôture** (valeur du
  mouvement si elle existe, sinon prix de l'article), et le coût des poussins
  est saisi à ce moment-là. `FinanceFacade.directExpensesForUnit` exclut la
  source `STOCK_ENTRY`, déjà comptée à l'entrée en stock.
- **Couverture de valorisation** — le bilan enregistre combien d'articles
  consommés ont pu être valorisés et avertit quand il en manque. Sans cela il
  sous-estimerait le coût en silence, et toujours dans le même sens.

#### Fixed

- **La mortalité et l'indice de consommation comptaient les ventes comme des
  pertes** — `EVENT_SALE` décrémente `current_count` au même titre qu'une mort,
  et les deux chiffres se calculaient sur l'écart avec l'effectif initial. Une
  bande ayant écoulé 80 % de son effectif s'affichait à 80 % de mortalité. Les
  deux lisent désormais le registre des événements `MORTALITY`.


### Roadmap pré-premier-client (2026-08-31 → 09-01)

Six chantiers destinés à combler les manques opérationnels avant de signer un
premier client payant : savoir ce qui s'est passé, pouvoir arrêter ce qui
dérape, détecter les données fausses, résister aux attaques, savoir quoi faire
quand le téléphone sonne, et ne pas être le point unique de défaillance.
Cf. `docs/roadmap-pre-first-client.md`.

#### Added

- **Traçabilité des requêtes** (`V48`) — table `request_traces` (rétention 30 j,
  écriture hors du chemin de requête), écran `/console/traces` : un éleveur lit
  la référence courte de son message d'erreur, le support retrouve la requête,
  son payload (secrets masqués) et sa stack trace. `X-Request-Id` accepté en
  alias d'entrée. Colonne `admin_audit_log.request_id` pour joindre trace et
  action. Cf. ADR-010.
- **Kill switch plateforme** (`V49`) — table `feature_flags`, écran
  `/console/urgence`, permission `flags:manage`. Coupe un module pour **toutes**
  les fermes, y compris pour le personnel ; raison obligatoire, expiration
  automatique à 30 min, réponse **503** distincte du 403 d'abonnement.
  Cf. ADR-011.
- **Contrôles d'intégrité et moteur de recalcul** (`V50`) — contexte racine
  `com.avicare.integrity` lisant en SQL natif, 9 invariants, balayage nocturne,
  écran `/console/integrite`. Le recalcul ne touche que des **agrégats dérivés**
  (stock, encours client, payé facture), jamais une valeur saisie par un humain ;
  simulation avant écriture, raison obligatoire, audit. Cf. ADR-012.
- **Détection de menaces et limitation de débit** (`V51`) — tables
  `security_events` et `blocked_ips`, écran `/console/securite`, permissions
  `security:read` / `security:manage`. Cinq échecs de connexion en 15 min
  bloquent une adresse une heure ; plafonds par route (429 + `Retry-After`).
  Compteurs en mémoire (une seule instance), blocages en base. Cf. ADR-013.
- **Plan de continuité** — alerte le contact de secours si le propriétaire n'a
  pas été vu depuis 72 h. **Sans nouvelle table** : le battement de cœur est
  dérivé de `admin_audit_log`. `docs/continuity/` + runbook écrit pour le
  remplaçant.
- **Runbooks opérationnels** — `docs/runbooks/`, rangés par symptôme rapporté.
  Cinq scénarios critiques, **chacun exécuté** avant d'être écrit.
- **Console partenaires** — création d'une organisation, rattachement d'une
  ferme, génération d'un code d'invitation, création du premier compte,
  suspension. Le backend savait tout faire depuis le chantier B2B2C ; la console
  ne savait que défaire.
- ADR-010 à ADR-014.

#### Fixed

- Le contrôle d'intégrité sanitaire signalait comme défaut une **dose de
  vaccination absente**, alors que l'écran mobile ne la demande pas
  délibérément — un vaccin dilué dans l'eau de boisson n'a pas de dose par
  sujet. 16 fausses anomalies sur les données réelles, ramenées à 0.
- `ADMIN_ONCALL_PHONE` n'était **pas transmis au conteneur** : les alertes des
  trois mécanismes ci-dessus étaient journalisées et n'atteignaient personne.
  Variable transmise, absence signalée au démarrage et sur l'écran Pilotage.
- Le dialogue de révélation de la console annonçait « affiché une seule fois »
  sur tout, y compris un code d'invitation qui reste listé en dessous.

#### Changed

- `VaccinationCreateRequest.subjectsCount` passe de `@PositiveOrZero` à
  `@Positive` : vacciner zéro sujet ne veut rien dire, et le contrôle
  d'intégrité le signalait déjà.
- `admin_audit_log.actor_user_id` devient **nullable** — un acteur nul désigne
  la plateforme elle-même (balayages automatiques), dont les entrées d'audit
  échouaient silencieusement auparavant.
- Rattacher une ferme depuis la console demande désormais de déclarer que
  l'éleveur l'a demandé : le geste confirme le rattachement immédiatement et
  ouvre trois partages par défaut.

> Note : le changelog n'a pas été tenu entre 0.9.0 (2026-06-15) et cette entrée.
> Les sprints B5 → C1, le mobile, l'assistant, le portail partenaire, la landing
> et la mise en production sont tracés par les PRs, les ADRs et les migrations
> Flyway. Reconstituer ce journal après coup produirait un récit approximatif ;
> les sources primaires, elles, sont exactes.

> Note : le changelog n'a pas été tenu entre 0.1.0 et 0.7.0 ; l'historique
> intermédiaire (A2 → B1) est tracé par les tags Git et les PRs. Reprise du
> journal à 0.7.0.

## [0.9.0-inventory] — 2026-06-15

Sprint B4 complet — module **Inventaire** (jalon B.M4). Un éleveur peut gérer son
catalogue d'articles, ses stocks et mouvements, ses fournisseurs et bons d'achat
(workflow DRAFT→SENT→RECEIVED), ses formules d'aliment (clonées depuis la
plateforme), et bénéficier d'un **couplage cross-sous-domaine optionnel** (D18)
décrémentant le stock depuis les saisies métier. Gating `module.inventory`.

### Added — Inventaire (backend, B4-1 → B4-6)

- Migration `V15` : catalogue plateforme `inventory_items` (17 articles V1) via
  `catalog_items` (D15) + `stock_items` (per-farm, solde négatif autorisé D19) +
  `suppliers` (annuaire ferme).
- Migration `V16` : `stock_movements` (journal append-only IN/OUT/ADJUSTMENT,
  snapshot before/after, backrefs cross-sous-domaine) + alertes compute-on-read.
- Migration `V17` : `purchase_orders` + `purchase_order_items` (workflow
  DRAFT→SENT→RECEIVED + cancel) ; réception atomique → cascade mouvements IN.
- Migration `V18` : `feed_formulas` (6 templates plateforme + clonage farm +
  coût snapshot, `ingredients` JSONB — D20 formule simple V1).
- Migration `V19` : extension du CHECK `stock_movements.reason`
  (`CONSUMPTION_VACCINATION`, `CONSUMPTION_TREATMENT`).
- **Couplage D18** : `StockConsumptionService` (orchestrateur intra-`livestock`
  réutilisable, `@Transactional`) ; champ optionnel `feedConsumption` /
  `stockConsumption` sur DailyRecord / Vaccination / Treatment ; **Option α** :
  payload couplé sans `module.inventory` actif → **422** (`BusinessRuleException`).
- **REST API** (~25 endpoints, 7 controllers) sous `/api/v1/farms/{id}/inventory/*`
  + `InventoryAccess` SpEL constants ; extension des 3 controllers existants.

### Added — Inventaire (frontend, B4-7)

- Pages `/stocks` (overview KPIs + table + actions rapides), `/stocks/articles/[id]`
  (détail + courbe 90j + 3 tabs), `/stocks/articles` (bibliothèque),
  `/stocks/fournisseurs`, `/stocks/achats` + `/stocks/achats/[id]` (workflow),
  `/stocks/formules` (plateforme + clonage).
- Composants : `StockMovementDialog`, `PurchaseOrderDialog` +
  `PurchaseOrderWorkflowActions`, `FeedFormulaDialog`, `SupplierDialog`,
  `StockConsumptionSection` (partagé D18, injecté dans les 3 dialogs existants),
  `InventoryAlertsKpis`, `StockHistoryChart`. 5 slices RTK Query, gating
  `useInventoryGating`, item sidebar « Stocks ».

### Fixed

- Option α renvoyait `400` (`ValidationException`) au lieu de `422` ; corrigé en
  `BusinessRuleException` (B4-8, trouvé par l'E2E `scripts/e2e-inventory.sh`).

### Docs

- Décisions D18 (couplage hybride), D19 (stock négatif non bloquant), D20
  (formule simple V1) — doc 00 §11.
- **ADR-008** : `livestock` super-context pour le pivot JPA JOINED (réconcilie
  doc 00 §5 / doc 03 §5). Doc 03 §3/§4/§5 nuancée. Doc 04 §3 réaligné V1→V19.
- E2E full-stack `scripts/e2e-inventory.sh` (34/34, jalon B.M4).

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
