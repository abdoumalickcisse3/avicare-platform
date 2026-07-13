# Réglage sanitaire — vaccins & traitements custom (CRUD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à une ferme de créer / modifier / supprimer ses propres vaccins et traitements dans Réglages › Sanitaire (le catalogue plateforme reste en lecture seule).

**Architecture:** Réplique du pattern #4 (articles custom). Le catalogue santé (`vaccines`/`treatments`) devient farm-scopé en lecture (`listForFarm` + flag `custom`). L'écriture passe par de nouveaux endpoints santé gétés par module (basic pour vaccins, advanced pour traitements) qui délèguent à `CatalogService` **via** une surface d'écriture ajoutée à `ParametersFacade` (écriture cross-context propre). Le frontend réutilise le gabarit CRUD du `VetsTab` et le pattern de dialogue de `ArticleDialog`.

**Tech Stack:** Spring Boot 3.4 / Java 21 (JUnit5 + Mockito + AssertJ) ; Next.js 16 / React / MUI **v9** / RTK Query (Vitest + Testing Library).

## Global Constraints

- Custom = CRUD complet ; **plateforme = lecture seule**. Source custom = catégories catalogue `vaccines` et `treatments` (entrées `farm_catalog_items` sans parent plateforme).
- **Gating par module (parité lecture/écriture)** : écriture vaccins = `module.health.basic` + OWNER/MANAGER (`HealthAccess.WRITE_BASIC_MANAGER`) ; écriture traitements = `module.health.advanced` + OWNER/MANAGER (`HealthAccess.WRITE_ADVANCED_MANAGER`). Enforce côté endpoint ; l'UI gate en miroir.
- Pas de cross-import entre bounded contexts : la santé (livestock) écrit le catalogue (parameters) **via `ParametersFacade`**, jamais `CatalogService` en direct.
- Champs custom (choix « essentiels ») : vaccin `{label, disease, route}` ; traitement `{label, molecule, routes, withdrawal_days_meat, withdrawal_days_eggs}`. Omettre les champs vides. Ne PAS exposer vaccin `active_strain`/`usage`, traitement `class`/`wave`.
- Commit : Conventional Commits, scope bounded-context (`feat(parameters)`, `feat(livestock:health)`, `feat(web)`). AUCUNE signature Claude/AI, pas de « Co-Authored-By », pas d'emoji robot, aucune mention AI/Claude/Anthropic.
- Backend avant commit : `cd backend && ./mvnw -q spotless:apply -pl avicare-app` (Google Java Format, 2 espaces).
- `*IT` Testcontainers = CI only (Docker local indisponible) — jamais `verify` en local ; `test-compile` + surefire `test` seulement.
- MUI **v9**. Reset dialog **edge-triggered sur `open`** via un ref `wasOpen` (leçon `member_access_customization`). Garde anti-doublon de key en création (comme #4). Web : « This is NOT the Next.js you know ».
- `BusinessRuleException(String,String)` → 422 ; exceptions dans `com.avicare.common.api.exception`.

## File Structure

**Backend**
- `parameters/api/ParametersFacade.java` — **modifier** : `override` + `delete`.
- `parameters/service/ParametersFacadeImpl.java` — **modifier** : impl (délégation `CatalogService`).
- `livestock/health/VaccineDto.java` / `TreatmentDto.java` — **modifier** : flag `custom`.
- `livestock/health/HealthCatalogService.java` — **modifier** : `listForFarm` + `save*/delete*`.
- `livestock/health/HealthCatalogWriteRequest.java` — **créer** : record REST `{key, value}`.
- `livestock/controller/HealthCatalogController.java` — **modifier** : 4 endpoints d'écriture.

**Backend tests**
- `parameters/ParametersFacadeWriteTest.java` — **créer**.
- `livestock/health/HealthCatalogServiceTest.java` — **créer**.

**Frontend**
- `types/index.ts` — **modifier** : `Vaccine.custom`, `Treatment.custom`.
- `lib/health.ts` — **modifier** : `HEALTH_ROUTE_LABELS` + `routeLabel`.
- `store/api/healthApi.ts` — **modifier** : 6 mutations vaccins/traitements custom.
- `components/health/VaccineLibraryDialog.tsx` (+ `.test.tsx`) — **créer**.
- `components/health/TreatmentLibraryDialog.tsx` (+ `.test.tsx`) — **créer**.
- `components/health/HealthLibraryView.tsx` — **modifier** : CRUD dans VaccinesTab + TreatmentsTab.

---

## Task 1: `ParametersFacade` — surface d'écriture

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/parameters/api/ParametersFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/parameters/service/ParametersFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/parameters/ParametersFacadeWriteTest.java`

**Interfaces:**
- Consumes: `CatalogService.override(Long farmId, String category, String key, Map<String,Object> value) : FarmCatalogItem` (getters `getCategory/getKey/getValue/getCatalogItemId`) ; `CatalogService.disable(Long farmId, String category, String key) : void` ; `CatalogEntryInfo(String category, String key, Map<String,Object> value, boolean custom)`.
- Produces: `ParametersFacade.override(Long farmId, String category, String key, Map<String,Object> value) : CatalogEntryInfo` ; `ParametersFacade.delete(Long farmId, String category, String key) : void`.

- [ ] **Step 1: Write the failing test**

Create `backend/avicare-app/src/test/java/com/avicare/parameters/ParametersFacadeWriteTest.java`:

```java
package com.avicare.parameters;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.parameters.domain.FarmCatalogItem;
import com.avicare.parameters.service.CatalogService;
import com.avicare.parameters.service.FarmSettingService;
import com.avicare.parameters.service.ParametersFacadeImpl;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ParametersFacadeWriteTest {

  @Mock FarmSettingService farmSettingService;
  @Mock CatalogService catalogService;

  @Test
  void overrideDelegatesAndMapsToCustomEntryInfo() {
    ParametersFacadeImpl facade = new ParametersFacadeImpl(farmSettingService, catalogService);
    Map<String, Object> value = Map.of("label", "Newcastle fermier");
    FarmCatalogItem item = new FarmCatalogItem();
    item.setCategory("vaccines");
    item.setKey("newcastle-fermier");
    item.setValue(value);
    // custom (no platform parent) → catalogItemId null → custom == true
    when(catalogService.override(7L, "vaccines", "newcastle-fermier", value)).thenReturn(item);

    CatalogEntryInfo out = facade.override(7L, "vaccines", "newcastle-fermier", value);

    assertThat(out.category()).isEqualTo("vaccines");
    assertThat(out.key()).isEqualTo("newcastle-fermier");
    assertThat(out.value()).isEqualTo(value);
    assertThat(out.custom()).isTrue();
  }

  @Test
  void deleteDelegatesToDisable() {
    ParametersFacadeImpl facade = new ParametersFacadeImpl(farmSettingService, catalogService);
    facade.delete(7L, "treatments", "amox-locale");
    verify(catalogService).disable(7L, "treatments", "amox-locale");
  }
}
```

> Verify `FarmCatalogItem` has setters (`setCategory/setKey/setValue`) — it is a JPA entity, likely Lombok `@Setter`. If not, construct it however the entity allows and stub `getCatalogItemId()` to return null (Mockito `mock(FarmCatalogItem.class)` + `when(item.getCategory())...`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=ParametersFacadeWriteTest`
Expected: FAIL — `override`/`delete` not on `ParametersFacade`.

- [ ] **Step 3: Add the interface methods**

In `ParametersFacade.java`, add:

```java
  /** Upsert a farm-level catalog entry (custom or override); returns the effective view. */
  CatalogEntryInfo override(Long farmId, String category, String key, Map<String, Object> value);

  /** Remove/disable a farm-level catalog entry so it no longer appears in {@link #listForFarm}. */
  void delete(Long farmId, String category, String key);
```

(Ensure `java.util.Map` and `CatalogEntryInfo` are already imported — they are, used by existing methods.)

- [ ] **Step 4: Implement in `ParametersFacadeImpl`**

Add (after `listPlatform`):

```java
  @Override
  public CatalogEntryInfo override(
      Long farmId, String category, String key, Map<String, Object> value) {
    var item = catalogService.override(farmId, category, key, value);
    return new CatalogEntryInfo(
        item.getCategory(), item.getKey(), item.getValue(), item.getCatalogItemId() == null);
  }

  @Override
  public void delete(Long farmId, String category, String key) {
    catalogService.disable(farmId, category, key);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=ParametersFacadeWriteTest`
Expected: PASS (2 tests).

- [ ] **Step 6: Format + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/parameters/api/ParametersFacade.java \
        backend/avicare-app/src/main/java/com/avicare/parameters/service/ParametersFacadeImpl.java \
        backend/avicare-app/src/test/java/com/avicare/parameters/ParametersFacadeWriteTest.java
git commit -m "feat(parameters): add override/delete write surface to ParametersFacade"
```

---

## Task 2: `HealthCatalogService` merge + write + controller endpoints

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/health/VaccineDto.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/health/TreatmentDto.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/health/HealthCatalogService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/health/HealthCatalogWriteRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/HealthCatalogController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/health/HealthCatalogServiceTest.java`

**Interfaces:**
- Consumes: `ParametersFacade.listForFarm(Long, String) : List<CatalogEntryInfo>`, `ParametersFacade.override(Long, String, String, Map) : CatalogEntryInfo`, `ParametersFacade.delete(Long, String, String)` (Task 1) ; `HealthAccess.WRITE_BASIC_MANAGER`, `HealthAccess.WRITE_ADVANCED_MANAGER`, `HealthAccess.READ_BASIC`, `HealthAccess.READ_ADVANCED`.
- Produces: `VaccineDto`/`TreatmentDto` gain trailing `boolean custom` ; `HealthCatalogService.listVaccines(Long farmId)`, `listTreatments(Long farmId)`, `saveVaccine(Long,String,Map):VaccineDto`, `deleteVaccine(Long,String)`, `saveTreatment(Long,String,Map):TreatmentDto`, `deleteTreatment(Long,String)` ; REST endpoints `POST/DELETE /health/catalog/{vaccines,treatments}`.

- [ ] **Step 1: Write the failing test**

Create `backend/avicare-app/src/test/java/com/avicare/livestock/health/HealthCatalogServiceTest.java`:

```java
package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HealthCatalogServiceTest {

  @Mock ParametersFacade parametersFacade;

  static final Long FARM = 1L;

  @Test
  void listVaccinesMergesPlatformAndCustomWithFlag() {
    when(parametersFacade.listForFarm(FARM, "vaccines"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo("vaccines", "newcastle", Map.of("label", "Newcastle"), false),
                new CatalogEntryInfo(
                    "vaccines", "nc-fermier", Map.of("label", "NC fermier"), true)));

    HealthCatalogService service = new HealthCatalogService(parametersFacade);
    List<VaccineDto> out = service.listVaccines(FARM);

    assertThat(out).extracting(VaccineDto::key, VaccineDto::custom)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("newcastle", false),
            org.assertj.core.groups.Tuple.tuple("nc-fermier", true));
  }

  @Test
  void saveVaccineDelegatesToFacadeAndRemaps() {
    Map<String, Object> value = Map.of("label", "NC fermier", "disease", "newcastle");
    when(parametersFacade.override(FARM, "vaccines", "nc-fermier", value))
        .thenReturn(new CatalogEntryInfo("vaccines", "nc-fermier", value, true));

    HealthCatalogService service = new HealthCatalogService(parametersFacade);
    VaccineDto out = service.saveVaccine(FARM, "nc-fermier", value);

    assertThat(out.key()).isEqualTo("nc-fermier");
    assertThat(out.label()).isEqualTo("NC fermier");
    assertThat(out.disease()).isEqualTo("newcastle");
    assertThat(out.custom()).isTrue();
  }

  @Test
  void deleteTreatmentDelegates() {
    HealthCatalogService service = new HealthCatalogService(parametersFacade);
    service.deleteTreatment(FARM, "amox-locale");
    verify(parametersFacade).delete(FARM, "treatments", "amox-locale");
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=HealthCatalogServiceTest`
Expected: FAIL — `listVaccines(Long)`, `saveVaccine`, `deleteTreatment` don't exist; `VaccineDto.custom()` missing.

- [ ] **Step 3a: Add `custom` to the DTOs**

`VaccineDto.java`:

```java
public record VaccineDto(
    String key,
    String label,
    String disease,
    String route,
    boolean activeStrain,
    String usage,
    String wave,
    boolean custom) {}
```

`TreatmentDto.java`:

```java
public record TreatmentDto(
    String key,
    String label,
    String molecule,
    String drugClass,
    Integer withdrawalDaysMeat,
    Integer withdrawalDaysEggs,
    List<String> routes,
    String wave,
    boolean custom) {}
```

- [ ] **Step 3b: Farm-scoped reads + write methods in `HealthCatalogService`**

- Change the two list methods to take `farmId` and use `listForFarm`, and propagate `custom`:

```java
  public List<VaccineDto> listVaccines(Long farmId) {
    return parametersFacade.listForFarm(farmId, CAT_VACCINES).stream()
        .map(HealthCatalogService::toVaccine)
        .toList();
  }

  public List<TreatmentDto> listTreatments(Long farmId) {
    return parametersFacade.listForFarm(farmId, CAT_TREATMENTS).stream()
        .map(HealthCatalogService::toTreatment)
        .toList();
  }
```

- Add the write methods (after `listTreatments`):

```java
  @Transactional
  public VaccineDto saveVaccine(Long farmId, String key, Map<String, Object> value) {
    return toVaccine(parametersFacade.override(farmId, CAT_VACCINES, key, value));
  }

  @Transactional
  public void deleteVaccine(Long farmId, String key) {
    parametersFacade.delete(farmId, CAT_VACCINES, key);
  }

  @Transactional
  public TreatmentDto saveTreatment(Long farmId, String key, Map<String, Object> value) {
    return toTreatment(parametersFacade.override(farmId, CAT_TREATMENTS, key, value));
  }

  @Transactional
  public void deleteTreatment(Long farmId, String key) {
    parametersFacade.delete(farmId, CAT_TREATMENTS, key);
  }
```

- Update the two mappers to read `custom` from the entry (append as the last constructor arg):

```java
  private static VaccineDto toVaccine(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    return new VaccineDto(
        e.key(),
        str(v, "label"),
        str(v, "disease"),
        str(v, "route"),
        bool(v, "active_strain"),
        str(v, "usage"),
        str(v, "wave"),
        e.custom());
  }

  private static TreatmentDto toTreatment(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    return new TreatmentDto(
        e.key(),
        str(v, "label"),
        str(v, "molecule"),
        str(v, "class"),
        intg(v, "withdrawal_days_meat"),
        intg(v, "withdrawal_days_eggs"),
        strList(v, "routes"),
        str(v, "wave"),
        e.custom());
  }
```

> `listVaccinationPrograms()` and its mappers are unchanged. The class annotation `@Transactional(readOnly = true)` stays at class level; the new write methods override it with `@Transactional` (read-write) as shown.

- [ ] **Step 4: Run the service test**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=HealthCatalogServiceTest`
Expected: PASS (3 tests).

- [ ] **Step 5: Write request DTO + controller endpoints**

Create `HealthCatalogWriteRequest.java`:

```java
package com.avicare.livestock.health;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** Create/update a custom farm-level health-library entry (vaccine or treatment). */
public record HealthCatalogWriteRequest(
    @NotBlank @Size(max = 100) String key, @NotNull Map<String, Object> value) {}
```

In `HealthCatalogController.java`: update the existing GET methods to pass `farmId`, and add the 4 write methods. Add imports (`org.springframework.http.HttpStatus`, `org.springframework.web.bind.annotation.{PostMapping,DeleteMapping,RequestBody,ResponseStatus}`, `jakarta.validation.Valid`).

Change the GET bodies to `healthCatalogService.listVaccines(farmId)` / `listTreatments(farmId)`. Then add:

```java
  @PostMapping("/vaccines")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)
  public ApiResponse<VaccineDto> createVaccine(
      @PathVariable Long farmId, @RequestBody @Valid HealthCatalogWriteRequest request) {
    return ApiResponse.of(
        healthCatalogService.saveVaccine(farmId, request.key(), request.value()));
  }

  @DeleteMapping("/vaccines/{key}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)
  public void deleteVaccine(@PathVariable Long farmId, @PathVariable String key) {
    healthCatalogService.deleteVaccine(farmId, key);
  }

  @PostMapping("/treatments")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public ApiResponse<TreatmentDto> createTreatment(
      @PathVariable Long farmId, @RequestBody @Valid HealthCatalogWriteRequest request) {
    return ApiResponse.of(
        healthCatalogService.saveTreatment(farmId, request.key(), request.value()));
  }

  @DeleteMapping("/treatments/{key}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public void deleteTreatment(@PathVariable Long farmId, @PathVariable String key) {
    healthCatalogService.deleteTreatment(farmId, key);
  }
```

> `HealthAccess.WRITE_BASIC_MANAGER` and `WRITE_ADVANCED_MANAGER` are package-private constants in the same `controller` package — usable directly. Confirm visibility; if they're `private`, widen to package-private (`static final`).

- [ ] **Step 6: Compile the module (REST mapping is trivial, IT-covered)**

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile`
Expected: BUILD SUCCESS.

> The `listVaccines()`/`listTreatments()` signature change (added `farmId`) may break other callers. Search and fix: `grep -rn "listVaccines()\|listTreatments()" backend/avicare-app/src` — update each call site to pass the farm id in scope. Also check `HealthCatalogControllerIT` / any health IT for the old no-arg calls.

- [ ] **Step 7: Run the module surefire suite**

Run: `cd backend && ./mvnw -q -pl avicare-app test`
Expected: PASS (existing tests + the 2 new classes). A pre-existing Testcontainers failure without Docker (e.g. `IdentityTenancyMappingTest`) is acceptable; any NEW failure must be investigated. No new `@Service`/repository is introduced (only a method on the existing service + a facade method), so DB-less `@SpringBootTest` mocking is unaffected.

- [ ] **Step 8: Format + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/health/VaccineDto.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/health/TreatmentDto.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/health/HealthCatalogService.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/health/HealthCatalogWriteRequest.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/controller/HealthCatalogController.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/health/HealthCatalogServiceTest.java
git commit -m "feat(livestock:health): custom vaccines & treatments — farm-scoped reads + gated write endpoints"
```

---

## Task 3: Frontend types + API + route vocabulary + `VaccineLibraryDialog`

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/lib/health.ts`
- Modify: `web/src/store/api/healthApi.ts`
- Create: `web/src/components/health/VaccineLibraryDialog.tsx`
- Test: `web/src/components/health/VaccineLibraryDialog.test.tsx`

**Interfaces:**
- Consumes: `slugify` (`@/lib/slug`), `useToast`, `apiErrorMessage`.
- Produces: `Vaccine.custom: boolean`, `Treatment.custom: boolean` ; `HEALTH_ROUTE_LABELS: Record<string,string>` + `routeLabel(key)` ; healthApi hooks `useCreateVaccineMutation`/`useUpdateVaccineMutation`/`useDeleteVaccineMutation` + `…Treatment…` ; component `VaccineLibraryDialog`.

- [ ] **Step 1: Add types + route vocabulary + API mutations**

In `web/src/types/index.ts`, append `custom: boolean;` as the last field of `Vaccine` and of `Treatment`:

```ts
export interface Vaccine {
  key: string;
  label: string;
  disease: string;
  route: string;
  activeStrain: boolean;
  usage: string;
  wave: string;
  custom: boolean;
}
```

(and the analogous one-line addition to `Treatment`).

In `web/src/lib/health.ts`, add:

```ts
/** Administration routes for custom vaccines/treatments (stable key → FR label). */
export const HEALTH_ROUTE_LABELS: Record<string, string> = {
  drinking_water: "Eau de boisson",
  injectable: "Injectable",
  ocular: "Oculo-nasal (goutte)",
  spray: "Nébulisation / spray",
  wing_web: "Piqûre au jabot d'aile",
  oral: "Oral",
};

export function routeLabel(key: string): string {
  return HEALTH_ROUTE_LABELS[key] ?? key;
}
```

In `web/src/store/api/healthApi.ts`, add these six mutations inside `endpoints` (place after `getPrograms`/before the vaccinations block), mirroring the inventory pattern (POST body `{key, value}` to the health write endpoints, invalidating the library tag):

```ts
    createVaccine: build.mutation<
      Vaccine,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/vaccines`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Vaccine>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    updateVaccine: build.mutation<
      Vaccine,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/vaccines`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Vaccine>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    deleteVaccine: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `${base(farmId)}/catalog/vaccines/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    createTreatmentCatalog: build.mutation<
      Treatment,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/treatments`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Treatment>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),
    updateTreatmentCatalog: build.mutation<
      Treatment,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/treatments`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Treatment>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),
    deleteTreatmentCatalog: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `${base(farmId)}/catalog/treatments/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),
```

