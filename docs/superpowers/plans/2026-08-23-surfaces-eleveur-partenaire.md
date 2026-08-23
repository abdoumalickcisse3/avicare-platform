# Surfaces éleveur du produit partenaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'éleveur, depuis son app (web + mobile), les moyens de déclarer un fournisseur/véto depuis un annuaire, rejoindre un réseau par code d'invitation, voir ses partenaires, régler ses curseurs de partage, et quitter un réseau — en consommant le socle backend `com.avicare.partner` (PR #215).

**Architecture:** Un contrôleur éleveur-facing `FarmerPartnerController` sous `/api/v1/farms/{farmId}/partners`, gaté par le bean `@farmAccess` (lecture = tout membre, écriture = OWNER/MANAGER). La frontière de confiance (un éleveur n'agit que sur les adhésions de SA ferme) est une garde farm-scoped **dans le service**. Les écrans web (Next.js/MUI, RTK Query) et mobile (Expo/RN, RTK Query) vivent sous Réglages, toujours visibles avec un état vide clair.

**Tech Stack:** Java 21, Spring Boot, Spring Data JPA, Lombok, JUnit 5 + Mockito + AssertJ ; Next.js 16 + MUI v9 + RTK Query ; Expo/React Native + RTK Query + Jest/RNTL 14.

**Spec:** `docs/superpowers/specs/2026-08-23-surfaces-eleveur-partenaire-design.md`

## Global Constraints

- **Contexte** : tout le backend vit dans `com.avicare.partner` (contexte racine existant). Aucun `@ManyToOne` cross-context ; références `farms`/`users` par ID. Aucun import de `com.avicare.livestock.*`/`finance.*`.
- **Aucune migration Flyway** : le schéma V36 couvre déjà tout. **Aucun nouvel enum.**
- **Services** : `@Service` + `@RequiredArgsConstructor` ; `@Transactional` sur écriture, `@Transactional(readOnly = true)` sur lecture ; `@Valid` sur DTOs entrants.
- **DTOs** : records Java 21. **Exceptions** métier existantes réutilisées : `NotFoundException.of("PartnerFarmMembership", id)` (404), `InviteCodeInvalidException` (422), `DuplicateMembershipException` (409). Messages techniques en anglais.
- **Gates** (patron `FarmSettingsController`) : lecture `@PreAuthorize("@farmAccess.hasAccess(#farmId)")` ; écriture `@PreAuthorize("@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")`. Le bean `FarmAccessChecker` est `@Component("farmAccess")` et lit les memberships depuis le JWT (pas la DB) → testable DB-less via token forgé.
- **Réponses REST** : `ApiResponse.of(...)` (patron `AdminPartnerController`). Acteur courant : `TenancyContext.currentUserId()`.
- **Tests DB-less** : `FarmAccessChecker` est réel dans le harness DB-less (`DashboardControllerIT`) ; le contrôleur se teste en `@SpringBootTest(MOCK) + @AutoConfigureMockMvc + @ActiveProfiles("test")`, services partner mockés en `@MockitoBean`. **Aucun nouveau repository** n'est créé → **aucun** nouveau `@MockitoBean` à câbler dans les 4 contextes DB-less.
- **Testcontainers ne tourne PAS sur ce Mac** : les suites Mockito/DB-less sont la boucle TDD locale ; ne jamais merger sur CI rouge.
- **Build local** (ADR-003) : `cd backend && ./mvnw clean verify` avant merge ; front : `cd web && npm run lint && npm run build && npm test` ; mobile : `cd mobile && npx tsc --noEmit && npm test`.
- **Spotless** Google Java Format 2 espaces : `./mvnw spotless:apply -pl avicare-app` (jamais `-am`).
- **Commits** : Conventional Commits, scope `feat(backend:partner):` / `feat(web:partner):` / `feat(mobile:partner):`. **AUCUNE** signature/mention Claude/IA.
- **Frontière de confiance** : jamais de filtrage de scope/appartenance côté front seul — le backend est l'autorité.
- **Curseurs par défaut** : opérationnel ON (`activity`, `flock_health`, `feed_consumption`), argent OFF (`sales_volume`, `finances`) — déjà porté par les initialisateurs de champs de l'entité.

---

### Task 1: `PartnerService.listActive` + `mapByIds` + annuaire DTO

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerRepository.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/AvailablePartnerResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerServiceTest.java` (modify — file exists)

**Interfaces:**
- Consumes: `PartnerRepository`, entities `Partner`/`PartnerType`/`PartnerStatus`.
- Produces:
  - `PartnerRepository.findByStatus(PartnerStatus status) : List<Partner>`
  - `PartnerService.listActive(PartnerType typeOrNull) : List<Partner>` — ACTIVE only, filtré par type si non-null.
  - `PartnerService.mapByIds(java.util.Collection<Long> ids) : java.util.Map<Long, Partner>` — résolution batch (soft-deleted exclus par `@SQLRestriction`).
  - `AvailablePartnerResponse(Long id, String name, String type, String contactName, String contactPhone, String logoUrl)` + `static of(Partner)`.

- [ ] **Step 1: Add the derived query to `PartnerRepository`**

Add inside the interface (after `findByType`):
```java
  List<Partner> findByStatus(com.avicare.partner.domain.PartnerStatus status);
```

- [ ] **Step 2: Write the failing tests in `PartnerServiceTest`**

Add these two tests (imports: `com.avicare.partner.domain.PartnerStatus`, `java.util.List`, `java.util.Map`):
```java
  @Test
  void listActiveFiltersByStatusAndType() {
    Partner active = new Partner();
    active.setName("Provendier X");
    active.setType(PartnerType.FEED_SUPPLIER);
    active.setStatus(PartnerStatus.ACTIVE);
    when(partnerRepository.findByStatus(PartnerStatus.ACTIVE)).thenReturn(List.of(active));

    // no type filter
    assertThat(service.listActive(null)).containsExactly(active);
    // matching type
    assertThat(service.listActive(PartnerType.FEED_SUPPLIER)).containsExactly(active);
    // non-matching type filters it out
    assertThat(service.listActive(PartnerType.VET)).isEmpty();
  }

  @Test
  void mapByIdsIndexesPartnersById() {
    Partner p = new Partner();
    p.setName("Provendier X");
    p.setType(PartnerType.FEED_SUPPLIER);
    // simulate persisted id via reflection-free setter path is unavailable; use a spy-free stub:
    when(partnerRepository.findAllById(List.of(3L))).thenReturn(List.of(withId(p, 3L)));

    Map<Long, Partner> byId = service.mapByIds(List.of(3L));

    assertThat(byId).containsOnlyKeys(3L);
    assertThat(byId.get(3L).getName()).isEqualTo("Provendier X");
  }

  /** Test helper: Partner#id has no setter; set it via the JPA field for assertions. */
  private static Partner withId(Partner p, long id) {
    try {
      var f = Partner.class.getDeclaredField("id");
      f.setAccessible(true);
      f.set(p, id);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
    return p;
  }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerServiceTest`
Expected: FAIL — `listActive` / `mapByIds` undefined.

- [ ] **Step 4: Implement `listActive` + `mapByIds` in `PartnerService`**

Add imports (`java.util.Collection`, `java.util.Map`, `java.util.function.Function`, `java.util.stream.Collectors`, `com.avicare.partner.domain.PartnerStatus`, `com.avicare.partner.domain.PartnerType`) and methods:
```java
  @Transactional(readOnly = true)
  public List<Partner> listActive(PartnerType type) {
    return partnerRepository.findByStatus(PartnerStatus.ACTIVE).stream()
        .filter(p -> type == null || p.getType() == type)
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<Long, Partner> mapByIds(Collection<Long> ids) {
    return partnerRepository.findAllById(ids).stream()
        .collect(Collectors.toMap(Partner::getId, Function.identity()));
  }
```

- [ ] **Step 5: Write `AvailablePartnerResponse`**

```java
package com.avicare.partner.dto.response;

import com.avicare.partner.domain.Partner;

/** A selectable partner in the farmer-facing directory. No internal fields (createdBy, status). */
public record AvailablePartnerResponse(
    Long id, String name, String type, String contactName, String contactPhone, String logoUrl) {

  public static AvailablePartnerResponse of(Partner p) {
    return new AvailablePartnerResponse(
        p.getId(), p.getName(), p.getType().name(), p.getContactName(), p.getContactPhone(),
        p.getLogoUrl());
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerServiceTest`
Expected: PASS.

- [ ] **Step 7: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerRepository.java \
        backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerService.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto/response/AvailablePartnerResponse.java \
        backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerServiceTest.java
git commit -m "feat(backend:partner): active-partner directory + batch id resolution

listActive(type) filters ACTIVE partners; mapByIds for batch name resolution
AvailablePartnerResponse DTO for the farmer directory"
```

---

### Task 2: `PartnerNetworkService` — gardes farm-scoped + liste détaillée

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerNetworkService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/FarmPartnerView.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerNetworkServiceTest.java` (modify — file exists)

**Interfaces:**
- Consumes: `PartnerFarmMembershipRepository`, `PartnerService.mapByIds` (Task 1), entities.
- Produces:
  - `record FarmPartnerView(PartnerFarmMembership membership, Partner partner)` (partner peut être null si introuvable, défensif).
  - `PartnerNetworkService.updateSharingScopesForFarm(Long farmId, Long membershipId, SharingScopes scopes) : PartnerFarmMembership` — 404 si l'adhésion n'appartient pas à `farmId`.
  - `PartnerNetworkService.leaveForFarm(Long farmId, Long membershipId) : PartnerFarmMembership` — 404 si mismatch.
  - `PartnerNetworkService.listForFarmDetailed(Long farmId) : List<FarmPartnerView>` — adhésions non-LEFT enrichies du partenaire.

- [ ] **Step 1: Write `FarmPartnerView`**

```java
package com.avicare.partner.service;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;

/** A farm membership joined with its partner, for the farmer-facing list. */
public record FarmPartnerView(PartnerFarmMembership membership, Partner partner) {}
```

- [ ] **Step 2: Write the failing tests in `PartnerNetworkServiceTest`**

The test file constructs the service directly (`new PartnerNetworkService(membershipRepository, inviteCodeRepository, partnerService)`). Add these tests (imports as needed: `com.avicare.partner.domain.Partner`, `com.avicare.partner.domain.PartnerType`, `com.avicare.common.api.exception.NotFoundException`, `java.util.List`, `java.util.Map`):
```java
  @Test
  void updateSharingScopesForFarmRejectsMembershipOfAnotherFarm() {
    PartnerFarmMembership other = new PartnerFarmMembership();
    other.setId(8L);
    other.setFarmId(99L); // belongs to farm 99, caller acts on farm 2
    when(membershipRepository.findById(8L)).thenReturn(java.util.Optional.of(other));

    assertThatThrownBy(
            () -> service().updateSharingScopesForFarm(2L, 8L, new SharingScopes(true, true, true, false, false)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void updateSharingScopesForFarmAppliesWhenFarmMatches() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setFarmId(2L);
    when(membershipRepository.findById(8L)).thenReturn(java.util.Optional.of(m));
    when(membershipRepository.save(any(PartnerFarmMembership.class))).thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership out =
        service().updateSharingScopesForFarm(2L, 8L, new SharingScopes(false, true, false, true, false));

    assertThat(out.isShareActivity()).isFalse();
    assertThat(out.isShareSalesVolume()).isTrue();
    assertThat(out.isShareFinances()).isFalse();
  }

  @Test
  void leaveForFarmRejectsMembershipOfAnotherFarm() {
    PartnerFarmMembership other = new PartnerFarmMembership();
    other.setId(8L);
    other.setFarmId(99L);
    when(membershipRepository.findById(8L)).thenReturn(java.util.Optional.of(other));

    assertThatThrownBy(() -> service().leaveForFarm(2L, 8L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void leaveForFarmSetsLeftWhenFarmMatches() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setFarmId(2L);
    when(membershipRepository.findById(8L)).thenReturn(java.util.Optional.of(m));
    when(membershipRepository.save(any(PartnerFarmMembership.class))).thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership out = service().leaveForFarm(2L, 8L);

    assertThat(out.getStatus()).isEqualTo(MembershipStatus.LEFT);
    assertThat(out.getLeftAt()).isNotNull();
  }

  @Test
  void listForFarmDetailedJoinsPartner() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setPartnerId(3L);
    m.setFarmId(2L);
    m.setStatus(MembershipStatus.CONFIRMED);
    Partner p = new Partner();
    p.setName("Provendier X");
    p.setType(PartnerType.FEED_SUPPLIER);
    when(membershipRepository.findByFarmIdAndStatusNot(2L, MembershipStatus.LEFT)).thenReturn(List.of(m));
    when(partnerService.mapByIds(List.of(3L))).thenReturn(Map.of(3L, p));

    var views = service().listForFarmDetailed(2L);

    assertThat(views).hasSize(1);
    assertThat(views.get(0).membership().getId()).isEqualTo(8L);
    assertThat(views.get(0).partner().getName()).isEqualTo("Provendier X");
  }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerNetworkServiceTest`
Expected: FAIL — new methods undefined.

- [ ] **Step 4: Implement the three methods in `PartnerNetworkService`**

Add imports (`com.avicare.partner.domain.Partner`, `java.util.Map`) and methods:
```java
  @Transactional
  public PartnerFarmMembership updateSharingScopesForFarm(
      Long farmId, Long membershipId, SharingScopes scopes) {
    PartnerFarmMembership m = loadForFarm(farmId, membershipId);
    m.setShareActivity(scopes.activity());
    m.setShareFlockHealth(scopes.flockHealth());
    m.setShareFeedConsumption(scopes.feedConsumption());
    m.setShareSalesVolume(scopes.salesVolume());
    m.setShareFinances(scopes.finances());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership leaveForFarm(Long farmId, Long membershipId) {
    PartnerFarmMembership m = loadForFarm(farmId, membershipId);
    m.setStatus(MembershipStatus.LEFT);
    m.setLeftAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional(readOnly = true)
  public List<FarmPartnerView> listForFarmDetailed(Long farmId) {
    List<PartnerFarmMembership> memberships =
        membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT);
    List<Long> partnerIds = memberships.stream().map(PartnerFarmMembership::getPartnerId).distinct().toList();
    Map<Long, Partner> byId = partnerService.mapByIds(partnerIds);
    return memberships.stream()
        .map(m -> new FarmPartnerView(m, byId.get(m.getPartnerId())))
        .toList();
  }

  /** Loads a membership and enforces it belongs to {@code farmId} (else 404 — no cross-farm leak). */
  private PartnerFarmMembership loadForFarm(Long farmId, Long membershipId) {
    PartnerFarmMembership m = load(membershipId);
    if (!m.getFarmId().equals(farmId)) {
      throw NotFoundException.of("PartnerFarmMembership", membershipId);
    }
    return m;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerNetworkServiceTest`
Expected: PASS.

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerNetworkService.java \
        backend/avicare-app/src/main/java/com/avicare/partner/service/FarmPartnerView.java \
        backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerNetworkServiceTest.java
git commit -m "feat(backend:partner): farm-scoped membership guards + detailed farm list

updateSharingScopesForFarm/leaveForFarm reject cross-farm membership ids (404)
listForFarmDetailed joins each membership with its partner (name/type)"
```

---

### Task 3: Enrichir `PartnerFacade.partnersForFarm` (dette name/type)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerFacadeImplTest.java` (modify — file exists)

**Interfaces:**
- Consumes: `PartnerFarmMembershipRepository`, `PartnerService.mapByIds` (Task 1).
- Produces: `PartnerFacadeImpl.partnersForFarm` renvoie désormais `PartnerLink` avec `partnerName`/`partnerType` remplis (au lieu de null).

- [ ] **Step 1: Write the failing test**

Add to `PartnerFacadeImplTest` (the class currently builds `new PartnerFacadeImpl(membershipRepository)` — this test adds the `PartnerService` collaborator; add `@Mock PartnerService partnerService;` field and update the constructor calls in existing tests to `new PartnerFacadeImpl(membershipRepository, partnerService)`):
```java
  @Test
  void partnersForFarmResolvesNameAndType() {
    PartnerFarmMembership m = membership(10L, MembershipStatus.CONFIRMED);
    m.setId(8L);
    m.setPartnerId(3L);
    com.avicare.partner.domain.Partner p = new com.avicare.partner.domain.Partner();
    p.setName("Provendier X");
    p.setType(com.avicare.partner.domain.PartnerType.FEED_SUPPLIER);
    when(membershipRepository.findByFarmIdAndStatusNot(10L, MembershipStatus.LEFT))
        .thenReturn(java.util.List.of(m));
    when(partnerService.mapByIds(java.util.List.of(3L)))
        .thenReturn(java.util.Map.of(3L, p));

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository, partnerService);

    var links = facade.partnersForFarm(10L);
    assertThat(links).hasSize(1);
    assertThat(links.get(0).partnerName()).isEqualTo("Provendier X");
    assertThat(links.get(0).partnerType()).isEqualTo("FEED_SUPPLIER");
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerFacadeImplTest`
Expected: FAIL — constructor arity / null name.

- [ ] **Step 3: Implement the enrichment**

Inject `PartnerService` and resolve names in `partnersForFarm`:
```java
  private final PartnerFarmMembershipRepository membershipRepository;
  private final PartnerService partnerService;

  // ... farmIdsInNetwork / sharedScopes unchanged ...

  @Override
  @Transactional(readOnly = true)
  public List<PartnerLink> partnersForFarm(Long farmId) {
    var memberships = membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT);
    var byId =
        partnerService.mapByIds(
            memberships.stream().map(PartnerFarmMembership::getPartnerId).distinct().toList());
    return memberships.stream()
        .map(
            m -> {
              var p = byId.get(m.getPartnerId());
              return new PartnerLink(
                  m.getPartnerId(),
                  p == null ? null : p.getName(),
                  p == null ? null : p.getType().name(),
                  m.getId(),
                  m.getStatus().name());
            })
        .toList();
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerFacadeImplTest`
Expected: PASS (existing tests still green with the updated constructor).

- [ ] **Step 5: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerFacadeImpl.java \
        backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerFacadeImplTest.java
git commit -m "feat(backend:partner): resolve partner name/type in partnersForFarm

pays the documented null debt via PartnerService.mapByIds"
```

---

### Task 4: `FarmerPartnerController` + DTOs + IT DB-less

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/DeclarePartnerRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/JoinNetworkRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/UpdateSharingRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/FarmPartnerResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/controller/FarmerPartnerController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/controller/FarmerPartnerControllerIT.java`

**Interfaces:**
- Consumes: `PartnerService.listActive`/`.get`, `PartnerNetworkService.declareSupplier`/`.joinViaCode`/`.updateSharingScopesForFarm`/`.leaveForFarm`/`.listForFarmDetailed`, `SharingScopes`, `TenancyContext.currentUserId()`.
- Produces: REST endpoints under `/api/v1/farms/{farmId}/partners`.

- [ ] **Step 1: Write the request/response records**

`DeclarePartnerRequest.java`:
```java
package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotNull;

/** Farmer declares an existing partner as their supplier/vet. */
public record DeclarePartnerRequest(@NotNull Long partnerId) {}
```
`JoinNetworkRequest.java`:
```java
package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Farmer joins a partner network via an invite code. */
public record JoinNetworkRequest(@NotBlank String code) {}
```
`UpdateSharingRequest.java`:
```java
package com.avicare.partner.dto.request;

/** Farmer sets the five sharing sliders for a membership. */
public record UpdateSharingRequest(
    boolean activity,
    boolean flockHealth,
    boolean feedConsumption,
    boolean salesVolume,
    boolean finances) {}
```
`FarmPartnerResponse.java`:
```java
package com.avicare.partner.dto.response;

import com.avicare.partner.service.FarmPartnerView;

/** A farm's membership as shown to the farmer (partner identity + sharing sliders). */
public record FarmPartnerResponse(
    Long membershipId,
    Long partnerId,
    String partnerName,
    String partnerType,
    String status,
    String origin,
    boolean shareActivity,
    boolean shareFlockHealth,
    boolean shareFeedConsumption,
    boolean shareSalesVolume,
    boolean shareFinances) {

  public static FarmPartnerResponse of(FarmPartnerView v) {
    var m = v.membership();
    var p = v.partner();
    return new FarmPartnerResponse(
        m.getId(),
        m.getPartnerId(),
        p == null ? null : p.getName(),
        p == null ? null : p.getType().name(),
        m.getStatus().name(),
        m.getOrigin().name(),
        m.isShareActivity(),
        m.isShareFlockHealth(),
        m.isShareFeedConsumption(),
        m.isShareSalesVolume(),
        m.isShareFinances());
  }
}
```

- [ ] **Step 2: Write the failing controller IT (DB-less)**

`FarmerPartnerControllerIT.java` — copy the DB-less harness from `DashboardControllerIT` verbatim for: the class annotations (`@SpringBootTest(webEnvironment = MOCK)`, `@AutoConfigureMockMvc`, `@ActiveProfiles("test")`), the **entire `@MockitoBean` repository block** (lines ~105-177 of `DashboardControllerIT`), the RSA key material helpers (`generateKeys`/`privatePem`/`publicPem`/`wrap`), and the `@DynamicPropertySource jwtKeys`. Then replace the domain-specific parts:

```java
package com.avicare.partner.controller;

// ... copy the same imports as DashboardControllerIT for JwtService, AvicarePrincipal,
// Membership, FarmRole, UserRole, MockMvc, SpringBootTest, AutoConfigureMockMvc, ActiveProfiles,
// DynamicProperty*, MockitoBean, and the full repository import list ...
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.exception.DuplicateMembershipException;
import com.avicare.partner.exception.InviteCodeInvalidException;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FarmerPartnerControllerIT {

  private static final KeyPair KEYS = generateKeys();
  private static final Long FARM_ID = 42L;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;

  // Mock the two partner services directly (DB-less); the real FarmAccessChecker enforces the gate.
  @MockitoBean private PartnerService partnerService;
  @MockitoBean private PartnerNetworkService partnerNetworkService;

  // <<< paste the FULL @MockitoBean repository block from DashboardControllerIT here >>>
  // <<< paste the @DynamicPropertySource jwtKeys(...) and the RSA helpers here >>>

  private PartnerFarmMembership sampleMembership() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setPartnerId(3L);
    m.setFarmId(FARM_ID);
    m.setStatus(MembershipStatus.DECLARED);
    m.setOrigin(MembershipOrigin.FARMER_DECLARED);
    return m;
  }

  @Test
  void noToken_returns401() throws Exception {
    mockMvc.perform(get("/api/v1/farms/" + FARM_ID + "/partners")).andExpect(status().isUnauthorized());
  }

  @Test
  void nonMember_returns403() throws Exception {
    // token with a membership for a DIFFERENT farm → @farmAccess.hasAccess(42) false
    String token = token(new Membership(999L, FarmRole.OWNER, List.of("*")));
    mockMvc
        .perform(get("/api/v1/farms/" + FARM_ID + "/partners").header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden());
  }

  @Test
  void member_list_returns200() throws Exception {
    when(partnerNetworkService.listForFarmDetailed(FARM_ID)).thenReturn(List.of());
    String token = token(new Membership(FARM_ID, FarmRole.FARMER, List.of("*")));
    mockMvc
        .perform(get("/api/v1/farms/" + FARM_ID + "/partners").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
  }

  @Test
  void farmerRole_declare_returns403() throws Exception {
    // FARMER is neither OWNER nor MANAGER → write gate rejects
    String token = token(new Membership(FARM_ID, FarmRole.FARMER, List.of("*")));
    mockMvc
        .perform(
            post("/api/v1/farms/" + FARM_ID + "/partners/declare")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content("{\"partnerId\":3}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void owner_declare_returns200() throws Exception {
    when(partnerNetworkService.declareSupplier(anyLong(), anyLong(), anyLong()))
        .thenReturn(sampleMembership());
    String token = token(new Membership(FARM_ID, FarmRole.OWNER, List.of("*")));
    mockMvc
        .perform(
            post("/api/v1/farms/" + FARM_ID + "/partners/declare")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content("{\"partnerId\":3}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.membershipId").value(8));
  }

  @Test
  void owner_joinWithBadCode_returns422() throws Exception {
    when(partnerNetworkService.joinViaCode(any(), anyLong(), anyLong()))
        .thenThrow(new InviteCodeInvalidException("Unknown invite code"));
    String token = token(new Membership(FARM_ID, FarmRole.OWNER, List.of("*")));
    mockMvc
        .perform(
            post("/api/v1/farms/" + FARM_ID + "/partners/join")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content("{\"code\":\"NOPE\"}"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void owner_declareDuplicate_returns409() throws Exception {
    when(partnerNetworkService.declareSupplier(anyLong(), anyLong(), anyLong()))
        .thenThrow(new DuplicateMembershipException(3L, FARM_ID));
    String token = token(new Membership(FARM_ID, FarmRole.OWNER, List.of("*")));
    mockMvc
        .perform(
            post("/api/v1/farms/" + FARM_ID + "/partners/declare")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content("{\"partnerId\":3}"))
        .andExpect(status().isConflict());
  }

  private String token(Membership membership) {
    return jwtService.generateAccessToken(
        new AvicarePrincipal(10L, "owner@avicare.com", UserRole.USER, List.of(membership)));
  }
}
```

> The `@MockitoBean` repo block makes the `test`-profile context boot without JPA; the two partner services are mocked so no repository stubbing is needed. `FarmAccessChecker` is real and reads the forged JWT's memberships — that is what makes the 403/200 gate assertions meaningful DB-less.

- [ ] **Step 3: Run the IT to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=FarmerPartnerControllerIT`
Expected: FAIL — `FarmerPartnerController` does not exist (404s / no bean).

- [ ] **Step 4: Write `FarmerPartnerController`**

```java
package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.dto.request.DeclarePartnerRequest;
import com.avicare.partner.dto.request.JoinNetworkRequest;
import com.avicare.partner.dto.request.UpdateSharingRequest;
import com.avicare.partner.dto.response.AvailablePartnerResponse;
import com.avicare.partner.dto.response.FarmPartnerResponse;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
import com.avicare.partner.service.SharingScopes;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farmer-facing partner network surface. Reads need farm membership ({@code @farmAccess.hasAccess});
 * writes are OWNER/MANAGER only. The farmer owns their data: sharing sliders default to operational
 * ON / money OFF and the farm can leave a network at any time.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/partners")
@RequiredArgsConstructor
public class FarmerPartnerController {

  private final PartnerService partnerService;
  private final PartnerNetworkService partnerNetworkService;

  @GetMapping("/available")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<AvailablePartnerResponse>> available(
      @PathVariable Long farmId, @RequestParam(required = false) PartnerType type) {
    return ApiResponse.of(
        partnerService.listActive(type).stream().map(AvailablePartnerResponse::of).toList());
  }

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<FarmPartnerResponse>> mine(@PathVariable Long farmId) {
    return ApiResponse.of(
        partnerNetworkService.listForFarmDetailed(farmId).stream()
            .map(FarmPartnerResponse::of)
            .toList());
  }

  @PostMapping("/declare")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> declare(
      @PathVariable Long farmId, @RequestBody @Valid DeclarePartnerRequest req) {
    var m =
        partnerNetworkService.declareSupplier(
            req.partnerId(), farmId, TenancyContext.currentUserId());
    return ApiResponse.of(
        FarmPartnerResponse.of(new com.avicare.partner.service.FarmPartnerView(m, null)));
  }

  @PostMapping("/join")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> join(
      @PathVariable Long farmId, @RequestBody @Valid JoinNetworkRequest req) {
    var m =
        partnerNetworkService.joinViaCode(req.code(), farmId, TenancyContext.currentUserId());
    return ApiResponse.of(
        FarmPartnerResponse.of(new com.avicare.partner.service.FarmPartnerView(m, null)));
  }

  @PutMapping("/{membershipId}/scopes")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> updateScopes(
      @PathVariable Long farmId,
      @PathVariable Long membershipId,
      @RequestBody @Valid UpdateSharingRequest req) {
    var m =
        partnerNetworkService.updateSharingScopesForFarm(
            farmId,
            membershipId,
            new SharingScopes(
                req.activity(),
                req.flockHealth(),
                req.feedConsumption(),
                req.salesVolume(),
                req.finances()));
    return ApiResponse.of(
        FarmPartnerResponse.of(new com.avicare.partner.service.FarmPartnerView(m, null)));
  }

  @DeleteMapping("/{membershipId}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> leave(
      @PathVariable Long farmId, @PathVariable Long membershipId) {
    var m = partnerNetworkService.leaveForFarm(farmId, membershipId);
    return ApiResponse.of(
        FarmPartnerResponse.of(new com.avicare.partner.service.FarmPartnerView(m, null)));
  }
}
```

> Note: the write endpoints return a `FarmPartnerResponse` with `partnerName=null` (the entity write path doesn't reload the partner); the front already knows the partner it just acted on, and re-fetches `GET /partners` (which is enriched) after a mutation. Keep it simple — do not add a partner reload on the write path.

- [ ] **Step 5: Run the IT to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=FarmerPartnerControllerIT`
Expected: PASS (401 no-token, 403 non-member, 403 FARMER write, 200 owner declare, 422 bad code, 409 duplicate, 200 list).

- [ ] **Step 6: Full backend gate + spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app && ./mvnw clean verify
git add backend/avicare-app/src/main/java/com/avicare/partner/dto \
        backend/avicare-app/src/main/java/com/avicare/partner/controller/FarmerPartnerController.java \
        backend/avicare-app/src/test/java/com/avicare/partner/controller/FarmerPartnerControllerIT.java
git commit -m "feat(backend:partner): farmer-facing partner controller

/api/v1/farms/{farmId}/partners: directory, my-partners, declare, join, scopes, leave
reads gated on farm membership, writes OWNER/MANAGER; DB-less controller IT"
```

---

### Task 5: Web — slice RTK Query `partnersApi`

**Files:**
- Modify: `web/src/store/api/baseApi.ts` (add the `"Partner"` tag)
- Create: `web/src/store/api/partnersApi.ts`
- Create: `web/src/store/api/partnersApi.test.ts`
- Modify: `web/src/types/index.ts` (or the project's types barrel — confirm path) to add partner types

**Interfaces:**
- Produces hooks: `useGetAvailablePartnersQuery`, `useGetMyPartnersQuery`, `useDeclarePartnerMutation`, `useJoinNetworkMutation`, `useUpdateSharingMutation`, `useLeaveNetworkMutation`.
- Types: `AvailablePartner`, `FarmPartner`, `SharingScopes`.

- [ ] **Step 1: Add the `"Partner"` tag to `baseApi.ts`**

In the `tagTypes` array (end of the list), add `"Partner",`.

- [ ] **Step 2: Add types**

In the web types barrel (mirror the pattern used by `notificationsApi`'s types), add:
```ts
export interface AvailablePartner {
  id: number;
  name: string;
  type: "FEED_SUPPLIER" | "VET";
  contactName: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
}

export interface FarmPartner {
  membershipId: number;
  partnerId: number;
  partnerName: string | null;
  partnerType: "FEED_SUPPLIER" | "VET";
  status: "DECLARED" | "CONFIRMED" | "LEFT";
  origin: "MANUAL_ADMIN" | "INVITE_CODE" | "FARMER_DECLARED";
  shareActivity: boolean;
  shareFlockHealth: boolean;
  shareFeedConsumption: boolean;
  shareSalesVolume: boolean;
  shareFinances: boolean;
}

export interface SharingScopes {
  activity: boolean;
  flockHealth: boolean;
  feedConsumption: boolean;
  salesVolume: boolean;
  finances: boolean;
}
```

- [ ] **Step 3: Write the slice test (failing)**

`partnersApi.test.ts` — mirror `notificationsApi.test.ts` structure (store with `baseApi.reducer`/middleware, `fetch` mock returning `{ data }`), asserting URL + method for each endpoint. Minimal example:
```ts
import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./baseApi";
import { partnersApi } from "./partnersApi";

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
  });
}

it("GET my partners hits the farm-scoped path", async () => {
  const store = makeStore();
  const spy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

  await store.dispatch(partnersApi.endpoints.getMyPartners.initiate({ farmId: 42 }));

  expect(spy).toHaveBeenCalledWith(
    expect.stringContaining("/api/v1/farms/42/partners"),
    expect.objectContaining({ method: "GET" }),
  );
  spy.mockRestore();
});

it("declare posts to /declare", async () => {
  const store = makeStore();
  const spy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));

  await store.dispatch(
    partnersApi.endpoints.declarePartner.initiate({ farmId: 42, partnerId: 3 }),
  );

  expect(spy).toHaveBeenCalledWith(
    expect.stringContaining("/api/v1/farms/42/partners/declare"),
    expect.objectContaining({ method: "POST" }),
  );
  spy.mockRestore();
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd web && npm test -- partnersApi`
Expected: FAIL — `partnersApi` not found.

- [ ] **Step 5: Write `partnersApi.ts`**

```ts
import { baseApi } from "./baseApi";
import type { AvailablePartner, FarmPartner, SharingScopes } from "@/types";

interface Envelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/partners`;

export const partnersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAvailablePartners: build.query<
      AvailablePartner[],
      { farmId: number; type?: "FEED_SUPPLIER" | "VET" }
    >({
      query: ({ farmId, type }) =>
        `${base(farmId)}/available${type ? `?type=${type}` : ""}`,
      transformResponse: (r: Envelope<AvailablePartner[]>) => r.data,
      providesTags: [{ type: "Partner", id: "directory" }],
    }),

    getMyPartners: build.query<FarmPartner[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: Envelope<FarmPartner[]>) => r.data,
      providesTags: [{ type: "Partner", id: "mine" }],
    }),

    declarePartner: build.mutation<FarmPartner, { farmId: number; partnerId: number }>({
      query: ({ farmId, partnerId }) => ({
        url: `${base(farmId)}/declare`,
        method: "POST",
        body: { partnerId },
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),

    joinNetwork: build.mutation<FarmPartner, { farmId: number; code: string }>({
      query: ({ farmId, code }) => ({
        url: `${base(farmId)}/join`,
        method: "POST",
        body: { code },
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),

    updateSharing: build.mutation<
      FarmPartner,
      { farmId: number; membershipId: number; scopes: SharingScopes }
    >({
      query: ({ farmId, membershipId, scopes }) => ({
        url: `${base(farmId)}/${membershipId}/scopes`,
        method: "PUT",
        body: scopes,
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),

    leaveNetwork: build.mutation<FarmPartner, { farmId: number; membershipId: number }>({
      query: ({ farmId, membershipId }) => ({
        url: `${base(farmId)}/${membershipId}`,
        method: "DELETE",
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),
  }),
});

export const {
  useGetAvailablePartnersQuery,
  useGetMyPartnersQuery,
  useDeclarePartnerMutation,
  useJoinNetworkMutation,
  useUpdateSharingMutation,
  useLeaveNetworkMutation,
} = partnersApi;
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd web && npm test -- partnersApi`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/store/api/baseApi.ts web/src/store/api/partnersApi.ts web/src/store/api/partnersApi.test.ts web/src/types
git commit -m "feat(web:partner): RTK Query slice for farmer partner surface

available/mine/declare/join/updateSharing/leave; Partner cache tag"
```

---

### Task 6: Web — page « Mon réseau » sous Réglages + entrée de nav

**Files:**
- Create: `web/src/app/(dashboard)/reglages/partenaires/page.tsx`
- Create: `web/src/components/settings/PartnerNetwork.tsx` (composant client principal)
- Create: `web/src/components/settings/PartnerNetwork.test.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx` (ajouter l'entrée « Mon réseau »)

**Interfaces:**
- Consumes: hooks de Task 5, `apiError` helper (`web/src/lib/apiError.ts`) pour mapper 422/409/404.
- Uses the active farm id from wherever the app sources it today (mirror how `reglages/notifications` obtains `farmId`).

- [ ] **Step 1: Read the sibling page for the exact farm-id + layout pattern**

Read `web/src/app/(dashboard)/reglages/notifications/page.tsx` and its component to copy: how the active `farmId` is obtained, the page shell/heading, and the MUI card/list idioms. Follow that pattern exactly (do not invent a new farm-id source).

- [ ] **Step 2: Write the component test (failing)**

`PartnerNetwork.test.tsx` — render `<PartnerNetwork farmId={42} />` inside a Redux `<Provider>` (mirror an existing settings component test, e.g. a members/notifications test), with `fetch` mocked to return `{ data: [] }` for `GET /partners`, and assert the empty state renders both actions:
```tsx
it("shows the empty state with join + browse actions", async () => {
  // ... render with mocked fetch returning { data: [] } ...
  expect(await screen.findByText(/aucun réseau/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /rejoindre par code/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /parcourir les partenaires/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd web && npm test -- PartnerNetwork`
Expected: FAIL — component not found.

- [ ] **Step 4: Implement `PartnerNetwork.tsx`**

Client component (`"use client"`). Structure:
- `const { data: mine = [] } = useGetMyPartnersQuery({ farmId });`
- **Empty state** (`mine.length === 0`): explanatory copy « Vous ne faites partie d'aucun réseau. » + two buttons opening the Join dialog and the Directory dialog.
- **List**: one MUI `Card` per `FarmPartner` — title `partnerName`, a `Chip` for `partnerType` (Provendier/Vétérinaire), a status `Chip` (`DECLARED` → « ⏳ En attente », `CONFIRMED` → « ✓ Confirmé »). Below, **five `Switch` toggles** grouped in two `Stack`s labelled « Opérationnel » (activity, flockHealth, feedConsumption) and « Commercial & Finances » (salesVolume, finances) with a helper caption warning that finances are private by default. Each toggle calls `updateSharing({ farmId, membershipId, scopes })` with the full current scopes and the flipped field (optimistic: flip local state, revert in the mutation's `catch`). A `[Quitter le réseau]` button opens a confirm `Dialog` calling `leaveNetwork`.
- **Directory dialog**: `useGetAvailablePartnersQuery({ farmId, type })` with a type filter (`ToggleButtonGroup`: Tous / Provendier / Vétérinaire); each row has a `[Déclarer]` button calling `declarePartner`, mapping 409 to « Vous faites déjà partie de ce réseau. ».
- **Join dialog**: a `TextField` for the code + submit calling `joinNetwork`, mapping 422 to « Code invalide, expiré ou épuisé. ».
- Write actions are disabled if the user is not OWNER/MANAGER (mirror how other settings components read the current farm role; the backend remains the authority).

Keep the file focused on this one surface; extract the two dialogs as local subcomponents in the same file if it stays readable, or sibling files if it grows past ~250 lines.

- [ ] **Step 5: Implement the route page**

`page.tsx`:
```tsx
import PartnerNetwork from "@/components/settings/PartnerNetwork";
// obtain farmId exactly like reglages/notifications/page.tsx does
export default function PartenairesPage() {
  // ... derive farmId ...
  return <PartnerNetwork farmId={farmId} />;
}
```

- [ ] **Step 6: Add the nav entry in `Sidebar.tsx`**

Add « Mon réseau » under the Réglages group pointing to `/reglages/partenaires` (follow the existing Réglages sub-entries pattern; use an appropriate MUI icon such as `HandshakeOutlined`). Keep `Sidebar.test.tsx` green (update it if it asserts the entry list).

- [ ] **Step 7: Run the front gates**

Run: `cd web && npm test -- PartnerNetwork && npm run lint && npm run build`
Expected: PASS / clean lint / successful build.

- [ ] **Step 8: Commit**

```bash
git add web/src/app/(dashboard)/reglages/partenaires web/src/components/settings/PartnerNetwork.tsx web/src/components/settings/PartnerNetwork.test.tsx web/src/components/layout/Sidebar.tsx web/src/components/layout/Sidebar.test.tsx
git commit -m "feat(web:partner): Mon réseau settings page (declare/join/scopes/leave)

directory + join-by-code dialogs, sharing sliders (operational/finances groups),
leave-network confirm; nav entry under Réglages"
```

---

### Task 7: Mobile — slice RTK Query `partnersApi`

**Files:**
- Modify: `mobile/src/store/api/baseApi.ts` (add the `"Partner"` tag if the mobile baseApi maintains a tagTypes list)
- Create: `mobile/src/store/api/partnersApi.ts`
- Create: `mobile/src/store/api/__tests__/partnersApi.test.ts`
- Modify: `mobile/src/types` barrel (add the same `AvailablePartner`/`FarmPartner`/`SharingScopes` types as web)

**Interfaces:**
- Same hooks as web (Task 5), mobile client.

- [ ] **Step 1: Read `mobile/src/store/api/baseApi.ts`**

Confirm whether it keeps a `tagTypes` array; if so add `'Partner'`. Confirm the `@/types` import alias used by `notificationsApi.ts`.

- [ ] **Step 2: Add the mobile types** (same shapes as web Task 5, Step 2) to the mobile types barrel.

- [ ] **Step 3: Write `partnersApi.ts`** — identical endpoint shapes to web Task 5 Step 5, but import style mirroring `mobile/src/store/api/notificationsApi.ts` (single quotes, `from './baseApi'`, `from '@/types'`).

- [ ] **Step 4: Write `__tests__/partnersApi.test.ts`** — mirror an existing mobile api test (e.g. the pattern used across `mobile/src/store/api/__tests__`), asserting the farm-scoped URL + method for `getMyPartners` and `declarePartner`.

- [ ] **Step 5: Run the mobile gates**

Run: `cd mobile && npx tsc --noEmit && npm test -- partnersApi`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/store/api/baseApi.ts mobile/src/store/api/partnersApi.ts mobile/src/store/api/__tests__/partnersApi.test.ts mobile/src/types
git commit -m "feat(mobile:partner): RTK Query slice for farmer partner surface"
```

---

### Task 8: Mobile — écran « Mon réseau » sous Réglages

**Files:**
- Create: `mobile/app/(field)/reglages/partenaires.tsx`
- Create: `mobile/app/(field)/reglages/__tests__/partenaires.test.tsx`
- Modify: `mobile/app/(field)/reglages/index.tsx` (ajouter l'entrée « Mon réseau »)

**Interfaces:**
- Consumes: hooks de Task 7.

- [ ] **Step 1: Read the sibling screen for pattern**

Read `mobile/app/(field)/reglages/notifications.tsx` and `mobile/app/(field)/reglages/index.tsx` to copy: how the active `farmId` is sourced, the screen shell, the settings-row navigation idiom, and the design-system components used.

- [ ] **Step 2: Write the screen test (failing)**

`__tests__/partenaires.test.tsx` — RNTL 14 gotchas apply: `render` is async (`await`), import the screen by **relative path**, flush with `act()` after any `fireEvent.press`. Mock the api hooks (or `fetch`) to return an empty list and assert the empty state + the two actions render:
```tsx
it("renders the empty state with join and browse actions", async () => {
  const screen = await render(<Partenaires />); // relative import
  expect(await screen.findByText(/aucun réseau/i)).toBeTruthy();
  expect(screen.getByText(/rejoindre par code/i)).toBeTruthy();
  expect(screen.getByText(/parcourir les partenaires/i)).toBeTruthy();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd mobile && npm test -- partenaires`
Expected: FAIL — screen not found.

- [ ] **Step 4: Implement `partenaires.tsx`**

Mirror the web component's behaviour with mobile design-system components (bold cards, RN `Switch` for the five sliders grouped Opérationnel / Commercial & Finances, a modal/sheet for the directory with type filter, a modal for the join code, a confirm for leave). Same optimistic toggle behaviour. Same 422/409 friendly messages (via the mobile toast/inline-error pattern used by sibling screens).

- [ ] **Step 5: Add the entry in `reglages/index.tsx`**

Add a settings row « Mon réseau » navigating to `/(field)/reglages/partenaires`, matching the existing rows.

- [ ] **Step 6: Run the mobile gates**

Run: `cd mobile && npx tsc --noEmit && npm test -- partenaires`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(field)/reglages/partenaires.tsx mobile/app/(field)/reglages/__tests__/partenaires.test.tsx mobile/app/(field)/reglages/index.tsx
git commit -m "feat(mobile:partner): Mon réseau screen (declare/join/scopes/leave)"
```

---

### Task 9: Validation complète + PR

- [ ] **Step 1: Backend full reactor build**

Run: `cd backend && ./mvnw clean verify`
Expected: BUILD SUCCESS (DB-less + Mockito suites green; Testcontainer ITs run in CI only).

- [ ] **Step 2: Boot + smoke the new endpoints**

Run: `make backend-run`, then with an OWNER token: `GET /api/v1/farms/{farmId}/partners` → `{"data":[]}` ; `GET .../partners/available` → `{"data":[...]}`. Stop the app.

- [ ] **Step 3: Web gates**

Run: `cd web && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Mobile gates**

Run: `cd mobile && npx tsc --noEmit && npm test`
Expected: all green.

- [ ] **Step 5: Push + PR**

```bash
git push -u origin feat/partner-farmer-surfaces
gh pr create --fill --base main
gh pr checks --watch
```
Expected: CI green (incl. Testcontainer ITs). Ne PAS merger sur CI rouge. Merge : `gh pr merge --rebase --delete-branch`.

---

## Notes d'exécution

- **Branche** : `feat/partner-farmer-surfaces` (déjà créée, spec committé dessus).
- **Ordre** : 1→9 strict — le web (5-6) et le mobile (7-8) dépendent des endpoints backend (1-4). Backend d'abord.
- **Aucun nouveau repository** → contrairement au socle (PR #215), **rien à câbler** dans les 4 contextes DB-less (`SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`, `NotificationControllerIT`).
- **Après un merge de `main`** pendant le dev : si l'app démarre en erreur alors que le build passe → `./mvnw clean install` (bytecode incrémental périmé, footgun connu).
- **Confirmation d'adhésion** hors périmètre : la déclaration/join reste `DECLARED` ; la confirmation est le fait du partenaire/admin (chemin `AdminPartnerController` + `PartnerNetworkService.confirm` existants).
