# Notifications unifiées — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un système de notifications unifié (cloche in-app web+mobile + WhatsApp) alimenté par un cron qui matérialise les conditions d'alerte existantes, avec état lu/non-lu, préférences par catégorie×canal, et une façade de lecture prête pour l'assistant IA.

**Architecture:** Nouveau bounded context racine `com.avicare.notification`. Un cron scanne chaque ferme, appelle les services compute-on-read existants **via facades** et matérialise une notification `ACTIVE` par condition (dédup par `dedup_key`, ré-armement quand la condition disparaît). Les panneaux d'alerte live santé/stocks restent inchangés. WhatsApp part en asynchrone via une outbox + dispatcher (best-effort, retry) contre l'API Konekt.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Hibernate 6.4 / Flyway / PostgreSQL 16 ; Spring `RestClient` (Konekt) ; Next.js 16 + RTK Query + MUI (web) ; React Native + RTK Query (mobile).

**Spec:** `docs/superpowers/specs/2026-08-16-notifications-unifiees-design.md`

## Global Constraints

- Bounded context = package ; **aucun cross-import** entre contextes → communication par **facades** (`InventoryFacade`, `CommercialFacade`, `HealthFacade`, `TenancyFacade`, `IdentityFacade`).
- Référencement **par id** dans les entités (jamais de `@ManyToOne` cross-context).
- Migrations Flyway **immuables**, `V<n>__snake_case.sql`, une migration = un sujet ; location `backend/avicare-app/src/main/resources/db/migration/` ; prochaines libres : **V34, V35** (dernière mergée = V33).
- SQL doc 04 : tables `snake_case` pluriel, `BIGSERIAL PK`, enums `VARCHAR + CHECK`, `TIMESTAMP` UTC, `JSONB`, FK explicites + index, trigger `trg_<table>_updated_at` via `update_updated_at_column()`.
- JPA : `@Enumerated(EnumType.STRING)` ; `created_at`/`updated_at` en lecture seule (`insertable=false, updatable=false`), gérés par trigger (pas de `@UpdateTimestamp`).
- Services : `@Service` + `@RequiredArgsConstructor` ; `@Transactional` en écriture, `(readOnly=true)` en lecture ; DTOs = records Java 21 ; exceptions métier héritent de `BusinessException` ; erreurs RFC 7807.
- RBAC : `@PreAuthorize` SpEL via `@farmAccess.hasPermission(#farmId, 'res:verb')` / `@farmAccess.hasRole(...)` ; toute requête data scoping via `getAccessibleFarmIds`.
- **Secret** : `KONEKT_API_SECRET` en env/secret VPS uniquement, **jamais commité**.
- **Contextes DB-less** : chaque nouveau repo JPA doit être ajouté en `@MockitoBean` dans `SecurityE2ETest`, `SecurityIntegrationTest` **et** `DashboardControllerIT`, sinon vert local / rouge CI.
- Testcontainers **KO en local** sur cette machine → valider non-TC en local, s'appuyer sur la CI pour les slices `@DataJpaTest`.
- Commits : Conventional Commits, scope `notification` / `backend:notification` / `web` / `mobile`, **sans signature Claude**. 1 PR = 1 sujet (une PR par phase recommandée).
- Spotless Google Java Format (2 espaces) appliqué par module : `./mvnw spotless:apply -pl avicare-app`.

---

## File Structure

**Backend — nouveau contexte `backend/avicare-app/src/main/java/com/avicare/notification/`**

| Fichier | Responsabilité |
|---|---|
| `domain/NotificationCategory.java` | enum des catégories |
| `domain/NotificationSeverity.java` | enum INFO/WARNING/CRITICAL |
| `domain/NotificationStatus.java` | enum ACTIVE/RESOLVED |
| `domain/NotificationChannel.java` | enum IN_APP/WHATSAPP |
| `domain/Notification.java` | entité `notifications` |
| `domain/NotificationRead.java` | entité `notification_reads` |
| `domain/NotificationPreference.java` | entité `notification_preferences` |
| `repository/NotificationRepository.java` | + requêtes feed/dedup/resolve |
| `repository/NotificationReadRepository.java` | |
| `repository/NotificationPreferenceRepository.java` | |
| `detect/DetectedCondition.java` | record condition détectée |
| `detect/AlertDetector.java` | interface détecteur |
| `detect/InventoryDetector.java` | LOW_STOCK / NEGATIVE_STOCK / PO_OVERDUE |
| `detect/HealthDetector.java` | VACCINATION_LATE / WITHDRAWAL_ENDING / CRITICAL_OBSERVATION |
| `detect/CommercialDetector.java` | INVOICE_OVERDUE / CREDIT_EXCEEDED |
| `service/NotificationScannerService.java` | cron + upsert + reconcile |
| `service/NotificationService.java` | feed, unread, mark-read, préférences |
| `service/PreferenceResolver.java` | défauts + surcharge |
| `api/NotificationFacade.java` + `api/NotificationView.java` | lecture pour l'IA |
| `controller/NotificationController.java` | REST |
| `controller/NotificationAccess.java` | constantes `@PreAuthorize` |
| `dto/…` | records requête/réponse |
| `whatsapp/WhatsAppSender.java` | interface d'envoi |
| `whatsapp/KonektWhatsAppClient.java` | impl `RestClient` |
| `whatsapp/PhoneNormalizer.java` | normalisation tél |
| `whatsapp/WhatsappOutbox.java` + `whatsapp/OutboxStatus.java` + repo | outbox |
| `whatsapp/WhatsAppDispatcher.java` | worker `@Scheduled` |

**Backend — extensions de facades existantes**
- `livestock/api/InventoryFacade.java` + impl : ajouter `inventoryAlerts(farmId)`.
- `livestock/health/HealthFacade.java` + impl : ajouter `healthAlerts(farmId)`.
- `livestock/commercial/CommercialFacade.java` + impl : ajouter `overdueInvoices(farmId)` + `clientsOverCredit(farmId)`.
- `tenancy/api/TenancyFacade.java` + impl : ajouter `listAllFarmIds()` + `listMemberUserIds(farmId)`.