Add `Vaccine` and `Treatment` to the `import type { … }` block at the top if not already present, and export the six new hooks in the `export const { … } = healthApi;` block: `useCreateVaccineMutation, useUpdateVaccineMutation, useDeleteVaccineMutation, useCreateTreatmentCatalogMutation, useUpdateTreatmentCatalogMutation, useDeleteTreatmentCatalogMutation`.

- [ ] **Step 2: Write the failing test**

Create `web/src/components/health/VaccineLibraryDialog.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { VaccineLibraryDialog } from "./VaccineLibraryDialog";

let lastBody: Record<string, unknown> | null = null;
function ok(data: unknown, status = 201) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.url.includes("/catalog/vaccines") && input.method === "POST") {
        lastBody = await input.clone().json();
        return ok({ key: "newcastle-fermier", label: "Newcastle fermier", custom: true });
      }
      return ok([], 200);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("VaccineLibraryDialog", () => {
  it("creates a custom vaccine with slugified key and essential fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <VaccineLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={[]} />,
    );
    await user.type(screen.getByLabelText(/nom/i), "Newcastle fermier");
    await user.type(screen.getByLabelText(/maladie/i), "newcastle");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toEqual({
      key: "newcastle-fermier",
      value: { label: "Newcastle fermier", disease: "newcastle" },
    });
  });

  it("rejects a duplicate key on create", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <VaccineLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={["newcastle-fermier"]} />,
    );
    await user.type(screen.getByLabelText(/nom/i), "Newcastle fermier");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByText(/existe déjà/i)).toBeInTheDocument();
    expect(lastBody).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/health/VaccineLibraryDialog.test.tsx`
