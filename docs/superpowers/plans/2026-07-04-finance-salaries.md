# Finance P2 — Salaires & avances — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship monthly salaries per farm member and the advance request→approval→deduction workflow — phase P2 of the finance module (spec `docs/superpowers/specs/2026-07-04-finance-module-design.md` §5), on top of the merged P1 (PR #116).

**Architecture:** Migration **V26** adds `salary_settings`, `salaries`, `salary_advances` + the deferred FK `expenses.salary_id`. Everything lives in the existing `com.avicare.finance` context. Employee = farm member (`user_id`); membership validated via the EXISTING `TenancyFacade.findMembership` (spec's « nouvelle méthode listMembers » is unnecessary — deviation justified: names come from the frontend's existing members join). Paying a salary / approving an advance auto-creates a `SALARY` expense (net / payout) so the P1 ledger stays the single P&L source. Self-service « Mes avances » lives OUTSIDE the Finance module (a FARMER lacks `finance:read`): endpoints under `/api/v1/my/advances`, UI in the Header avatar menu.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Flyway / JPA / Mockito · Next.js 16 / TS / MUI v9 / RTK Query / Vitest.

## Global Constraints

- Migration **V26** immuable ; conventions V25 (BIGSERIAL, TIMESTAMP, CHECK enums, trigger `update_updated_at_column()`, FK explicites).
- Aucun cross-import : finance consomme `TenancyFacade` (`com.avicare.tenancy.api`) uniquement ; références par ID.
- RBAC : lectures Finance `FinanceAccess.READ` ; écritures `FinanceAccess.WRITE_MANAGER` (constantes P1 existantes) ; self-service avances `@farmAccess.hasAccess(...)` + **user depuis le principal** (`TenancyContext.currentUserId()`), jamais du body.
- Codes erreur : `SALARY_PERIOD_EXISTS` → 409 `ConflictException` ; `SALARY_ALREADY_PAID`, `ADVANCE_NOT_PENDING`, `NOT_A_MEMBER` → 422 `BusinessRuleException` ; `INVALID_PERIOD` → 400 `ValidationException`. Corps d'erreur : code au top-level `$.code`.
- Argent : XOF entiers (`BIGINT`/`long`) ; `CHECK (amount > 0)` ⇒ **ne pas créer** de dépense si net = 0.
- **FOOTGUN P1 (leçon)** : tout nouveau repo JPA doit être `@MockitoBean` dans **LES TROIS** contextes DB-less : `SecurityE2ETest`, `SecurityIntegrationTest`, **`DashboardControllerIT`**.
- Commits : Conventional Commits (scopes `finance`, `web`), **AUCUNE signature IA/Claude**, pas de Co-Authored-By, pas d'emoji robot. Backend : `spotless:apply` avant commit ; gate local = `test-compile` exit 0 ; `*IT` en CI uniquement.
- Frontend : tokens only, copie FR, `AuthTokens` exige `expiresIn`, reset dialog edge-triggered (`wasOpen`), stub fetch : matchers spécifiques (`/finance/`, `/my/advances`, `/users`) AVANT `/api/v1/farms`. Dernière tâche front = gates complets (tsc/lint/vitest/build).

---

## File Structure

**Backend (create):** `V26__finance_salaries.sql` ; `finance/domain/{SalarySetting,Salary,SalaryAdvance,SalaryStatus,AdvanceStatus}.java` ; `finance/repository/{SalarySettingRepository,SalaryRepository,SalaryAdvanceRepository}.java` ; `finance/service/{SalaryService,AdvanceService}.java` ; `finance/controller/{SalaryController,MyAdvanceController}.java` ; `finance/dto/...` ; test `finance/SalaryModuleIT.java`.
**Backend (modify):** les 3 tests DB-less (+3 `@MockitoBean`).
**Frontend (create):** endpoints salaires/avances dans `financeApi.ts` ; `components/finance/{SalariesView,SalarySettingDialog,AdvancesPanel}.tsx` ; `app/(dashboard)/finance/salaires/page.tsx` ; `components/account/MyAdvancesDialog.tsx`.
**Frontend (modify):** `types/index.ts`, `baseApi.ts` (tags `Salary`,`Advance`), `Sidebar.tsx` (+ enfant « Salaires »), `Header.tsx` (+ item « Mes avances »).

