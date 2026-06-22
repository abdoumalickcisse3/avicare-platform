# Dashboard principal cross-module (Spec B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un dashboard principal par-ferme, mobile-first, qui agrège des KPI cross-module (commercial, élevage, stocks) via un contexte backend `reporting` lecture seule et un seul endpoint gaté, rendu en widgets adaptatifs côté Next.js.

**Architecture:** Nouveau bounded-context `com.avicare.reporting` (lecture seule) ; `ReportingService` compose les KPI en appelant `CommercialFacade`/`LivestockFacade`/`InventoryFacade` (chacune enrichie de méthodes d'agrégation SQL/JPQL). Un endpoint `GET /farms/{id}/dashboard` renvoie un `DashboardResponse` dont chaque section n'existe que si le module est actif. Le front consomme la réponse en 1 appel et rend les widgets présents (recharts). Rill = projet design-time versionné, non runtime.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Spring Data JPA / Postgres ; Next.js 16 App Router / MUI v7 / RTK Query / recharts 3.8 / Vitest ; Rill Developer (local).

## Global Constraints

- Backend : `@Service` + `@RequiredArgsConstructor`, DTO = records Java 21, `@Transactional(readOnly = true)` sur les lectures, exceptions héritent de `BusinessException`, messages techniques en anglais. **Pas de cross-import entre contextes — uniquement via façades.** Aucune valeur métier en dur.
- **Aucune migration existante modifiée.** Spec B n'ajoute en principe **aucune** table (agrégations sur l'existant). Si une vue/index s'avère nécessaire → nouvelle migration Flyway versionnée immuable.
- Gating : endpoint dashboard = `@farmAccess.hasAccess(#farmId)` (tout membre) ; inclusion **par section** décidée dans le service via `SubscriptionFacade.isModuleEnabled(farmId, key)`. Clés : `module.commercial.basic`, `module.poultry.broiler`, `module.poultry.layer`, `module.health.basic`, `module.inventory`.
- API : réponses enveloppées `ApiResponse.of(...)` ; montants `XOF` entiers (HT, D25) ; dates ISO (`yyyy-MM-dd`).
- Frontend : RTK Query via `baseApi.injectEndpoints` + `transformResponse: r => r.data` ; couleurs `@/theme/tokens` (zéro hex), money/date via `@/lib/format` ; widgets **adaptatifs selon les sections présentes dans la réponse** (jamais en dur) ; Rules of Hooks (hooks avant tout early-return) ; pas de rôle-ferme exposé (403 backend = garde).
- Période : `?period=today|7d|30d|mtd` **OU** `?from=YYYY-MM-DD&to=YYYY-MM-DD` (exclusifs). KPI **snapshot** (encours, impayés, stock bas, valeur stock, bandes, effectif) ignorent la période ; KPI **période** (CA, mortalité, ponte, consommation, séries) la respectent.
- Commits : Conventional Commits, scope par contexte (`feat(reporting):`, `feat(web):`), **sans aucune signature/mention Claude/AI**. 1 PR = 1 phase. CI verte avant merge (`mvn verify` back + `tsc`/lint/vitest/`next build` front ; lint front = `npm run lint` projet entier).
- Pré-requis backend connus : façade `@Service @Transactional(readOnly=true)` implémentant une interface `*Facade` ; contrôleur `@RestController @RequestMapping("/api/v1/farms/{farmId}/...")` ; `SubscriptionFacade.isModuleEnabled(Long, String)` existe ; `@features`/`@farmAccess` beans SpEL existent.

---

## File Structure

**Backend — nouveau contexte `com.avicare.reporting`**
- `reporting/api/dto/DashboardResponse.java` — record racine + sous-records de sections/KPI (un seul fichier, records imbriqués).
- `reporting/domain/DashboardPeriod.java` — record période + factory de parsing/validation (logique pure).
- `reporting/service/ReportingService.java` — orchestration + gating par section.
- `reporting/controller/DashboardController.java` — endpoint gaté.
- Tests : `reporting/domain/DashboardPeriodTest.java`, `reporting/service/ReportingServiceTest.java` (façades mockées), `reporting/controller/DashboardControllerIT.java` (gating, DB-less profil `test`).

