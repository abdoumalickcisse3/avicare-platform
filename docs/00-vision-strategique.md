# AviCare Platform — Vision stratégique

> Document fondateur du projet. À garder à la racine de `docs/` du repo.
> Toute personne (ou IA) qui rejoint le projet **doit lire ce document en premier**.

---

## 1. Le projet en une phrase

**AviCare Platform** est une plateforme SaaS multi-tenant de gestion d'élevage destinée aux exploitations d'Afrique de l'Ouest (Sénégal en premier), construite pour évoluer d'une couverture avicole vers une gestion multi-espèces (ovins, bovins, caprins, porcins).

---

## 2. Historique et contexte

- Le projet succède à **GINAARTECH / AviCare Pro**, un SaaS avicole multi-sites construit en **AdonisJS v7 + Next.js 16 + PostgreSQL**.
- L'ancien projet (repo `avicare-pro`) est **figé en lecture seule**. Son `ARCHITECTURE.md` est conservé comme **bible métier** dans `docs/legacy-reference/`.
- La reconstruction est motivée par :
  1. Un **changement de stack** vers Spring Boot + Next.js + React Native (mobile)
  2. Un **élargissement métier** au-delà de l'aviculture (multi-espèces)
  3. Un **changement d'architecture** vers un monolithe modulaire DDD strictement aligné sur le template fourni

---

## 3. Stack technique cible

| Couche | Choix |
|---|---|
| Backend | **Spring Boot 3.4** + Spring Cloud 2024 + Java 21 LTS |
| Build | Maven multi-module (parent BOM) |
| ORM | Spring Data JPA + Hibernate 6.4 |
| Migrations | Flyway (SQL natif, versionné) |
| Cache | Redis (sessions, blacklist JWT, quotas Lua) |
| DB | PostgreSQL 16 |
| Doc API | SpringDoc OpenAPI |
| Frontend Web | **Next.js 16** (App Router) + React 19 + TypeScript |
| UI lib Web | MUI v7 + Emotion (à valider en Section 7) |
| Mobile | **React Native** (offline-first, multi-rôles) |
| State Web | Redux Toolkit + RTK Query |
| Observabilité | Micrometer + Prometheus + OpenTelemetry |
| Repo | **Mono-repo** : `avicare-platform/{backend,web,mobile,docs,infra}` |

---

## 4. Principes architecturaux non-négociables

### Règle d'or n°0 — Tout ce qui appartient à l'éleveur est paramétrable

Aucune valeur métier en dur dans le code. Tout passe par 3 couches :
1. **Catalogue plateforme** (`catalog_items`) — défauts gérés par super-admin
2. **Paramètres ferme** (`farm_settings`) — surchargés par l'admin de la ferme
3. **Préférences utilisateur** (`user_settings`) — surchargés par chaque utilisateur

Le lookup runtime parcourt les 3 couches du plus spécifique au plus général.

### Règle 1 — Monolithe modulaire, pas micro-services

Un seul service Spring Boot (`avicare-app`) avec des bounded contexts DDD comme packages. On ne fragmente que si un découplage est **techniquement justifié** (transactions, scaling, équipe).

### Règle 2 — Bounded context = package, pas micro-service

Découpe par agrégat business, pas par couche technique. Un package = un sous-domaine DDD avec son propre `entity/repository/service/controller/dto`.

### Règle 3 — Le JWT porte tout

Aucun hit DB pour vérifier une permission. Les memberships ferme + rôles sont dans les claims JWT.

### Règle 4 — `common-*` partagés, contrats explicites

Les libs `common-api`, `common-security`, `common-tenancy`, `common-i18n` sont partagées par tous les modules. Aucune dépendance directe inter-bounded-contexts au runtime — communication par contrats HTTP/events.

### Règle 5 — Erreurs RFC 7807 toujours

Jamais de string nue, jamais de `ResponseStatusException`. Toute exception métier hérite d'une hiérarchie (`NotFoundException`, `ValidationException`, `ForbiddenException`, `BusinessRuleException`...) et est mappée vers Problem Details par un `@ControllerAdvice` central.

### Règle 6 — Multi-tenant strict

