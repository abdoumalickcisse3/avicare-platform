# Retrait de la gestion d'abonnement (pilote gratuit) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer la gestion d'abonnement de l'expérience (self-serve front) et faire naître chaque ferme avec tous les modules V1 actifs, en gardant le mécanisme de gating dormant pour une monétisation future.

**Architecture:** Approche **lean**. Un seul changement backend — `SubscriptionService.getOrCreate` provisionne les 12 modules V1 à la création d'un abonnement (les lignes `subscription_modules` existent → le gate passe honnêtement, la sidebar montre tout). Aucun endpoint/service backend retiré (ils restent dormants, cohérent avec « garder pour plus tard » ; évite le recâblage d'ITs CI-only). Le frontend retire la surface abonnement (page/onglet, TrialBanner, étape plan du signup). Docs : ADR-009 + note doc 00 §7.

**Tech Stack:** Spring Boot 3.4 / Java 21 (JUnit5 + Mockito + AssertJ) ; Next.js 16 / React / MUI v9 / RTK Query (Vitest + Testing Library).

## Global Constraints

- **Un seul changement backend** = le provisioning V1 dans `getOrCreate`. Aucun endpoint/service backend supprimé (couche self-serve backend reste **dormante**). Aucun IT à recâbler/supprimer.
- Modules V1 = ceux du catalogue `modules` dont `value.wave == "V1"` (12 : broiler, layer, health.basic, health.advanced, commercial.basic, commercial.advanced, inventory, finance, kpi.advanced, buyer_portal, qr_codes, api_access). **Exclut** `smallruminants.*`/`cattle.*` (V2/V3).
- Provisioning **idempotent** : seulement à la **création** d'un abonnement, jamais sur un abonnement existant.
- RBAC/tenancy (`@farmAccess`, JWT memberships) et le garde-fou prod ADR-004 (`FeatureGatingGuard`) **inchangés**. Gating **reste enforced** (ce sont les fermes complètes qui rendent tout actif).
- **Migrations immuables** : aucune migration touchée.
- Frontend : garder les **consommateurs de gating** (`useActiveModules`, `AdvancedLockCard`, pages gétées, `useHealthGating`/`useInventoryGating`) ; retirer seulement le **management** (page/onglet abonnement, TrialBanner, étape plan du signup, `bundles.ts`, mutations de management de `subscriptionApi`).
- Commit : Conventional Commits, scope bounded-context (`feat(subscription)`, `feat(web)`, `docs`). AUCUNE signature Claude/AI, pas de « Co-Authored-By », pas d'emoji robot, aucune mention AI/Claude/Anthropic.
- Backend avant commit : `cd backend && ./mvnw -q spotless:apply -pl avicare-app`. `*IT` = CI only. MUI **v9**. « This is NOT the Next.js you know ».

## File Structure

**Backend**
- `subscription/service/SubscriptionService.java` — **modifier** : provisioning V1 dans `getOrCreate`.
- `subscription/SubscriptionServiceProvisioningTest.java` — **créer**.

**Frontend**
- `app/(auth)/signup/page.tsx` (+ `page.test.tsx`) — **modifier** : retirer l'étape plan + `applyPlan`.
- `components/dashboard/TrialBanner.tsx` (+ `.test.tsx`) — **supprimer** ; retirer son montage dans `app/(dashboard)/dashboard/page.tsx`.
- `components/farms/FarmSubscriptionTab.tsx` (+ `.test.tsx`) — **supprimer** ; retirer l'onglet dans `components/farms/FarmDetailView.tsx`.
- `components/layout/Sidebar.tsx` + `Header.tsx` — **modifier** : retirer l'entrée « Abonnement » + le lien `tab=subscription`.
- `constants/bundles.ts`, `lib/featureGating.ts` — **supprimer** (plus de consommateur).
- `store/api/subscriptionApi.ts` (+ `.test.ts`) — **modifier** : retirer `getPlans`/`applyPlan`/`enableModule`/`*ChangeRequest*` ; garder `getSubscription`.