**Backend — façades enrichies (méthodes d'agrégation lecture seule)**
- `livestock/commercial/CommercialFacade.java` (+impl `CommercialFacadeImpl`) — stats commerciales.
- `livestock/api/LivestockFacade.java` (+`LivestockFacadeImpl`) — stats élevage.
- `livestock/inventory/InventoryFacade.java` (**créé**) (+impl) — stats stocks.
- Repos concernés gagnent des `@Query` agrégées ; tests `@DataJpaTest`+Testcontainers par requête.

**Frontend — refonte `/dashboard`**
- `web/src/store/api/dashboardApi.ts` — slice 1 endpoint.
- `web/src/types/dashboard.ts` — types miroir du DTO.
- `web/src/lib/dashboard.ts` (+`.test.ts`) — helpers purs (résolution période, mise en forme séries).
- `web/src/components/dashboard/PeriodSelector.tsx` — presets + custom.
- `web/src/components/dashboard/KpiCard.tsx` — carte-chiffre réutilisable (extraite de la page actuelle).
- `web/src/components/dashboard/CommercialSection.tsx`, `LivestockSection.tsx`, `InventorySection.tsx`.
- `web/src/app/(dashboard)/dashboard/page.tsx` — réécrite (shell adaptatif).

**Rill (design-time)**
- `analytics/rill/rill.yaml`, `analytics/rill/connectors/`, `analytics/rill/models/`, `analytics/rill/metrics/`, `analytics/rill/README.md`.

---

# Phase 0 — Socle (reporting + shell + Rill)

> PR : `feat(reporting): dashboard scaffold — period model, gated endpoint, web shell (Spec B phase 0)`.

### Task 0.1 : Modèle de période (logique pure backend)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/reporting/domain/DashboardPeriod.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/reporting/domain/DashboardPeriodTest.java`

**Interfaces:**
- Produces:
```java
public record DashboardPeriod(String kind, String value, LocalDate from, LocalDate to) {
  static DashboardPeriod resolve(String period, LocalDate from, LocalDate to, LocalDate today);
}
```
`kind` ∈ {`"preset"`,`"custom"`} ; pour un preset `value` ∈ {`today`,`7d`,`30d`,`mtd`} et `from/to` calculés ; bornes inclusives. `resolve` lève `BusinessRuleException` (422) si entrée invalide.

- [ ] **Step 1 : test qui échoue**
```java
package com.avicare.reporting.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.exception.BusinessRuleException;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DashboardPeriodTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 6, 22);

  @Test
  void preset30dSpansLast30DaysInclusive() {
    DashboardPeriod p = DashboardPeriod.resolve("30d", null, null, TODAY);
    assertThat(p.kind()).isEqualTo("preset");
    assertThat(p.value()).isEqualTo("30d");
    assertThat(p.to()).isEqualTo(TODAY);
    assertThat(p.from()).isEqualTo(LocalDate.of(2026, 5, 24)); // 29 jours avant -> 30 jours inclus
  }

  @Test
  void presetTodayIsSingleDay() {
    DashboardPeriod p = DashboardPeriod.resolve("today", null, null, TODAY);
    assertThat(p.from()).isEqualTo(TODAY);
    assertThat(p.to()).isEqualTo(TODAY);
  }

  @Test
  void presetMtdStartsFirstOfMonth() {
    DashboardPeriod p = DashboardPeriod.resolve("mtd", null, null, TODAY);
    assertThat(p.from()).isEqualTo(LocalDate.of(2026, 6, 1));
    assertThat(p.to()).isEqualTo(TODAY);
  }

  @Test
  void customRangeIsHonored() {
    DashboardPeriod p =
        DashboardPeriod.resolve(null, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 10), TODAY);
    assertThat(p.kind()).isEqualTo("custom");
    assertThat(p.from()).isEqualTo(LocalDate.of(2026, 6, 1));
    assertThat(p.to()).isEqualTo(LocalDate.of(2026, 6, 10));
  }

  @Test
  void defaultsTo30dWhenNothingProvided() {
    assertThat(DashboardPeriod.resolve(null, null, null, TODAY).value()).isEqualTo("30d");
  }

  @Test
  void rejectsCustomWithFromAfterTo() {
    assertThatThrownBy(
            () ->
                DashboardPeriod.resolve(
                    null, LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 1), TODAY))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void rejectsUnknownPreset() {
    assertThatThrownBy(() -> DashboardPeriod.resolve("yearly", null, null, TODAY))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void rejectsPresetAndCustomTogether() {
    assertThatThrownBy(
            () -> DashboardPeriod.resolve("7d", LocalDate.of(2026, 6, 1), null, TODAY))
        .isInstanceOf(BusinessRuleException.class);
  }
}
```

- [ ] **Step 2 : lancer, échec attendu** — `cd backend && ./mvnw -q -pl avicare-app test -Dtest=DashboardPeriodTest` → FAIL (classe absente).

- [ ] **Step 3 : implémenter**
```java
package com.avicare.reporting.domain;

import com.avicare.common.exception.BusinessRuleException;
import java.time.LocalDate;

/** Résout la fenêtre temporelle d'un dashboard : preset (today/7d/30d/mtd) ou plage custom. */
public record DashboardPeriod(String kind, String value, LocalDate from, LocalDate to) {

  public static DashboardPeriod resolve(
      String period, LocalDate from, LocalDate to, LocalDate today) {
    boolean hasCustom = from != null || to != null;
    if (period != null && hasCustom) {
      throw new BusinessRuleException("Provide either 'period' or a 'from'/'to' range, not both.");
    }
    if (hasCustom) {
      if (from == null || to == null) {
        throw new BusinessRuleException("Custom range requires both 'from' and 'to'.");
      }
      if (from.isAfter(to)) {
        throw new BusinessRuleException("'from' must not be after 'to'.");
      }
      return new DashboardPeriod("custom", "custom", from, to);
    }
    String preset = period == null ? "30d" : period;
    return switch (preset) {
      case "today" -> new DashboardPeriod("preset", "today", today, today);
      case "7d" -> new DashboardPeriod("preset", "7d", today.minusDays(6), today);
      case "30d" -> new DashboardPeriod("preset", "30d", today.minusDays(29), today);
      case "mtd" -> new DashboardPeriod("preset", "mtd", today.withDayOfMonth(1), today);
      default -> throw new BusinessRuleException("Unknown period preset: " + preset);
    };
  }
}
```
> Vérifier le nom exact de l'exception dans `com.avicare.common.exception` (utilisée par les services existants comme `ChangeRequestService`) ; réutiliser la même.

- [ ] **Step 4 : lancer, succès attendu** — `cd backend && ./mvnw -q -pl avicare-app test -Dtest=DashboardPeriodTest` → PASS.

- [ ] **Step 5 : commit**
```bash
git add backend/avicare-app/src/main/java/com/avicare/reporting/domain/DashboardPeriod.java backend/avicare-app/src/test/java/com/avicare/reporting/domain/DashboardPeriodTest.java
git commit -m "feat(reporting): dashboard period model (presets + custom range)"
```

### Task 0.2 : DTO + service squelette + contrôleur gaté

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/reporting/api/dto/DashboardResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/reporting/service/ReportingService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/reporting/controller/DashboardController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/reporting/service/ReportingServiceTest.java`

**Interfaces:**
- Consumes: `DashboardPeriod` (0.1) ; `SubscriptionFacade.isModuleEnabled(Long, String)`.
- Produces:
```java
public record DashboardResponse(
    PeriodInfo period,
    CommercialSection commercial,   // null si module inactif
    LivestockSection livestock,     // null si module inactif
    InventorySection inventory) {   // null si module inactif
  public record PeriodInfo(String kind, String value, String from, String to) {}
  public record CommercialSection(/* rempli en Phase 1 */) {}
  public record LivestockSection(/* rempli en Phase 2 */) {}
  public record InventorySection(/* rempli en Phase 3 */) {}
}
// ReportingService.buildDashboard(Long farmId, DashboardPeriod period) -> DashboardResponse
```
> Sérialisation : configurer Jackson pour **omettre les sections null** (les champs `null` ne doivent pas apparaître). Le projet utilise `ApiResponse` ; vérifier la config Jackson globale — si `NON_NULL` n'est pas global, annoter les sections avec `@JsonInclude(JsonInclude.Include.NON_NULL)` au niveau du record racine.

- [ ] **Step 1 : test qui échoue (gating par section)**
```java
package com.avicare.reporting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.subscription.api.SubscriptionFacade;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportingServiceTest {

  @Mock SubscriptionFacade subscriptionFacade;
  @InjectMocks ReportingService service;

  private static final DashboardPeriod P =
      DashboardPeriod.resolve("30d", null, null, LocalDate.of(2026, 6, 22));

  @Test
  void includesOnlyActiveModuleSections() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    // élevage : aucun module poultry actif
    var resp = service.buildDashboard(1L, P);
    assertThat(resp.commercial()).isNotNull();
    assertThat(resp.inventory()).isNull();
    assertThat(resp.livestock()).isNull();
    assertThat(resp.period().value()).isEqualTo("30d");
  }
}
```
> En Phase 0, `CommercialSection` est un record vide ; le test vérifie seulement *présence/absence* + écho période. Adapter `isModuleEnabled` stubs au fur et à mesure que les phases ajoutent des façades (les méthodes stats seront mockées à partir de la Phase 1 — ici le service ne fait qu'instancier des sections vides selon le gating).

- [ ] **Step 2 : lancer, échec attendu** — `./mvnw -q -pl avicare-app test -Dtest=ReportingServiceTest` → FAIL.

- [ ] **Step 3 : implémenter DTO + service + contrôleur**

`DashboardResponse.java` :
```java
package com.avicare.reporting.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DashboardResponse(
    PeriodInfo period,
    CommercialSection commercial,
    LivestockSection livestock,
    InventorySection inventory) {

  public record PeriodInfo(String kind, String value, String from, String to) {}

  // Phase 1 enrichira ce record (CA, encours, ...).
  public record CommercialSection() {}

  // Phase 2 enrichira ce record (bandes, mortalité, ponte, ...).
  public record LivestockSection() {}

  // Phase 3 enrichira ce record (stock bas, valeur, consommation).
  public record InventorySection() {}
}
```

`ReportingService.java` :
```java
package com.avicare.reporting.service;