**Migrations** : `V34__notifications.sql`, `V35__whatsapp_outbox.sql`.

**Web** : `web/src/store/api/notificationsApi.ts` ; `web/src/components/layout/NotificationBell.tsx` (monté dans `Header.tsx`) ; `web/src/app/(dashboard)/reglages/notifications/page.tsx` ; types dans `web/src/types/index.ts`.

**Mobile** : `mobile/src/notifications/notificationsApi.ts` ; `mobile/src/components/notifications/NotificationBell.tsx` ; `mobile/app/(tabs)/notifications.tsx` (ou équivalent nav) ; préférences dans l'écran réglages.

---

# PHASE 1 — Backend core (cloche in-app)

Livrable : notifications matérialisées par cron + API REST (feed, unread-count, mark-read, préférences in-app) + façade. Testable via tests + curl, indépendamment de WhatsApp et de l'UI.

## Task 1 : Migration V34 (tables notifications)

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V34__notifications.sql`

**Interfaces:**
- Produces: tables `notifications`, `notification_reads`, `notification_preferences`.

- [ ] **Step 1: Écrire la migration**

```sql
-- V34 — Sprint C1 : notifications unifiées (in-app). WhatsApp outbox = V35.
-- Modèle "matérialiser sur transition" : une notif ACTIVE par condition (dedup_key),
-- résolue quand la condition disparaît (status=RESOLVED). Périmètre = ferme ;
-- l'état lu est par utilisateur (notification_reads). Cf. spec 2026-08-16.

CREATE TABLE notifications (
    id           BIGSERIAL PRIMARY KEY,
    farm_id      BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category     VARCHAR(40) NOT NULL CHECK (category IN (
                   'MORTALITY_ANOMALY','VACCINATION_LATE','WITHDRAWAL_ENDING',
                   'CRITICAL_OBSERVATION','LOW_STOCK','NEGATIVE_STOCK',
                   'PO_OVERDUE','CREDIT_EXCEEDED','INVOICE_OVERDUE')),
    severity     VARCHAR(10) NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    title        VARCHAR(200) NOT NULL,
    body         TEXT,
    source_ref   JSONB,
    dedup_key    VARCHAR(200) NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMP
);
CREATE UNIQUE INDEX uq_notifications_active_key
    ON notifications(farm_id, dedup_key) WHERE status = 'ACTIVE';
CREATE INDEX idx_notifications_feed ON notifications(farm_id, status, created_at DESC);
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE notification_reads (
    id               BIGSERIAL PRIMARY KEY,
    notification_id  BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (notification_id, user_id)
);
CREATE INDEX idx_notification_reads_user ON notification_reads(user_id);

CREATE TABLE notification_preferences (
    id           BIGSERIAL PRIMARY KEY,
    farm_id      BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category     VARCHAR(40) NOT NULL,
    channel      VARCHAR(10) NOT NULL CHECK (channel IN ('IN_APP','WHATSAPP')),
    enabled      BOOLEAN NOT NULL,
    min_severity VARCHAR(10) NOT NULL CHECK (min_severity IN ('INFO','WARNING','CRITICAL')),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id, category, channel)
);
CREATE INDEX idx_notification_prefs_scope ON notification_preferences(farm_id, user_id);
CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Vérifier la compilation du reactor (Flyway validé au boot en test/CI)**

Run: `cd backend && ./mvnw -q -pl avicare-app compile`
Expected: BUILD SUCCESS (la migration tournera sur DB propre en CI / au `backend-run`).

- [ ] **Step 3: Commit**

```bash
git add backend/avicare-app/src/main/resources/db/migration/V34__notifications.sql
git commit -m "feat(backend:notification): V34 migration for unified notifications"
```

## Task 2 : Enums + entités + repos

**Files:**
- Create: `notification/domain/NotificationCategory.java`, `NotificationSeverity.java`, `NotificationStatus.java`, `NotificationChannel.java`, `Notification.java`, `NotificationRead.java`, `NotificationPreference.java`
- Create: `notification/repository/NotificationRepository.java`, `NotificationReadRepository.java`, `NotificationPreferenceRepository.java`
- Test: `notification/repository/NotificationRepositoryTest.java`

**Interfaces:**
- Produces:
  - `enum NotificationCategory { MORTALITY_ANOMALY, VACCINATION_LATE, WITHDRAWAL_ENDING, CRITICAL_OBSERVATION, LOW_STOCK, NEGATIVE_STOCK, PO_OVERDUE, CREDIT_EXCEEDED, INVOICE_OVERDUE }`
  - `enum NotificationSeverity { INFO, WARNING, CRITICAL }` (ordinal croissant = gravité croissante)
  - `enum NotificationStatus { ACTIVE, RESOLVED }`
  - `enum NotificationChannel { IN_APP, WHATSAPP }`
  - `Notification` (entité, getters/setters Lombok) champs : `id, farmId, category, severity, title, body, sourceRefJson (String, colonne JSONB), dedupKey, status, createdAt, updatedAt, resolvedAt`
  - `NotificationRepository`:
    - `Optional<Notification> findByFarmIdAndDedupKeyAndStatus(Long farmId, String dedupKey, NotificationStatus status)`
    - `List<Notification> findByFarmIdAndCategoryAndStatus(Long farmId, NotificationCategory category, NotificationStatus status)`
    - `Page<Notification> findByFarmId(Long farmId, Pageable pageable)`
  - `NotificationReadRepository`: `boolean existsByNotificationIdAndUserId(Long, Long)`, `List<NotificationRead> findByUserIdAndNotification_FarmId(Long userId, Long farmId)` — ou requête `@Query` équivalente ; `long countUnread(...)` via `@Query` (Task 9)
  - `NotificationPreferenceRepository`: `List<NotificationPreference> findByFarmIdAndUserId(Long farmId, Long userId)`