**Docs**
- `docs/decisions/009-remove-self-serve-subscription.md` — **créer**.
- `docs/00-vision-strategique.md` — **modifier** : note d'amendement §7.

---

## Task 1: Backend — `getOrCreate` provisionne les modules V1

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/subscription/service/SubscriptionService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/subscription/SubscriptionServiceProvisioningTest.java`

**Interfaces:**
- Consumes: `ParametersFacade.listPlatform(String) : List<CatalogEntryInfo>` (`CatalogEntryInfo.key()`, `.value() : Map<String,Object>`) ; `SubscriptionModuleRepository.save(SubscriptionModule)` ; `SubscriptionModule` (setters `setSubscriptionId/setModuleKey/setMode/setExpiresAt`) ; `FeatureMode.HARD` ; `Subscription.getId()`.
- Produces: a newly created subscription has one `subscription_modules` row per V1 module.

- [ ] **Step 1: Write the failing test**

Create `backend/avicare-app/src/test/java/com/avicare/subscription/SubscriptionServiceProvisioningTest.java`:

```java
package com.avicare.subscription;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.domain.SubscriptionStatus;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import com.avicare.subscription.service.SubscriptionService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceProvisioningTest {

  @Mock SubscriptionRepository subscriptionRepository;
  @Mock SubscriptionModuleRepository subscriptionModuleRepository;
  @Mock ParametersFacade parametersFacade;

  SubscriptionService service;

  static final Long FARM = 7L;

  @BeforeEach
  void setUp() {
    service =
        new SubscriptionService(
            subscriptionRepository, subscriptionModuleRepository, parametersFacade);
  }

  private static CatalogEntryInfo mod(String key, String wave) {
    return new CatalogEntryInfo("modules", key, Map.of("label", key, "wave", wave), false);
  }

  @Test
  void newFarmGetsAllV1ModulesActive() {
    when(subscriptionRepository.findByFarmId(FARM)).thenReturn(Optional.empty());
    when(subscriptionRepository.save(any(Subscription.class)))
        .thenAnswer(
            inv -> {
              Subscription s = inv.getArgument(0);
              s.setId(100L);
              return s;
            });
    when(parametersFacade.listPlatform("modules"))
        .thenReturn(
            List.of(
                mod("module.poultry.broiler", "V1"),
                mod("module.inventory", "V1"),
                mod("module.smallruminants.fattening", "V2"),
                mod("module.cattle.beef", "V3")));

    Subscription sub = service.getOrCreate(FARM);

    assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
    ArgumentCaptor<SubscriptionModule> cap = ArgumentCaptor.forClass(SubscriptionModule.class);
    verify(subscriptionModuleRepository, times(2)).save(cap.capture());
    assertThat(cap.getAllValues())
        .extracting(SubscriptionModule::getModuleKey)
        .containsExactlyInAnyOrder("module.poultry.broiler", "module.inventory");
    assertThat(cap.getAllValues())
        .allSatisfy(
            m -> {
              assertThat(m.getSubscriptionId()).isEqualTo(100L);
              assertThat(m.getMode()).isEqualTo(FeatureMode.HARD);
              assertThat(m.getExpiresAt()).isNull();
            });
  }

  @Test
  void existingFarmIsNotReprovisioned() {
    Subscription existing = new Subscription();
    existing.setId(200L);
    existing.setFarmId(FARM);
    existing.setStatus(SubscriptionStatus.TRIAL);
    when(subscriptionRepository.findByFarmId(FARM)).thenReturn(Optional.of(existing));

    Subscription sub = service.getOrCreate(FARM);

    assertThat(sub).isSameAs(existing);
    verify(subscriptionModuleRepository, never()).save(any());
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=SubscriptionServiceProvisioningTest`
Expected: FAIL — `newFarmGetsAllV1ModulesActive` fails (no module rows saved) while `existingFarmIsNotReprovisioned` already passes.

- [ ] **Step 3: Implement the provisioning**

In `SubscriptionService.java`, add the import `import com.avicare.parameters.api.dto.CatalogEntryInfo;` (and confirm `SubscriptionModule`, `FeatureMode` are imported — they are, used by `enableModule`). Replace `getOrCreate` and add the private helper:

```java
  /** Return the farm's subscription, creating a TRIAL one on first access. */
  @Transactional
  public Subscription getOrCreate(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .orElseGet(
            () -> {
              Subscription sub = new Subscription();
              sub.setFarmId(farmId);
              sub.setStatus(SubscriptionStatus.TRIAL);
              Subscription saved = subscriptionRepository.save(sub);
              provisionV1Modules(saved.getId());
              return saved;
            });
  }

  /**
   * Free-pilot provisioning (ADR-009): a brand-new farm starts with every V1-wave module active, so
   * the whole product is usable without any subscription management. The V1 set is derived from the
   * {@code modules} catalog ({@code value.wave == "V1"}) — no hardcoded list that could drift.
   * Reversible lever for future monetization: restrict this set.
   */
  private void provisionV1Modules(Long subscriptionId) {
    parametersFacade.listPlatform("modules").stream()
        .filter(e -> "V1".equals(e.value().get("wave")))
        .map(CatalogEntryInfo::key)
        .forEach(
            moduleKey -> {
              SubscriptionModule module = new SubscriptionModule();
              module.setSubscriptionId(subscriptionId);
              module.setModuleKey(moduleKey);
              module.setMode(FeatureMode.HARD);
              module.setExpiresAt(null);
              subscriptionModuleRepository.save(module);
            });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=SubscriptionServiceProvisioningTest`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the module surefire suite (guard against caller regressions)**

Run: `cd backend && ./mvnw -q -pl avicare-app test`
Expected: PASS (a pre-existing Docker-less Testcontainers failure like `IdentityTenancyMappingTest` is acceptable; no NEW surefire failure). No new bean/dependency is introduced (`parametersFacade` already injected), so DB-less `@SpringBootTest` mocking is unaffected.

- [ ] **Step 6: Format + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/subscription/service/SubscriptionService.java \
        backend/avicare-app/src/test/java/com/avicare/subscription/SubscriptionServiceProvisioningTest.java
git commit -m "feat(subscription): provision all V1 modules on farm-subscription creation (free pilot)"
```

---

## Task 2: Frontend — simplifier le signup (retirer l'étape plan)

**Files:**
- Modify: `web/src/app/(auth)/signup/page.tsx`
- Modify: `web/src/app/(auth)/signup/page.test.tsx`

**Interfaces:**
- Consumes: farms are now auto-provisioned server-side (Task 1) → the signup no longer applies a plan.
- Produces: signup = account → farm → onboarding flag → redirect to `/dashboard` (single step, no plan choice).

- [ ] **Step 1: Update the failing test**

In `web/src/app/(auth)/signup/page.test.tsx`, remove any assertion about a plan-selection step 2 / bundle choice, and assert the single-step flow instead. Add/replace with a test that submitting the form creates the account+farm and does NOT call `applyPlan`. Example case to include (adapt imports/stub to the file's existing harness):

```tsx
it("creates the account and farm without a plan step", async () => {
  const user = userEvent.setup();
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      calls.push(`${input.method} ${input.url}`);
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } });
      if (input.url.includes("/auth/signup")) return json({ accessToken: "a", refreshToken: "r" }, 201);
      if (input.url.endsWith("/api/v1/farms") && input.method === "POST") return json({ id: 1, name: "F" }, 201);
      if (input.url.includes("/auth/refresh")) return json({ accessToken: "a2", refreshToken: "r2" });
      return json({});
    }),
  );
  renderWithProviders(<SignupPage />);
  // ... fill the required fields via getByLabelText, then submit ...
  // Assert no plan endpoint was hit:
  await vi.waitFor(() => expect(calls.some((c) => c.includes("/subscription/plan"))).toBe(false));
});
```

> Read the existing `page.test.tsx` first and align the stub/field-fill with its established pattern; keep any still-valid cases (validation errors, etc.). Remove cases that drive the (now-deleted) step 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/app/\(auth\)/signup/page.test.tsx`
Expected: FAIL (old step-2 assertions gone / new no-plan assertion not yet satisfied by the current 2-step page).

- [ ] **Step 3: Simplify the signup page**

In `web/src/app/(auth)/signup/page.tsx`:
- Remove imports/usages: `useApplyPlanMutation`, `useGetPlansQuery` (from `subscriptionApi`), `bundles` helpers (`moduleLabel`, `planPriceLabel`, `DEV_BYPASS_BUNDLE_KEY`, `CUSTOM_BUNDLE_EMAIL`), `isFeatureGatingDisabled`.
- Remove state: `step`/`setStep`, `selectedKey`/`setSelectedKey`, `bundleError`/`setBundleError`, `plans`, `gatingDisabled`, and the entire step-2 JSX (plan cards / bundle picker).
- Replace `goToStep2` with a direct submit handler `onSubmit` that validates then calls `handleCreate()`.
- In `handleCreate`, remove the `key`/`isCustom`/`applyPlan`/custom-quote-email logic. Keep the retry-safe orchestration: (a) `signup`, (b) `createFarm` + `refreshSession`, (c) `upsertSetting(ONBOARDING_SETTING_KEY, {completed:true})`, then `router.replace("/dashboard")` (or the file's existing post-onboarding redirect). The farm's modules are provisioned server-side — no plan call.
- The page now renders a single form + a submit button ("Créer mon compte" or the existing label); no step indicator.

> Keep the form schema, fields, and the account/farm creation orchestration intact. Only the plan-selection layer is removed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/app/\(auth\)/signup/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
cd web && npm run lint
git add web/src/app/\(auth\)/signup/page.tsx web/src/app/\(auth\)/signup/page.test.tsx
git commit -m "feat(web): signup no longer picks a plan — farms start fully provisioned"
```

---

## Task 3: Frontend — retirer la surface abonnement

**Files:**
- Delete: `web/src/components/dashboard/TrialBanner.tsx` + `TrialBanner.test.tsx`
- Delete: `web/src/components/farms/FarmSubscriptionTab.tsx` + `FarmSubscriptionTab.test.tsx`
- Delete: `web/src/constants/bundles.ts`
- Delete: `web/src/lib/featureGating.ts`
- Modify: `web/src/app/(dashboard)/dashboard/page.tsx` (drop TrialBanner mount)
- Modify: `web/src/components/farms/FarmDetailView.tsx` (drop subscription tab)
- Modify: `web/src/components/layout/Sidebar.tsx` + `Header.tsx` (drop Abonnement nav + subscription link)
- Modify: `web/src/store/api/subscriptionApi.ts` + `subscriptionApi.test.ts` (keep only `getSubscription`)

**Interfaces:**
- Consumes: nothing new.
- Produces: no subscription-management UI anywhere; `useActiveModules`/gating consumers keep working via the still-present `getSubscription` query.

- [ ] **Step 1: Delete the management components + constants + helper**

```bash
cd /Users/mac/Developer/avicare-platform/web
git rm src/components/dashboard/TrialBanner.tsx src/components/dashboard/TrialBanner.test.tsx \
       src/components/farms/FarmSubscriptionTab.tsx src/components/farms/FarmSubscriptionTab.test.tsx \
       src/constants/bundles.ts src/lib/featureGating.ts
```

- [ ] **Step 2: Remove the TrialBanner mount from the dashboard**

In `web/src/app/(dashboard)/dashboard/page.tsx`: remove `import { TrialBanner } from "@/components/dashboard/TrialBanner";` and its `<TrialBanner ... />` render (and any prop/hook only used to feed it).

- [ ] **Step 3: Remove the subscription tab from `FarmDetailView`**

In `web/src/components/farms/FarmDetailView.tsx`:
- Remove `import { FarmSubscriptionTab } from "./FarmSubscriptionTab";`.
- `type TabKey = "overview" | "team" | "settings";` (drop `"subscription"`).
- `const TAB_KEYS: TabKey[] = ["overview", "team", "settings"];`.
- Remove the `<Tab value="subscription" .../>` label and the `{tab === "subscription" && <FarmSubscriptionTab .../>}` render branch. Keep overview/team/settings intact.

- [ ] **Step 4: Remove the Abonnement nav entries**

- `web/src/components/layout/Sidebar.tsx`: remove the leaf `{ kind: "leaf", label: "Abonnement", href: "/abonnement", icon: CreditCard, enabled: false }` (line ~170) and, if `CreditCard` is now unused, drop its import. Change the `hasFarm ? \`/fermes/${farmId}?tab=subscription\` : "/fermes"` link (line ~307) to just `/fermes/${farmId}` (or the farm overview) — no `tab=subscription`.
- `web/src/components/layout/Header.tsx`: remove `{ prefix: "/abonnement", label: "Abonnement" }` (line ~41).

- [ ] **Step 5: Trim `subscriptionApi` to the read query**

In `web/src/store/api/subscriptionApi.ts`: remove the `getPlans`, `applyPlan`, `enableModule`, `listChangeRequests`, `createChangeRequest`, `submitChangeRequest` endpoints and their exported hooks. **Keep** `getSubscription` (used by `useActiveModules`). Remove now-unused type imports (`Plan`, `ChangeRequest`, etc.).
In `web/src/store/api/subscriptionApi.test.ts`: remove the cases for the deleted endpoints; keep/adjust the `getSubscription` case. If nothing remains, delete the test file.

- [ ] **Step 6: Compile-check the removals (find stragglers)**

Run: `cd web && npx tsc --noEmit`
Expected: no errors. Fix any remaining import of a deleted symbol (e.g. a page importing `isFeatureGatingDisabled`, `bundles`, or a removed hook). `useActiveModules`, `AdvancedLockCard`, and gating hooks must remain untouched.

- [ ] **Step 7: Run the affected suites + lint**

Run: `cd web && npx vitest run src/components/farms src/components/layout src/app/\(dashboard\)/dashboard && npm run lint`
Expected: pass, 0 lint errors. Update any test that referenced a removed nav entry / tab / banner.

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add -A
git commit -m "feat(web): remove subscription-management surface (banner, farm tab, nav, plan API)"
```

---

## Task 4: Docs — ADR-009 + note doc 00

**Files:**
- Create: `docs/decisions/009-remove-self-serve-subscription.md`
- Modify: `docs/00-vision-strategique.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Write ADR-009**

Create `docs/decisions/009-remove-self-serve-subscription.md`:

```markdown
# ADR 009 — Retrait du self-serve d'abonnement (pilote gratuit)

**Date** : 2026-07-14
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

AviCare V1 (volaille) est fonctionnellement complet mais sans fermes en production. La priorité
est l'adoption et la preuve de ROI, pas la monétisation. Le modèle « modules vendus à la carte »
en self-serve (doc 00 §7, D13-D16) impose une friction inadaptée à la réalité ouest-africaine :
mobile money (pas de carte), trésorerie des éleveurs en dents de scie (cycle chair ~45 j), et une
distribution qui passe par des canaux (coopératives, provendiers, couvoirs, vétos).

## Décision

1. **Pilote gratuit, tous modules actifs.** `SubscriptionService.getOrCreate` provisionne les 12
   modules de vague V1 à la création d'un abonnement (source : catalogue `modules`, `wave == "V1"`).
   Le gating (`@features`) reste **enforced** ; ce sont les fermes complètes qui rendent tout actif.
2. **Retrait du self-serve de l'expérience** (frontend) : page/onglet abonnement, `TrialBanner`,
   étape de choix de plan au signup, `bundles.ts`, mutations de management de `subscriptionApi`.
3. **Mécanisme conservé dormant** (approche lean) : aucun endpoint/service backend supprimé
   (`applyPlan`, plans, change-requests restent injoignables depuis l'UI mais présents), la table
   `subscription_modules` et `FeatureChecker` intacts. **Levier de monétisation future** = restreindre
   le provisioning V1 + réactiver le self-serve.

## Thèse de monétisation (différée, hors code)

- **Primaire : B2B2C canal.** Un partenaire (coopérative / provendier / couvoir) paie ou subventionne
  AviCare pour son réseau d'éleveurs — il porte la relation, la confiance et le rail de paiement.
- **Secondaire : mobile money par cycle** (Wave / Orange Money) pour la ferme semi-industrielle
  indépendante — aligné sur le cash-flow (« payer quand la bande est vendue »).
- **Écartés** : prélèvement mensuel fixe au petit éleveur (friction max) ; tout flux carte bancaire.

## Conséquences

- Zéro friction d'onboarding ; toute la valeur produit est démontrable en pilote.
- On ne collecte pas encore de signal de willingness-to-pay in-app → à valider via le canal.
- Superseded : le **volet friction** d'ADR-004 (bypass dev) — le provisioning complet couvre l'usage
  courant ; le flag `avicare.features.gating-enabled` + le garde-fou prod restent pour le dev.
- Réversible : re-restreindre `provisionV1Modules` et remonter le self-serve rétablit le modèle payant.
```

- [ ] **Step 2: Amend doc 00 §7**

In `docs/00-vision-strategique.md`, add a short amendment note at the top of §7 (« Modèle commercial — Modules vendus à la carte »), without rewriting history:

```markdown
> **Amendement 2026-07-14 (ADR-009)** : le self-serve d'abonnement est retiré de l'expérience pour
> le pilote — **gratuit, tous modules V1 actifs**. Le mécanisme de gating et le catalogue de modules
> restent (dormants) ; la monétisation (thèse **B2B2C canal** primaire + mobile money par cycle
> secondaire) est différée. Les décisions D13-D16 restent la référence du mécanisme, pas de la
> commercialisation courante. Cf. `docs/decisions/009-remove-self-serve-subscription.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/009-remove-self-serve-subscription.md docs/00-vision-strategique.md
git commit -m "docs(subscription): ADR-009 remove self-serve subscription (free pilot, B2B2C thesis)"
```

---

## Task 5: Suites vertes

**Files:** none (verification only).

- [ ] **Step 1: Backend module tests**

Run: `cd backend && ./mvnw -q -pl avicare-app test`
Expected: BUILD SUCCESS (1 pre-existing Docker-less Testcontainers failure acceptable; no NEW failure).

- [ ] **Step 2: Frontend full suite + lint + type-check**

Run: `cd web && npx tsc --noEmit && npx vitest run && npm run lint`
Expected: no type errors, all tests pass, 0 lint errors.

- [ ] **Step 3: Commit any incidental fix**

```bash
git add -A && git commit -m "test(web): reconcile suites after subscription-management removal"
```

(Skip if nothing changed.)

---

## Self-Review notes

- **Spec coverage:** provisioning V1 (T1) ; signup sans plan (T2) ; retrait surface abonnement front (T3) ; ADR-009 + doc 00 (T4) ; suites (T5). Approche **lean** respectée (aucun endpoint backend retiré, aucun IT recâblé). ✔
- **Type/consistency:** V1 = `wave == "V1"` (T1) cohérent avec le spec ; `getSubscription` conservé pour `useActiveModules` (T3) ; ADR-009 = prochain numéro libre. ✔
- **No placeholders:** code backend complet ; retraits front listés fichier par fichier avec un `tsc --noEmit` pour rattraper les stragglers ; l'implémenteur lit `signup/page.test.tsx` existant avant d'adapter (harnais). ✔