---

### Task S1 : migration V26 + entités + repositories

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V26__finance_salaries.sql` ; `finance/domain/{SalaryStatus,AdvanceStatus,SalarySetting,Salary,SalaryAdvance}.java` ; `finance/repository/{SalarySettingRepository,SalaryRepository,SalaryAdvanceRepository}.java`
- Modify: `SecurityE2ETest.java`, `SecurityIntegrationTest.java`, `reporting/controller/DashboardControllerIT.java` (+3 `@MockitoBean` chacun)

**Interfaces (Produces):**
- `enum SalaryStatus { DUE, PAID }` ; `enum AdvanceStatus { PENDING, APPROVED, REJECTED }`
- Entités (mêmes annotations que `finance/domain/Expense.java` — la lire ; PAS de soft delete sur ces 3 tables) :
  - `SalarySetting`: id, farmId, userId, monthlySalaryXof (Long), active (boolean), audit read-only.
  - `Salary`: id, farmId, userId, period (String, col `period` CHAR(7)), grossXof, advanceDeductedXof, netXof (Long), status (`@Enumerated(STRING)`), paidAt (LocalDateTime nullable), createdBy, audit.
  - `SalaryAdvance`: id, farmId, userId, amountXof (Long), reason (String), status (`@Enumerated(STRING)`), requestedAt (LocalDateTime), decidedBy (Long nullable), decidedAt (LocalDateTime nullable), remainingXof (Long), audit.
- Repos (`JpaRepository<E, Long>`) :
```java
// SalarySettingRepository
Optional<SalarySetting> findByFarmIdAndUserId(Long farmId, Long userId);
List<SalarySetting> findByFarmIdOrderByUserId(Long farmId);
List<SalarySetting> findByFarmIdAndActiveTrueOrderByUserId(Long farmId);
// SalaryRepository
boolean existsByFarmIdAndUserIdAndPeriod(Long farmId, Long userId, String period);
List<Salary> findByFarmIdAndPeriodOrderByUserId(Long farmId, String period);
List<Salary> findByFarmIdOrderByPeriodDescUserIdAsc(Long farmId);
// SalaryAdvanceRepository
List<SalaryAdvance> findByFarmIdOrderByRequestedAtDesc(Long farmId);
List<SalaryAdvance> findByFarmIdAndStatusOrderByRequestedAtDesc(Long farmId, AdvanceStatus status);
List<SalaryAdvance> findByFarmIdAndUserIdOrderByRequestedAtDesc(Long farmId, Long userId);
List<SalaryAdvance> findByFarmIdAndUserIdAndStatusAndRemainingXofGreaterThanOrderByDecidedAtAscIdAsc(
    Long farmId, Long userId, AdvanceStatus status, Long remaining);
```

- [ ] **Step 1 : migration** `V26__finance_salaries.sql` :

```sql
-- V26 — Finance P2 (Sprint B6) : salaires par membre + avances.
-- Employé = membre de la ferme (user_id -> users). Complète V25 : ajoute la FK
-- différée expenses.salary_id (colonne créée nullable en V25, table absente alors).