Expected: FAIL — module `./VaccineLibraryDialog` not found.

- [ ] **Step 4: Implement `VaccineLibraryDialog`**

Create `web/src/components/health/VaccineLibraryDialog.tsx` (modeled on `ArticleDialog`):

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { Vaccine } from "@/types";
import { useCreateVaccineMutation, useUpdateVaccineMutation } from "@/store/api/healthApi";
import { HEALTH_ROUTE_LABELS } from "@/lib/health";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  disease: z.string().optional(),
  route: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, edits this custom vaccine (key is fixed). */
  vaccine?: Vaccine;
  /** All farm-visible vaccine keys — used to reject duplicate creates. */
  existingKeys?: string[];
}

export function VaccineLibraryDialog({ open, onClose, farmId, vaccine, existingKeys = [] }: Props) {
  const { showToast } = useToast();
  const [createVaccine, { isLoading: creating }] = useCreateVaccineMutation();
  const [updateVaccine, { isLoading: updating }] = useUpdateVaccineMutation();
  const isEdit = vaccine != null;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", disease: "", route: "" },
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        label: vaccine?.label ?? "",
        disease: vaccine?.disease ?? "",
        route: vaccine?.route ?? "",
      });
    }
    wasOpen.current = open;
  }, [open, vaccine, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = { label: values.label };
    if (values.disease) value.disease = values.disease;
    if (values.route) value.route = values.route;
    const key = isEdit ? vaccine!.key : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un vaccin avec ce nom existe déjà" });
      return;
    }
    try {
      if (isEdit) await updateVaccine({ farmId, key, value }).unwrap();
      else await createVaccine({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Vaccin modifié" : "Vaccin créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Modifier le vaccin" : "Nouveau vaccin"}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="label"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="disease"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Maladie ciblée" fullWidth />
              )}
            />
            <Controller
              name="route"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Voie" fullWidth>
                  <MenuItem value="">—</MenuItem>
                  {Object.entries(HEALTH_ROUTE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={creating || updating}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/health/VaccineLibraryDialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Lint + commit**

```bash
cd web && npm run lint
git add web/src/types/index.ts web/src/lib/health.ts web/src/store/api/healthApi.ts \
        web/src/components/health/VaccineLibraryDialog.tsx \
        web/src/components/health/VaccineLibraryDialog.test.tsx
git commit -m "feat(web): custom-vaccine library dialog + health catalog mutations"
```

---

## Task 4: `TreatmentLibraryDialog`

**Files:**
- Create: `web/src/components/health/TreatmentLibraryDialog.tsx`
- Test: `web/src/components/health/TreatmentLibraryDialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateTreatmentCatalogMutation`/`useUpdateTreatmentCatalogMutation` (Task 3), `HEALTH_ROUTE_LABELS` (Task 3), `slugify`, `useToast`, `apiErrorMessage`, type `Treatment`.
- Produces: component `TreatmentLibraryDialog` (props `{open, onClose, farmId, treatment?, existingKeys?}`).

- [ ] **Step 1: Write the failing test**

Create `web/src/components/health/TreatmentLibraryDialog.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { TreatmentLibraryDialog } from "./TreatmentLibraryDialog";

let lastBody: Record<string, unknown> | null = null;
function ok(data: unknown, status = 201) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.url.includes("/catalog/treatments") && input.method === "POST") {
        lastBody = await input.clone().json();
        return ok({ key: "amox-locale", label: "Amox locale", custom: true });
      }
      return ok([], 200);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("TreatmentLibraryDialog", () => {
  it("creates a custom treatment with molecule + withdrawal days", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TreatmentLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={[]} />,
    );
    await user.type(screen.getByLabelText(/^nom/i), "Amox locale");
    await user.type(screen.getByLabelText(/molécule/i), "amoxicilline");
    await user.type(screen.getByLabelText(/délai viande/i), "7");
    await user.type(screen.getByLabelText(/délai œufs/i), "3");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toEqual({
      key: "amox-locale",
      value: {
        label: "Amox locale",
        molecule: "amoxicilline",
        withdrawal_days_meat: 7,
        withdrawal_days_eggs: 3,
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/health/TreatmentLibraryDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TreatmentLibraryDialog`**

Create `web/src/components/health/TreatmentLibraryDialog.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type { Treatment } from "@/types";
import {
  useCreateTreatmentCatalogMutation,
  useUpdateTreatmentCatalogMutation,
} from "@/store/api/healthApi";
import { HEALTH_ROUTE_LABELS, routeLabel } from "@/lib/health";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  molecule: z.string().optional(),
  routes: z.array(z.string()),
  withdrawalMeat: z.string().regex(/^\d*$/, "Entier").optional(),
  withdrawalEggs: z.string().regex(/^\d*$/, "Entier").optional(),
});
type FormValues = z.infer<typeof schema>;

const ROUTE_KEYS = Object.keys(HEALTH_ROUTE_LABELS);

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  treatment?: Treatment;
  existingKeys?: string[];
}

export function TreatmentLibraryDialog({
  open,
  onClose,
  farmId,
  treatment,
  existingKeys = [],
}: Props) {
  const { showToast } = useToast();
  const [createTreatment, { isLoading: creating }] = useCreateTreatmentCatalogMutation();
  const [updateTreatment, { isLoading: updating }] = useUpdateTreatmentCatalogMutation();
  const isEdit = treatment != null;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", molecule: "", routes: [], withdrawalMeat: "", withdrawalEggs: "" },
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        label: treatment?.label ?? "",
        molecule: treatment?.molecule ?? "",
        routes: treatment?.routes ?? [],
        withdrawalMeat:
          treatment?.withdrawalDaysMeat != null ? String(treatment.withdrawalDaysMeat) : "",
        withdrawalEggs:
          treatment?.withdrawalDaysEggs != null ? String(treatment.withdrawalDaysEggs) : "",
      });
    }
    wasOpen.current = open;
  }, [open, treatment, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = { label: values.label };
    if (values.molecule) value.molecule = values.molecule;
    if (values.routes.length) value.routes = values.routes;
    if (values.withdrawalMeat) value.withdrawal_days_meat = Number(values.withdrawalMeat);
    if (values.withdrawalEggs) value.withdrawal_days_eggs = Number(values.withdrawalEggs);
    const key = isEdit ? treatment!.key : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un traitement avec ce nom existe déjà" });
      return;
    }
    try {
      if (isEdit) await updateTreatment({ farmId, key, value }).unwrap();
      else await createTreatment({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Traitement modifié" : "Traitement créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Modifier le traitement" : "Nouveau traitement"}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="label"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="molecule"
              control={control}
              render={({ field }) => <TextField {...field} label="Molécule" fullWidth />}
            />
            <Controller
              name="routes"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={ROUTE_KEYS}
                  getOptionLabel={(o) => routeLabel(o)}
                  value={field.value}
                  onChange={(_e, v) => field.onChange(v)}
                  renderInput={(params) => <TextField {...params} label="Voie(s)" />}
                />
              )}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <Controller
                name="withdrawalMeat"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Délai viande (j)"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                  />
                )}
              />
              <Controller
                name="withdrawalEggs"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Délai œufs (j)"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                  />
                )}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={creating || updating}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/health/TreatmentLibraryDialog.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Lint + commit**

```bash
cd web && npm run lint
git add web/src/components/health/TreatmentLibraryDialog.tsx web/src/components/health/TreatmentLibraryDialog.test.tsx
git commit -m "feat(web): custom-treatment library dialog"
```

---

## Task 5: Wire CRUD into `HealthLibraryView` (VaccinesTab + TreatmentsTab)

**Files:**
- Modify: `web/src/components/health/HealthLibraryView.tsx`
- Test: `web/src/components/health/HealthLibraryView.test.tsx` (create)

**Interfaces:**
- Consumes: `VaccineLibraryDialog` (Task 3), `TreatmentLibraryDialog` (Task 4), `useDeleteVaccineMutation`/`useDeleteTreatmentCatalogMutation` (Task 3), `useFarmRole`/`canManageCatalog` (`@/hooks/useFarmRole`), `routeLabel` (`@/lib/health`), `useHealthGating` (already used: `hasBasic`, `hasAdvanced`).
- Produces: VaccinesTab + TreatmentsTab gain create/edit/delete on custom rows.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/health/HealthLibraryView.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { HealthLibraryView } from "./HealthLibraryView";

const SUBSCRIPTION = {
  modules: [
    { key: "module.health.basic", mode: "HARD", expiresAt: null },
    { key: "module.health.advanced", mode: "HARD", expiresAt: null },
  ],
};
const VACCINES = [
  { key: "newcastle", label: "Newcastle", disease: "newcastle", route: "", activeStrain: true, usage: "", wave: "", custom: false },
  { key: "nc-fermier", label: "NC fermier", disease: "newcastle", route: "drinking_water", activeStrain: false, usage: "", wave: "", custom: true },
];

function ok(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = input.url;
      if (url.includes("/catalog/vaccines")) return ok(VACCINES);
      if (url.includes("/subscription")) return ok(SUBSCRIPTION);
      if (url.endsWith("/api/v1/farms")) return ok([{ id: 1, name: "Ferme", role: "OWNER" }]);
      return ok([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("HealthLibraryView", () => {
  it("marks custom vaccines and offers create for a manager", async () => {
    renderWithProviders(<HealthLibraryView />);
    // custom row carries the "Perso" chip; platform row does not
    const customRow = (await screen.findByText("NC fermier")).closest("tr")!;
    expect(within(customRow).getByText(/perso/i)).toBeInTheDocument();
    const platformRow = screen.getByText("Newcastle").closest("tr")!;
    expect(within(platformRow).queryByText(/perso/i)).not.toBeInTheDocument();
    // create button visible for OWNER
    expect(screen.getByRole("button", { name: /nouveau vaccin/i })).toBeInTheDocument();
  });
});
```

> Confirm the selected-farm shape the app expects: inspect `useSelectedFarm`/`useActiveModules` (as done in the #6 Task-4 stub) and adjust the `/api/v1/farms` and `/subscription` stub payloads to match (`role`/`farmRole`, module `mode:"HARD"`, non-expired). The test must make `useFarmRole` return `"OWNER"` and both health modules active.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/health/HealthLibraryView.test.tsx`
Expected: FAIL — no "Perso" chip / no "Nouveau vaccin" button yet.

- [ ] **Step 3: Rewrite `VaccinesTab` with CRUD**

In `HealthLibraryView.tsx`, add imports at the top:

```tsx
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { routeLabel } from "@/lib/health";
import { VaccineLibraryDialog } from "./VaccineLibraryDialog";
import { TreatmentLibraryDialog } from "./TreatmentLibraryDialog";
import {
  useDeleteVaccineMutation,
  useDeleteTreatmentCatalogMutation,
} from "@/store/api/healthApi";
import type { Vaccine, Treatment } from "@/types";
```

Replace the `VaccinesTab` function with (drops the read-only note; adds create/edit/delete on custom rows; button gated by OWNER/MANAGER + `hasBasic` passed as prop):

```tsx
function VaccinesTab({
  farmId,
  enabled,
  canManage,
}: {
  farmId?: number;
  enabled: boolean;
  canManage: boolean;
}) {
  const { showToast } = useToast();
  const { data = [], isLoading } = useGetVaccinesQuery(
    { farmId: farmId as number },
    { skip: !enabled || !farmId },
  );
  const [deleteVaccine] = useDeleteVaccineMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vaccine | null>(null);
  const existingKeys = data.map((v) => v.key);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const onDelete = async (key: string) => {
    try {
      await deleteVaccine({ farmId: farmId as number, key }).unwrap();
      showToast("Vaccin supprimé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (isLoading) return <LoadingRows />;
  return (
    <>
      {canManage && (
        <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 2 }}>
          <Button variant="contained" color="secondary" startIcon={<Plus size={16} />} onClick={openCreate}>
            Nouveau vaccin
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx}>Vaccin</TableCell>
              <TableCell sx={headCellSx}>Maladie ciblée</TableCell>
              <TableCell sx={headCellSx}>Voie</TableCell>
              <TableCell sx={headCellSx} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((v) => (
              <TableRow key={v.key} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {v.label}
                  {v.custom && (
                    <Chip size="small" label="Perso" sx={{ ml: 1, bgcolor: colors.primary[50], color: colors.primary[700] }} />
                  )}
                </TableCell>
                <TableCell>{humanizeKey(v.disease)}</TableCell>
                <TableCell>
                  {v.route && <Chip size="small" label={routeLabel(v.route)} sx={{ bgcolor: colors.neutral[100] }} />}
                </TableCell>
                <TableCell align="right">
                  {v.custom && canManage && (
                    <>
                      <IconButton
                        size="small"
                        aria-label="Modifier"
                        onClick={() => {
                          setEditing(v);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton size="small" aria-label="Supprimer" onClick={() => onDelete(v.key)}>
                        <Power size={16} />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <VaccineLibraryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        farmId={farmId as number}
        vaccine={editing ?? undefined}
        existingKeys={existingKeys}
      />
    </>
  );
}
```

- [ ] **Step 4: Rewrite `TreatmentsTab` with CRUD**

Replace the `TreatmentsTab` function analogously (gated by `hasAdvanced`; delete via `useDeleteTreatmentCatalogMutation`; `TreatmentLibraryDialog`):

```tsx
function TreatmentsTab({
  farmId,
  enabled,
  canManage,
}: {
  farmId?: number;
  enabled: boolean;
  canManage: boolean;
}) {
  const { showToast } = useToast();
  const { data = [], isLoading } = useGetTreatmentCatalogQuery(
    { farmId: farmId as number },
    { skip: !enabled || !farmId },
  );
  const [deleteTreatment] = useDeleteTreatmentCatalogMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const existingKeys = data.map((t) => t.key);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const onDelete = async (key: string) => {
    try {
      await deleteTreatment({ farmId: farmId as number, key }).unwrap();
      showToast("Traitement supprimé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (isLoading) return <LoadingRows />;
  return (
    <>
      {canManage && (
        <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 2 }}>
          <Button variant="contained" color="secondary" startIcon={<Plus size={16} />} onClick={openCreate}>
            Nouveau traitement
          </Button>
        </Stack>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx}>Traitement</TableCell>
              <TableCell sx={headCellSx}>Molécule</TableCell>
              <TableCell sx={headCellSx} align="right">
                Délai œufs / viande
              </TableCell>
              <TableCell sx={headCellSx} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((t) => (
              <TableRow key={t.key} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t.label}
                  {t.custom && (
                    <Chip size="small" label="Perso" sx={{ ml: 1, bgcolor: colors.primary[50], color: colors.primary[700] }} />
                  )}
                </TableCell>
                <TableCell>{humanizeKey(t.molecule)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                  {t.withdrawalDaysEggs ?? "?"} j / {t.withdrawalDaysMeat ?? "?"} j
                </TableCell>
                <TableCell align="right">
                  {t.custom && canManage && (
                    <>
                      <IconButton
                        size="small"
                        aria-label="Modifier"
                        onClick={() => {
                          setEditing(t);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton size="small" aria-label="Supprimer" onClick={() => onDelete(t.key)}>
                        <Power size={16} />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TreatmentLibraryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        farmId={farmId as number}
        treatment={editing ?? undefined}
        existingKeys={existingKeys}
      />
    </>
  );
}
```

- [ ] **Step 5: Pass `canManage` from the parent + drop the unused `READ_ONLY_NOTE`**

In `HealthLibraryView`, compute the role and pass `canManage` per tab (vaccines→`hasBasic`, treatments→`hasAdvanced`):

- At the top of `HealthLibraryView` body: add `const role = useFarmRole(farmId); const canManage = canManageCatalog(role);` (import already added).
- Update the tab renders:
  ```tsx
  {tab === "vaccines" && (
    <VaccinesTab farmId={farmId} enabled={hasFarm} canManage={canManage && hasBasic} />
  )}
  {tab === "treatments" && (hasAdvanced ? (
    <TreatmentsTab farmId={farmId} enabled={hasFarm} canManage={canManage && hasAdvanced} />
  ) : (
    /* keep the existing AdvancedLockCard branch unchanged */
  ))}
  ```
  (Preserve the existing `hasAdvanced` lock wrapper for treatments; only add the `canManage` prop to the active branch. Read the current JSX at lines ~90-101 and keep its structure.)
- Add `hasBasic`, `hasAdvanced` to the `useHealthGating()` destructure at the top of `HealthLibraryView` if not already destructured.
- `READ_ONLY_NOTE` is still used by `ProgramsTab` — keep the const. (Vaccines/Treatments tabs no longer reference it.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/health/HealthLibraryView.test.tsx`
Expected: PASS. If the farm/subscription stub shape is off (no button / no chip), adjust the stub per the note in Step 1 and re-run.

- [ ] **Step 7: Lint + commit**

```bash
cd web && npm run lint
git add web/src/components/health/HealthLibraryView.tsx web/src/components/health/HealthLibraryView.test.tsx
git commit -m "feat(web): create/edit/delete custom vaccines & treatments in the health library"
```

---

## Task 6: Full suites green

**Files:** none (verification only).

- [ ] **Step 1: Backend module tests (surefire, no ITs)**

Run: `cd backend && ./mvnw -q -pl avicare-app test`
Expected: BUILD SUCCESS (a pre-existing Docker-less Testcontainers failure like `IdentityTenancyMappingTest` is acceptable; no NEW failure).

- [ ] **Step 2: Frontend suite + lint**

Run: `cd web && npx vitest run && npm run lint`
Expected: all tests pass, 0 lint errors.

- [ ] **Step 3: Commit any incidental fix**

```bash
git add -A && git commit -m "test(web): reconcile suites after health custom library"
```

(Skip if nothing changed.)

---

## Self-Review notes

- **Spec coverage:** facade write surface (T1) ; service merge + custom flag + write + gated endpoints (T2) ; types/api/route-vocab + vaccine dialog (T3) ; treatment dialog (T4) ; view CRUD wiring (T5) ; suites (T6). ✔
- **Type consistency:** `VaccineDto`/`TreatmentDto` gain trailing `custom` (backend) mirrored by `Vaccine.custom`/`Treatment.custom` (frontend) ; health write endpoints `POST/DELETE /health/catalog/{vaccines,treatments}` consistent between T2 (backend) and T3 (frontend api) ; `HEALTH_ROUTE_LABELS` keys used by both dialogs. ✔
- **No placeholders:** all code provided in full; the two implementer-verify notes (FarmCatalogItem setters in T1; farm/subscription stub shape in T5) name the exact file to check and the fallback. ✔
