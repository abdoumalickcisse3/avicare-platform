# Couche « Garder » (partenaire C1) — Implementation Plan

**Goal:** Donner au partenaire une raison de revenir : des **alertes « éleveur qui décroche »**
matérialisées, poussées en WhatsApp, visibles dans le portail — et un **co-branding** léger (logo
partenaire) dans l'app de l'éleveur.

**Spec:** `docs/superpowers/specs/2026-08-24-partner-couche-garder-design.md`

**Architecture:** Une table `partner_alerts` propre au contexte partenaire (miroir de
`notifications`, audience différente), alimentée par un `PartnerAlertScanner` quotidien qui lit
`LivestockFacade.recentActivity` et **masque par les scopes partagés**. Le push WhatsApp réutilise
l'outbox existante via une nouvelle façade `WhatsAppOutboxFacade` (contexte notification), rendue
possible par une migration corrective qui passe `whatsapp_outbox.notification_id` en NULLABLE.

**Stack:** Spring Boot 3 / Java 21 / Flyway / Testcontainers · Next.js 16 + MUI v9 + RTK Query.

## Global Constraints

- **Frontière de confiance** : aucune alerte pour une ferme qui ne partage pas `activity`. Le
  masquage est fait dans le scanner, jamais dans le front. Le corps d'alerte ne cite que le nom de
  la ferme et un nombre de jours.
- **Pas de cross-import** : le contexte `partner` n'importe rien de `notification.whatsapp` —
  uniquement `com.avicare.notification.api.WhatsAppOutboxFacade`.
- **Migrations** : V38 uniquement, jamais modifier V35/V36/V37. `TIMESTAMP` sans TZ, trigger
  `trg_partner_alerts_updated_at`, index partiel unique sur ACTIVE.
- **JPA** : `@Enumerated(STRING)`, `created_at`/`updated_at` en lecture seule (trigger DB).
- **DB-less contexts** : tout nouveau repository JPA doit être `@MockitoBean` dans les **quatre**
  tests DB-less (`SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`,
  `NotificationControllerIT`) — les repérer via le grep de l'ancre `FarmRepository`.
- **Gates web** : `npm run lint && npx tsc --noEmit && npm test && npm run build` (le `tsc` a manqué
  au cycle B2 et a cassé la CI).
- **Gates backend** : `./mvnw clean verify` (reactor complet), Spotless `-pl` sur le module touché.
- **Commits** : Conventional Commits, aucune mention Claude/IA.

---