CREATE TABLE salary_settings (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monthly_salary_xof  BIGINT NOT NULL CHECK (monthly_salary_xof > 0),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id)
);
CREATE TRIGGER trg_salary_settings_updated_at
    BEFORE UPDATE ON salary_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE salaries (
    id                    BIGSERIAL PRIMARY KEY,
    farm_id               BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period                CHAR(7) NOT NULL,
    gross_xof             BIGINT NOT NULL CHECK (gross_xof > 0),
    advance_deducted_xof  BIGINT NOT NULL DEFAULT 0 CHECK (advance_deducted_xof >= 0),
    net_xof               BIGINT NOT NULL CHECK (net_xof >= 0),
    status                VARCHAR(10) NOT NULL CHECK (status IN ('DUE','PAID')),
    paid_at               TIMESTAMP,
    created_by            BIGINT NOT NULL REFERENCES users(id),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id, period)
);
CREATE INDEX idx_salaries_farm_period ON salaries(farm_id, period);
CREATE TRIGGER trg_salaries_updated_at
    BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE salary_advances (
    id             BIGSERIAL PRIMARY KEY,
    farm_id        BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_xof     BIGINT NOT NULL CHECK (amount_xof > 0),
    reason         VARCHAR(200),
    status         VARCHAR(10) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    requested_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    decided_by     BIGINT REFERENCES users(id),
    decided_at     TIMESTAMP,
    remaining_xof  BIGINT NOT NULL DEFAULT 0 CHECK (remaining_xof >= 0),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_salary_advances_farm_status ON salary_advances(farm_id, status);
CREATE INDEX idx_salary_advances_user ON salary_advances(farm_id, user_id);
CREATE TRIGGER trg_salary_advances_updated_at
    BEFORE UPDATE ON salary_advances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FK différée depuis V25 (expenses.salary_id créé nullable sans contrainte).
ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_salary FOREIGN KEY (salary_id) REFERENCES salaries(id);
```

- [ ] **Step 2 : entités + repos** (interfaces ci-dessus ; annotations calquées sur `Expense.java`, sans @SQLDelete/@SQLRestriction).
- [ ] **Step 3 : DB-less** — `@MockitoBean` des 3 nouveaux repos dans **les 3** contextes (imports comme les autres).
- [ ] **Step 4 : gates** — `./mvnw -q -pl avicare-app -am test-compile` exit 0 + `spotless:apply`. Prouver le boot DB-less : `./mvnw -pl avicare-app test -Dtest='SecurityE2ETest,DashboardControllerIT'` → verts.
- [ ] **Step 5 : commit** — `feat(finance): V26 salary settings, salaries and advances tables`

---

### Task S2 : `SalaryService` + `AdvanceService` (TDD — le cœur : déduction)

**Files:**
- Create: `finance/service/SalaryService.java`, `finance/service/AdvanceService.java`, `finance/dto/request/{SalarySettingRequest,GenerateSalariesRequest,AdvanceRequest}.java`, `finance/dto/response/{SalarySettingResponse,SalaryResponse,AdvanceResponse}.java`
- Test: `finance/service/SalaryServiceTest.java`, `finance/service/AdvanceServiceTest.java`

**Interfaces:**
- Consumes : repos S1 ; `ExpenseRepository` + `Expense`/`ExpenseSource` (P1) ; `TenancyFacade.findMembership(userId, farmId)` (`com.avicare.tenancy.api`, existant — retour `Optional<UserFarmInfo>` avec `active()`).
- Produces (DTOs records) :
```java
SalarySettingRequest(@NotNull Long userId, @NotNull @Positive Long monthlySalaryXof, Boolean active)
GenerateSalariesRequest(@NotBlank String period)                        // "YYYY-MM"
AdvanceRequest(@NotNull Long farmId, @NotNull @Positive Long amountXof, @Size(max=200) String reason)
SalarySettingResponse(Long id, Long userId, Long monthlySalaryXof, boolean active)
SalaryResponse(Long id, Long userId, String period, Long grossXof, Long advanceDeductedXof,
               Long netXof, String status, LocalDateTime paidAt)
AdvanceResponse(Long id, Long userId, Long amountXof, String reason, String status,
                LocalDateTime requestedAt, Long remainingXof)
```
- `SalaryService` (`@Service @RequiredArgsConstructor`) :
  - `upsertSetting(farmId, SalarySettingRequest)` — membre requis : `tenancyFacade.findMembership(userId, farmId)` présent ET `active()`, sinon 422 `BusinessRuleException("NOT_A_MEMBER", ...)` ; crée/met à jour (`monthlySalaryXof`, `active` si non null).
  - `listSettings(farmId)`.
  - `generate(farmId, period, userId)` — période validée `^\d{4}-(0[1-9]|1[0-2])$` sinon 400 `ValidationException("INVALID_PERIOD", ...)` ; pour chaque réglage **actif** : si `existsByFarmIdAndUserIdAndPeriod` → 409 `ConflictException("SALARY_PERIOD_EXISTS", ...)` (la période entière est refusée si déjà générée pour l'un — vérifier AVANT de créer quoi que ce soit : deux passes) ; sinon **déduction** : avances `APPROVED` à `remainingXof > 0` du membre, **plus anciennes d'abord** (`OrderByDecidedAtAscIdAsc`), on décrémente chaque `remainingXof` jusqu'à concurrence de `min(Σ remaining, gross)` ; `net = gross − deducted` ; sauve `Salary(DUE)` avec `createdBy=userId`. Retourne les salaires créés.
  - `pay(farmId, salaryId, userId)` — 404 si absent/autre ferme ; 422 `SALARY_ALREADY_PAID` si `PAID` ; passe `PAID` + `paidAt=now` ; **si `netXof > 0`** crée `Expense(source=SALARY, categoryKey="staff", amountXof=net, expenseDate=today, label="Salaire " + period, salaryId, createdBy=userId)` — même transaction.
  - `listSalaries(farmId, period nullable)`.
- `AdvanceService` :
  - `requestSelf(farmId, userIdFromPrincipal, amountXof, reason)` — membre actif requis (`NOT_A_MEMBER` sinon) ; crée `PENDING`, `remainingXof=0`.
  - `listSelf(farmId, userId)` ; `listFarm(farmId, status nullable)`.
  - `approve(farmId, advanceId, deciderId)` — 404 scope ferme ; 422 `ADVANCE_NOT_PENDING` si statut ≠ PENDING ; `APPROVED`, `decidedBy/At`, `remainingXof = amountXof` ; crée `Expense(SALARY, "staff", amountXof, today, "Avance sur salaire", salaryId=null, createdBy=deciderId)` — l'approbation vaut versement (spec §5).
  - `reject(farmId, advanceId, deciderId)` — mêmes gardes ; `REJECTED`.

- [ ] **Step 1 : tests d'abord (RED)** — cas obligatoires :
  - `SalaryServiceTest` : `upsertSetting` non-membre → `NOT_A_MEMBER` (verify save never) ; `generate` période invalide `"2026-13"` → `ValidationException` ; `generate` déjà générée → `ConflictException` ET **aucun** salaire créé ; **déduction multi-avances** : gross 120000, avances approuvées [30000 (ancienne), 50000] → salaire `deducted=80000, net=40000`, avance1.remaining=0, avance2.remaining=0 ; **déduction partielle avec report** : gross 50000, avances [30000, 40000] → `deducted=50000, net=0`, avance1.remaining=0, avance2.remaining=20000 ; `pay` déjà payé → `SALARY_ALREADY_PAID` ; `pay` net>0 → expense SALARY/staff/net avec salaryId (captor) ; `pay` net=0 → **aucune** expense ; membre sans réglage absent de la génération.
  - `AdvanceServiceTest` : `approve` non-PENDING → 422 ; `approve` → remaining=amount + expense "Avance sur salaire" du montant ; `reject` → pas d'expense ; `requestSelf` non-membre → `NOT_A_MEMBER`.
- [ ] **Step 2 : implémenter → GREEN** — `./mvnw -pl avicare-app test -Dtest='SalaryServiceTest,AdvanceServiceTest'` BUILD SUCCESS.
- [ ] **Step 3 : gates + commit** — `feat(finance): salary generation with advance deduction and payout expenses`

---

### Task S3 : REST + `SalaryModuleIT`

**Files:**
- Create: `finance/controller/SalaryController.java`, `finance/controller/MyAdvanceController.java`
- Test: `finance/SalaryModuleIT.java`

**Interfaces:**
- `SalaryController` (`@RequestMapping("/api/v1/farms/{farmId}/finance")`, constantes `FinanceAccess` P1) :
  - `GET /salary-settings` (READ) ; `PUT /salary-settings` (WRITE_MANAGER, body `SalarySettingRequest`) ;
  - `GET /salaries?period` (READ) ; `POST /salaries/generate` (WRITE_MANAGER, 201, body `GenerateSalariesRequest`) ; `POST /salaries/{id}/pay` (WRITE_MANAGER) ;
  - `GET /advances?status` (READ) ; `POST /advances/{id}/approve` / `POST /advances/{id}/reject` (WRITE_MANAGER).
- `MyAdvanceController` (`@RequestMapping("/api/v1/my/advances")`) — self-service, PAS de gating finance :
```java
@GetMapping
@PreAuthorize("@farmAccess.hasAccess(#farmId)")
public ApiResponse<List<AdvanceResponse>> mine(@RequestParam Long farmId) {
  return ApiResponse.of(advanceService.listSelf(farmId, TenancyContext.currentUserId()));
}

@PostMapping
@ResponseStatus(HttpStatus.CREATED)
@PreAuthorize("@farmAccess.hasAccess(#request.farmId())")
public ApiResponse<AdvanceResponse> request(@RequestBody @Valid AdvanceRequest request) {
  return ApiResponse.of(
      advanceService.requestSelf(
          request.farmId(), TenancyContext.currentUserId(), request.amountXof(), request.reason()));
}
```
(le `userId` vient TOUJOURS du principal — le body n'en porte pas.)

- [ ] **Step 1 : IT** `SalaryModuleIT` (bootstrap + helpers verbatim de `FinanceModuleIT` — même package) :
  1. **Cycle complet** : owner + ferme + `module.finance` ; provisionner un FARMER (addMember → tempPw → loginWith) ; owner `PUT /salary-settings {userId:<farmer>, monthlySalaryXof:120000}` → 200 ; **FARMER demande une avance** `POST /api/v1/my/advances {farmId, amountXof:30000, reason:"urgence"}` → 201 ; owner `GET /finance/advances?status=PENDING` la voit ; owner approuve → 200 ; `GET /finance/expenses` contient une dépense SALARY 30000 (« Avance sur salaire ») ; owner `POST /salaries/generate {period:"2026-07"}` → 201, salaire `gross=120000, advanceDeducted=30000, net=90000, status=DUE` ; owner `POST /salaries/{id}/pay` → 200 ; `GET /finance/expenses` contient une dépense SALARY 90000 (« Salaire 2026-07 ») ; regénérer `2026-07` → **409** `$.code=SALARY_PERIOD_EXISTS`.
  2. **Self-only & RBAC** : le FARMER `GET /api/v1/my/advances?farmId` voit SA demande → 200 ; le FARMER `GET /farms/{id}/finance/salaries` → **403** ; un owner d'une AUTRE ferme `GET /api/v1/my/advances?farmId=<ferme1>` → **403** (hasAccess) ; `PUT /salary-settings` avec un `userId` non membre → **422** `$.code=NOT_A_MEMBER`.
- [ ] **Step 2 : contrôleurs** (code ci-dessus, délégation mince).
- [ ] **Step 3 : gates** — test-compile 0 + spotless (IT en CI). **DB-less** : aucun nouveau repo (S1 les a mockés) — confirmer `SecurityE2ETest` vert si rapide.
- [ ] **Step 4 : commit** — `feat(finance): salary and advance REST endpoints with self-service requests`

---

### Task S4 : frontend — page Salaires & avances

**Files:**
- Modify: `web/src/store/api/financeApi.ts` (+endpoints), `web/src/store/api/baseApi.ts` (+tags `"Salary"`, `"Advance"`), `web/src/types/index.ts` (+types), `web/src/components/layout/Sidebar.tsx` (+enfant `{ label: "Salaires", href: "/finance/salaires", icon: Users }` au groupe finance)
- Create: `web/src/components/finance/SalariesView.tsx`, `web/src/components/finance/SalarySettingDialog.tsx`, `web/src/components/finance/AdvancesPanel.tsx`, `web/src/app/(dashboard)/finance/salaires/page.tsx`
- Test: `web/src/components/finance/SalariesView.test.tsx`, `web/src/components/finance/AdvancesPanel.test.tsx`

**Interfaces:**
- Types : `SalarySetting {id,userId,monthlySalaryXof,active}` ; `Salary {id,userId,period,grossXof,advanceDeductedXof,netXof,status:"DUE"|"PAID",paidAt:string|null}` ; `Advance {id,userId,amountXof,reason:string|null,status:"PENDING"|"APPROVED"|"REJECTED",requestedAt,remainingXof}` ; `AdvanceInput {farmId,amountXof,reason?}`.
- `financeApi` (+) : `getSalarySettings`, `upsertSalarySetting` (PUT, invalide `Salary`), `getSalaries({farmId,period?})`, `generateSalaries`, `paySalary` (invalide `Salary` ET `Expense`), `getAdvances({farmId,status?})`, `approveAdvance`/`rejectAdvance` (invalident `Advance` ET `Expense`), `getMyAdvances({farmId})`, `requestAdvance` (tags `Advance`).
- `SalariesView({farmId})` : join **membres** (`useGetMembersQuery(farmId)` existant → fullName par userId) × réglages ; table réglages (membre, salaire mensuel, actif, Modifier → `SalarySettingDialog` : select membre depuis les membres actifs, montant, switch actif) ; bloc génération (champ période `YYYY-MM` prérempli mois courant + bouton « Générer » — 409 → toast) ; table salaires de la période (membre, brut, avance déduite, net, statut, bouton « Marquer payé » si DUE) ; onglet/section Avances = `AdvancesPanel` (liste par statut, Approuver/Rejeter sur PENDING avec ConfirmDialog). Actions gated `canManageCatalog(useFarmRole(farmId))`.
- Tests : `SalariesView` — la table joint le nom du membre ; « Marquer payé » visible sur DUE seulement ; génération envoie `{period}` exact. `AdvancesPanel` — Approuver n'apparaît que sur PENDING ; approve POST la bonne URL.

- [ ] Steps : tests RED → implémenter → GREEN (`npx vitest run src/components/finance`) ; tsc/eslint clean sur les fichiers touchés ; étendre `Sidebar.test.tsx` n'est PAS requis (le groupe est déjà testé — l'enfant hérite du gating).
- [ ] **Commit** — `feat(web): salaries page with settings, generation, payment and advance decisions`

---

### Task S5 : « Mes avances » (Header) + gates complets

**Files:**
- Create: `web/src/components/account/MyAdvancesDialog.tsx` + test
- Modify: `web/src/components/layout/Header.tsx` (item de menu avant « Se déconnecter »)

**Interfaces:**
- Consumes : `useGetMyAdvancesQuery({farmId})`, `useRequestAdvanceMutation` (S4) ; `useSelectedFarm` (farmId courant).
- `MyAdvancesDialog({open, onClose})` : résout `farmId` via `useSelectedFarm` ; formulaire (montant > 0 entier, motif optionnel) → `requestAdvance({farmId, amountXof, reason})` ; historique self (montant, statut chip, date, restant si APPROVED) ; reset edge-triggered ; toasts. Header : `MenuItem` « Mes avances » (icône `HandCoins` lucide) qui ouvre le dialog (state local dans Header) — visible pour **tout** utilisateur connecté (pas de gating : le back protège).
- Test : le dialog POSTe `{farmId, amountXof, reason}` exact ; l'historique s'affiche depuis le stub.

- [ ] Steps : test RED → implémenter → GREEN, puis **GATES COMPLETS** :
```bash
cd web && npx vitest run && npx tsc --noEmit && npm run lint && npx next build
```
- [ ] **Commit** — `feat(web): self-service advance requests from the account menu`

---

## Self-Review (couverture spec §5)

- Tables + FK différée `expenses.salary_id` → S1 (V26). ✓ Réglage salaire par membre (validation membre via `findMembership` EXISTANT — déviation YAGNI justifiée vs « listMembers », les noms viennent du join front `membersApi`). ✓
- Génération idempotente (UNIQUE + 409 deux-passes), déduction plus-anciennes-d'abord avec report, net=brut−déduit → S2 (tests dédiés multi-avances + report). ✓
- Payer → dépense SALARY nette (skip si 0, CHECK>0) ; approbation avance = versement → dépense — comptabilité sans double compte (30k+90k=120k) → S2 + IT S3. ✓
- Self-service `/my/advances` hasAccess + user du principal (jamais du body) ; UI menu avatar (FARMER sans finance:read) → S3 + S5. ✓
- RBAC : lectures READ, écritures WRITE_MANAGER, cross-farm 403, non-membre 422 → S3 IT. ✓
- Frontend : page Salaires (réglages/génération/paiement/avances) + Sidebar enfant + Mes avances → S4/S5 ; gates complets en S5. ✓

**Type consistency :** DTOs S2 consommés tels quels en S3 ; types TS S4 = records backend (status strings) ; `AdvanceRequest.farmId` utilisé par le SpEL `#request.farmId()` (nom de champ contractuel).
**Ordering :** S1 → S2 → S3 (backend) → S4 → S5 (front, S5 = porte tout-vert).