import com.avicare.reporting.api.dto.DashboardResponse;
import com.avicare.reporting.api.dto.DashboardResponse.CommercialSection;
import com.avicare.reporting.api.dto.DashboardResponse.InventorySection;
import com.avicare.reporting.api.dto.DashboardResponse.LivestockSection;
import com.avicare.reporting.api.dto.DashboardResponse.PeriodInfo;
import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.subscription.api.SubscriptionFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Compose le dashboard cross-module en lecture seule, section par section selon le gating. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportingService {

  private final SubscriptionFacade subscriptionFacade;
  // Phase 1+ : private final CommercialFacade commercialFacade; (etc.)

  public DashboardResponse buildDashboard(Long farmId, DashboardPeriod period) {
    CommercialSection commercial =
        subscriptionFacade.isModuleEnabled(farmId, "module.commercial.basic")
            ? new CommercialSection()
            : null;
    boolean livestockActive =
        subscriptionFacade.isModuleEnabled(farmId, "module.poultry.broiler")
            || subscriptionFacade.isModuleEnabled(farmId, "module.poultry.layer");
    LivestockSection livestock = livestockActive ? new LivestockSection() : null;
    InventorySection inventory =
        subscriptionFacade.isModuleEnabled(farmId, "module.inventory")
            ? new InventorySection()
            : null;
    return new DashboardResponse(
        new PeriodInfo(
            period.kind(), period.value(), period.from().toString(), period.to().toString()),
        commercial,
        livestock,
        inventory);
  }
}
```

`DashboardController.java` :
```java
package com.avicare.reporting.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.reporting.api.dto.DashboardResponse;
import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.reporting.service.ReportingService;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Tableau de bord cross-module, par ferme (Spec B). Tout membre de la ferme ; sections gatées. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/dashboard")
@RequiredArgsConstructor
public class DashboardController {