Toute donnée métier est rattachée à un `farm_id`. Toute requête lecture/écriture passe par un filtre `getAccessibleFarmIds(user)`. Jamais de filtre direct par `Farm.userId` seul.

### Règle 7 — Multi-devise & multi-langue dès J1

Champ `currency` (défaut `XOF`) sur tous les modèles financiers. Tables `*_translations` ou colonnes JSONB i18n pour les libellés métier. Langues V1 : FR. Langues V2+ : FR + WO + EN.

---

## 5. Modèle métier — Concept central

### `ProductionUnit` — abstraction pivot

Toutes les espèces sont modélisées comme des `ProductionUnit` via **héritage JPA `JOINED`** :

```
production_units (table parente — colonnes communes)
├── id, farm_id, species, kind (BATCH | INDIVIDUAL)
├── breed_id, start_date, end_date, status, current_count
│
├── poultry_batches (V1)        — BATCH, héritage
├── small_ruminant_animals (V2) — INDIVIDUAL, héritage
└── cattle_animals (V3)         — INDIVIDUAL, héritage
```

**Avantage clé :** les bounded contexts transverses (`health`, `commercial`, `inventory`, `finance`, `notification`, `reporting`) manipulent uniquement `ProductionUnit` → quand on ajoute une espèce, on ne touche que :
- Une nouvelle table d'héritage
- Un nouveau bounded context spécifique
- Aucune ligne du code transverse n'est modifiée

---

## 6. Stratégie en vagues

| Vague | Périmètre | Durée estimée | Statut |
|---|---|---|---|
| **V1 — Avicare Pro Reloaded** | Volaille (chair + ponte) sur nouvelle stack | 4-6 mois | À démarrer |
| **V2 — Tabaski Edition** | + Ovins + Caprins (animal individuel, embouche, Tabaski) | 3-4 mois | Plus tard |
| **V3 — Bétail complet** | + Bovins (lait + viande, lactation, reproduction) | 4-6 mois | Plus tard |
| **V4** | Porcins + spécialités + extensions | À voir | Plus tard |

**Règle non-négociable :** le code de V1 est conçu dès le J1 pour accueillir les vagues suivantes. L'architecture est extensible, seules les **tables d'héritage par espèce** et leurs **bounded contexts** sont livrés par vagues.

---

## 7. Modèle commercial — Modules vendus à la carte

### Distinction fondamentale

- **Bounded context** = unité de code (DDD)
- **Module commercial** = unité de vente (feature gating)

Un module commercial peut activer des fonctionnalités dans plusieurs bounded contexts. Inversement, un bounded context peut être contrôlé par plusieurs modules commerciaux selon le niveau d'abonnement.

### Modules commerciaux prévus

**Modules production (par espèce + sous-spécialité) :**
- `module.poultry.broiler` — volaille chair
- `module.poultry.layer` — volaille ponte
- `module.smallruminants.fattening` — embouche ovine/caprine (V2)
- `module.smallruminants.tabaski` — calendrier Tabaski (V2)
- `module.cattle.milking` — bovins laitiers (V3)
- `module.cattle.beef` — bovins viande (V3)

**Modules transverses (universels) :**
- `module.health.basic` / `module.health.advanced`
- `module.commercial.basic` / `module.commercial.advanced`
- `module.inventory`
- `module.finance`
- `module.kpi.advanced`
- `module.buyer_portal`
- `module.qr_codes`
- `module.api_access`

**Quotas (limites paramétrables) :**
- `quota.farms_max` (1, 3, 10, ∞)
- `quota.users_max`
- `quota.animals_max`
- `quota.api_calls_per_day`

### Pricing — Hybride bundles + sur mesure

| Bundle | Modules | Prix indicatif |
|---|---|---|
| Starter Volaille | broiler OR layer + health.basic + 1 ferme + 100 animaux | 15 000 F/mois |
| Pro Volaille | broiler + layer + health.advanced + commercial.basic + inventory + 3 fermes + 3 000 animaux | 25 000 F/mois |
| Tabaski Edition (V2+) | smallruminants.fattening + tabaski + health.basic + commercial.basic | 20 000 F/mois saisonnier |
| Ferme Complète | Tous les modules + 10 fermes + 10 000 animaux | 45 000 F/mois |
| Sur mesure | À la carte | Devis |

