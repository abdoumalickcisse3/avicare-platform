# 01 — Roadmap V1 AviCare Platform

> Document de référence opérationnelle. Décrit le **chemin** de la reconstruction V1.
> À mettre à jour à chaque fin de sprint avec ce qui a été réellement livré.

---

## 1. Définition de "V1 terminée"

V1 est considérée comme terminée quand **TOUS** les critères suivants sont satisfaits :

### Critères fonctionnels

- [ ] Un éleveur peut créer un compte, configurer sa ferme et inviter son équipe
- [ ] Il peut créer un lot de poulets (chair OU ponte), faire les saisies quotidiennes, suivre la mortalité, l'aliment, le poids et les œufs
- [ ] Il peut gérer le calendrier sanitaire (vaccins, traitements avec délais d'attente)
- [ ] Il peut gérer ses stocks (aliment, intrants), ses fournisseurs et ses achats
- [ ] Il peut enregistrer des clients, prendre des commandes, faire des ventes/livraisons, émettre des factures et encaisser des paiements
- [ ] Il voit un dashboard adaptatif avec les KPI de son activité (taux ponte, GMQ, mortalité, encours client...)
- [ ] Il reçoit des alertes automatiques (mortalité anormale, stock bas, fin de délai d'attente)
- [ ] Il peut exporter ses données (PDF, Excel) — lot, financier, sanitaire
- [ ] Il utilise une app mobile offline-first pour la saisie terrain (mortalité, pesées, collecte œufs)
- [ ] Le super-admin peut gérer les abonnements et activer/désactiver des modules
- [ ] Tous les libellés métier sont paramétrables (souches, vaccins, catégories...)
- [ ] L'interface est en français (wolof et anglais arrivent en V2)

### Critères techniques

- [ ] CI/CD verte sur `main` (build + tests + lint pour backend, web, mobile)
- [ ] OpenAPI généré à jour, documentation Swagger consultable
- [ ] Couverture de tests : backend ≥ 60 %, services critiques ≥ 80 %
- [ ] Toutes les erreurs respectent RFC 7807 (Problem Details)
- [ ] Tous les logs portent un Correlation ID
- [ ] Toutes les permissions passent par `@FarmAccess.hasPermission(...)`
- [ ] Toutes les requêtes data passent par `getAccessibleFarmIds(user)`
- [ ] Aucune valeur métier en dur (prix, seuils, libellés)
- [ ] Migrations Flyway versionnées, jamais d'auto-DDL Hibernate en prod
- [ ] Déploiement automatisé (Docker + script ou IaC simple)
- [ ] Backups automatiques de la DB de production

### Critères business

- [ ] Au moins 2-3 éleveurs utilisent la V1 en bêta privée pendant 2 semaines
- [ ] Feedback collecté et issues critiques résolues
- [ ] Modèle pricing concret en place (Stripe / Wave / facturation manuelle au choix)
- [ ] Documentation utilisateur basique (FAQ, vidéos courtes)

---

## 2. Vue d'ensemble — 3 phases

| Phase | Durée | Livrable principal | Statut |
|---|---|---|---|
| **A — Fondations** | 5-6 semaines | Socle technique : auth, multi-tenant, paramétrage, common-*, livestock | À faire |
| **B — Cœur métier volaille** | 8-10 semaines | Tous les bounded contexts métier de la volaille livrés bout-en-bout | À faire |
| **C — Finitions & lancement** | 4-5 semaines | Notifications, exports, polish, bêta, production | À faire |
| **Total** | **17-21 semaines** (≈ 4-5 mois) | V1 en production | — |

**Note :** Les durées sont des **estimations en solo avec Claude Code**. Elles seront ajustées en fonction du rythme réel. Pas de stress sur la deadline — qualité > vitesse.

---

## 3. Phase A — Fondations (5-6 semaines)

> **Objectif :** mettre en place TOUT le socle technique sur lequel reposeront les bounded contexts métier.
> À la fin de cette phase, on peut s'authentifier, créer une ferme, configurer un abonnement, mais **aucun métier avicole n'existe encore**.

### Sprint A1 — Setup mono-repo & infrastructure (semaine 1)

**Livrables :**
- [ ] Repo `avicare-platform` créé sur GitHub avec structure mono-repo
- [ ] Sous-dossiers `backend/`, `web/`, `mobile/`, `docs/`, `infra/`, `shared/`
- [ ] Parent POM Maven configuré avec Spring Boot 3.4 BOM
- [ ] `docker-compose.yml` local : PostgreSQL 16 + Redis + mailhog
- [ ] Pipeline CI GitHub Actions de base (build backend, build web, lint mobile)
- [ ] README initial + LICENSE
- [ ] `.gitignore`, `.editorconfig`, conventions de commit (Conventional Commits)
- [ ] Premier commit, première PR mergée

**Critères d'acceptation :**
- ✅ `docker-compose up` démarre l'environnement complet
- ✅ `./mvnw clean install` build le backend
- ✅ `npm run build` build le web
- ✅ Pipeline CI verte sur `main`

### Sprint A2 — common-api + common-security squelette (semaine 2)

**Livrables :**
- [ ] Module Maven `common-api` créé
  - [ ] `ApiResponse<T>`, `PageResponse<T>`
  - [ ] RFC 7807 `ErrorResponse` (Problem Details)
  - [ ] Hiérarchie d'exceptions : `BusinessException`, `NotFoundException`, `ValidationException`, `ForbiddenException`, `BusinessRuleException`
  - [ ] `@ControllerAdvice` central de mapping exception → Problem Details
  - [ ] `CorrelationIdFilter` + MDC + propagation outbound
- [ ] Module Maven `common-security` squelette
  - [ ] `JwtFilter` + structure principal
  - [ ] `@RequireServiceAuth` annotation + interceptor (s2s)
  - [ ] Bean SpEL `@FarmAccess` (vide pour l'instant)
- [ ] Module Maven `common-tenancy` squelette
- [ ] Module Maven `common-i18n` squelette (locale resolver FR par défaut)

**Critères d'acceptation :**
- ✅ Un endpoint test renvoie un Problem Details propre sur exception
- ✅ Les logs JSON portent le Correlation ID
- ✅ `@FarmAccess` est appelable (renvoie false partout pour l'instant)

### Sprint A3 — Bounded context `identity` + `tenancy` (semaines 3-4)

**Livrables backend :**
- [ ] Migration Flyway V1 : tables `users`, `farms`, `user_farms`, `roles`, `permissions`
- [ ] Entités JPA + repositories
- [ ] Endpoints `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/refresh`
- [ ] Endpoints `/account/profile`, `/account/profile` (PUT)
- [ ] Endpoints `/farms` (CRUD), `/farms/{id}/users` (CRUD)
- [ ] JWT RS256 émis + cookie httpOnly
- [ ] Blacklist Redis pour les tokens révoqués
- [ ] Implémentation complète de `@FarmAccess.hasPermission(farmId, 'res:verb')`
- [ ] Memberships dans les claims JWT
- [ ] Tests unitaires des règles d'accès (≥ 80 % couverture du module security)

**Livrables web :**
- [ ] Setup Next.js 16 + App Router + RTK Query
- [ ] Page login / signup avec validation
- [ ] Page "mes fermes" + sélecteur de ferme global
- [ ] Page "équipe de la ferme" (CRUD users + invitations)
- [ ] AppShell avec sidebar conditionnelle
- [ ] Gestion 401 → redirect login

**Critères d'acceptation :**
- ✅ Un user peut s'inscrire, se connecter, voir son profil
- ✅ Un admin de ferme peut inviter un user et lui assigner un rôle
- ✅ Un user qui n'a pas accès à une ferme reçoit 403 Problem Details
- ✅ Le JWT contient les memberships, vérifiables côté backend sans hit DB
- ✅ Aucun hardcoding de rôle dans le code métier

### Sprint A4 — Bounded context `subscription` + `parameters` (semaine 5)

**Livrables backend :**
- [ ] Migration Flyway V2 : `subscriptions`, `subscription_modules`, `entitlements`, `subscription_change_requests`
- [ ] Migration Flyway V3 : `catalog_items`, `farm_settings`, `user_settings`, `farm_catalog_items`, `price_lists`, `price_list_items`, `alert_thresholds`
- [ ] Bounded context `subscription` : CRUD souscription, activation/désactivation modules, workflow demandes
- [ ] Bounded context `parameters` : services `FarmSettingService`, `CatalogService`, `PriceListService`, `ThresholdService` avec lookup 3 couches
- [ ] Bean `@features.isEnabled(farmId, 'module.xxx')` opérationnel avec modes OFF/SHADOW/SOFT/HARD
- [ ] Seed data : modules par défaut, bundles starter/pro/complete, catalogue souches volaille (Cobb 500, Ross 308, ISA Brown...)

**Livrables web :**
- [ ] Backoffice super-admin : gestion souscriptions
- [ ] Page éleveur "Mon abonnement" : voir modules actifs, demander changement
- [ ] Hub paramétrage `/reglages` : 5 catégories (stock, lots, sanitaire, ventes, comptabilité)

**Critères d'acceptation :**
- ✅ Un endpoint protégé par `@features.isEnabled('module.poultry.broiler')` renvoie 403 si module désactivé
- ✅ Un éleveur peut surcharger un libellé du catalogue plateforme (ex: ajouter "Ma souche locale")
- ✅ Le `FarmSettingService.get(...)` parcourt bien les 3 couches dans l'ordre
- ✅ Les libellés FR sont chargés dynamiquement (pas en dur dans le code)

### Sprint A5 — Bounded context `livestock` socle (semaine 6)

**Livrables backend :**
- [ ] Migration Flyway V4 : `production_units` (table parente)
- [ ] Entité abstraite JPA `ProductionUnit` avec stratégie `JOINED`
- [ ] Référentiel `breeds` (souches/races) lié à `Species`
- [ ] Bounded context `livestock/species` : enum `Species`, registre des espèces actives
- [ ] Bounded context `livestock/lifecycle` : enregistrement événements génériques (création, transfert, fin)
- [ ] Services transverses (mortalité générique, comptage)

**Critères d'acceptation :**
- ✅ La table `production_units` existe avec toutes ses colonnes communes
- ✅ Aucune table d'extension par espèce n'est créée à cette étape (`poultry_batches` arrive en Sprint B1)
- ✅ Les services transverses (sanitaire futur, commercial futur) peuvent référencer `ProductionUnit` sans connaître l'espèce
- ✅ Tests unitaires du socle livestock

### Jalons Phase A

| Jalon | Quand | Quoi |
|---|---|---|
| **A.M1** — Setup OK | Fin sprint A1 | Repo + CI verte + Docker tourne |
| **A.M2** — Common ready | Fin sprint A2 | `common-*` utilisables par tout le reste |
| **A.M3** — Auth & multi-tenant | Fin sprint A3 | Un user peut se connecter et accéder à sa ferme |
| **A.M4** — Abonnement & paramétrage | Fin sprint A4 | Feature gating opérationnel, paramétrage 3 couches |
| **A.M5** — Socle livestock prêt | Fin sprint A5 | `ProductionUnit` prêt à accueillir la volaille |

---

### Sprint A6 — Rattrapage frontend (décision stratégique, hors plan initial)

> **Contexte.** Les sprints A2→A5 ont été livrés **backend uniquement** (les
> « Livrables web » d'A3/A4/A5 n'ont pas été faits). A6 rattrape ce socle web en
> un sprint dédié, avant d'attaquer la Phase B. Référence design : `docs/10-design-system.md` ;
> architecture : `docs/07-frontend-nextjs.md`.

**Sessions :**
- **A6-1** — Bootstrap : setup Next.js 16 + theme MUI `avicareTheme` + RTK Query + pages **login/signup** + AppShell minimal + dashboard placeholder.
- **A6-2** — Pages **fermes** (liste/création) + **équipe** (membres/invitation).
- **A6-3** — **Abonnement** (plan + modules) + **hub paramétrage** `/reglages`.

**Critères d'acceptation :**
- ✅ Un user peut s'inscrire, se connecter et atteindre le dashboard depuis l'UI web
- ✅ Le theme respecte `docs/10` (palette vert/orange, Inter/Geist, pas de look MUI générique)
- ✅ Les appels passent par le backend réel (JWT Bearer, gestion 401)

> **Dette connue (A6-1).** Tokens stockés en `localStorage` en V1 (le backend ne pose
> pas encore de cookie httpOnly — cf. A3-2) ; à aligner sur `docs/07 §5`
> (access en mémoire + refresh cookie httpOnly) lors d'un sprint de durcissement sécu.

---

## 4. Phase B — Cœur métier volaille (8-10 semaines)

> **Objectif :** livrer TOUS les bounded contexts métier nécessaires pour qu'un éleveur de volaille puisse piloter sa ferme de A à Z, sur web ET sur mobile.

### Sprint B1 — Bounded context `poultry` chair (semaine 7)

**Livrables backend :**
- [x] Migration Flyway V6 : `poultry_batches` (hérite de `production_units`) + `daily_records` (saisies quotidiennes)
- [x] Migration Flyway V7 : `weighing_samples`, `growth_performance`
- [x] CRUD lots poulets chair
- [x] Saisies quotidiennes (mortalité, aliment, eau, poids, observations)
- [x] Pesées échantillon + calcul GMQ + IC + uniformité
- [x] Service `GrowthAnalysisService` (recalcul auto, projection maturité)
- [x] Validation contre `module.poultry.broiler` via `@features.isEnabled`

**Livrables web :**
- [x] Page Liste des lots avec filtres + statuts
- [x] Page Détail lot avec courbes (Recharts)
- [x] Formulaire saisie quotidienne (avec pré-remplissage)
- [x] Formulaire pesée échantillon

**Critères d'acceptation :**
- ✅ Un éleveur peut créer un lot de 1 000 poulets Cobb 500
- ✅ Il fait des saisies quotidiennes, voit le GMQ se calculer
- ✅ Si `module.poultry.broiler` est désactivé, l'accès aux endpoints renvoie 403

### Sprint B2 — Bounded context `poultry` ponte (semaine 8)

**Livrables backend :**
- [ ] Migration Flyway V8 : `egg_collection_configs`, `egg_collections`, `egg_tray_stocks`, `daily_egg_productions`
- [ ] CRUD configuration créneaux collecte + grades activés
- [ ] Enregistrement collectes par créneau + collecteur + grades
- [ ] Stock plaquettes (pleins/vides) en temps réel
- [ ] Clôture jour + agrégation + calcul taux ponte/casse
- [ ] Validation contre `module.poultry.layer`

**Livrables web :**
- [ ] Page configuration ponte par site
- [ ] Formulaire collecte œufs
- [ ] Vue stock plaquettes
- [ ] Tableau historique production journalière

**Critères d'acceptation :**
- ✅ Un éleveur peut configurer 3 créneaux (7h, 12h, 17h) + grades S/M/L/XL
- ✅ Il enregistre 200 œufs collectés à 12h dont 5 cassés, 50 S, 100 M, 40 L, 10 XL
- ✅ Le stock plaquettes est cohérent en temps réel
- ✅ Le taux de ponte est correctement calculé en clôture jour

### Sprint B3 — Bounded context `health` (semaine 9)

**Livrables backend :**
- [ ] Migration Flyway V9 : `vaccination_programs`, `vaccination_schedules`, `treatments`, `vet_visits`, `mortality_records`, `health_events`
- [ ] CRUD programmes vaccination + exécution planning
- [ ] CRUD traitements avec délais d'attente automatiques (`withdrawalStatus`)
- [ ] CRUD visites vétos
- [ ] Enregistrement mortalité lié à `ProductionUnit` (générique)
- [ ] Sync effectif lot ↔ mortalité (`MortalitySyncService`)

**Livrables web :**
- [ ] Calendrier sanitaire (vue mensuelle)
- [ ] Formulaire vaccination / traitement
- [ ] Badge "délai d'attente en cours" sur les lots concernés

**Critères d'acceptation :**
- ✅ Un éleveur planifie un programme Newcastle pour son lot
- ✅ Il exécute la vaccination, le système marque le lot avec "viande consommable dans X jours"
- ✅ La mortalité saisie décrémente l'effectif du lot automatiquement
- ✅ Le code de `health` ne connaît pas le mot "poultry" — il manipule `ProductionUnit`

### Sprint B4 — Bounded context `inventory` (semaine 10)

**Livrables backend :**
- [ ] Migration Flyway V10 : `stocks`, `stock_movements`, `stock_categories`, `suppliers`, `purchase_orders`, `purchase_order_items`, `feed_formulas`
- [ ] CRUD stocks + mouvements (entrée/sortie)
- [ ] Seuils d'alerte par stock (lié à `alert_thresholds`)
- [ ] CRUD fournisseurs
- [ ] Workflow bons de commande (draft → sent → received → cancelled)
- [ ] Réception qui alimente le stock
- [ ] CRUD formules d'aliment

**Livrables web :**
- [ ] Page Inventaire avec catégories
- [ ] Mouvements stock avec historique
- [ ] Page Fournisseurs + Bons de commande
- [ ] Formules d'aliment

**Critères d'acceptation :**
- ✅ Un éleveur saisit une entrée de 500 kg d'aliment chair, le stock passe à 500 kg
- ✅ Une sortie de 50 kg le ramène à 450 kg
- ✅ Quand il passe sous le seuil de 100 kg, une alerte est créée
- ✅ La réception d'un bon de commande alimente automatiquement le stock

### Sprint B5 — Bounded context `commercial` (semaines 11-12)

**Livrables backend :**
- [x] Migration Flyway `clients`/`orders`/`order_items`/`sales`/`deliveries`/`delivery_items`/`invoices`/`payments` — réelles : **V20** (clients+orders, B5-1), **V21** (sales+deliveries, B5-2), **V22** (invoices, B5-3), **V23** (payments, B5-4)
- [x] CRUD clients avec limite de crédit et encours (B5-1)
- [x] Workflow commandes (pending → confirmed → in_progress → delivered → cancelled) (B5-1, D23)
- [x] Conversion commande → livraison (décrémente stock) (B5-2, D21)
- [x] Génération facture (depuis sale ou delivery) (B5-3)
- [x] Paiements ventilés (espèces, mobile money, virement) (B5-4)
- [x] Mise à jour encours client automatique (B5-3 émission +, B5-4 paiement −, D26)
- [ ] Alerte dépassement limite de crédit — *calcul prêt* (`CommercialFacade.getClientCredit` / `ClientService.projectCredit`, D26) ; surfaçage en endpoint/UX → B5-5/B5-6
- [ ] Intégration avec `price_lists` du module `parameters` — différé (prix unitaires saisis au formulaire en V1)

**Livrables web :**
- [ ] Page Pipeline Kanban (Commande → Vente → Facture → Paiement)
- [ ] CRUD clients + fiche client avec historique
- [ ] Formulaires commande / vente / livraison / facture / paiement

**Critères d'acceptation :**
- ✅ Un éleveur enregistre un client avec limite de crédit 500 000 F
- ✅ Le client commande 100 poulets vifs, l'éleveur convertit en livraison
- ✅ Une facture est générée, partiellement payée (300 000 F), l'encours devient 200 000 F
- ✅ Si le client commande encore et dépasse 500 000 F d'encours, alerte automatique

### Sprint B6 — Bounded context `finance` (semaine 13)

**Livrables backend :**
- [ ] Migration Flyway V12 : `expenses`, `salaries`, `salary_advances`
- [ ] CRUD dépenses avec catégories (paramétrables)
- [ ] Service comptabilité analytique : coût par lot, marges
- [ ] CRUD salaires : génération mensuelle, marquage payé
- [ ] CRUD avances : workflow demande → approbation → déduction

**Livrables web :**
- [ ] Page Dépenses avec filtres
- [ ] Vue analytique par lot (coût total, coût par poulet, marge)
- [ ] Vue factures impayées (overdue)
- [ ] Vue encours clients
- [ ] Page Salaires + Avances

**Critères d'acceptation :**
- ✅ Un éleveur enregistre une dépense aliment de 500 000 F sur le lot #3
- ✅ Il voit dans "Coût lot #3" : aliment 500 000 + traitements 50 000 = 550 000 F
- ✅ Il génère les salaires du mois pour ses 2 fermiers
- ✅ Un fermier demande une avance de 30 000 F, l'admin l'approuve, elle est déduite du prochain salaire

### Sprint B7 — Mobile React Native fermier MVP (semaines 14-15)

**Livrables mobile :**
- [ ] Setup React Native + navigation (React Navigation)
- [ ] Setup state management (Redux Toolkit + RTK Query avec persist)
- [ ] Setup base de données locale (WatermelonDB ou SQLite avec Drizzle)
- [ ] Auth (login + biometrics optionnel)
- [ ] Sélecteur de ferme + sélecteur de lot
- [ ] Mode terrain : saisie mortalité, pesées, collectes œufs
- [ ] Mode offline-first : queue d'actions à syncer
- [ ] Sync automatique quand le réseau revient
- [ ] Indicateur online/offline visible
- [ ] Détection rôle (farmer → mode terrain, buyer → mode buyer désactivé pour V1)

**Livrables backend :**
- [ ] Endpoint `/mobile/sync` (batch d'actions à appliquer côté serveur)
- [ ] Gestion des conflits de sync (last-write-wins par défaut)

**Critères d'acceptation :**
- ✅ Un fermier installe l'app, se connecte, sélectionne sa ferme + un lot
- ✅ En mode avion, il saisit 5 mortalités → mises en file localement
- ✅ Le réseau revient, les 5 mortalités sont envoyées au serveur, l'effectif lot est mis à jour
- ✅ L'app affiche "5 actions en attente de sync" quand offline

### Jalons Phase B

| Jalon | Quand | Quoi |
|---|---|---|
| **B.M1** — Volaille chair | Fin sprint B1 | Un lot chair complet pilotable |
| **B.M2** — Volaille ponte | Fin sprint B2 | Production d'œufs opérationnelle |
| **B.M3** — Sanitaire | Fin sprint B3 | Vaccins + traitements + délais d'attente |
| **B.M4** — Stocks | Fin sprint B4 | Inventaire + achats |
| **B.M5** — Commercial | Fin sprint B5 | Pipeline complet client → paiement |
| **B.M6** — Finance | Fin sprint B6 | Comptabilité analytique + salaires |
| **B.M7** — Mobile MVP | Fin sprint B7 | Saisie terrain offline-first |

---

## 5. Phase C — Finitions & lancement (4-5 semaines)

> **Objectif :** transformer un produit "qui marche" en un produit "qu'on peut vendre".

### Sprint C1 — Notifications & alertes (semaine 16)

**Livrables backend :**
- [ ] Bounded context `notification` : `notifications`, `notification_preferences`, `alerts`
- [ ] Cron `ScheduledJobsService` : checks quotidiens (mortalité anormale, stock bas, perfs, délais d'attente)
- [ ] Génération in-app + préférences par canal
- [ ] Endpoints `/notifications`, `/alerts`, `/notification-preferences`

**Livrables web/mobile :**
- [ ] Cloche live avec badge unread
- [ ] Page Préférences notifications
- [ ] Push notifications mobile (Firebase Cloud Messaging — optionnel V1)

**Critères d'acceptation :**
- ✅ À 6h chaque jour, les checks tournent et créent les alertes
- ✅ Un utilisateur voit la cloche avec le bon badge
- ✅ Il peut choisir de ne pas être notifié des stocks bas (préférences)

### Sprint C2 — Reporting & exports (semaine 17)

**Livrables backend :**
- [ ] Bounded context `reporting`
- [ ] Service `PdfExportService` (PDFKit ou OpenPDF) : rapport lot, rapport financier, rapport sanitaire
- [ ] Service `ExcelExportService` (Apache POI) : exports tabulaires
- [ ] KPI configurables (`kpi_configs`) — gated par `module.kpi.advanced`
- [ ] Score performance Or/Argent/Bronze

**Livrables web :**
- [ ] Boutons export PDF / Excel sur les pages concernées
- [ ] Dashboard avec widgets adaptatifs selon les modules actifs
- [ ] Page Comparaison inter-sites (gated par multi-site)

**Critères d'acceptation :**
- ✅ Un éleveur exporte le rapport d'un lot terminé en PDF (page de garde + courbes + chiffres)
- ✅ Le dashboard affiche les bons widgets selon les modules actifs

### Sprint C3 — QR codes + portail buyer (semaine 18)

**Livrables backend :**
- [ ] Génération QR pour lot et stock (`/qr/batch/{id}`, `/qr/stock/{id}`) — gated par `module.qr_codes`
- [ ] Lookup public `/qr/lookup` (auth optionnelle)
- [ ] Bounded context `buyer` : endpoints `/buyer/profile`, `/buyer/dashboard`, `/buyer/orders`, `/buyer/invoices`, `/buyer/payments` — gated par `module.buyer_portal`

**Livrables web :**
- [ ] Page Scan QR (`/scan`) avec scanner HTML5
- [ ] Portail buyer : dashboard, mes commandes, mes factures, mes paiements

**Critères d'acceptation :**
- ✅ Un éleveur génère un QR pour le lot #3, l'imprime, le colle sur le bâtiment
- ✅ Un opérateur scanne le QR → page lot affichée (auth requise pour détails)
- ✅ Un buyer se connecte et voit uniquement SES commandes/factures/paiements

### Sprint C4 — Polish UX + tests utilisateurs (semaine 19)

**Livrables :**
- [ ] Audit UX complet : parcours signup → premier lot → première vente → premier paiement
- [ ] Wizard onboarding 3 étapes (créer ferme, configurer paramètres, créer premier lot)
- [ ] Pages 403, 404, 500 propres avec navigation
- [ ] Messages d'erreur clairs et localisés
- [ ] Loading states et skeleton screens
- [ ] Tests d'acceptation E2E sur les flows critiques (Playwright ou Cypress)
- [ ] Bêta privée avec 2-3 éleveurs réels, collecte feedback
- [ ] Issues critiques fixées

**Critères d'acceptation :**
- ✅ Un nouvel éleveur peut s'inscrire et créer son premier lot en moins de 10 minutes sans aide
- ✅ Les éleveurs bêta donnent un NPS ≥ 7

### Sprint C5 — Déploiement production (semaines 20-21)

**Livrables :**
- [ ] Infrastructure cible choisie et configurée (VPS Hetzner / OVH ou cloud type Scaleway, AWS, GCP)
- [ ] Domaine acheté et configuré (HTTPS via Let's Encrypt)
- [ ] Variables d'environnement gérées via vault (.env.production en local crypté, ou Hashicorp Vault, ou simple secrets manager)
- [ ] Backups automatiques DB (quotidiens, rétention 30 jours)
- [ ] Monitoring : Prometheus + Grafana ou solution simple (UptimeRobot + alertes email)
- [ ] Logs centralisés (Loki ou simple fichier rotatif + outil de recherche)
- [ ] App mobile publiée en Beta (Google Play Internal Testing + TestFlight optionnel)
- [ ] Migration data GINAARTECH si nécessaire (script one-shot)
- [ ] Documentation utilisateur (FAQ, vidéos courtes)
- [ ] Go-live officiel

**Critères d'acceptation :**
- ✅ `https://app.avicare-platform.com` (ou domaine choisi) est accessible
- ✅ Un éleveur peut s'inscrire en production et commencer à utiliser
- ✅ Les backups tournent et sont restaurables
- ✅ Le monitoring alerte en cas de downtime

### Jalons Phase C

| Jalon | Quand | Quoi |
|---|---|---|
| **C.M1** — Notifications | Fin sprint C1 | Alertes opérationnelles |
| **C.M2** — Exports | Fin sprint C2 | PDF/Excel + dashboards |
| **C.M3** — QR + Buyer | Fin sprint C3 | Portail client + traçabilité |
| **C.M4** — Beta closed | Fin sprint C4 | 2-3 éleveurs testent en bêta |
| **C.M5** — V1 LIVE | Fin sprint C5 | Production publique |

---

## 6. Dépendances clés entre phases

```
A1 (setup) ──→ A2 (common-*) ──→ A3 (auth) ──→ A4 (subs + params) ──→ A5 (livestock)
                                                                              │
                                                                              ▼
                                          B1 (poultry chair) ──→ B2 (poultry ponte)
                                                  │                       │
                                                  ▼                       ▼
                                              B3 (health) ←──────────────┘
                                                  │
                                                  ▼
                                              B4 (inventory)
                                                  │
                                                  ▼
                                              B5 (commercial)
                                                  │
                                                  ▼
                                              B6 (finance)
                                                  │
                                                  ▼
                                              B7 (mobile)
                                                  │
                                                  ▼
                                C1 → C2 → C3 → C4 → C5 (LIVE)
```

**Règle d'or :** ne jamais commencer un sprint dont les dépendances ne sont pas livrées et stables.

---

## 7. Risques majeurs et mitigations

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Apprentissage Spring Boot prend plus de temps que prévu | Élevée | Élevé | Phase A allongée si besoin. Demander conseil à Claude (moi) avant chaque nouveau pattern. |
| R2 | Le mobile offline-first est sous-estimé en complexité | Élevée | Élevé | Démarrer B7 sur un seul flow (mortalité) avant d'étendre. Choisir lib éprouvée (WatermelonDB ou Drizzle). |
| R3 | Migration GINAARTECH plus complexe que prévu | Moyenne | Moyen | À traiter en C5, scénario fallback : démarrage avec 0 utilisateur si trop dur. |
| R4 | Découvrir un pattern fondamental manquant en phase B | Moyenne | Élevé | Phase A étendue de 1 semaine si besoin. Tests intensifs dès A5. |
| R5 | Scope creep — tentation d'ajouter ovins/bovins en V1 | Élevée | Très élevé | Discipline stricte. Garder les recos validées. Ajouter dans le backlog mais ne pas implémenter. |
| R6 | Burnout solo | Moyenne | Très élevé | Cadence soutenable (40-45 h/semaine max). Pause 1 jour/semaine minimum. Pas de deadline qui force. |
| R7 | Problèmes d'auth/sécurité tardifs | Faible | Très élevé | Tests intensifs en A3. Audit sécurité externe en C4 si possible. |
| R8 | Performances DB sous charge | Faible | Moyen | Indexes pensés dès Flyway V1. Tests de charge en C5. |

---

## 8. Méthode de travail recommandée avec Claude Code

### Routine type d'un sprint

1. **Lundi matin** — Relire le sprint planifié dans ce document. Donner à Claude Code : `00-vision-strategique.md` + le document de la section concernée + le sprint courant.
2. **Lundi-Vendredi** — Coder en binôme avec Claude Code, commit progressifs avec Conventional Commits.
3. **Vendredi après-midi** — Faire le bilan du sprint : checkboxes du sprint, mettre à jour ce document.
4. **Vendredi soir / Week-end** — Revoir l'archi globale, poser des questions stratégiques (à moi ici).
5. **Lundi suivant** — Démarrer le sprint suivant.

### Quand demander à Claude vs Claude Code

- **À moi (Claude, ici)** : décisions d'architecture, choix de libs, doutes stratégiques, revues de code de modules importants
- **À Claude Code** : implémentation concrète, génération de tests, refactorings locaux, debug

### Bonnes pratiques

- 1 PR = 1 feature ou 1 fix, jamais "plein de trucs mélangés"
- Tests écrits AVANT de marquer une checkbox comme cochée
- Code review (à toi-même via Claude Code) avant merge
- Pas de "TODO" oubliés dans le code — soit fait, soit en issue GitHub

---

## 9. Documents associés

- `00-vision-strategique.md` — Vision globale du projet
- `02-setup-monorepo.md` — À venir, détaille la Phase A1
- `03-architecture-spring-boot.md` — À venir, détaille la structure backend
- `04-schema-db-initial.md` — À venir, détaille les migrations Flyway
- ... (etc.)

---

_Document créé en démarrage du projet. À mettre à jour à chaque fin de sprint._