  private final ReportingService reportingService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<DashboardResponse> get(
      @PathVariable Long farmId,
      @RequestParam(required = false) String period,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    DashboardPeriod resolved = DashboardPeriod.resolve(period, from, to, LocalDate.now());
    return ApiResponse.of(reportingService.buildDashboard(farmId, resolved));
  }
}
```
> Vérifier la signature exacte de `ApiResponse.of` et l'import du bean `@farmAccess` (déjà utilisé partout). Ajouter `ReportingService`/repos comme `@MockitoBean` dans les tests DB-less existants si le contexte de sécurité les charge (pattern récurrent du projet).

- [ ] **Step 4 : lancer, succès attendu** — `./mvnw -q -pl avicare-app test -Dtest=ReportingServiceTest` → PASS.

- [ ] **Step 5 : test contrôleur (gating 403 / période 422) — DB-less profil `test`**
```java
// DashboardControllerIT : @SpringBootTest + @AutoConfigureMockMvc + profil "test" (DB-less),
// SubscriptionFacade en @MockitoBean. Vérifier :
//  - GET sans token -> 401 ; avec token membre + module commercial actif -> 200 et body.commercial != null
//  - ?period=yearly -> 422 (BusinessRuleException mappée par le @RestControllerAdvice existant)
// Réutiliser le pattern de SecurityE2ETest / des *IT commerciaux existants (forge JWT via jwtService).
```
Lancer : `./mvnw -q -pl avicare-app test -Dtest=DashboardControllerIT` → PASS.

- [ ] **Step 6 : commit**
```bash
git add backend/avicare-app/src/main/java/com/avicare/reporting backend/avicare-app/src/test/java/com/avicare/reporting
git commit -m "feat(reporting): gated dashboard endpoint + section composition skeleton"
```

### Task 0.3 : Shell frontend `/dashboard` (slice + période + conteneur adaptatif)

**Files:**
- Create: `web/src/types/dashboard.ts`
- Create: `web/src/store/api/dashboardApi.ts`
- Create: `web/src/lib/dashboard.ts`
- Test: `web/src/lib/dashboard.test.ts`
- Create: `web/src/components/dashboard/PeriodSelector.tsx`
- Create: `web/src/components/dashboard/KpiCard.tsx`
- Modify: `web/src/app/(dashboard)/dashboard/page.tsx` (réécriture)

**Interfaces:**
- Produces (types miroir du DTO ; sections optionnelles) :
```ts
export type PeriodPreset = "today" | "7d" | "30d" | "mtd";
export interface DashboardPeriodState { kind: "preset" | "custom"; preset?: PeriodPreset; from?: string; to?: string }
export interface DashboardResponse {
  period: { kind: string; value: string; from: string; to: string };
  commercial?: CommercialSection;   // étoffé en Phase 1
  livestock?: LivestockSection;     // étoffé en Phase 2
  inventory?: InventorySection;     // étoffé en Phase 3
}
// lib/dashboard.ts
export function periodToQuery(s: DashboardPeriodState): Record<string, string>;
export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[];
```

- [ ] **Step 1 : test qui échoue (helper pur `periodToQuery`)**
```ts
import { describe, expect, it } from "vitest";
import { periodToQuery } from "./dashboard";