Les bundles sont des **collections d'entitlements** côté DB — le code de gestion à la carte et de bundle est identique.

---

## 8. Marché cible

| Aspect | Choix |
|---|---|
| Pays prioritaire | Sénégal |
| Devise | XOF (FCFA), design multi-devise |
| Langues V1 | FR |
| Langues V2+ | FR + WO (wolof) + EN |
| Connectivité | Offline-first sur mobile (zones rurales) |
| Paiements | Wave, Orange Money, Free Money (V1 : preuves de paiement, intégration API plus tard) |
| Saisonnalité forte | **Tabaski** (V2 — calendrier islamique) |
| Formats imprimés | PDF A5 (papier réel utilisé au Sénégal) |

---

## 9. Naming

- Repo provisoire : **`avicare-platform`**
- Nom commercial actuel : **AviCare Pro** (gardé pour V1)
- Rebrand décidé à l'approche de V2, avec nom-parapluie multi-espèces (pistes : KheulPro, Jam-Ferme, Téraanga Farm, à valider avec le marché)

---

## 10. Profil de l'équipe

- **Solo** (Abdou Malick Cisse)
- Outil principal : **Claude Code** pour le développement
- Pas de deadline stricte — qualité > vitesse
- Mais discipline de livraison : V1 doit être en production utilisable avant d'attaquer V2

---

## 11. Décisions consolidées (résumé exécutif)