- [ ] **Step 1: Écrire un test de repository (slice)**

```java
// NotificationRepositoryTest.java — @DataJpaTest + Testcontainers (pattern des slices existants)
@Test
void activeDedupKeyIsUnique_andReArmsAfterResolve() {
  Notification n1 = active(FARM, "LOW_STOCK:item:42");
  repo.saveAndFlush(n1);
  // même clé active à nouveau → viole l'index unique partiel
  assertThatThrownBy(() -> repo.saveAndFlush(active(FARM, "LOW_STOCK:item:42")))
      .isInstanceOf(DataIntegrityViolationException.class);
  // résolue → la clé se libère → ré-armement OK
  n1.setStatus(NotificationStatus.RESOLVED);
  n1.setResolvedAt(LocalDateTime.now());
  repo.saveAndFlush(n1);
  assertThatCode(() -> repo.saveAndFlush(active(FARM, "LOW_STOCK:item:42")))
      .doesNotThrowAnyException();
}
```

- [ ] **Step 2: Lancer le test → échoue à la compilation (types absents)**

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile`
Expected: FAIL (classes `Notification`, repo absents).

- [ ] **Step 3: Créer enums, entité `Notification` (modèle `finance/domain/Expense.java`), entités reads/preferences, et repos**

Notes d'implémentation :
- `Notification` : `@Entity @Table(name="notifications")`, `@Id @GeneratedValue(IDENTITY)`, `@Enumerated(STRING)` sur category/severity/status ; `sourceRefJson` mappé `@Column(name="source_ref", columnDefinition="jsonb")` en `String` (sérialisation JSON gérée dans le service — pas de type Hibernate custom en V1) ; `createdAt/updatedAt` en lecture seule (`insertable=false, updatable=false`). **Pas** de `@SQLDelete` (cycle ACTIVE→RESOLVED, pas de soft delete).
- `NotificationRead`, `NotificationPreference` : idem, mappés sur leurs tables.

- [ ] **Step 4: Lancer le test → PASS** (via CI si Testcontainers KO en local ; en local vérifier au moins `test-compile` vert)

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/notification/domain backend/avicare-app/src/main/java/com/avicare/notification/repository backend/avicare-app/src/test/java/com/avicare/notification
git commit -m "feat(backend:notification): entities, enums and repositories"
```

## Task 3 : `DetectedCondition` + `AlertDetector`

**Files:**
- Create: `notification/detect/DetectedCondition.java`, `notification/detect/AlertDetector.java`

**Interfaces:**
- Produces:
  - `record DetectedCondition(NotificationCategory category, NotificationSeverity severity, String dedupKey, String title, String body, Map<String,Object> sourceRef) {}`
  - `interface AlertDetector { Set<NotificationCategory> categories(); List<DetectedCondition> detect(Long farmId); }`
    - `categories()` = les catégories que ce détecteur **possède** (utilisé par le scanner pour réconcilier/résoudre).

- [ ] **Step 1: Créer les deux fichiers** (record + interface, aucun test propre — contrats purs, testés via les détecteurs).

- [ ] **Step 2: Compiler**

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/notification/detect
git commit -m "feat(backend:notification): DetectedCondition + AlertDetector contract"
```

## Task 4 : Extension `InventoryFacade.inventoryAlerts` + `InventoryDetector`

**Files:**
- Modify: `livestock/api/InventoryFacade.java` (+ son impl, chercher `implements InventoryFacade`)
- Create: `livestock/api/dto/InventoryAlertInfo.java`
- Create: `notification/detect/InventoryDetector.java`
- Test: `notification/detect/InventoryDetectorTest.java`

**Interfaces:**
- Consumes: `InventoryAlertService.computeInventoryAlerts(farmId)` → `InventoryAlertsResponse` (champs : `lowStockItems`, `negativeStockItems`, `pendingPurchaseOrders`) ; `StockAlertsResponse.LowStockItem`/`NegativeStockItem`.
- Produces:
  - `record InventoryAlertInfo(String kind, Long itemId, String label, long daysOverdue) {}` où `kind ∈ {LOW_STOCK, NEGATIVE_STOCK, PO_OVERDUE}`.
  - `List<InventoryAlertInfo> InventoryFacade.inventoryAlerts(Long farmId)`
  - `InventoryDetector implements AlertDetector` — `categories() = {LOW_STOCK, NEGATIVE_STOCK, PO_OVERDUE}`.

- [ ] **Step 1: Test du détecteur (mock de la facade)**

```java
@Test
void mapsLowStockToWarningCondition_withStableDedupKey() {
  when(inventoryFacade.inventoryAlerts(1L)).thenReturn(List.of(
      new InventoryAlertInfo("LOW_STOCK", 42L, "Aliment démarrage", 0)));
  List<DetectedCondition> out = detector.detect(1L);
  assertThat(out).singleElement().satisfies(c -> {
    assertThat(c.category()).isEqualTo(NotificationCategory.LOW_STOCK);
    assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
    assertThat(c.dedupKey()).isEqualTo("LOW_STOCK:item:42");
    assertThat(c.sourceRef()).containsEntry("itemId", 42L);
  });
}
```

- [ ] **Step 2: Lancer → FAIL** (`InventoryDetector`/`inventoryAlerts` absents)

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile`
Expected: FAIL.

- [ ] **Step 3: Implémenter**
  - Ajouter `inventoryAlerts` à `InventoryFacade` + impl : appeler `computeInventoryAlerts` et aplatir les 3 listes en `InventoryAlertInfo` (`PO_OVERDUE` porte `daysOverdue`).
  - `InventoryDetector` : mapper chaque `kind` → catégorie/sévérité (`LOW_STOCK`/`PO_OVERDUE` = WARNING, `NEGATIVE_STOCK` = CRITICAL), `dedupKey = "<CATEGORY>:item:<id>"` (ou `":po:<id>"` pour PO), `title`/`body` FR, `sourceRef = Map.of("itemId", id)`.