describe("periodToQuery", () => {
  it("maps a preset to ?period=", () => {
    expect(periodToQuery({ kind: "preset", preset: "30d" })).toEqual({ period: "30d" });
  });
  it("maps a custom range to from/to", () => {
    expect(periodToQuery({ kind: "custom", from: "2026-06-01", to: "2026-06-10" })).toEqual({
      from: "2026-06-01",
      to: "2026-06-10",
    });
  });
  it("defaults to 30d when preset missing", () => {
    expect(periodToQuery({ kind: "preset" })).toEqual({ period: "30d" });
  });
});
```

- [ ] **Step 2 : échec attendu** — `cd web && npx vitest run src/lib/dashboard.test.ts` → FAIL.

- [ ] **Step 3 : implémenter `lib/dashboard.ts`**
```ts
import type { DashboardPeriodState, PeriodPreset } from "@/types/dashboard";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "mtd", label: "Ce mois" },
];

export function periodToQuery(s: DashboardPeriodState): Record<string, string> {
  if (s.kind === "custom" && s.from && s.to) return { from: s.from, to: s.to };
  return { period: s.preset ?? "30d" };
}
```
Et `types/dashboard.ts` avec les interfaces ci-dessus (sections en `unknown`/optionnelles pour l'instant, étoffées par phase).

- [ ] **Step 4 : succès attendu** — `npx vitest run src/lib/dashboard.test.ts` → PASS.

- [ ] **Step 5 : `dashboardApi.ts`** (1 endpoint, transformResponse, tag `Dashboard`)
```ts
import { baseApi } from "./baseApi";
import type { DashboardResponse } from "@/types/dashboard";