| # | Décision | Choix |
|---|---|---|
| 1 | Approche multi-espèces | Hybride : socle commun + extensions par espèce via héritage JPA |
| 2 | Périmètre V1 | Volaille uniquement (chair + ponte) |
| 3 | Vagues futures | V2 Ovins/Caprins → V3 Bovins → V4 reste |
| 4 | Architecture backend | Spring Boot monolithe modulaire, template strict |
| 5 | Modèle data | `ProductionUnit` héritage JPA `JOINED` |
| 6 | Mobile | 1 seule app React Native multi-rôles, offline-first |
| 7 | Pricing | Hybride bundles + à la carte sur mesure |
| 8 | Règle d'or | Tout ce qui appartient à l'éleveur est paramétrable (3 couches) |
| 9 | Repo | Nouveau repo `avicare-platform`, mono-repo |
| 10 | Legacy | Ancien repo `avicare-pro` figé, ARCHITECTURE.md gardé comme bible métier |
| 11 | RBAC plateforme (`UserRole`) | 2 niveaux : `ADMIN` (staff AviCare) / `USER` (éleveur) — YAGNI V1, ajout d'un 3e rôle reste non-breaking |
| 12 | RBAC tenant (`FarmRole`) | 5 personas par ferme : `OWNER`, `MANAGER`, `FARMER`, `VETERINARIAN`, `BUYER`, avec `defaultPermissions()` conservateurs (`resource:verb`), surchargeables par membership |
| 13 | Catalogue modules | Tous les modules V1+V2+ déclarés (future-proof), champ `wave` marque la disponibilité (cf. doc 04 / A4) |
| 14 | Modes d'activation | `OFF`/`HARD` seulement ; `SHADOW`/`SOFT` différés (cf. doc 04 / A4) |
| 15 | Bundles | Pas de table dédiée : collections d'entitlements via `catalog_items` (catégorie `bundles`) (cf. doc 04 / A4) |
| 16 | Plans → Modules | Mapping porté **côté backend = source de vérité unique**, exposé via API (`GET /subscription/plans`) ; V1 : plans = pré-bundles **only** (pas d'à-la-carte — affine D7) ; quotas **indicatifs, non enforced** (marketing soft). Cf. ADR-005 |
| 17 | Type d'élevage par ferme | Pas de `farm.type` (cohérent D5) ; `production_focus` métier stocké en `farm_settings` (`farm`/`production_focus`, JSONB `broiler`/`layer`) ; sidebar = (modules abonnés actifs) ∩ (focus ferme courante) |
| 18 | Couplage stock ↔ saisies métier | **Option hybride** : champ optionnel (`feedConsumption` / `stockConsumption`) sur DailyRecord / Vaccination / TreatmentExecuted, déclenchant un `StockMovement` OUT automatique via `StockConsumptionService` (orchestrateur intra-livestock réutilisable). Atomique (`@Transactional` : rollback de toute l'action si le couplage échoue). Rétrocompat : si `null`, aucun impact stock. **Option α** : si le champ est envoyé mais `module.inventory` est inactif → **422** (`BusinessRuleException`). Cf. ADR-008 (intra-livestock) |
| 19 | Stock insuffisant | **Warning non bloquant** (cohérent ADR-007 délais d'attente) : le backend accepte un solde **négatif**, l'UI affiche un avertissement orange. L'éleveur reste maître de son inventaire — pas de garde dure |
| 20 | Décomposition formule d'aliment | **V1 = référence simple** : `DailyRecord.feedConsumption` cible **un seul article** (la formule est une aide UX/coût, **pas** une décomposition automatique). **V2 = décomposition** : le backend éclatera `formula.ingredients` en N mouvements de stock |
| 21 | Couplage commercial ↔ stock | Vente/livraison de **PRODUITS** décrémente le stock : un `StockMovement` **OUT** (`reason=SALE`) par ligne via `StockMovementService`, atomique (`@Transactional`, rollback si échec). Stock **négatif autorisé** (cohérent D19). Annulation → mouvement **IN** compensatoire. Appel **direct intra-livestock** (ADR-008), pas de façade |
| 22 | Vente ≠ Commande (2 flux) | `commercial` = **sous-domaine de `livestock`** (ADR-008, façade `CommercialFacade`). Deux flux distincts qui touchent le stock : **vente directe** (comptant, client **optionnel** walk-in) et **livraison** (conversion d'une **commande** confirmée uniquement en V1). La facture se génère **explicitement** depuis l'une ou l'autre |
| 23 | Workflow commande | Machine à **5 états stricte** : `PENDING → CONFIRMED → IN_PROGRESS → DELIVERED`, `CANCELLED` depuis tout état non terminal. **Pas** de `PARTIALLY_DELIVERED` ; livraison **complète** (pas de partielle V1). Transition illégale → **422** (`BusinessRuleException`) |
| 24 | Numérotation des pièces | Compteurs **par ferme et par an**, préfixés : commande `ORD-`, vente `V-`, livraison `LIV-`, facture `F-`, paiement `P-` (format `<PRÉFIXE>-YYYY-NNN`). Pas de verrou en V1 |
| 25 | Fiscalité V1 | **HT uniquement**, pas de **TVA** en V1 (montants `NUMERIC`/XOF entiers). La TVA est différée |
| 26 | Crédit & encours client | **Indicatif, non bloquant** (cohérent D19/ADR-007) : aucune opération n'est refusée sur dépassement, seulement une **alerte** (`CommercialFacade.getClientCredit`). `currentBalance` (encours) = **facturé − payé** : l'**émission de facture** l'augmente, le **paiement** le diminue ; ventes/livraisons ne le touchent pas directement. Solde **négatif** possible (avance). Facture : une par source, surpaiement **refusé** (422), « overdue » **dérivé** (pas de statut stocké) ; paiement : 1 paiement ↔ 1 facture, **void** réversible |

---

## 12. Documents associés

- `01-roadmap-v1.md` — Roadmap détaillée V1 (phases, jalons, livrables)
- `02-setup-monorepo.md` — Setup du repo, CI/CD, environnement de dev
- `03-architecture-spring-boot.md` — Architecture backend détaillée
- `04-schema-db-initial.md` — Schéma DB Flyway + modèle universel
- `05-securite-rbac.md` — Sécurité, JWT, RBAC, feature gating
- `06-cross-cutting.md` — RFC 7807, i18n, observabilité, paramétrage
- `07-frontend-nextjs.md` — Architecture frontend
- `08-mobile-react-native.md` — Architecture mobile offline-first
- `09-plan-j1-j30.md` — Plan opérationnel des 30 premiers jours
- `decisions/` — ADRs (Architecture Decision Records)
- `legacy-reference/ARCHITECTURE.md` — Bible métier GINAARTECH

---

_Document créé en démarrage du projet. À mettre à jour à chaque décision majeure._