- [ ] **Step 4: Lancer → PASS**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=InventoryDetectorTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/api backend/avicare-app/src/main/java/com/avicare/notification/detect/InventoryDetector.java backend/avicare-app/src/test/java/com/avicare/notification/detect/InventoryDetectorTest.java
git commit -m "feat(backend:notification): inventory alert detector via InventoryFacade"
```

## Task 5 : Extension `HealthFacade.healthAlerts` + `HealthDetector`

**Files:**
- Modify: `livestock/health/HealthFacade.java` (+ impl)
- Create: `livestock/health/HealthAlertInfo.java`
- Create: `notification/detect/HealthDetector.java`
- Test: `notification/detect/HealthDetectorTest.java`

**Interfaces:**
- Consumes: `AlertService.computeAlertsForFarm(farmId)` → `AlertsResponse` (champs : `vaccinationsLate` [unitId, unitName, vaccineKey, dueDate, daysLate], `activeWithdrawals` [unitId, treatmentId, daysRemainingMeat/Eggs], `criticalObservations` [unitId, observationId, severity, title, observationDate]).
- Produces:
  - `record HealthAlertInfo(String kind, Long unitId, Long refId, String label, long days) {}` (`kind ∈ {VACCINATION_LATE, WITHDRAWAL_ENDING, CRITICAL_OBSERVATION}`)
  - `List<HealthAlertInfo> HealthFacade.healthAlerts(Long farmId)`
  - `HealthDetector implements AlertDetector` — `categories() = {VACCINATION_LATE, WITHDRAWAL_ENDING, CRITICAL_OBSERVATION}`.

- [ ] **Step 1: Test** (mock `HealthFacade`, un cas par kind ; vérifier `dedupKey` : `VACCINATION_LATE:unit:<unitId>:<vaccineKey>`, `WITHDRAWAL_ENDING:treatment:<refId>`, `CRITICAL_OBSERVATION:obs:<refId>` ; sévérités : VACCINATION_LATE=WARNING, WITHDRAWAL_ENDING=WARNING, CRITICAL_OBSERVATION=CRITICAL).

- [ ] **Step 2: Lancer → FAIL.** Run: `./mvnw -q -pl avicare-app test-compile`

- [ ] **Step 3: Implémenter** `healthAlerts` (aplatir `AlertsResponse` en `HealthAlertInfo`, en réutilisant `computeAlertsForFarm`) + `HealthDetector` (mapping + `sourceRef` = `Map.of("unitId", unitId)`).

- [ ] **Step 4: Lancer → PASS.** Run: `./mvnw -q -pl avicare-app test -Dtest=HealthDetectorTest`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(backend:notification): health alert detector via HealthFacade"
```

## Task 6 : Extension `CommercialFacade` + `CommercialDetector`

**Files:**
- Modify: `livestock/commercial/CommercialFacade.java` (+ impl)
- Create: `livestock/commercial/OverdueInvoiceInfo.java`, `livestock/commercial/CreditExceededInfo.java`
- Create: `notification/detect/CommercialDetector.java`
- Test: `notification/detect/CommercialDetectorTest.java`