interface ApiEnvelope<T> { data: T }

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<
      DashboardResponse,
      { farmId: number; query: Record<string, string> }
    >({
      query: ({ farmId, query }) => ({
        url: `/api/v1/farms/${farmId}/dashboard`,
        params: query,
      }),
      transformResponse: (r: ApiEnvelope<DashboardResponse>) => r.data,
      providesTags: [{ type: "Dashboard", id: "current" }],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
```
> Ajouter `"Dashboard"` à `tagTypes` dans `web/src/store/api/baseApi.ts`.

- [ ] **Step 6 : `PeriodSelector.tsx` + `KpiCard.tsx`** — `PeriodSelector` : `ToggleButtonGroup` des `PERIOD_PRESETS` + bouton « Perso… » ouvrant deux `<input type=date>` (MUI `TextField type="date"`), remonte un `DashboardPeriodState` via `onChange`. `KpiCard` : extraire la carte-chiffre existante de `dashboard/page.tsx` (label + valeur + icône + teinte) en composant réutilisable. Couleurs `@/theme/tokens`.

- [ ] **Step 7 : réécrire `dashboard/page.tsx`** — `useSelectedFarm()` → `farmId` ; état période (défaut `{kind:"preset",preset:"30d"}`) ; `useGetDashboardQuery({ farmId, query: periodToQuery(state) }, { skip: !farmId })` (hook **avant** tout early-return) ; rendu : `TrialBanner` + titre + `PeriodSelector` + conteneur qui montera `CommercialSection`/`LivestockSection`/`InventorySection` **uniquement si `data.commercial`/`.livestock`/`.inventory` présents** (Phases 1-3) ; états loading (skeletons) + empty (« Aucun module actif »).

- [ ] **Step 8 : valider** — `cd web && npx tsc --noEmit && npm run lint && npx vitest run && npx next build` → vert (warnings `_args` pré-existants tolérés).

- [ ] **Step 9 : commit**
```bash
git add web/src/types/dashboard.ts web/src/store/api/dashboardApi.ts web/src/lib/dashboard.ts web/src/lib/dashboard.test.ts web/src/components/dashboard "web/src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(web): dashboard shell — period selector, adaptive sections, single fetch"
```

### Task 0.4 : Projet Rill design-time

**Files:**
- Create: `analytics/rill/rill.yaml`, `analytics/rill/.gitignore`, `analytics/rill/connectors/postgres.yaml`, `analytics/rill/models/*.sql`, `analytics/rill/metrics/*.yaml`, `analytics/rill/README.md`

- [ ] **Step 1 : scaffold via skills Rill** — Utiliser les skills `rill:rill-development`, `rill:rill-connector`, `rill:rill-model`, `rill:rill-metrics-view` pour créer un projet minimal connecté au Postgres **dev** (`localhost:5434`, DSN via variable d'env, **jamais** de secret commité — `.gitignore` exclut `.env`/state local). Un modèle SQL par domaine (commercial/élevage/stocks) + une *metrics view* par groupe de KPI, reflétant exactement les agrégations des Phases 1-3.
- [ ] **Step 2 : README** — expliquer `rill start`, la variable DSN dev, et que ce projet est **design-time only** (pas de déploiement, pas de CI gate) — source de doc des définitions de métriques.
- [ ] **Step 3 : valider** — `rill start` démarre et les dashboards Explore s'affichent sur des données de dev (validation visuelle, non automatisée).
- [ ] **Step 4 : commit**
```bash
git add analytics/rill
git commit -m "chore(analytics): Rill design-time project for dashboard metric modeling"
```

---

# Phase 1 — KPI Commercial

> PR : `feat(reporting): commercial dashboard KPIs (Spec B phase 1)`. Ferme la boucle Spec A.

### Task 1.1 : Agrégations commerciales (façade + requêtes)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/CommercialFacade.java`
- Modify: `backend/.../livestock/commercial/CommercialFacadeImpl.java` (ou la classe impl existante)
- Modify: les repos commerciaux (`SaleRepository`, `InvoiceRepository`, `OrderRepository`) — ajouter `@Query` agrégées
- Create: `backend/.../livestock/commercial/dto/CommercialStats.java` (record de transport façade→reporting)
- Test: `backend/.../livestock/commercial/CommercialStatsIT.java` (`@DataJpaTest` + Testcontainers)

**Interfaces:**
- Produces (sur `CommercialFacade`) :
```java
record CommercialStats(
    long revenueXof, java.util.List<DayValue> revenueSeries,
    long outstandingXof, long overdueXof,
    java.util.List<NamedValue> topClients, java.util.List<NamedValue> topDebtors,
    long ordersToDeliver, long invoicesToCollect) {}
record DayValue(java.time.LocalDate date, long valueXof) {}
record NamedValue(Long clientId, String name, long valueXof) {}

CommercialStats commercialStats(Long farmId, java.time.LocalDate from, java.time.LocalDate to);
```

- [ ] **Step 1 : lire les entités** `Sale`, `Invoice`, `Order`, `Client` pour relever les noms **exacts** des champs/colonnes (`totalXof`, dates, statut `overdue`, FK `clientId`, statuts `DELIVERED`/worklist) avant d'écrire les requêtes.
- [ ] **Step 2 : test `@DataJpaTest`** — insérer un jeu minimal (2 clients, ventes sur 2 jours, 1 facture payée partiellement, 1 facture en retard, 1 commande à livrer) et asserter chaque agrégat : `revenueXof` = somme des ventes de la fenêtre ; `revenueSeries` groupé par jour ; `outstandingXof` = facturé−payé ; `overdueXof` ; `topClients`/`topDebtors` triés desc ; `ordersToDeliver`/`invoicesToCollect`.
- [ ] **Step 3 : implémenter** les `@Query` JPQL agrégées (SUM/COUNT/GROUP BY, paramètres `farmId,from,to`) + les méthodes façade qui assemblent `CommercialStats`. **Snapshot** (outstanding/overdue/worklist/topDebtors) ignore `from/to` ; **période** (revenue/series/topClients) la respecte. Ne jamais charger toutes les lignes.
- [ ] **Step 4 : lancer** `./mvnw -q -pl avicare-app test -Dtest=CommercialStatsIT` → PASS.
- [ ] **Step 5 : commit** `feat(commercial): read-only aggregation stats for the dashboard`.

### Task 1.2 : Brancher la section commerciale dans reporting

**Files:**
- Modify: `reporting/api/dto/DashboardResponse.java` (étoffer `CommercialSection`)
- Modify: `reporting/service/ReportingService.java` (injecter `CommercialFacade`, mapper `CommercialStats`→`CommercialSection`)
- Modify: `reporting/service/ReportingServiceTest.java` (mock `CommercialFacade.commercialStats`)

- [ ] **Step 1 : étoffer `CommercialSection`** record avec les champs du catalogue (revenueXof, revenueSeries[{date,valueXof}], outstandingXof, overdueXof, topClients[{clientId,name,valueXof}], topDebtors[...], ordersToDeliver, invoicesToCollect).
- [ ] **Step 2 : test** — quand commercial actif, `service.buildDashboard` appelle `commercialFacade.commercialStats(farmId, period.from(), period.to())` (mocké) et mappe vers `CommercialSection` non nul ; quand inactif, la façade n'est PAS appelée et la section est nulle.
- [ ] **Step 3 : implémenter** le mapping dans `ReportingService` (n'appeler la façade que si le module est actif).
- [ ] **Step 4 : lancer** `./mvnw -q -pl avicare-app test -Dtest=ReportingServiceTest` → PASS.
- [ ] **Step 5 : commit** `feat(reporting): populate commercial dashboard section`.

### Task 1.3 : Widgets commerciaux (frontend)

**Files:**
- Modify: `web/src/types/dashboard.ts` (étoffer `CommercialSection`)
- Create: `web/src/components/dashboard/CommercialSection.tsx`
- Modify: `web/src/app/(dashboard)/dashboard/page.tsx` (monter `<CommercialSection>` si `data.commercial`)

- [ ] **Step 1 : types** — refléter le record backend (mêmes noms de champs).
- [ ] **Step 2 : `CommercialSection.tsx`** — rangée de `KpiCard` (CA période, encours, impayés, commandes à livrer, factures à encaisser) + un graphe recharts de `revenueSeries` (réutiliser le style des charts existants, ex. `StockHistoryChart`) + deux listes Top clients / Top débiteurs (liens vers `/commercial/clients/{id}`). Money/date via `@/lib/format`, couleurs `@/theme/tokens`.
- [ ] **Step 3 : monter** la section dans la page si `data.commercial` présent.
- [ ] **Step 4 : valider** `cd web && npx tsc --noEmit && npm run lint && npx vitest run && npx next build` → vert.
- [ ] **Step 5 : commit** `feat(web): commercial dashboard widgets (KPIs, revenue chart, tops)`.

---

# Phase 2 — KPI Élevage

> PR : `feat(reporting): livestock dashboard KPIs (Spec B phase 2)`.

### Task 2.1 : Agrégations élevage (façade + requêtes)

**Files:**
- Modify: `livestock/api/LivestockFacade.java` (+`LivestockFacadeImpl`)
- Modify: repos concernés (production units, lifecycle/mortalité, pesées V7, collectes œufs V9, santé V14) — `@Query` agrégées
- Create: `livestock/api/dto/LivestockStats.java`
- Test: `livestock/.../LivestockStatsIT.java` (`@DataJpaTest`+Testcontainers)

**Interfaces:**
- Produces :
```java
record LivestockStats(
    long activeBatches, long totalHeadcount,
    long deaths, Double mortalityRate, java.util.List<DayValue> mortalitySeries,
    Double avgDailyGainG,                 // GMQ chair, null si pas de pesées
    Double layingRate, java.util.List<DayValue> layingSeries, // ponte, null si pas pondeuses
    long vaccinationsCount, long treatmentsCount) {}
LivestockStats livestockStats(Long farmId, LocalDate from, LocalDate to);
```
(`DayValue` partagé ; le réutiliser depuis un emplacement commun ou redéclarer localement — DRY : préférer un record commun dans `reporting`/`common` si déjà introduit.)

- [ ] **Step 1 : lire les entités** chair (V6/V7), layer (V8/V9), lifecycle/mortalité, santé (V14) pour les noms exacts (`avg_weight_g`, collectes d'œufs, events de mortalité, `current_count`).
- [ ] **Step 2 : test `@DataJpaTest`** — jeu minimal : 2 bandes actives, des morts sur la fenêtre, 2 pesées (pour GMQ), des collectes d'œufs (pour ponte), 1 vaccination. Asserter chaque agrégat ; `mortalityRate`/`layingRate`/`avgDailyGainG` = `null` quand pas de donnée (jamais division par zéro).
- [ ] **Step 3 : implémenter** requêtes agrégées + assemblage `LivestockStats` (snapshot : bandes/effectif ; période : morts/série/GMQ/ponte/santé).
- [ ] **Step 4 : lancer** `./mvnw -q -pl avicare-app test -Dtest=LivestockStatsIT` → PASS.
- [ ] **Step 5 : commit** `feat(livestock): read-only aggregation stats for the dashboard`.

### Task 2.2 : Brancher la section élevage

**Files:** `reporting/api/dto/DashboardResponse.java` (étoffer `LivestockSection`), `reporting/service/ReportingService.java`, `ReportingServiceTest.java`.

- [ ] **Step 1 : étoffer `LivestockSection`** (champs du catalogue, conditionnels nullable pour GMQ/ponte).
- [ ] **Step 2 : test** — section présente seulement si `module.poultry.broiler` ou `module.poultry.layer` actif ; façade appelée et mappée.
- [ ] **Step 3 : implémenter** mapping `LivestockStats`→`LivestockSection`.
- [ ] **Step 4 : lancer** `./mvnw -q -pl avicare-app test -Dtest=ReportingServiceTest` → PASS.
- [ ] **Step 5 : commit** `feat(reporting): populate livestock dashboard section`.

### Task 2.3 : Widgets élevage (frontend)

**Files:** `web/src/types/dashboard.ts`, `web/src/components/dashboard/LivestockSection.tsx`, `dashboard/page.tsx`.

- [ ] **Step 1 : types** miroir.
- [ ] **Step 2 : `LivestockSection.tsx`** — `KpiCard` (bandes actives, effectif, mortalité+taux, GMQ si présent, taux de ponte si présent) + graphes recharts (mortalité, ponte) en réutilisant `MortalityChart`/`LayingRateCurve` existants ; widgets GMQ/ponte rendus **uniquement si la donnée est non-nulle** (sinon carte « — / pas de données »).
- [ ] **Step 3 : monter** si `data.livestock`.
- [ ] **Step 4 : valider** `npx tsc --noEmit && npm run lint && npx vitest run && npx next build` → vert.
- [ ] **Step 5 : commit** `feat(web): livestock dashboard widgets (headcount, mortality, GMQ, laying)`.

---

# Phase 3 — KPI Stocks

> PR : `feat(reporting): inventory dashboard KPIs (Spec B phase 3)`. Clôt la Spec B.

### Task 3.1 : Façade inventaire + agrégations

**Files:**
- Create: `livestock/inventory/InventoryFacade.java` (+impl `InventoryFacadeImpl`)
- Modify: repos inventaire (`StockItemRepository`, `StockMovementRepository`) — `@Query` agrégées
- Create: `livestock/inventory/dto/InventoryStats.java`
- Test: `livestock/.../InventoryStatsIT.java` (`@DataJpaTest`+Testcontainers)

**Interfaces:**
- Produces :
```java
record InventoryStats(
    long lowStockCount, long stockValueXof,
    long consumptionXof, java.util.List<DayValue> consumptionSeries,
    java.util.List<NamedValue> topConsumed) {}
InventoryStats inventoryStats(Long farmId, LocalDate from, LocalDate to);
```

- [ ] **Step 1 : lire** `stock_items` (`current_quantity`, lien coût), `stock_movements` (OUT, dates) + le service d'alertes B4-2 pour le critère « stock bas ». Décider le **coût unitaire = dernier prix d'achat** (V1, figé spec) et localiser sa source (PO/catalogue) ; documenter.
- [ ] **Step 2 : test `@DataJpaTest`** — articles dont certains sous seuil, mouvements OUT sur la fenêtre. Asserter `lowStockCount`, `stockValueXof` (Σ qty×coût), `consumptionXof`+série, `topConsumed`.
- [ ] **Step 3 : implémenter** la façade (nouvelle) + requêtes agrégées (snapshot : lowStock/valeur ; période : consommation/série/top).
- [ ] **Step 4 : lancer** `./mvnw -q -pl avicare-app test -Dtest=InventoryStatsIT` → PASS.
- [ ] **Step 5 : commit** `feat(inventory): facade + read-only aggregation stats for the dashboard`.

### Task 3.2 : Brancher la section stocks

**Files:** `reporting/api/dto/DashboardResponse.java` (étoffer `InventorySection`), `reporting/service/ReportingService.java`, `ReportingServiceTest.java`.

- [ ] **Step 1 : étoffer `InventorySection`**.
- [ ] **Step 2 : test** — section présente seulement si `module.inventory` actif ; façade appelée et mappée.
- [ ] **Step 3 : implémenter** mapping `InventoryStats`→`InventorySection`.
- [ ] **Step 4 : lancer** `./mvnw -q -pl avicare-app test -Dtest=ReportingServiceTest` → PASS.
- [ ] **Step 5 : commit** `feat(reporting): populate inventory dashboard section`.

### Task 3.3 : Widgets stocks (frontend) + finition

**Files:** `web/src/types/dashboard.ts`, `web/src/components/dashboard/InventorySection.tsx`, `dashboard/page.tsx`.

- [ ] **Step 1 : types** miroir.
- [ ] **Step 2 : `InventorySection.tsx`** — `KpiCard` (stock bas, valeur stock, consommation période) + graphe consommation (réutiliser `StockHistoryChart`) + liste top articles consommés (liens `/stocks/...`).
- [ ] **Step 3 : monter** si `data.inventory` ; vérifier le rendu **multi-modules** (commercial+élevage+stocks tous présents) et **mono-module**.
- [ ] **Step 4 : valider** `npx tsc --noEmit && npm run lint && npx vitest run && npx next build` → vert.
- [ ] **Step 5 : commit** `feat(web): inventory dashboard widgets + adaptive multi-module layout`.

---

## Self-Review (couverture du spec)

- §3.1 contexte reporting + façades stats → Tasks 0.2, 1.1-1.2, 2.1-2.2, 3.1-3.2. ✓
- §3.2 front 1 appel + adaptatif + recharts → 0.3, 1.3, 2.3, 3.3. ✓
- §3.3 Rill design-time → 0.4. ✓
- §4 modèle de période (presets+custom, snapshot vs période) → 0.1 (back), 0.3 (front), respecté dans chaque agrégation. ✓
- §5 catalogue KPI (commercial/élevage/stocks) → 1.1, 2.1, 3.1. ✓
- §6 contrat d'API (sections null omises) → 0.2 (`@JsonInclude(NON_NULL)`). ✓
- §7 découpage 4 phases / 1 PR → Phases 0-3. ✓
- §8 tests (agrégations, parsing période, gating, slice, rendu adaptatif) → tests de chaque task. ✓

**Cohérence des types** : `DashboardPeriod` (0.1) consommé en 0.2/contrôleur ; `CommercialStats`/`LivestockStats`/`InventoryStats` (façades) mappés vers `*Section` (reporting) puis reflétés en `types/dashboard.ts` (front) — mêmes noms de champs imposés à chaque phase. `DayValue`/`NamedValue` partagés (DRY — un seul emplacement).

**Notes aux implémenteurs** : les noms exacts de champs/colonnes d'entités (Sale/Invoice/Order, chair/layer, stock) doivent être **relevés en Step 1** de chaque task d'agrégation avant d'écrire les `@Query` (le plan donne la forme et l'intention ; les `*IT` Testcontainers verrouillent le comportement). `*IT` (Testcontainers) ne tournent pas en local sur ce Mac (Docker 29.x) → s'appuyer sur la CI (`mvn verify`) ; valider en local le reste (tests unitaires mockés, front).