### Task 1 : Migration V38 + entités

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V38__partner_alerts.sql`
- Create: `.../partner/domain/PartnerAlert.java`, `AlertCategory.java`, `AlertSeverity.java`, `AlertStatus.java`
- Create: `.../partner/repository/PartnerAlertRepository.java`
- Create: `.../partner/repository/PartnerAlertRepositoryIT.java`

- [ ] **Step 1** — V38 : `partner_alerts` (cf. spec §4) + index unique partiel
  `(partner_id, dedup_key) WHERE status='ACTIVE'` + index `(partner_id, status)` + trigger
  `updated_at`. **Et** la corrective : `ALTER TABLE whatsapp_outbox ALTER COLUMN notification_id DROP NOT NULL;`
- [ ] **Step 2** — Entité `PartnerAlert` + 3 enums. Pas de soft delete (une alerte se RESOLVED, elle
  ne se supprime pas) → **pas** de `deleted_at`, donc pas de `@SQLRestriction`.
- [ ] **Step 3** — Repository : `findByPartnerIdAndStatusOrderByCreatedAtDesc`,
  `findByPartnerIdAndDedupKeyAndStatus`, `findByPartnerIdAndCategoryAndStatus`.
- [ ] **Step 4** — `PartnerAlertRepositoryIT` (Testcontainers) : l'index unique partiel refuse un
  second ACTIVE sur la même clé, et l'accepte une fois le premier RESOLVED.
- [ ] **Step 5** — Ajouter `PartnerAlertRepository` en `@MockitoBean` dans les 4 tests DB-less.
- [ ] **Step 6** — `./mvnw clean verify` puis commit
  `feat(backend:partner): partner_alerts table + entity (V38)`

---

### Task 2 : `WhatsAppOutboxFacade` (contexte notification)

**Files:**
- Create: `.../notification/api/WhatsAppOutboxFacade.java`
- Create: `.../notification/whatsapp/WhatsAppOutboxFacadeImpl.java` + test
- Modify: `.../notification/whatsapp/WhatsappOutbox.java` (`notificationId` devient nullable)

- [ ] **Step 1** — Façade : `void enqueue(String rawPhone, String message)`. Normalise via
  `PhoneNormalizer`, no-op si `notifications.whatsapp.enabled=false` ou téléphone inexploitable.
- [ ] **Step 2** — Retirer `nullable = false` sur `WhatsappOutbox.notificationId`.
- [ ] **Step 3** — Test unitaire : enfile une ligne PENDING quand activé ; n'enfile rien quand
  désactivé ni quand le téléphone est nul/invalide.
- [ ] **Step 4** — Vérifier que `OutboxEnqueuerImpl` (chemin éleveur) est inchangé et vert.
- [ ] **Step 5** — Commit `feat(backend:notification): WhatsApp outbox facade for non-farm senders`

> **Attention façade** : `WhatsAppOutboxFacadeImpl` ne doit dépendre que de `PhoneNormalizer` +
> `WhatsappOutboxRepository`. Élargir son graphe casserait les slices `@DataJpaTest` qui l'importent
> (footgun connu du registre d'outils assistant).

---

### Task 3 : `PartnerAlertScanner` (détection + masquage + push)

**Files:**
- Create: `.../partner/service/PartnerAlertService.java` (upsert / resolve / list)
- Create: `.../partner/service/PartnerAlertScanner.java` (`@Scheduled`)
- Create: `.../partner/service/PartnerAlertScannerTest.java`, `PartnerAlertServiceTest.java`
- Modify: `.../partner/api/PartnerFacade.java` si besoin d'un `activePartnerIds()`

- [ ] **Step 1** — `PartnerAlertService` : `upsert(partnerId, farmId, condition)` idempotent sur
  `dedup_key` ACTIVE ; `resolveDisappeared(partnerId, category, currentKeys)` ; `listActive`.
  Le push WhatsApp part **uniquement à la création** (jamais sur un upsert idempotent).
- [ ] **Step 2** — `PartnerAlertScanner` : `@Scheduled(cron = "${partner.risk.scan-cron:0 30 6 * * *}", zone = "${partner.risk.zone:Africa/Dakar}")`.
  Pour chaque partenaire ACTIVE → chaque ferme CONFIRMED → **si et seulement si** `activity` est
  partagé → jours depuis `recentActivity(farmId, 1)`. Palier WARNING/CRITICAL dans le dedup key
  (spec §5). Une ferme sans aucune activité connue → pas d'alerte (on ne sait pas, on ne crie pas).
- [ ] **Step 3** — Isolation des erreurs par partenaire ET par ferme (`try/catch` + `log.warn`),
  calqué sur `NotificationScannerService`.
- [ ] **Step 4** — Tests unitaires (Mockito) : ferme silencieuse 20 j → 1 alerte WARNING + 1 push ;
  re-scan le lendemain → **aucun** nouveau push ; passage à 31 j → WARNING resolved + CRITICAL créée
  + 1 push ; **ferme ne partageant pas `activity` → zéro alerte** (le test de la frontière) ;
  ressaisie → alerte RESOLVED.
- [ ] **Step 5** — `./mvnw clean verify` + commit
  `feat(backend:partner): daily network risk scan (FARM_SILENT) with WhatsApp push`

---

### Task 4 : `FARM_LEFT` + endpoints portail + `riskLevel`

**Files:**
- Modify: `.../partner/service/PartnerNetworkService.java` (hook sur `leave`)
- Modify: `.../partner/controller/PartnerPortalController.java`
- Modify: `.../partner/dto/response/NetworkFarmRow.java` (+ `riskLevel`)
- Modify: `.../partner/service/PartnerNetworkReadService.java`
- Create: `.../partner/dto/response/PartnerAlertResponse.java`
- Modify: `.../partner/controller/PartnerPortalControllerIT.java`

- [ ] **Step 1** — `leave()` crée une alerte `FARM_LEFT` CRITICAL (+ push). Le scan ne la réconcilie
  jamais (catégorie non déclarée par le scanner).
- [ ] **Step 2** — `GET /api/v1/partner/network/alerts` → `List<PartnerAlertResponse>` (ACTIVE,
  plus récentes d'abord).
- [ ] **Step 3** — `NetworkFarmRow` gagne `String riskLevel` (`OK`/`WATCH`/`AT_RISK`, **`null` si
  `activity` non partagé**) calculé dans `row()`, à côté du masquage existant.
- [ ] **Step 4** — IT : un partner-user ne voit que les alertes de SON partenaire ; un token éleveur
  → 403 ; une ferme sans `activity` → `riskLevel` null.
- [ ] **Step 5** — `./mvnw clean verify` + commit
  `feat(backend:partner): network alerts endpoint + per-farm risk level`

---

### Task 5 : Co-branding backend (PATCH partenaire + logoUrl éleveur)

**Files:**
- Create: `.../partner/dto/request/UpdatePartnerRequest.java`
- Modify: `.../partner/controller/AdminPartnerController.java`, `.../service/PartnerService.java`
- Modify: `.../partner/dto/response/FarmPartnerResponse.java` (+ `logoUrl`)
- Modify: `AdminPartnerControllerTest`, `FarmerPartnerControllerIT`

- [ ] **Step 1** — `PATCH /api/v1/admin/partners/{partnerId}` (ADMIN) : nom, contacts, `logoUrl`.
  Champs null = inchangés (sémantique PATCH).
- [ ] **Step 2** — `FarmPartnerResponse` expose `logoUrl` (l'éleveur voit le logo de son réseau).
- [ ] **Step 3** — Tests : PATCH partiel ne remet pas à null les champs omis ; non-ADMIN → 403.
- [ ] **Step 4** — `./mvnw clean verify` + commit
  `feat(backend:partner): admin partner update (logo co-branding) + logoUrl on farmer view`

---

### Task 6 : Portail — bandeau d'alertes + colonne Suivi

**Files:**
- Modify: `web/src/store/api/partnerApi.ts` (+ `useGetNetworkAlertsQuery`), `web/src/types/index.ts`
- Create: `web/src/components/partner/NetworkAlerts.tsx` + test
- Modify: `web/src/components/partner/NetworkDashboard.tsx` + son test

- [ ] **Step 1** — Types `PartnerAlert`, `riskLevel` sur `NetworkFarmRow` ; endpoint
  `getNetworkAlerts` (tag `Network`).
- [ ] **Step 2** — `NetworkAlerts` : rien à afficher → **ne rend rien** (pas d'état vide). Sinon
  bandeau `severity`-coloré, une ligne par alerte (titre + corps).
- [ ] **Step 3** — Colonne « Suivi » dans la table : puce OK / À surveiller / À risque, `—` si null.
- [ ] **Step 4** — Tests : bandeau absent sans alerte ; 2 alertes rendues ; `riskLevel` null → `—`.
- [ ] **Step 5** — `npm run lint && npx tsc --noEmit && npm test && npm run build` + commit
  `feat(web:partner): network alerts banner + per-farm follow-up column`

---

### Task 7 : App éleveur — bloc « Mon réseau »

**Files:**
- Create: `web/src/components/partner/MyNetworkCard.tsx` + test
- Modify: la page dashboard éleveur, `web/src/types/index.ts` (+ `logoUrl`)

- [ ] **Step 1** — `MyNetworkCard` : partenaires CONFIRMED de la ferme (logo + nom + type), lien
  vers `/reglages/partenaires`. Aucun partenaire → ne rend rien.
- [ ] **Step 2** — Logo : `<Box component="img">` avec fallback (initiale du nom) si `logoUrl` est
  null ou l'image casse. Discret, pas de bannière publicitaire.
- [ ] **Step 3** — Insérer dans le dashboard éleveur, sous les KPI.
- [ ] **Step 4** — Tests : rend le nom + le logo ; fallback quand `logoUrl` null ; rien quand aucun
  partenaire CONFIRMED.
- [ ] **Step 5** — Gates web + commit `feat(web:partner): farmer dashboard network card (co-branding)`

---

### Task 8 : Validation complète + PR

- [ ] **Step 1** — `cd backend && ./mvnw clean verify` vert (reactor complet).
- [ ] **Step 2** — `make backend-run` + `/actuator/health` → UP (la V38 tourne sur une DB propre).
      ⚠️ Si l'app ne démarre pas après un merge : `./mvnw clean install` (footgun incrémental connu).
- [ ] **Step 3** — Gates web complets.
- [ ] **Step 4** — Smoke : seeder via `infra/seed/partner-demo-seed.sql`, forcer une ferme
      silencieuse, déclencher le scan, vérifier l'alerte dans le portail. WhatsApp reste OFF en local.
- [ ] **Step 5** — PR + `gh pr checks --watch` → vert avant tout merge.

---

## Ordre & dépendances

1 → 2 → 3 → 4 → 5 (backend, strict : 3 dépend de 1+2, 4 dépend de 3) puis 6 → 7 (front, dépendent
de 4 et 5) puis 8. Les tâches 5 et 6 sont indépendantes entre elles.

## Points à trancher en cours de route

- **Destinataire du push** : `partners.contact_phone` (seul téléphone existant — `partner_users`
  n'a pas de colonne `phone`). Si on veut cibler chaque utilisateur du portail, il faudra une V39
  ajoutant `partner_users.phone` — **hors périmètre**, à confirmer si le premier partenaire réel a
  plusieurs interlocuteurs.
- **`FARM_LEFT` non réconciliée** : reste ACTIVE indéfiniment tant qu'aucun « marquer comme lu »
  n'existe côté portail. Acceptable au départ (volume nul), à revoir si le réseau grossit.