**Interfaces:**
- Consumes: services commercial existants (factures overdue = ISSUED/PARTIALLY_PAID dont la date d'échéance est passée ; crédit = `getClientCredit` avec `currentBalance > creditLimit`). L'impl de la facade réutilise les repos/services internes du sous-domaine (pas de logique neuve dans notification).
- Produces:
  - `record OverdueInvoiceInfo(Long invoiceId, Long clientId, String clientName, long outstandingXof, long daysOverdue) {}`
  - `record CreditExceededInfo(Long clientId, String clientName, long currentBalanceXof, long creditLimitXof) {}`
  - `List<OverdueInvoiceInfo> CommercialFacade.overdueInvoices(Long farmId)`
  - `List<CreditExceededInfo> CommercialFacade.clientsOverCredit(Long farmId)`
  - `CommercialDetector implements AlertDetector` — `categories() = {INVOICE_OVERDUE, CREDIT_EXCEEDED}`, `dedupKey` : `INVOICE_OVERDUE:invoice:<id>`, `CREDIT_EXCEEDED:client:<id>` ; sévérités : INVOICE_OVERDUE=WARNING, CREDIT_EXCEEDED=WARNING.

- [ ] **Step 1: Test** (mock `CommercialFacade`, un cas overdue + un cas crédit dépassé).
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter** les 2 méthodes de facade + le détecteur.
- [ ] **Step 4: Lancer → PASS.** Run: `./mvnw -q -pl avicare-app test -Dtest=CommercialDetectorTest`
- [ ] **Step 5: Commit** `feat(backend:notification): commercial overdue/credit detector`

## Task 7 : Extensions `TenancyFacade` (fermes + membres)

**Files:**
- Modify: `tenancy/api/TenancyFacade.java` (+ impl, chercher `implements TenancyFacade`)
- Test: étendre le test d'impl tenancy existant, ou `TenancyFacadeMembersTest.java`

**Interfaces:**
- Produces:
  - `List<Long> TenancyFacade.listAllFarmIds()` — toutes les fermes actives (pour le scan).
  - `List<Long> TenancyFacade.listMemberUserIds(Long farmId)` — user ids membres d'une ferme (destinataires).

- [ ] **Step 1: Test** (seed 1 ferme + 2 memberships → `listMemberUserIds` renvoie 2 ids ; `listAllFarmIds` contient la ferme).
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter** via `FarmRepository`/`UserFarmRepository` (ajouter au besoin `List<Long> findAllFarmIds()` / `findUserIdsByFarmId` en `@Query`).
- [ ] **Step 4: Lancer → PASS** (CI si Testcontainers).
- [ ] **Step 5: Commit** `feat(backend:tenancy): expose farm ids and farm members for notifications`

## Task 8 : `NotificationScannerService` (upsert + reconcile + cron)

**Files:**
- Create: `notification/service/NotificationScannerService.java`
- Test: `notification/service/NotificationScannerServiceTest.java`

**Interfaces:**
- Consumes: `List<AlertDetector>` (injection de tous les détecteurs), `NotificationRepository`, `TenancyFacade.listAllFarmIds()`, un `ObjectMapper` (sérialiser `sourceRef` → JSON), l'enqueue WhatsApp (Phase 2 — injecter une interface `OutboxEnqueuer` no-op en Phase 1).
- Produces:
  - `void scanFarm(Long farmId)` — pour chaque détecteur : `detect(farmId)` → upsert des conditions courantes ; puis, pour chaque `category ∈ detector.categories()`, résoudre les notifs ACTIVE de cette catégorie dont le `dedupKey` n'est plus présent.
  - `void scanAll()` — `@Scheduled(cron="${notifications.scan.cron:0 0 6 * * *}", zone="${notifications.scan.zone:Africa/Dakar}")` → boucle `listAllFarmIds()`.
  - `Notification upsert(Long farmId, DetectedCondition c)` — public (réutilisable par un futur listener d'événements) : si une notif ACTIVE existe pour `(farmId, dedupKey)`, ne rien créer (idempotent) ; sinon créer.

- [ ] **Step 1: Écrire les tests (mocks)**

```java
@Test
void createsNotification_forNewCondition_thenIdempotentOnRescan() {
  when(detector.categories()).thenReturn(Set.of(NotificationCategory.LOW_STOCK));
  when(detector.detect(1L)).thenReturn(List.of(cond("LOW_STOCK:item:42")));
  when(repo.findByFarmIdAndDedupKeyAndStatus(1L,"LOW_STOCK:item:42",ACTIVE))
      .thenReturn(Optional.empty());
  scanner.scanFarm(1L);
  verify(repo).save(argThat(n -> n.getDedupKey().equals("LOW_STOCK:item:42")
      && n.getStatus()==ACTIVE));
}

@Test
void resolvesNotification_whenConditionDisappears() {
  when(detector.categories()).thenReturn(Set.of(NotificationCategory.LOW_STOCK));
  when(detector.detect(1L)).thenReturn(List.of()); // plus de condition
  Notification stale = active(1L, "LOW_STOCK:item:42");
  when(repo.findByFarmIdAndCategoryAndStatus(1L, NotificationCategory.LOW_STOCK, ACTIVE))
      .thenReturn(List.of(stale));
  scanner.scanFarm(1L);
  assertThat(stale.getStatus()).isEqualTo(RESOLVED);
  assertThat(stale.getResolvedAt()).isNotNull();
}
```

- [ ] **Step 2: Lancer → FAIL.** Run: `./mvnw -q -pl avicare-app test-compile`
- [ ] **Step 3: Implémenter** le service (upsert idempotent via `findByFarmIdAndDedupKeyAndStatus` ; reconcile par catégorie via `findByFarmIdAndCategoryAndStatus` ; sérialiser `sourceRef` avec `ObjectMapper`). Ne pas laisser une exception d'un détecteur casser les autres (try/catch par détecteur, log). `@Service @RequiredArgsConstructor`, `@Transactional` sur `scanFarm`.
- [ ] **Step 4: Lancer → PASS.** Run: `./mvnw -q -pl avicare-app test -Dtest=NotificationScannerServiceTest`
- [ ] **Step 5: Commit** `feat(backend:notification): scanner service (cron + upsert + reconcile)`

## Task 9 : `NotificationService` + `PreferenceResolver`

**Files:**
- Create: `notification/service/NotificationService.java`, `notification/service/PreferenceResolver.java`
- Test: `notification/service/NotificationServiceTest.java`, `notification/service/PreferenceResolverTest.java`

**Interfaces:**
- Produces:
  - `PreferenceResolver` : `ResolvedPreference resolve(Long farmId, Long userId, NotificationCategory cat, NotificationChannel ch, List<NotificationPreference> overrides)` où défaut = IN_APP enabled/min INFO, WHATSAPP disabled ; `record ResolvedPreference(boolean enabled, NotificationSeverity minSeverity) {}`. Aussi `List<ResolvedPreference> resolveAll(...)` pour l'écran préférences (grille complète catégories×canaux fusionnée avec les overrides).
  - `NotificationService` :
    - `Page<NotificationResponse> feed(Long farmId, Long userId, boolean unreadOnly, Pageable pageable)` (marque `read` par jointure avec `notification_reads`)
    - `long unreadCount(Long farmId, Long userId)`
    - `void markRead(Long farmId, Long userId, Long notificationId)` (insert `notification_reads` si absent ; 404 si notif hors ferme)
    - `void markAllRead(Long farmId, Long userId)`
    - `List<PreferenceResponse> getPreferences(Long farmId, Long userId)` (grille résolue)
    - `void updatePreferences(Long farmId, Long userId, UpdatePreferencesRequest req)` (upsert des overrides)

- [ ] **Step 1: Tests**
  - `PreferenceResolverTest` : défaut WHATSAPP off / IN_APP on ; un override rend WHATSAPP on avec min=CRITICAL.
  - `NotificationServiceTest` : `unreadCount` = notifs de la ferme sans ligne read pour l'user ; `markRead` idempotent (2 appels → 1 ligne).
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter.** `unreadCount` via `@Query` : `count notifications n where n.farmId=:farmId and not exists (read r where r.notification=n and r.userId=:userId)`. `feed` : mapper `Notification` + flag `read` (existence dans reads) + désérialiser `sourceRef`.
- [ ] **Step 4: Lancer → PASS.** Run: `./mvnw -q -pl avicare-app test -Dtest=NotificationServiceTest,PreferenceResolverTest`
- [ ] **Step 5: Commit** `feat(backend:notification): notification service + preference resolver`

## Task 10 : `NotificationController` + RBAC + permissions + garde-fous DB-less

**Files:**
- Create: `notification/controller/NotificationController.java`, `notification/controller/NotificationAccess.java`
- Create: `notification/dto/NotificationResponse.java`, `UnreadCountResponse.java`, `PreferenceResponse.java`, `UpdatePreferencesRequest.java`
- Modify: `common-security` `defaultPermissions()` (ajouter `notification:read` / `notification:write`) — chercher `defaultPermissions` dans `common/security`.
- Modify: `SecurityE2ETest.java`, `SecurityIntegrationTest.java`, `DashboardControllerIT.java` (ajouter `@MockitoBean` des 3 nouveaux repos + facades utilisées si le contexte les charge)
- Test: `notification/controller/NotificationControllerIT.java`

**Interfaces:**
- Consumes: `NotificationService`.
- Produces (endpoints, tous préfixés `/api/v1/farms/{farmId}/notifications` sauf préférences) :
  - `GET /` (query `unread`, `page`, `size`) → `PageResponse<NotificationResponse>`
  - `GET /unread-count` → `ApiResponse<UnreadCountResponse>`
  - `POST /{id}/read` → `ApiResponse<Void>`
  - `POST /read-all` → `ApiResponse<Void>`
  - `GET /api/v1/farms/{farmId}/notification-preferences` → `ApiResponse<List<PreferenceResponse>>`
  - `PUT /api/v1/farms/{farmId}/notification-preferences` → `ApiResponse<Void>`
  - `POST /{farmId}/notifications/scan` → **dev only** (`@Profile("!prod")` ou garde config) déclenche `scannerService.scanFarm`.
- `NotificationAccess` (modèle `FinanceAccess`) :
  - `READ = "@farmAccess.hasPermission(#farmId, 'notification:read')"`
  - `WRITE = "@farmAccess.hasPermission(#farmId, 'notification:write')"`
  - Pas de gate `module.*` (les notifications sont transverses, disponibles sans module commercial dédié).

- [ ] **Step 1: Test IT** (profil DB-less `@SpringBootTest @AutoConfigureMockMvc`, mocks des repos) : `GET /unread-count` renvoie 200 pour un membre avec `notification:read` ; 403 sans la permission.
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter** controller + DTOs + `NotificationAccess` ; ajouter les permissions par défaut ; **ajouter les `@MockitoBean` manquants** dans les 3 tests DB-less (sinon rouge CI).
- [ ] **Step 4: Lancer → PASS** + relancer les 3 tests DB-less.

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=NotificationControllerIT,SecurityE2ETest,SecurityIntegrationTest,DashboardControllerIT`
Expected: PASS.

- [ ] **Step 5: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app && cd ..
git commit -am "feat(backend:notification): REST controller, RBAC and DB-less test wiring"
```

## Task 11 : `NotificationFacade` (lecture pour l'IA)

**Files:**
- Create: `notification/api/NotificationFacade.java`, `notification/api/NotificationView.java`, `notification/service/NotificationFacadeImpl.java`
- Test: `notification/service/NotificationFacadeImplTest.java`

**Interfaces:**
- Produces:
  - `record NotificationView(Long id, String category, String severity, String title, String body, java.time.LocalDateTime createdAt) {}`
  - `interface NotificationFacade { List<NotificationView> listActive(Long farmId); long unreadCount(Long farmId, Long userId); }`
  - Impl délègue à `NotificationRepository`/`NotificationService`. **Aucun** appel depuis l'assistant en C1 (design-for only).

- [ ] **Step 1: Test** (`listActive` ne renvoie que les `ACTIVE`).
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer → PASS.**
- [ ] **Step 5: Commit** `feat(backend:notification): read facade for future assistant integration`

**Fin Phase 1 — checkpoint :** `cd backend && ./mvnw -q -pl avicare-app verify` doit passer (ou CI verte). Ouvrir la PR « Phase 1 — notifications in-app ».

---

# PHASE 2 — WhatsApp (Konekt)

Livrable : envoi WhatsApp asynchrone best-effort des notifications selon les préférences, via outbox + dispatcher. Dépend de Phase 1.

## Task 12 : Migration V35 + entité/repo outbox

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V35__whatsapp_outbox.sql`
- Create: `notification/whatsapp/WhatsappOutbox.java`, `notification/whatsapp/OutboxStatus.java`, `notification/whatsapp/WhatsappOutboxRepository.java`
- Modify: les 3 tests DB-less (ajouter `@MockitoBean WhatsappOutboxRepository`)

**Interfaces:**
- Produces: table `whatsapp_outbox` (cf. spec §2) ; `enum OutboxStatus { PENDING, SENT, FAILED }` ; `WhatsappOutbox` entité ; `WhatsappOutboxRepository.findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus status)`.

- [ ] **Step 1: Migration SQL**

```sql
-- V35 — Sprint C1 : outbox d'envoi WhatsApp (Konekt), best-effort asynchrone.
CREATE TABLE whatsapp_outbox (
    id                BIGSERIAL PRIMARY KEY,
    notification_id   BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    phone             VARCHAR(20) NOT NULL,
    message           TEXT NOT NULL,
    status            VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
    attempts          INT NOT NULL DEFAULT 0,
    last_error        TEXT,
    provider_response JSONB,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    sent_at           TIMESTAMP
);
CREATE INDEX idx_whatsapp_outbox_pending ON whatsapp_outbox(status, created_at);
```

- [ ] **Step 2: Compiler + entité/repo + mockbeans.** Run: `./mvnw -q -pl avicare-app test-compile`
- [ ] **Step 3: Commit** `feat(backend:notification): V35 whatsapp outbox table + entity`

## Task 13 : `WhatsAppSender` + `KonektWhatsAppClient` + `PhoneNormalizer` + config

**Files:**
- Create: `notification/whatsapp/WhatsAppSender.java`, `KonektWhatsAppClient.java`, `PhoneNormalizer.java`
- Modify: `application.yml` (+ `application-prod.yml`) : bloc `konekt` + `notifications.whatsapp`
- Test: `notification/whatsapp/PhoneNormalizerTest.java`, `KonektWhatsAppClientTest.java`

**Interfaces:**
- Produces:
  - `interface WhatsAppSender { SendResult send(String phone, String message); }` avec `record SendResult(boolean ok, String rawResponse, String error) {}`
  - `KonektWhatsAppClient implements WhatsAppSender` — `RestClient` POST `${konekt.base-url}/send`, header `X-WA-SECRET: ${KONEKT_API_SECRET}`, body `{"phone":..,"message":..}` ; timeouts courts ; renvoie `SendResult` (jamais d'exception propagée).
  - `PhoneNormalizer.toKonekt(String raw, String defaultCountryCode)` → `221XXXXXXXXX` (retire `+`, espaces, tirets ; préfixe `221` si numéro local sénégalais 9 chiffres).
- Config :

```yaml
konekt:
  base-url: ${KONEKT_BASE_URL:https://konekt.nexteranga.com}
  api-secret: ${KONEKT_API_SECRET:}
notifications:
  whatsapp:
    enabled: ${NOTIF_WHATSAPP_ENABLED:false}
    dispatch-cron: ${NOTIF_WHATSAPP_DISPATCH_CRON:0 */2 * * * *}
    max-attempts: 5
  scan:
    cron: ${NOTIF_SCAN_CRON:0 0 6 * * *}
    zone: ${NOTIF_SCAN_ZONE:Africa/Dakar}
```

- [ ] **Step 1: Tests**
  - `PhoneNormalizerTest` : `"+221 77 000 00 00"` → `"221770000000"` ; `"770000000"` → `"221770000000"`.
  - `KonektWhatsAppClientTest` : avec `MockRestServiceServer` (ou `MockWebServer`), vérifier header `X-WA-SECRET` + body ; `send` renvoie `ok=true` sur 200, `ok=false` (pas d'exception) sur 500.
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter** le normalizer, le client `RestClient`, la config. **Ne jamais** logguer `api-secret`.
- [ ] **Step 4: Lancer → PASS.** Run: `./mvnw -q -pl avicare-app test -Dtest=PhoneNormalizerTest,KonektWhatsAppClientTest`
- [ ] **Step 5: Commit** `feat(backend:notification): Konekt WhatsApp client + phone normalizer`

## Task 14 : Enqueue à la création + `WhatsAppDispatcher`

**Files:**
- Modify: `notification/service/NotificationScannerService.java` (implémenter le vrai `OutboxEnqueuer`)
- Create: `notification/whatsapp/OutboxEnqueuer.java` (impl), `notification/whatsapp/WhatsAppDispatcher.java`
- Test: `notification/whatsapp/OutboxEnqueuerTest.java`, `WhatsAppDispatcherTest.java`

**Interfaces:**
- Consumes: `PreferenceResolver`, `TenancyFacade.listMemberUserIds`, `IdentityFacade.findById(userId).phone()`, `WhatsappOutboxRepository`, `WhatsAppSender`.
- Produces:
  - `OutboxEnqueuer.enqueueFor(Notification n)` : pour chaque membre de la ferme dont la pref WHATSAPP est ON et `n.severity ≥ minSeverity`, avec un téléphone présent → insérer une ligne `whatsapp_outbox` (`PENDING`) avec message rendu (`title` + `body`). Ne fait rien si `notifications.whatsapp.enabled=false`.
  - `WhatsAppDispatcher.dispatch()` — `@Scheduled(cron="${notifications.whatsapp.dispatch-cron}")` : charge les `PENDING` (batch 50), pour chacun `sender.send(...)` ; succès → `SENT`+`sent_at` ; échec → `attempts++`, `last_error`, `FAILED` si `attempts ≥ max-attempts`, sinon reste `PENDING` (retry au prochain tick). Chaque ligne dans sa propre transaction (échec isolé).

- [ ] **Step 1: Tests**
  - `OutboxEnqueuerTest` : notif CRITICAL + pref WHATSAPP on (min WARNING) + membre avec phone → 1 ligne PENDING ; pref off → 0 ligne ; `enabled=false` → 0 ligne.
  - `WhatsAppDispatcherTest` : `send ok` → SENT ; `send fail` sous max → reste PENDING, attempts=1 ; à max → FAILED.
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter** ; brancher `enqueueFor` dans `NotificationScannerService.upsert` **après** création d'une notif (même transaction pour l'enqueue ; l'envoi reste hors transaction, côté dispatcher).
- [ ] **Step 4: Lancer → PASS.** Run: `./mvnw -q -pl avicare-app test -Dtest=OutboxEnqueuerTest,WhatsAppDispatcherTest`
- [ ] **Step 5: Spotless + commit** `feat(backend:notification): whatsapp enqueue on create + async dispatcher`

**Fin Phase 2 — checkpoint :** `verify` vert / CI verte. Ajouter `KONEKT_API_SECRET` + `NOTIF_WHATSAPP_ENABLED=true` aux secrets/env du VPS (hors repo). Ouvrir la PR « Phase 2 — WhatsApp ».

---

# PHASE 3 — Web + mobile

Livrable : cloche + feed + préférences côté web et mobile, consommant l'API Phase 1/2. Les panneaux d'alerte live existants restent inchangés.

## Task 15 : Web — `notificationsApi` (RTK Query) + types

**Files:**
- Create: `web/src/store/api/notificationsApi.ts`
- Modify: `web/src/types/index.ts` (types `AppNotification`, `NotificationPreference`, `NotificationChannel`, `NotificationCategory`)
- Modify: `web/src/store/api/baseApi.ts` (ajouter `"Notification"` à `tagTypes`)
- Test: `web/src/store/api/notificationsApi.test.ts`

**Interfaces:**
- Produces (modèle `web/src/store/api/healthApi.ts`, `injectEndpoints`, `ApiEnvelope` unwrap) :
  - `useGetNotificationsQuery({farmId, unread?, page?})`, `useGetUnreadCountQuery({farmId})` (avec `pollingInterval: 60000`), `useMarkReadMutation`, `useMarkAllReadMutation`, `useGetNotificationPreferencesQuery`, `useUpdateNotificationPreferencesMutation`.
  - `providesTags`/`invalidatesTags` sur `{type:"Notification", id:"farm"}`.

- [ ] **Step 1: Test** (rendu du hook avec store de test, mock fetch renvoyant `{data:{count:3}}` → `unreadCount=3`).
- [ ] **Step 2: Lancer → FAIL.** Run: `cd web && npm run test -- notificationsApi`
- [ ] **Step 3: Implémenter** le slice + types + tag.
- [ ] **Step 4: Lancer → PASS** + `npm run typecheck` (ou `tsc --noEmit`).
- [ ] **Step 5: Commit** `feat(web): notifications RTK Query api slice`

## Task 16 : Web — cloche dans le Header

**Files:**
- Create: `web/src/components/layout/NotificationBell.tsx`
- Modify: `web/src/components/layout/Header.tsx` (monter la cloche)
- Test: `web/src/components/layout/NotificationBell.test.tsx`

**Interfaces:**
- Consumes: `useGetUnreadCountQuery`, `useGetNotificationsQuery`, `useMarkReadMutation`, `useMarkAllReadMutation`.
- Produces: `NotificationBell` — `IconButton` + `Badge` (unread), `Menu`/`Popover` listant les 12 dernières, clic item → `markRead` + deep-link via `source_ref` (unit → `/elevage/lots/<id>`, item → `/stocks`, invoice → `/commercial/factures`), bouton « Tout marquer lu ». Respecte le thème `avicareTheme` (pas de look MUI générique).

- [ ] **Step 1: Test** (badge affiche le count ; clic « tout marquer lu » appelle la mutation).
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter** + monter dans `Header.tsx`.
- [ ] **Step 4: Lancer → PASS** + typecheck.
- [ ] **Step 5: Commit** `feat(web): notification bell in header`

## Task 17 : Web — page préférences

**Files:**
- Create: `web/src/app/(dashboard)/reglages/notifications/page.tsx`
- Modify: la nav réglages (ajouter l'entrée « Notifications ») — chercher le menu dans `reglages/`
- Test: `web/src/app/(dashboard)/reglages/notifications/page.test.tsx`

**Interfaces:**
- Consumes: `useGetNotificationPreferencesQuery`, `useUpdateNotificationPreferencesMutation`.
- Produces: grille catégorie × canal (IN_APP/WHATSAPP) avec toggles `enabled` + select `min_severity` ; note explicite « WhatsApp utilise le numéro de votre profil » ; enregistrement via la mutation.

- [ ] **Step 1: Test** (rendu de la grille depuis les prefs mockées ; toggle → mutation).
- [ ] **Step 2: Lancer → FAIL.**
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer → PASS** + typecheck.
- [ ] **Step 5: Commit** `feat(web): notification preferences page`

## Task 18 : Mobile — api + cloche + écran + préférences

**Files:**
- Create: `mobile/src/notifications/notificationsApi.ts`, `mobile/src/components/notifications/NotificationBell.tsx`, écran notifications (`mobile/app/(...)/notifications.tsx`), section préférences dans l'écran réglages
- Test: `mobile/src/notifications/notificationsApi.test.ts`, `NotificationBell.test.tsx`

**Interfaces:**
- Produces: mêmes endpoints que le web (RTK Query, base mobile) ; cloche dans le header avec badge (polling au focus via `useFocusEffect` + `refetch`) ; écran liste avec pull-to-refresh + `markRead` au tap ; préférences (toggles catégorie×canal).
- Respecter les gotchas mobiles : `render`/`renderHook` **async** (await), imports par chemin relatif, `act()` après `fireEvent.press`. Gates = `tsc` + `jest`.

- [ ] **Step 1: Tests** (api slice unreadCount ; badge affiche le count).
- [ ] **Step 2: Lancer → FAIL.** Run: `cd mobile && npm test -- notifications`
- [ ] **Step 3: Implémenter** api + cloche + écran + préférences.
- [ ] **Step 4: Lancer → PASS** + `cd mobile && npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(mobile): notifications api, bell, screen and preferences`

**Fin Phase 3 — checkpoint :** web `npm run build` + mobile `tsc`+`jest` verts. Ouvrir la PR « Phase 3 — UI notifications ».

---

## Self-Review — couverture spec

| Section spec | Task(s) |
|---|---|
| §1 Contexte racine + facades | 4,5,6,7,8,11 |
| §2 `notifications` / `notification_reads` / `notification_preferences` | 1,2 ; `whatsapp_outbox` → 12 |
| §3 Détection cron + upsert + reconcile + événementiel différé | 8 (upsert public = point d'extension événementiel) |
| §4 WhatsApp Konekt async + outbox + retry + normalisation + coût/opt-in | 12,13,14 |
| §5 API + `NotificationFacade` + RBAC | 9,10,11 |
| §6 Web (cloche+prefs) + mobile | 15,16,17,18 |
| §7 Config & secrets | 13 (yaml) ; secret VPS hors repo |
| §8 Tests + garde-fous DB-less | chaque task (TDD) ; DB-less → 10,12 |
| §9 Périmètre (IN/différé) | Phases 1-3 = IN ; MORTALITY_ANOMALY, FCM, email, digest, event-driven, IA = différés |

**Note MORTALITY_ANOMALY :** catégorie déclarée dans l'enum/CHECK (V34) mais **aucun détecteur en C1** (nécessite un calcul de mortalité anormale non exposé aujourd'hui). À trancher dans un sprint ultérieur (seuil paramétrable via `alert_thresholds` + `MortalityAnomalyDetector`). Aucun autre placeholder.
