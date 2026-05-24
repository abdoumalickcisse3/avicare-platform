# GINAARTECH — Architecture & Fonctionnalités

> Plateforme SaaS de gestion avicole multi-sites, multi-forfaits, multi-utilisateurs.
> Stack : **AdonisJS v7** (backend) · **Next.js 16 + MUI v7** (frontend) · **PostgreSQL 16**.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Architecture backend](#3-architecture-backend)
4. [Architecture frontend](#4-architecture-frontend)
5. [Modèle de données](#5-modèle-de-données)
6. [Authentification & sécurité](#6-authentification--sécurité)
7. [Modules fonctionnels](#7-modules-fonctionnels)
8. [Flows métier majeurs](#8-flows-métier-majeurs)
9. [Forfaits & feature gating](#9-forfaits--feature-gating)
10. [Jobs planifiés & notifications](#10-jobs-planifiés--notifications)
11. [API REST — vue d'ensemble](#11-api-rest--vue-densemble)

---

## 1. Vue d'ensemble

GinaarTech est une plateforme SaaS B2B destinée aux exploitations avicoles d'Afrique de l'Ouest. Elle couvre tout le cycle d'élevage (lots, sanitaire, croissance, ponte, abattage), la chaîne commerciale (commandes → ventes → livraisons → factures → paiements), la logistique (stocks, fournisseurs, achats, formules d'aliment), la finance (comptabilité analytique, salaires) et la gouvernance (multi-sites, multi-utilisateurs, rôles, abonnements).

### Principes architecturaux clés

- **Site = unité métier principale**. Toutes les données sont rattachées à un `site_id` et filtrées par les sites accessibles à l'utilisateur (`getAccessibleSiteIds()`).
- **Lot (Batch) = pivot central**. Œufs et poulets de chair sont des vues spécialisées d'un lot (sources uniques : `EggCollection`, `WeighingSample`).
- **Dashboard unique adaptatif**. Une seule page `/dashboard` qui se reconfigure via `useSiteCapabilities()` selon le type de site et les features actives.
- **Capacités effectives**. Le rôle effectif (`UserSite`) prime sur le rôle global (`user.role`). L'accès à un site = propriétaire OU membre via `UserSite`.

---

## 2. Architecture technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Backend API | AdonisJS v7 + TypeScript | REST API, auth, business logic, jobs |
| ORM | Lucid ORM v22 | Modèles, migrations, requêtes |
| Validation | VineJS v4 | Schemas de validation entrée |
| Base de données | PostgreSQL (pg 8.20) | Données relationnelles + colonnes JSON |
| Auth | `@adonisjs/auth` + access tokens | Bearer tokens, multi-guard |
| Frontend | Next.js 16 (App Router) + React 19 + TS | UI, routing, SSR/CSR |
| UI library | Material UI v7 + Emotion | Composants, design system |
| State | Redux Toolkit + RTK Query | Cache, mutations, invalidation |
| Charts | Recharts | Visualisations |
| Animations | Framer Motion | Transitions, micro-interactions |
| QR Codes | `qrcode` (backend) + `html5-qrcode` (frontend) | Génération + scan |
| Exports | PDFKit + ExcelJS | PDF/Excel rapports |
| Cron | `node-cron` | Tâches planifiées |
| HTTP client | Axios + RTK Query baseQuery | Appels API frontend |
| Infra dev | Docker Compose (Postgres + Redis) | Environnement local |

---

## 3. Architecture backend

### Arborescence

```
backend/
├── app/
│   ├── controllers/      # 47 contrôleurs REST
│   ├── models/           # 46 modèles Lucid
│   ├── services/         # 20 services métier
│   ├── middleware/       # auth, silent_auth, site_permission, subscription_guard, force_json
│   ├── validators/       # Schemas VineJS par ressource
│   ├── transformers/     # Sérialiseurs
│   ├── exceptions/       # Handlers d'erreur
│   └── utils/            # Helpers (accessible_site_ids, etc.)
├── config/               # app, auth, database, cors, session, shield…
├── database/
│   ├── migrations/       # Schémas Postgres
│   ├── seeders/          # Données de seed
│   └── schema.ts         # Schéma généré (44 modèles)
├── start/
│   ├── routes.ts         # 200+ routes REST
│   ├── kernel.ts         # Stack middleware
│   ├── cron.ts           # Jobs planifiés
│   └── env.ts            # Variables d'environnement
└── providers/            # Service providers AdonisJS
```

### Pipeline middleware (kernel.ts)

1. `container_bindings_middleware` — DI runtime
2. `force_json_response_middleware` — forçage `Accept: application/json`
3. `cors` — politique cross-origin
4. `auth` — guard access token (routes protégées)
5. `silent_auth` — tentative d'auth sans rejet (routes mixtes)
6. `site_permission` — vérifie le rôle effectif sur un site
7. `subscription_guard` — bloque si l'abonnement est expiré/cancelled

### Services métier (couche logique)

| Service | Responsabilité |
|---------|----------------|
| `activity_log_service` | Audit log de toutes les actions critiques |
| `alert_service` | Génération + diffusion d'alertes (mortalité, stock bas, perfs) |
| `analytical_accounting_service` | Comptabilité analytique par lot (coûts, marges) |
| `batch_service` | Cycle de vie d'un lot (création, clôture, transitions) |
| `business_rules_service` | Règles métier transversales (validations, garde-fous) |
| `cost_analysis_service` | Coût par lot/œuf/kg vif |
| `credit_management_service` | Encours, limites de crédit clients |
| `egg_stock_service` | Stock plaquettes/œufs en temps réel |
| `excel_export_service` | Génération .xlsx (lot, financier, sanitaire) |
| `growth_analysis_service` | GMQ, IC, uniformité, prévision maturité (Cobb/Ross) |
| `import_service` | Preview + commit d'imports CSV |
| `kpi_service` | Score performance Or/Argent/Bronze + KPIs custom |
| `mortality_sync_service` | Synchronisation effectif lot ↔ mortalité |
| `notification_service` | Notifications in-app + préférences |
| `payment_service` | Paiements ventes/livraisons + ventilation |
| `pdf_export_service` | Génération PDF (lot, financier, sanitaire) |
| `salary_service` | Salaires + avances |
| `scheduled_jobs_service` | Orchestration des jobs cron quotidiens |
| `site_comparison_service` | Comparaison inter-sites (Business/Ultimate) |
| `stock_service` | Mouvements + alertes seuils |
| `withdrawal_service` | Délais d'attente vétérinaires |

### Pattern d'accès aux données

Toutes les requêtes lecture/écriture passent par un filtre `getAccessibleSiteIds(user)` qui retourne l'union :
- des sites dont `user` est propriétaire (`Site.userId = user.id`)
- des sites où `user` a une entrée `UserSite` active

Jamais de filtre direct par `Site.userId` seul.

---

## 4. Architecture frontend

### Arborescence

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Layout split-screen (login, register)
│   ├── (dashboard)/            # Layout AppShell (toutes les pages métier)
│   ├── (onboarding)/           # Wizard 3 étapes nouveau compte
│   ├── (terrain)/              # Mode kiosque tactile fermier
│   ├── scan/                   # Lookup QR code (publique)
│   ├── 403.tsx | 500.tsx | not-found.tsx | error.tsx
│   ├── layout.tsx              # Racine (Providers)
│   └── page.tsx                # Landing / redirect
├── components/
│   ├── AppShell.tsx            # Coque (Header + Sidebar + main)
│   ├── NotificationsBell.tsx   # Cloche live (badge unread)
│   ├── QuickAddFab.tsx         # FAB d'accès rapide
│   ├── PwaInstaller.tsx        # Bandeau install PWA
│   ├── Providers.tsx           # Redux + MUI ThemeProvider
│   ├── layout/                 # Header, Sidebar
│   ├── dashboard/              # Widgets (Egg, Broiler, Financial, Alerts…)
│   ├── deliveries/ invoices/ payments/ sales/ settings/
│   └── shared/                 # ConfirmDialog, FeatureGate, RequirePermission…
├── store/
│   ├── api/                    # 30 slices RTK Query (un par ressource)
│   ├── slices/                 # authSlice, uiSlice (selectedSiteId)
│   ├── hooks.ts                # useAppDispatch, useAppSelector typés
│   └── store.ts                # Configuration Redux
├── hooks/
│   ├── useFeatureGate          # Gating par feature d'abonnement
│   ├── useNetworkStatus        # Online/offline
│   ├── useSettings             # Paramètres dynamiques (souches, vaccins…)
│   ├── useSidebar              # État collapsed
│   ├── useSite                 # Site sélectionné
│   └── useSiteCapabilities     # Type de site + features → UI conditionnelle
├── constants/                  # sidebar.ts (config nav centralisée)
├── theme/                      # palette MUI personnalisée
├── lib/                        # apiError, helpers, storage, utils
├── utils/                      # auth.ts (clearAuthData)
└── types/                      # Types partagés (Client, Setting…)
```

### Sidebar (navigation consolidée)

7 entrées top-level filtrées par rôle + type de site + features :

1. **Tableau de bord** (unique, adaptatif)
2. **Élevage** : Lots · Production d'œufs · Poulets de chair · Suivi sanitaire
3. **Commercial** : Pipeline · Commandes · Ventes · Livraisons · Factures · Clients
4. **Stocks** : Inventaire · Fournisseurs · Achats · Formules aliment
5. **Finance** : Comptabilité · Salaires
6. **Notifications** (badge unread)
7. **Réglages** (hub central)

Sidebar séparée pour les **buyers** : Mes commandes · Mes factures · Mes paiements.

### State management (RTK Query)

Une slice par ressource (`batchesApi`, `salesApi`, `deliveriesApi`, etc.). Chaque slice gère son cache, ses tags d'invalidation et expose des hooks (`useGetXxxQuery`, `useCreateXxxMutation`). Le `baseApi` centralise :
- l'URL de base (`NEXT_PUBLIC_API_URL`)
- l'injection du Bearer token
- la sérialisation `siteId` global (depuis `uiSlice.selectedSiteId`)
- la gestion d'erreur 401 → logout

---

## 5. Modèle de données

**46 modèles Lucid**. Groupes principaux :

### Fondations
- `User` — fullName, email, phone, password, avatar, locale, role (`super_admin|admin|manager|farmer|buyer`), isActive
- `Subscription` — plan (`starter|business|ultimate|custom`), status, dates, maxSites, maxUsersPerSite, features (JSON)
- `Site` — name, type (`ponte|chair|mixte`), location, gpsCoords, capacity, subscriptionId, createdBy
- `UserSite` — userId, siteId, role, permissions (JSON) → rôle effectif par site
- `Setting` — siteId, category, key, value → paramètres dynamiques
- `ActivityLog` — userId, siteId, action, entityType, entityId, old/new values, IP

### Élevage
- `Batch` — pivot. type, breed, startDate, endDate, initialCount, currentCount, status, growthObjective (JSON), targetWeight, targetAge
- `DailyRecord` — saisie quotidienne par lot (mortalité, aliment, eau, poids…)
- `MortalityRecord` — mortalité détaillée
- `EggCollectionConfig` / `EggCollection` / `EggTrayStock` / `DailyEggProduction` — chaîne œufs
- `WeighingSample` / `GrowthPerformance` / `MaturityForecast` / `SlaughterRecord` — chaîne chair

### Sanitaire
- `VaccinationProgram` / `VaccinationSchedule` — programmes de vaccination
- `Treatment` — traitements vétérinaires + délais d'attente
- `VetVisit` — visites vétérinaires
- `HealthEvent` — événements génériques

### Commercial
- `Client` — nom, contacts, creditLimit, currentBalance, type
- `Order` / `OrderItem` — commandes/réservations
- `Sale` — ventes (peut générer livraison + facture)
- `Delivery` / `DeliveryItem` — livraisons
- `Invoice` — factures (sync depuis sale/delivery)
- `Payment` — paiements ventilés

### Stocks & approvisionnement
- `Stock` / `StockMovement` — inventaire + mouvements
- `StockCategory` — catégories
- `Supplier` — fournisseurs
- `PurchaseOrder` / `PurchaseOrderItem` — bons de commande achats
- `FeedFormula` — formules d'aliment

### Finance & RH
- `Expense` — dépenses
- `Salary` / `SalaryAdvance` — paie + avances
- `KpiConfig` — configuration KPIs par site

### Système
- `Alert` — alertes générées
- `Notification` / `NotificationPreference` — notifs in-app + canaux
- `Subscription` / `SubscriptionChangeRequest` — abonnement + demandes de changement

---

## 6. Authentification & sécurité

### Flow

1. **Signup** (`POST /api/v1/auth/signup`) — création compte + abonnement Starter par défaut + premier site optionnel
2. **Login** (`POST /api/v1/auth/login`) — retourne `access_token` (Bearer)
3. **Routes protégées** — header `Authorization: Bearer <token>` + middleware `auth`
4. **Logout** (`POST /api/v1/auth/logout`) — révoque le token

### Rôles

- `super_admin` — accès complet plateforme
- `admin` — propriétaire d'un compte, gère l'abonnement et les sites
- `manager` — gère un site (paramétrage, commerciale, finance)
- `farmer` — saisie terrain (récoltes, pesées, mortalité)
- `buyer` — portail client read-only

### Garde-fous

- **Middleware `auth`** sur tout `/api/v1/*` sauf login/signup/swagger
- **Middleware `subscription_guard`** — refuse l'écriture si abonnement expiré
- **Middleware `site_permission`** — vérifie le rôle effectif (UserSite) avant action
- **`getAccessibleSiteIds()`** — toujours appelé pour borner les requêtes
- **CORS** configuré via `ORIGIN`
- **Shield** (anti-CSRF Adonis) actif
- **Activity log** pour audit (création/modification/suppression d'entités critiques)

---

## 7. Modules fonctionnels

### 7.1 — Élevage

**Lots (Batches)** — registre central. Création (type chair/ponte/mixte, souche, effectif initial, date de démarrage). Statuts actif/clôturé. Détail lot avec courbes, saisies, rapport financier.

**Saisie quotidienne** — mortalité, aliment (kg), eau (L), poids moyen (g), œufs collectés, observations. Pré-remplissage automatique depuis la dernière saisie. Validation adaptée au type (poids pour chair, œufs pour ponte).

**Production d'œufs** :
- Configuration par site : créneaux de collecte, taille de plateau (défaut 30), prix plateau, grades activés
- Collecte (`EggCollection`) — par créneau, par lot, par collecteur, avec œufs cassés et grades S/M/L/XL
- Stock plaquettes (`EggTrayStock`) — pleins/vides/total
- Clôture jour (`DailyEggProduction`) — agrégation, taux de ponte, taux de casse
- Statistiques + historique

**Poulets de chair** :
- Pesées échantillon (`WeighingSample`) — poids individuels, moyenne, min/max, uniformité
- Performance (`GrowthPerformance`) — GMQ, IC, mortalité cumulée, conso aliment/eau, recalcul auto
- Prévision maturité (`MaturityForecast`) — projection date d'abattage selon courbe Cobb/Ross
- Abattages (`SlaughterRecord`) — quantité, poids vif/carcasse, rendement, destination

**Sanitaire** :
- Programmes de vaccination (`VaccinationProgram`) avec calendrier exécutable
- Traitements (`Treatment`) avec délais d'attente automatiques (`withdrawalStatus`)
- Visites vétérinaires (`VetVisit`)
- Mortalité (`MortalityRecord`) liée au lot

### 7.2 — Commercial (pipeline)

Pipeline Kanban : **Commande → Vente/Livraison → Facture → Paiement**.

- **Commandes (`Order`)** : réservations client avec statuts (`pending → confirmed → in_progress → delivered → cancelled`). Conversion en livraison (`POST /orders/:id/convert-to-delivery`).
- **Ventes (`Sale`)** : ventes directes (compteur), génère facture automatique.
- **Livraisons (`Delivery`)** : items, statut, transporteur. Génère facture optionnelle.
- **Factures (`Invoice`)** : créées depuis sale OU delivery. Sync (recalcul totaux). Suivi paiements.
- **Paiements (`Payment`)** : ventilation par sale/delivery, méthode (espèces, mobile money, virement), historique.
- **Clients (`Client`)** : fiche, limite de crédit, encours (`currentBalance`).

### 7.3 — Stocks & approvisionnement

- **Inventaire (`Stock`)** : aliment / œufs / volailles / autres. Seuils d'alerte par stock.
- **Mouvements (`StockMovement`)** : entrées/sorties avec prix unitaire et notes. Historique complet.
- **Stocks lot** : disponibilité produits par batch (œufs disponibles, kg vif…).
- **Catégories (`StockCategory`)** : taxonomie configurable.
- **Fournisseurs (`Supplier`)** : carnet d'adresses.
- **Bons de commande achat (`PurchaseOrder`)** : workflow draft → sent → received → cancelled. Réception alimente le stock.
- **Formules d'aliment (`FeedFormula`)** : compositions personnalisables.

### 7.4 — Finance

- **Comptabilité (`Expense`)** : dépenses avec catégories configurables.
- **Comptabilité analytique** : `accounting/cost/:batchId` (coût total d'un lot), `accounting/analytical` (vue analytique), `accounting/overdue` (factures impayées), `accounting/credit/:clientId` (encours client).
- **Salaires (`Salary`)** : génération mensuelle, statut paid/unpaid, marquage payé.
- **Avances (`SalaryAdvance`)** : workflow demande → approbation → déduction.

### 7.5 — Dashboard & rapports

- **Dashboard unique adaptatif** (`/dashboard`) : se reconfigure via `useSiteCapabilities()`.
- **Widgets** : EggProductionWidget, BroilerWidget, FinancialWidget, AlertsWidget, StatCard, QuickActions.
- **Onglets** : OverviewTab, ComparisonTab (inter-sites, Business/Ultimate), ReportsTab.
- **BuyerDashboard** : vue spécifique pour les clients (commandes, factures, paiements).
- **KPI configurables (`KpiConfig`)** : Ultimate uniquement.
- **Score performance** : badges Or/Argent/Bronze calculés via `kpi_service`.
- **Rapports** (`/api/v1/reports/:id`) : performance d'un lot.

### 7.6 — Exports & imports

- **Exports PDF** : lot, financier, sanitaire (PDFKit).
- **Exports Excel** : lot, financier, sanitaire (ExcelJS).
- **Imports CSV** : preview (`POST /imports/preview`) + commit (`POST /imports/commit`). Validation avant insertion.

### 7.7 — Notifications & alertes

- **Alertes (`Alert`)** : mortalité anormale, stock bas, baisse de performance. Génération automatique par `alert_service`.
- **Notifications (`Notification`)** : in-app avec badge unread, `mark read`, `mark all read`.
- **Préférences (`NotificationPreference`)** : canal par type (in-app, email, sms, whatsapp prévu).
- **Cloche live** (`NotificationsBell`) : polling unread count.

### 7.8 — QR codes

- Génération `qr/batch/:id` et `qr/stock/:id` (image PNG via `qrcode`).
- Lookup public `qr/lookup` + page `/scan` (frontend, scanner `html5-qrcode`).
- Permet à un opérateur de scanner un lot et accéder à ses infos.

### 7.9 — Abonnement & forfaits

- **`/api/v1/subscription`** : statut courant.
- **`SubscriptionChangeRequest`** : demande de passage à un forfait supérieur, workflow `pending → approved/rejected`.
- **Feature gating** via `useFeatureGate` (frontend) + `subscription_guard` (backend).

### 7.10 — Portail buyer (read-only)

Endpoints `/api/v1/buyer/*` : profile, dashboard, orders, invoices, payments. Frontend `/portail/*`. Le client voit ses propres données uniquement.

### 7.11 — Mode terrain (kiosque)

`/terrain` — interface tactile plein écran optimisée pour saisie terrain (mortalité, pesées, collectes œufs). Pensée pour tablette, sans sidebar.

### 7.12 — Onboarding

Wizard 3 étapes (`/onboarding`) après signup : créer premier site → configurer paramètres de base → créer premier lot.

### 7.13 — Paramètres dynamiques

Page `/reglages` = hub central. 5 catégories de paramètres :
- **Stock** : types de produits
- **Lots** : souches/races
- **Sanitaire** : vaccins
- **Ventes** : produits
- **Comptabilité** : catégories de dépenses

Seed initial via `POST /settings/seed`. Intégration automatique dans tous les formulaires concernés (autocomplete + ajout à la volée).

### 7.14 — Multi-sites & users

- **Sites** CRUD + comparaison inter-sites (`/sites/compare`).
- **UserSites** : invitation membre sur un site avec rôle effectif + permissions JSON.
- **Mes sites** (`GET /me/sites`) : liste accessible à l'utilisateur connecté.
- **Sélecteur site global** dans le Header (`uiSlice.selectedSiteId`).

---

## 8. Flows métier majeurs

### 8.1 — Cycle de vie d'un lot

```
Création (type, effectif initial, souche)
    ↓
Saisies quotidiennes (mortalité, aliment, eau, poids)
    ↓
[Ponte] Collectes œufs → clôtures jour → stock plaquettes
[Chair] Pesées échantillon → performance (GMQ, IC) → prévision maturité
    ↓
Événements sanitaires (vaccins, traitements, mortalité)
    ↓
[Chair] Abattages
[Ponte] Réforme
    ↓
Clôture lot + rapport final (PDF/Excel)
```

### 8.2 — Pipeline commercial complet

```
Client passe commande (Order)
    ↓ confirmation
Conversion en livraison (Delivery) — décrémente le stock
    ↓
Génération facture (Invoice) — depuis sale ou delivery
    ↓
Paiements (Payment) — un ou plusieurs, ventilés
    ↓
Mise à jour encours client (Client.currentBalance)
    ↓
Alerte si dépassement limite de crédit
```

### 8.3 — Flow d'authentification

```
POST /auth/signup → User + Subscription(Starter) créés
    ↓
POST /auth/login → access_token retourné, stocké côté client
    ↓
Onboarding wizard (3 étapes) → premier Site + premiers Settings + premier Batch
    ↓
Accès dashboard
```

### 8.4 — Saisie terrain (kiosque)

```
Connexion farmer
    ↓
Redirige vers /terrain (mode kiosque)
    ↓
Sélection site/lot → action rapide (mortalité, pesée, collecte)
    ↓
POST direct → invalidation cache RTK Query → confirmation visuelle
    ↓
Mortalité sync (mortality_sync_service) → currentCount du lot mis à jour
```

### 8.5 — Génération d'alertes (job quotidien 06:00)

```
Cron tick (configurable CRON_DAILY_SCHEDULE)
    ↓
ScheduledJobsService.runDailyChecks()
    ↓
Pour chaque site accessible :
  • alert_service : mortalité anormale ?
  • stock_service : stock < seuil ?
  • growth_analysis_service : baisse de perf ?
  • withdrawal_service : fin de délai d'attente ?
    ↓
Alert + Notification créées + préférences appliquées (in-app pour l'instant)
```

### 8.6 — Demande de changement de forfait

```
Admin demande passage Ultimate (SubscriptionChangeRequest)
    ↓
Super-admin examine (POST /subscription-change-requests/:id/review)
    ↓
approved → Subscription.plan mis à jour + maxSites/features ajustés
rejected → Notification au demandeur
```

---

## 9. Forfaits & feature gating

| Forfait | Sites | Poules max | Utilisateurs | Cible |
|---------|-------|------------|--------------|-------|
| **Starter** (15 000 F/mois) | 1 | 1 000 | 1 admin + 1 fermier | Familles |
| **Business** (25 000 F/mois) | 3 | 3 000 | 1 admin + 3 fermiers | Pro en croissance |
| **Ultimate** (45 000 F/mois) | 10 (extensible) | 10 000 (extensible) | 3 admins + 10 fermiers + 1 gestionnaire | Grandes exploit. |
| **Sur mesure** | ∞ | ∞ | sur mesure | Groupes |

**Features gatées** (déclarées dans `Subscription.features`) :
- `multi_site` — Business+
- `maturity_forecast` — Business+
- `financial_reports` — Business+
- `kpi_config` — Ultimate
- `buyer_portal` — Ultimate
- `qr_codes` — Ultimate
- `whatsapp_sms_alerts` — Ultimate
- `api_access` — Ultimate
- `benchmarking_cobb_ross` — Ultimate

Backend : `subscription_guard` middleware. Frontend : `useFeatureGate` + composant `<FeatureGate feature="…">`.

---

## 10. Jobs planifiés & notifications

### Cron (`backend/start/cron.ts`)

- **Daily checks** : `0 6 * * *` (06:00 serveur local), configurable via `CRON_DAILY_SCHEDULE`.
- **Désactivable** : `CRON_ENABLED=false` (utile en CI/tests).
- Exécute `ScheduledJobsService.runDailyChecks()` qui boucle sur tous les sites et alimente alertes + notifications.

### Canaux de notification

- **In-app** : implémenté (cloche + badge + liste).
- **Préférences par type** : table `NotificationPreference` (in_app, email, sms, whatsapp).
- **Email / SMS / WhatsApp** : prévus dans le plan (Ultimate), pas encore branchés.

---

## 11. API REST — vue d'ensemble

Toutes les routes sont préfixées `/api/v1`. Documentation Swagger interactive : `GET /api/docs`.

### Auth & profil
```
POST   /auth/signup
POST   /auth/login
POST   /auth/logout                    [auth]
GET    /account/profile                [auth]
```

### Sites & équipe
```
GET    /sites                          GET /sites/compare
POST   /sites                          GET/PUT/DELETE /sites/:id
GET    /sites/:siteId/users            POST   /sites/:siteId/users
PUT    /sites/:siteId/users/:id        DELETE /sites/:siteId/users/:id
GET    /me/sites
```

### Élevage
```
GET/POST/PUT/DELETE  /batches[/:id]
GET/POST/PUT/DELETE  /daily-records[/:id]

# Production d'œufs
GET/PUT  /egg-production/config/:siteId
GET/POST/PUT/DELETE  /egg-production/collections[/:id]
GET   /egg-production/tray-stock     GET /egg-production/daily
GET   /egg-production/history        POST /egg-production/close-day
GET   /egg-production/stats

# Poulets de chair
GET   /broilers/dashboard            GET  /broilers/batches
PUT   /broilers/batches/:id/targets  GET/POST/DELETE /broilers/weighings[/:id]
GET   /broilers/performance          POST /broilers/performance/recalculate
GET   /broilers/maturity-forecast    GET  /broilers/maturity-forecast/history
GET/POST/DELETE /broilers/slaughters[/:id]
```

### Sanitaire
```
GET/POST/DELETE  /vaccination-programs[/:id]
POST   /vaccination-schedules/:id/execute
GET/POST/PUT/DELETE  /treatments[/:id]
GET    /treatments/withdrawal-status
GET/POST/PUT/DELETE  /vet-visits[/:id]
GET/POST/DELETE  /mortality-records[/:id]
GET/POST/PUT/DELETE  /health-events[/:id]
```

### Commercial
```
GET/POST/PUT/DELETE  /clients[/:id]
GET/POST/DELETE  /orders[/:id]       PUT /orders/:id/status
POST   /orders/:id/convert-to-delivery
GET/POST/PUT/DELETE  /sales[/:id]
GET/POST/PUT/DELETE  /deliveries[/:id]
GET/POST/DELETE  /invoices[/:id]     POST /invoices/sale  POST /invoices/delivery
POST   /invoices/:id/sync
POST   /payments/sale   POST /payments/delivery
GET    /payments/sale/:saleId        GET /payments/delivery/:deliveryId
GET    /batches/:batchId/availability
```

### Stocks & achats
```
GET/POST/PUT/DELETE  /stocks[/:id]      POST /stocks/movements
GET    /stocks/batches                  GET  /stocks/batches/:id
POST   /stocks/check-availability       GET  /stocks/products/:batchType
GET/POST/DELETE  /stock-categories[/:id]
GET/POST/PUT/DELETE  /suppliers[/:id]
GET/POST/GET  /purchase-orders[/:id]
POST   /purchase-orders/:id/send|receive|cancel
GET/POST/PUT/DELETE  /feed-formulas[/:id]
```

### Finance & RH
```
GET/POST/PUT/DELETE  /expenses[/:id]
GET/POST/DELETE  /salaries[/:id]     POST /salaries/:id/pay
GET/POST/DELETE  /salary-advances[/:id]  PUT /salary-advances/:id/approve
GET    /accounting/cost/:batchId     GET  /accounting/analytical
GET    /accounting/overdue           GET  /accounting/credit/:clientId
```

### Exports & imports
```
GET    /exports/batch/:id/pdf|excel
GET    /exports/financial/pdf|excel
GET    /exports/health/pdf|excel
POST   /imports/preview              POST /imports/commit
```

### Dashboard, KPI, QR
```
GET    /dashboard
GET    /kpi-configs/:siteId          PUT  /kpi-configs/:siteId
POST   /kpi-configs/:siteId/reset
GET    /qr/batch/:id                 GET  /qr/stock/:id
GET    /qr/lookup
```

### Notifications, alertes, abonnement
```
GET    /alerts                       GET   /alerts/unread
PATCH  /alerts/:id/read              PATCH /alerts/read-all
GET    /notifications                GET   /notifications/unread-count
POST   /notifications/:id/read       POST  /notifications/read-all
DELETE /notifications/:id
GET    /notification-preferences     PUT   /notification-preferences
GET    /subscription
GET    /subscription-change-requests POST  /subscription-change-requests
POST   /subscription-change-requests/:id/review
DELETE /subscription-change-requests/:id
```

### Portail buyer
```
GET    /buyer/profile     GET /buyer/dashboard
GET    /buyer/orders      GET /buyer/invoices    GET /buyer/payments
```

### Paramètres
```
GET    /settings          POST   /settings       DELETE /settings/:id
POST   /settings/seed
```

### Rapports
```
GET    /reports/:id
```

---

## Annexe — Conventions de code

- **Pas de dashboard par module** : une seule page `/dashboard` adaptative via `useSiteCapabilities()`.
- **Lot = pivot** : ne pas créer de système parallèle pour œufs ou chair, étendre `Batch` via `EggCollection` / `WeighingSample`.
- **Accès site** : toujours via `getAccessibleSiteIds()`, jamais `Site.userId` seul.
- **Rôle effectif** : `UserSite` prime sur `user.role` global.
- **Paramètres dynamiques** : tout libellé "métier" (souches, vaccins, catégories…) passe par `Setting` + `useSettings`.

---

_Document généré automatiquement à partir de l'inspection du codebase — branche `main`, commit `730200c`._
