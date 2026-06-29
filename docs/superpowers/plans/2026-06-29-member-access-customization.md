# Gestion des comptes membres (création + accès) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'éleveur de **créer le compte** d'un membre (nom + numéro + email + rôle + accès personnalisables, mot de passe temporaire généré) et de le **modifier** (rôle, accès, reset mot de passe, activation, retrait), en respectant le pattern RBAC existant.

**Architecture:** Backend — `identity` provisionne l'utilisateur (`IdentityFacade.provisionUser`/`resetPassword`), `tenancy` orchestre (`MembershipService.createMemberAccount` génère le mot de passe temporaire + crée la membership), `common-security` fournit le catalogue/validation de permissions. Frontend — `PermissionEditor` partagé + `AddMemberDialog` (formulaire + révélation du mot de passe) + `EditMemberDialog`, fidèles aux 2 écrans Stitch. Aucune migration.

**Tech Stack:** Spring Boot 3.4 / Java 21 / MapStruct / Lombok / BCrypt(12) ; Next.js 16 / MUI v7 / RTK Query / react-hook-form + zod / Vitest.

## Global Constraints

- **Aucune migration** : `users.full_name/phone`, `user_farms.role/permissions/is_active` existent déjà.
- Cross-context **uniquement via façade** : `tenancy` provisionne l'utilisateur via `IdentityFacade` (jamais d'accès direct aux entités `identity`).
- `@Service` + `@RequiredArgsConstructor` ; DTO = records Java 21 ; exceptions héritent de `BusinessException` ; messages techniques en anglais. BCrypt `strength=12` (bean `PasswordEncoder` existant).
- **Rôles assignables = MANAGER, FARMER, VETERINARIAN, BUYER** (OWNER refusé en création → `BusinessRuleException` 422, et exclu de l'UI).
- **Mot de passe temporaire** : généré, renvoyé **une seule fois** dans la réponse, jamais re-consultable, jamais loggé.
- Permissions : convention `resource:verb` / `resource:*` / `*` ; non personnalisé → `role.defaultPermissions()` ; personnalisé → liste explicite validée.
- Endpoints membres sous `/api/v1/farms/{farmId}/users` (chemin existant). Gating OWNER/MANAGER via `@farmAccess` (inchangé).
- Frontend : RTK Query existant (`baseApi.injectEndpoints`, `transformResponse: r=>r.data`), couleurs `@/theme/tokens` (vert `colors.primary`, orange `colors.accent` = CTA), pas de hex en dur, pas de `any`, Rules of Hooks. Designs Stitch : Création `4524f35defdd4c67b9910712c68ccca2`, Modification `8d615c9354094c918abc7fe99dd5f493`.
- Commits Conventional Commits, scope par contexte (`feat(identity:)`, `feat(tenancy:)`, `feat(web:)`), **sans signature Claude/IA**. Backend avant commit : `./mvnw -q spotless:apply -pl avicare-app`. `*IT` = CI (Docker local KO) → `test-compile` local. Web : `npx tsc --noEmit && npm run lint && npx vitest run && npx next build`.

---

## File Structure

**Backend**
- `common-security/.../access/PermissionConstants.java` (modif : helper `resources()`), `PermissionCatalog.java` (create), `PermissionValidator.java` (create) + tests.
- `identity/api/IdentityFacade.java` (+ `provisionUser`/`resetPassword`), `identity/api/dto/UserInfo.java` (+`phone`), `identity/api/dto/ProvisionUserCommand.java` (create), `identity/service/IdentityFacadeImpl.java` (impl), `identity/service/AuthService.java` (extraire `createUser`).
- `tenancy/controller/PermissionCatalogController.java` (create) + `tenancy/dto/response/PermissionCatalogResponse.java` (create).
- `tenancy/dto/request/CreateMemberRequest.java` (create), `tenancy/dto/response/CreateMemberResult.java` + `MemberResponse.java` (modif : +identité), `tenancy/dto/request/UpdateMemberRequest.java` (+`active`), `tenancy/service/MembershipService.java` (modif), `tenancy/controller/FarmMemberController.java` (modif), `common-security/.../TemporaryPasswordGenerator.java` (create) + tests.

**Frontend**
- `web/src/types/index.ts` (+ types), `web/src/store/api/permissionsApi.ts` (create), `web/src/store/api/membersApi.ts` (modif), `web/src/constants/farmRoles.ts` (+ `ASSIGNABLE_FARM_ROLES`).
- `web/src/components/farms/PermissionEditor.tsx` (create) + test, `AddMemberDialog.tsx` (create) + test, `EditMemberDialog.tsx` (create) + test, `FarmTeamTab.tsx` (modif).

---

# Phase Backend

### Task 1 : `TemporaryPasswordGenerator` + `PermissionValidator` + catalogue (common-security, TDD)

**Files:**
- Create: `backend/common/common-security/src/main/java/com/avicare/common/security/util/TemporaryPasswordGenerator.java`
- Create: `backend/common/common-security/src/main/java/com/avicare/common/security/access/PermissionCatalog.java`
- Create: `backend/common/common-security/src/main/java/com/avicare/common/security/access/PermissionValidator.java`
- Modify: `backend/common/common-security/src/main/java/com/avicare/common/security/access/PermissionConstants.java`
- Test: `backend/common/common-security/src/test/java/com/avicare/common/security/access/PermissionValidatorTest.java`, `.../util/TemporaryPasswordGeneratorTest.java`

**Interfaces:**
- Produces : `TemporaryPasswordGenerator.generate(): String` (statique) ; `PermissionCatalog.RESOURCES: List<ResourceDef{String resource,String label,List<String> verbs}>` + `PermissionCatalog.isValid(String permission): boolean` ; `PermissionValidator.validate(List<String> permissions): void` (lève `ValidationException`).

- [ ] **Step 1 : tests** `TemporaryPasswordGeneratorTest.java` :

```java
package com.avicare.common.security.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TemporaryPasswordGeneratorTest {
  @Test
  void generates_a_password_of_expected_length_without_ambiguous_chars() {
    String pw = TemporaryPasswordGenerator.generate();
    assertThat(pw).hasSize(12);
    assertThat(pw).doesNotContainAnyWhitespaces();
    // no ambiguous characters O/0/o/l/1/I
    assertThat(pw).doesNotContain("O", "0", "l", "1", "I");
  }

  @Test
  void generates_distinct_passwords() {
    assertThat(TemporaryPasswordGenerator.generate())
        .isNotEqualTo(TemporaryPasswordGenerator.generate());
  }
}
```

`PermissionValidatorTest.java` :

```java
package com.avicare.common.security.access;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ValidationException;
import java.util.List;
import org.junit.jupiter.api.Test;

class PermissionValidatorTest {
  @Test
  void accepts_known_permissions_wildcards_and_star() {
    assertThatCode(
            () ->
                PermissionValidator.validate(
                    List.of("poultry:read", "health:*", "commercial:write", "*")))
        .doesNotThrowAnyException();
  }

  @Test
  void rejects_unknown_resource_or_verb() {
    assertThatThrownBy(() -> PermissionValidator.validate(List.of("bogus:read")))
        .isInstanceOf(ValidationException.class);
    assertThatThrownBy(() -> PermissionValidator.validate(List.of("poultry:fly")))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void accepts_null_or_empty() {
    assertThatCode(() -> PermissionValidator.validate(null)).doesNotThrowAnyException();
    assertThatCode(() -> PermissionValidator.validate(List.of())).doesNotThrowAnyException();
  }
}
```

- [ ] **Step 2 : vérifier l'échec** — `cd backend && ./mvnw -q -pl common/common-security test -Dtest='TemporaryPasswordGeneratorTest,PermissionValidatorTest'` → FAIL (classes absentes).

- [ ] **Step 3 : implémenter**. `PermissionConstants.java` — ajouter en bas (avant la dernière `}`) un helper :

```java
  /** All known resources and their verbs (single source for the catalog/validator). */
  public static final java.util.Map<String, java.util.List<String>> RESOURCE_VERBS =
      java.util.Map.of(
          "poultry", java.util.List.of("read", "write", "delete"),
          "health", java.util.List.of("read", "write"),
          "commercial", java.util.List.of("read", "write"),
          "inventory", java.util.List.of("read", "write"),
          "finance", java.util.List.of("read", "write"),
          "settings", java.util.List.of("read", "write"));
```

`PermissionCatalog.java` :

```java
package com.avicare.common.security.access;

import java.util.List;
import java.util.Map;

/** Catalog of assignable permissions (resources + verbs) with FR labels. */
public final class PermissionCatalog {

  private PermissionCatalog() {}

  public record ResourceDef(String resource, String label, List<String> verbs) {}

  private static final Map<String, String> LABELS =
      Map.of(
          "poultry", "Élevage volaille",
          "health", "Sanitaire",
          "commercial", "Commercial",
          "inventory", "Stock",
          "finance", "Finance",
          "settings", "Réglages");

  /** Resources in a stable display order. */
  public static final List<ResourceDef> RESOURCES =
      List.of("poultry", "health", "commercial", "inventory", "finance", "settings").stream()
          .map(r -> new ResourceDef(r, LABELS.get(r), PermissionConstants.RESOURCE_VERBS.get(r)))
          .toList();

  /** True if {@code permission} is "*", "resource:*" or a known "resource:verb". */
  public static boolean isValid(String permission) {
    if (permission == null || permission.isBlank()) return false;
    if (permission.equals("*")) return true;
    int c = permission.indexOf(':');
    if (c <= 0 || c == permission.length() - 1) return false;
    String resource = permission.substring(0, c);
    String verb = permission.substring(c + 1);
    List<String> verbs = PermissionConstants.RESOURCE_VERBS.get(resource);
    if (verbs == null) return false;
    return verb.equals("*") || verbs.contains(verb);
  }
}
```

`PermissionValidator.java` :

```java
package com.avicare.common.security.access;

import com.avicare.common.api.exception.ValidationException;
import java.util.List;

/** Rejects any permission string not present in {@link PermissionCatalog}. */
public final class PermissionValidator {

  private PermissionValidator() {}

  public static void validate(List<String> permissions) {
    if (permissions == null) return;
    for (String p : permissions) {
      if (!PermissionCatalog.isValid(p)) {
        throw new ValidationException(
            "INVALID_PERMISSION", "Unknown permission: " + p);
      }
    }
  }
}
```

`TemporaryPasswordGenerator.java` :

```java
package com.avicare.common.security.util;

import java.security.SecureRandom;

/** Generates readable temporary passwords (no ambiguous characters). */
public final class TemporaryPasswordGenerator {

  private TemporaryPasswordGenerator() {}

  // excludes O/0/o, l/1/I to stay readable when transmitted verbally
  private static final char[] ALPHABET =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789".toCharArray();
  private static final int LENGTH = 12;
  private static final SecureRandom RANDOM = new SecureRandom();

  public static String generate() {
    StringBuilder sb = new StringBuilder(LENGTH);
    for (int i = 0; i < LENGTH; i++) {
      sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
    }
    return sb.toString();
  }
}
```

> Vérifier que `common-security` a `common-api` en dépendance (pour `ValidationException`) — c'est le cas (le module l'utilise déjà). Sinon, adapter.

- [ ] **Step 4 : vérifier le succès** — `./mvnw -q -pl common/common-security test -Dtest='TemporaryPasswordGeneratorTest,PermissionValidatorTest'` → PASS.

- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl common/common-security
git add backend/common/common-security/src/main/java/com/avicare/common/security/util/TemporaryPasswordGenerator.java backend/common/common-security/src/main/java/com/avicare/common/security/access/PermissionCatalog.java backend/common/common-security/src/main/java/com/avicare/common/security/access/PermissionValidator.java backend/common/common-security/src/main/java/com/avicare/common/security/access/PermissionConstants.java backend/common/common-security/src/test/java/com/avicare/common/security/
git commit -m "feat(common-security): permission catalog/validator + temporary password generator"
```

---

### Task 2 : `IdentityFacade.provisionUser` + `resetPassword` (+ phone sur UserInfo)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/identity/api/IdentityFacade.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/identity/api/dto/ProvisionUserCommand.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/identity/api/dto/UserInfo.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/identity/service/IdentityFacadeImpl.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/identity/service/AuthService.java`

**Interfaces:**
- Consumes : rien (Task 1 indépendante).
- Produces : `IdentityFacade.provisionUser(ProvisionUserCommand{String fullName,String email,String phone,String rawPassword}): UserInfo` ; `IdentityFacade.resetPassword(Long userId,String rawPassword): void` ; `UserInfo` gagne `String phone`.

- [ ] **Step 1 : `ProvisionUserCommand.java`** :

```java
package com.avicare.identity.api.dto;

/** Command to provision a user account from another context (e.g. tenancy). */
public record ProvisionUserCommand(
    String fullName, String email, String phone, String rawPassword) {}
```

- [ ] **Step 2 : `UserInfo`** — ajouter `phone` (le mapper MapStruct mappe par nom de champ) :

```java
public record UserInfo(
    Long id, String email, String fullName, String phone, UserRole role, boolean active) {}
```

- [ ] **Step 3 : `IdentityFacade`** — ajouter les 2 méthodes au contrat :

```java
  /**
   * Provision a new user account (e.g. created by a farm owner for a worker).
   *
   * @throws com.avicare.common.api.exception.ConflictException if the email is already used
   */
  UserInfo provisionUser(ProvisionUserCommand command);

  /** Set a new password for an existing user (BCrypt-encoded). */
  void resetPassword(Long userId, String rawPassword);
```
(ajouter l'import `com.avicare.identity.api.dto.ProvisionUserCommand`.)

- [ ] **Step 4 : `AuthService`** — extraire un helper réutilisable `createUser(fullName,email,phone,rawPassword)` et l'appeler depuis `signup` :

```java
  /** Create + persist a USER account (shared by signup and provisioning). */
  @Transactional
  public User createUser(String fullName, String email, String phone, String rawPassword) {
    if (userRepository.existsByEmailIgnoreCase(email)) {
      throw new ConflictException("EMAIL_ALREADY_USED", "Email is already registered");
    }
    User user = new User();
    user.setEmail(email);
    user.setPasswordHash(passwordEncoder.encode(rawPassword));
    user.setFullName(fullName);
    user.setPhone(phone);
    return userRepository.save(user);
  }
```
puis dans `signup`, remplacer le bloc de création par :
```java
    User saved = createUser(request.fullName(), request.email(), request.phone(), request.password());
    log.info("New user registered: id={}", saved.getId());
    return issueTokens(saved);
```

- [ ] **Step 5 : `IdentityFacadeImpl`** — implémenter (injecter `AuthService`, `UserRepository`, `PasswordEncoder`, `IdentityMapper` selon ce qui est déjà injecté ; ajouter ce qui manque) :

```java
  @Override
  @Transactional
  public UserInfo provisionUser(ProvisionUserCommand command) {
    User saved =
        authService.createUser(
            command.fullName(), command.email(), command.phone(), command.rawPassword());
    return identityMapper.toInfo(saved);
  }

  @Override
  @Transactional
  public void resetPassword(Long userId, String rawPassword) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User " + userId));
    user.setPasswordHash(passwordEncoder.encode(rawPassword));
  }
```
(ajouter les champs `private final` manquants + imports `ProvisionUserCommand`, `NotFoundException`, `User`, `PasswordEncoder`.)

- [ ] **Step 6 : compiler** — `cd backend && ./mvnw -q -pl avicare-app -am test-compile` → exit 0. (Corriger tout site cassé par l'ajout du champ `phone` à `UserInfo` — chercher les constructions `new UserInfo(` éventuelles et y insérer `phone`.)

- [ ] **Step 7 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/identity
git commit -m "feat(identity): provisionUser + resetPassword on IdentityFacade, phone on UserInfo"
```

---

### Task 3 : endpoint `GET /api/v1/permissions/catalog`

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/response/PermissionCatalogResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/tenancy/controller/PermissionCatalogController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/tenancy/PermissionCatalogControllerTest.java`

**Interfaces:**
- Consumes : `PermissionCatalog` (Task 1), `FarmRole` (`com.avicare.common.security.principal.FarmRole`).
- Produces : `GET /api/v1/permissions/catalog` → `ApiResponse<PermissionCatalogResponse>`.

- [ ] **Step 1 : DTO** `PermissionCatalogResponse.java` :

```java
package com.avicare.tenancy.dto.response;

import com.avicare.common.security.access.PermissionCatalog.ResourceDef;
import java.util.List;
import java.util.Map;

/** Permission vocabulary for the member-access UI. */
public record PermissionCatalogResponse(
    List<ResourceDef> resources, Map<String, List<String>> roleDefaults) {}
```

- [ ] **Step 2 : controller** `PermissionCatalogController.java` :

```java
package com.avicare.tenancy.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.access.PermissionCatalog;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.tenancy.dto.response.PermissionCatalogResponse;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes the assignable permission vocabulary + per-role defaults (read-only). */
@RestController
@RequestMapping("/api/v1/permissions")
public class PermissionCatalogController {

  @GetMapping("/catalog")
  public ApiResponse<PermissionCatalogResponse> catalog() {
    Map<String, java.util.List<String>> defaults = new LinkedHashMap<>();
    for (FarmRole role : FarmRole.values()) {
      defaults.put(role.name(), role.defaultPermissions());
    }
    return ApiResponse.of(
        new PermissionCatalogResponse(PermissionCatalog.RESOURCES, defaults));
  }
}
```

> L'endpoint est sous `/api/v1/permissions/**`. **Vérifier la `SecurityConfig`** : tout endpoint non public exige l'authentification (OK, c'est le comportement par défaut — pas besoin de `@PreAuthorize`, tout user authentifié peut lire le vocabulaire). Ne PAS l'ajouter aux routes publiques.

- [ ] **Step 3 : test** `PermissionCatalogControllerTest.java` (profil DB-less `test` + MockMvc, comme les tests web existants ; pas de DB requise) :

```java
package com.avicare.tenancy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PermissionCatalogControllerTest {

  @Autowired private MockMvc mockMvc;

  @Test
  @WithMockUser
  void returns_resources_and_role_defaults() throws Exception {
    mockMvc
        .perform(get("/api/v1/permissions/catalog"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.resources[0].resource").value("poultry"))
        .andExpect(jsonPath("$.data.roleDefaults.MANAGER").isArray());
  }
}
```
> Si le profil `test` DB-less requiert des `@MockitoBean` pour démarrer (cf. SecurityE2ETest), calquer les beans mockés sur un test web existant de ce profil. Si trop lourd, transformer en `@WebMvcTest(PermissionCatalogController.class)` (le contrôleur n'a aucune dépendance de service).

- [ ] **Step 4 : compiler + (si possible) tester** — `./mvnw -q -pl avicare-app -am test-compile` → exit 0.

- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/tenancy/controller/PermissionCatalogController.java backend/avicare-app/src/main/java/com/avicare/tenancy/dto/response/PermissionCatalogResponse.java backend/avicare-app/src/test/java/com/avicare/tenancy/PermissionCatalogControllerTest.java
git commit -m "feat(tenancy): permission catalog endpoint"
```

---

### Task 4 : `MembershipService.createMemberAccount` + reset + enrich `MemberResponse` + `active`

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/response/MemberResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/request/CreateMemberRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/response/CreateMemberResult.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/request/UpdateMemberRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/service/MembershipService.java`

**Interfaces:**
- Consumes : `IdentityFacade.provisionUser/resetPassword/findById` (Task 2), `PermissionValidator.validate` + `TemporaryPasswordGenerator.generate` (Task 1), `FarmRole`.
- Produces : `createMemberAccount(Long farmId, CreateMemberRequest): CreateMemberResult{MemberResponse member,String temporaryPassword}` ; `resetMemberPassword(Long farmId, Long userId): String` ; `MemberResponse` enrichi `{id,userId,farmId,fullName,email,phone,role,permissions,active}` ; `UpdateMemberRequest{role,permissions?,active?}`.

- [ ] **Step 1 : `MemberResponse`** — enrichir avec l'identité :

```java
package com.avicare.tenancy.dto.response;

import com.avicare.common.security.principal.FarmRole;
import java.util.List;

/** HTTP view of a farm membership (with the member's identity). */
public record MemberResponse(
    Long id,
    Long userId,
    Long farmId,
    String fullName,
    String email,
    String phone,
    FarmRole role,
    List<String> permissions,
    boolean active) {}
```

- [ ] **Step 2 : `CreateMemberRequest`** :

```java
package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Provision a new member account on a farm. {@code permissions} null → role defaults. */
public record CreateMemberRequest(
    @NotBlank @Size(max = 200) String fullName,
    @NotNull @Email String email,
    @Size(max = 30) String phone,
    @NotNull FarmRole role,
    List<String> permissions) {}
```

- [ ] **Step 3 : `CreateMemberResult`** :

```java
package com.avicare.tenancy.dto.response;

/** Result of provisioning a member: the membership + the one-time temporary password. */
public record CreateMemberResult(MemberResponse member, String temporaryPassword) {}
```

- [ ] **Step 4 : `UpdateMemberRequest`** — ajouter `active` (nullable = inchangé) :

```java
package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Change a member's role, optionally override permissions (null = role defaults), and optionally
 * toggle the membership active flag (null = unchanged).
 */
public record UpdateMemberRequest(@NotNull FarmRole role, List<String> permissions, Boolean active) {}
```

- [ ] **Step 5 : `MembershipService`** — modifier. Injecter (déjà présents `userFarmRepository`, `identityFacade`, `tenancyMapper`). Remplacer la construction `tenancyMapper.toResponse(membership)` par un helper `toResponse(membership)` qui enrichit via `IdentityFacade`, et ajouter les nouvelles méthodes :

```java
  private MemberResponse toResponse(UserFarm m) {
    UserInfo u = identityFacade.findById(m.getUserId());
    return new MemberResponse(
        m.getId(), m.getUserId(), m.getFarmId(),
        u.fullName(), u.email(), u.phone(),
        m.getRole(), m.getPermissions(), m.isActive());
  }

  @Transactional
  public CreateMemberResult createMemberAccount(Long farmId, CreateMemberRequest request) {
    if (request.role() == FarmRole.OWNER) {
      throw new BusinessRuleException(
          "OWNER_NOT_ASSIGNABLE", "The OWNER role cannot be assigned to a member");
    }
    PermissionValidator.validate(request.permissions());
    String tempPassword = TemporaryPasswordGenerator.generate();
    UserInfo user =
        identityFacade.provisionUser(
            new ProvisionUserCommand(
                request.fullName(), request.email(), request.phone(), tempPassword));

    UserFarm membership = new UserFarm();
    membership.setUserId(user.id());
    membership.setFarmId(farmId);
    membership.setRole(request.role());
    membership.setPermissions(
        request.permissions() != null ? request.permissions() : request.role().defaultPermissions());
    UserFarm saved = userFarmRepository.save(membership);
    return new CreateMemberResult(toResponse(saved), tempPassword);
  }

  @Transactional
  public String resetMemberPassword(Long farmId, Long userId) {
    UserFarm membership = load(farmId, userId);
    String tempPassword = TemporaryPasswordGenerator.generate();
    identityFacade.resetPassword(membership.getUserId(), tempPassword);
    return tempPassword;
  }
```
Modifier `listMembers` et `updateMember` pour utiliser `toResponse(...)`. Dans `updateMember`, après role/permissions, gérer `active` :
```java
    membership.setRole(request.role());
    membership.setPermissions(
        request.permissions() != null ? request.permissions() : request.role().defaultPermissions());
    PermissionValidator.validate(request.permissions());
    if (request.active() != null) membership.setActive(request.active());
    return toResponse(membership);
```
(ajouter imports : `FarmRole`, `BusinessRuleException`, `PermissionValidator`, `TemporaryPasswordGenerator`, `ProvisionUserCommand`, `UserInfo`, `CreateMemberRequest`, `CreateMemberResult`. **Supprimer** l'ancien `addMember` invite-by-email — remplacé par `createMemberAccount`.)

- [ ] **Step 6 : compiler** — `./mvnw -q -pl avicare-app -am test-compile` → exit 0. Corriger les usages de l'ancien `MemberResponse`/`addMember` (le contrôleur, Task 5 ; et tout test existant `MembershipServiceTest` qui construit `new MemberResponse(...)` ou appelle `addMember` → adapter).

- [ ] **Step 7 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/tenancy
git commit -m "feat(tenancy): provision member account with temp password, enriched member response"
```

---

### Task 5 : endpoints membres (`FarmMemberController`) + IT

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/controller/FarmMemberController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/tenancy/MemberAccountIT.java`

**Interfaces:**
- Consumes : `MembershipService.createMemberAccount/resetMemberPassword/updateMember/listMembers/removeMember` (Task 4).
- Produces : `POST /api/v1/farms/{farmId}/users` → `ApiResponse<CreateMemberResult>` ; `POST …/users/{userId}/reset-password` → `ApiResponse<Map<String,String>>` (`{"temporaryPassword": "..."}`) ; `PUT …/users/{userId}` (avec `active`) ; `GET`/`DELETE` inchangés.

- [ ] **Step 1 : controller** — remplacer `add(...)` et ajouter `resetPassword(...)` :

```java
  @PostMapping
  @PreAuthorize("@farmAccess.hasPermission(#farmId, 'settings:write')")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<CreateMemberResult> create(
      @PathVariable Long farmId, @RequestBody @Valid CreateMemberRequest request) {
    return ApiResponse.of(membershipService.createMemberAccount(farmId, request));
  }

  @PostMapping("/{userId}/reset-password")
  @PreAuthorize("@farmAccess.hasPermission(#farmId, 'settings:write')")
  public ApiResponse<java.util.Map<String, String>> resetPassword(
      @PathVariable Long farmId, @PathVariable Long userId) {
    String pw = membershipService.resetMemberPassword(farmId, userId);
    return ApiResponse.of(java.util.Map.of("temporaryPassword", pw));
  }
```
(adapter les imports + la même autorisation `@farmAccess` que les autres endpoints membres existants — **réutiliser l'expression exacte déjà en place** sur `add`/`update` plutôt que `settings:write` si elle diffère ; lire le contrôleur et conserver sa convention de gating). Garder `list`, `update`, `remove`.

- [ ] **Step 2 : IT** `MemberAccountIT.java` (Testcontainers, CI — calquer le bootstrap sur un IT tenancy existant : `@SpringBootTest` + `@AutoConfigureMockMvc` + Postgres + token OWNER) :

```java
// Provision a member, assert 201 + a temporary password is returned, the member
// appears in GET with fullName/email, and POST reset-password returns a new password.
// Provision with role OWNER → 422 OWNER_NOT_ASSIGNABLE.
// Provision with an unknown permission → 422 INVALID_PERMISSION.
```
Écrire les cas concrets en s'inspirant d'un `*IT` tenancy existant (auth, farm bootstrap). Asserts : `status().isCreated()`, `jsonPath("$.data.temporaryPassword").isNotEmpty()`, `jsonPath("$.data.member.fullName").value("Awa Diop")`.

- [ ] **Step 3 : compiler** — `./mvnw -q -pl avicare-app -am test-compile` → exit 0.

- [ ] **Step 4 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/tenancy/controller/FarmMemberController.java backend/avicare-app/src/test/java/com/avicare/tenancy/MemberAccountIT.java
git commit -m "feat(tenancy): member account create + reset-password REST endpoints"
```

---

# Phase Frontend

### Task 6 : types + slices RTK Query (permissions + members)

**Files:**
- Modify: `web/src/types/index.ts`, `web/src/constants/farmRoles.ts`
- Create: `web/src/store/api/permissionsApi.ts`
- Modify: `web/src/store/api/membersApi.ts`, `web/src/store/api/baseApi.ts`

**Interfaces:**
- Produces : types `PermissionCatalog`, `CreateMemberInput`, `CreateMemberResult`, `Member` (enrichi) ; hooks `useGetPermissionCatalogQuery`, `useCreateMemberMutation`, `useUpdateMemberMutation`, `useResetMemberPasswordMutation`, `useRemoveMemberMutation` ; constante `ASSIGNABLE_FARM_ROLES`.

- [ ] **Step 1 : types** (`web/src/types/index.ts`) — enrichir `Member` et ajouter :

```ts
// Member enrichi (mirrors backend MemberResponse)
export interface Member {
  id: number;
  userId: number;
  farmId: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: FarmRole;
  permissions: string[];
  active: boolean;
}

export interface PermissionResourceDef {
  resource: string;
  label: string;
  verbs: string[];
}
export interface PermissionCatalog {
  resources: PermissionResourceDef[];
  roleDefaults: Record<string, string[]>;
}
export interface CreateMemberInput {
  fullName: string;
  email: string;
  phone?: string;
  role: FarmRole;
  permissions?: string[];
}
export interface CreateMemberResult {
  member: Member;
  temporaryPassword: string;
}
```
(supprimer/abandonner `InviteMemberInput` s'il n'est plus utilisé ailleurs — sinon le laisser.)

- [ ] **Step 2 : `baseApi`** — ajouter le tag `"Permission"` au tableau `tagTypes` (après `"Member"`).

- [ ] **Step 3 : `farmRoles.ts`** — ajouter :

```ts
/** Roles assignable to a created member (OWNER excluded — that is the farm creator). */
export const ASSIGNABLE_FARM_ROLES: FarmRole[] = [
  "MANAGER",
  "FARMER",
  "VETERINARIAN",
  "BUYER",
];
```

- [ ] **Step 4 : `permissionsApi.ts`** :

```ts
import { baseApi } from "./baseApi";
import type { PermissionCatalog } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPermissionCatalog: build.query<PermissionCatalog, void>({
      query: () => `/api/v1/permissions/catalog`,
      transformResponse: (r: ApiEnvelope<PermissionCatalog>) => r.data,
      providesTags: [{ type: "Permission", id: "CATALOG" }],
    }),
  }),
});

export const { useGetPermissionCatalogQuery } = permissionsApi;
```

- [ ] **Step 5 : `membersApi.ts`** — remplacer `inviteMember` par `createMember`, ajouter `resetMemberPassword`, étendre `updateMember` (active) :

```ts
import { baseApi } from "./baseApi";
import type { CreateMemberInput, CreateMemberResult, FarmRole, Member } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const membersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMembers: build.query<Member[], number>({
      query: (farmId) => `/api/v1/farms/${farmId}/users`,
      transformResponse: (r: ApiEnvelope<Member[]>) => r.data,
      providesTags: (_r, _e, farmId) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
    createMember: build.mutation<
      CreateMemberResult,
      { farmId: number; body: CreateMemberInput }
    >({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/users`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<CreateMemberResult>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
    updateMember: build.mutation<
      Member,
      { farmId: number; userId: number; role: FarmRole; permissions?: string[]; active?: boolean }
    >({
      query: ({ farmId, userId, role, permissions, active }) => ({
        url: `/api/v1/farms/${farmId}/users/${userId}`,
        method: "PUT",
        body: { role, permissions, active },
      }),
      transformResponse: (r: ApiEnvelope<Member>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
    resetMemberPassword: build.mutation<
      { temporaryPassword: string },
      { farmId: number; userId: number }
    >({
      query: ({ farmId, userId }) => ({
        url: `/api/v1/farms/${farmId}/users/${userId}/reset-password`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<{ temporaryPassword: string }>) => r.data,
    }),
    removeMember: build.mutation<void, { farmId: number; userId: number }>({
      query: ({ farmId, userId }) => ({
        url: `/api/v1/farms/${farmId}/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useResetMemberPasswordMutation,
  useRemoveMemberMutation,
} = membersApi;
```

- [ ] **Step 6 : compiler** — `cd web && npx tsc --noEmit` → exit 0. (Corriger `FarmTeamTab`/`InviteMemberDialog` qui consomment l'ancien `useInviteMemberMutation`/`Member` — Task 10 les remplace ; en attendant, si tsc casse, garder `InviteMemberDialog` compilable en le neutralisant minimalement ou en faisant Task 10 juste après. Le contrôleur dispatchera 7→8→9→10 ; tsc complet est exigé au Task 10.)

> Note d'ordonnancement : Tasks 6–9 peuvent laisser `FarmTeamTab` temporairement incohérent ; **le vert tsc/lint/build complet est exigé au Task 10** (qui recâble tout). Chaque task 6–9 vérifie au minimum `tsc --noEmit` sur SES fichiers + vitest sur ses tests.

- [ ] **Step 7 : commit**
```bash
git add web/src/types/index.ts web/src/constants/farmRoles.ts web/src/store/api/permissionsApi.ts web/src/store/api/membersApi.ts web/src/store/api/baseApi.ts
git commit -m "feat(web): permission catalog + member account RTK Query endpoints"
```

---

### Task 7 : `PermissionEditor` (composant partagé, TDD)

**Files:**
- Create: `web/src/components/farms/PermissionEditor.tsx`
- Test: `web/src/components/farms/PermissionEditor.test.tsx`

**Interfaces:**
- Consumes : `PermissionCatalog` (Task 6), `colors` (`@/theme/tokens`).
- Produces : `PermissionEditor({ catalog, value, roleDefaults, disabled, onChange }: { catalog: PermissionCatalog; value: string[]; roleDefaults?: string[]; disabled?: boolean; onChange: (next: string[]) => void })` + helper exporté `expandPermissions(perms: string[], catalog: PermissionCatalog): Set<string>` (étend `resource:*`/`*` en `resource:verb` individuels).

- [ ] **Step 1 : test** `PermissionEditor.test.tsx` :

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { avicareTheme } from "@/theme";
import { PermissionEditor, expandPermissions } from "./PermissionEditor";
import type { PermissionCatalog } from "@/types";

const CATALOG: PermissionCatalog = {
  resources: [
    { resource: "poultry", label: "Élevage volaille", verbs: ["read", "write", "delete"] },
    { resource: "finance", label: "Finance", verbs: ["read", "write"] },
  ],
  roleDefaults: { MANAGER: ["poultry:*", "finance:read"] },
};

function renderEditor(props: Partial<Parameters<typeof PermissionEditor>[0]> = {}) {
  return render(
    <ThemeProvider theme={avicareTheme}>
      <PermissionEditor
        catalog={CATALOG}
        value={["poultry:read", "poultry:write"]}
        onChange={props.onChange ?? vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("expandPermissions", () => {
  it("expands resource:* into individual verbs", () => {
    const set = expandPermissions(["poultry:*", "finance:read"], CATALOG);
    expect(set.has("poultry:read")).toBe(true);
    expect(set.has("poultry:delete")).toBe(true);
    expect(set.has("finance:read")).toBe(true);
    expect(set.has("finance:write")).toBe(false);
  });
  it("expands * into everything", () => {
    const set = expandPermissions(["*"], CATALOG);
    expect(set.has("poultry:delete")).toBe(true);
    expect(set.has("finance:write")).toBe(true);
  });
});

describe("PermissionEditor", () => {
  it("renders the module rows", () => {
    renderEditor();
    expect(screen.getByText("Élevage volaille")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });

  it("emits the explicit verb list when a box is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ value: ["poultry:read"], onChange });
    // toggle poultry:write on
    await user.click(screen.getByRole("checkbox", { name: /poultry:write/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(["poultry:read", "poultry:write"]),
    );
  });

  it("disables all checkboxes when disabled", () => {
    renderEditor({ disabled: true });
    screen.getAllByRole("checkbox").forEach((cb) => expect(cb).toBeDisabled());
  });
});
```

- [ ] **Step 2 : échec** — `cd web && npx vitest run src/components/farms/PermissionEditor.test.tsx` → FAIL.

- [ ] **Step 3 : implémenter** `PermissionEditor.tsx` :

```tsx
"use client";

import { Box, Checkbox, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import type { PermissionCatalog } from "@/types";

const VERBS = ["read", "write", "delete"] as const;
const VERB_LABELS: Record<string, string> = {
  read: "Lecture",
  write: "Écriture",
  delete: "Suppression",
};

/** Expand "resource:*" / "*" into the set of concrete "resource:verb" strings. */
export function expandPermissions(perms: string[], catalog: PermissionCatalog): Set<string> {
  const out = new Set<string>();
  const all = perms.includes("*");
  for (const r of catalog.resources) {
    for (const v of r.verbs) {
      if (all || perms.includes(`${r.resource}:*`) || perms.includes(`${r.resource}:${v}`)) {
        out.add(`${r.resource}:${v}`);
      }
    }
  }
  return out;
}

export function PermissionEditor({
  catalog,
  value,
  disabled,
  onChange,
}: {
  catalog: PermissionCatalog;
  value: string[];
  roleDefaults?: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const selected = expandPermissions(value, catalog);

  const toggle = (perm: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(perm);
    else next.delete(perm);
    onChange([...next].sort());
  };

  return (
    <Box sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 2, overflow: "hidden" }}>
      {/* header */}
      <Stack
        direction="row"
        sx={{ px: 2, py: 1, bgcolor: colors.neutral[50], alignItems: "center" }}
      >
        <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, color: colors.neutral[500] }}>
          Module
        </Typography>
        {VERBS.map((v) => (
          <Typography
            key={v}
            variant="caption"
            sx={{ width: 88, textAlign: "center", fontWeight: 600, color: colors.neutral[500] }}
          >
            {VERB_LABELS[v]}
          </Typography>
        ))}
      </Stack>
      {catalog.resources.map((r) => (
        <Stack
          key={r.resource}
          direction="row"
          sx={{
            px: 2,
            py: 0.5,
            alignItems: "center",
            borderTop: `1px solid ${colors.neutral[100]}`,
          }}
        >
          <Typography sx={{ flex: 1, fontWeight: 500 }}>{r.label}</Typography>
          {VERBS.map((v) => {
            const perm = `${r.resource}:${v}`;
            const supported = r.verbs.includes(v);
            return (
              <Box key={v} sx={{ width: 88, textAlign: "center" }}>
                {supported ? (
                  <Checkbox
                    size="small"
                    disabled={disabled}
                    checked={selected.has(perm)}
                    onChange={(e) => toggle(perm, e.target.checked)}
                    inputProps={{ "aria-label": perm }}
                    sx={{ color: colors.primary[400], "&.Mui-checked": { color: colors.primary[600] } }}
                  />
                ) : (
                  <Typography component="span" sx={{ color: colors.neutral[300] }}>
                    —
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      ))}
    </Box>
  );
}
```

- [ ] **Step 4 : succès** — `npx vitest run src/components/farms/PermissionEditor.test.tsx` → PASS ; `npx tsc --noEmit` exit 0.

- [ ] **Step 5 : commit**
```bash
git add web/src/components/farms/PermissionEditor.tsx web/src/components/farms/PermissionEditor.test.tsx
git commit -m "feat(web): shared permission editor grid"
```

---

### Task 8 : `AddMemberDialog` (création + révélation mot de passe, TDD)

**Files:**
- Create: `web/src/components/farms/AddMemberDialog.tsx`
- Test: `web/src/components/farms/AddMemberDialog.test.tsx`

**Interfaces:**
- Consumes : `useCreateMemberMutation`, `useGetPermissionCatalogQuery` (Task 6), `PermissionEditor` + `expandPermissions` (Task 7), `ASSIGNABLE_FARM_ROLES`/`FARM_ROLE_LABELS`, `useToast`, `apiErrorMessage`, `colors`.
- Produces : `AddMemberDialog({ open, onClose, farmId }: { open: boolean; onClose: () => void; farmId: number })`.

- [ ] **Step 1 : test** `AddMemberDialog.test.tsx` — vérifie : rendu des champs (Nom complet, Email, Rôle) ; toggle « Personnaliser » affiche la grille ; soumission **sans** personnalisation envoie `{fullName, email, phone, role}` (sans `permissions`) ; après succès, le **mot de passe temporaire** retourné est affiché. Stub `global.fetch` (matcher : `/permissions/catalog` → catalogue ; POST `/users` → `{member, temporaryPassword:"Temp123abcd"}`). Pattern `renderWithProviders` + `vi.stubGlobal`. Assertions : `await screen.findByText("Temp123abcd")` après clic « Créer le compte ».

- [ ] **Step 2 : échec** — `npx vitest run src/components/farms/AddMemberDialog.test.tsx` → FAIL.

- [ ] **Step 3 : implémenter** `AddMemberDialog.tsx` (design Stitch `4524f35d…`) : `Dialog` MUI (maxWidth sm, `PaperProps` rounded 16px) ; react-hook-form + zod (fullName requis, email valide, phone optionnel, role ∈ ASSIGNABLE) ; champs Nom complet / (Numéro, Email) / select Rôle (`ASSIGNABLE_FARM_ROLES` + `FARM_ROLE_LABELS`) + aide ; `Alert` info « Un mot de passe temporaire sera généré… » ; `Switch` « Personnaliser les accès » + sous-texte ; si ON → `PermissionEditor` avec `value` initialisée aux `catalog.roleDefaults[role]` (réinitialisée au changement de rôle via `useEffect`) ; CTA « Créer le compte » (`color` via `colors.accent` / variant contained). Sur succès : passer en **état `created`** affichant un `TextField` lecture seule = `temporaryPassword` + bouton « Copier » (`navigator.clipboard.writeText`) + texte « Notez-le, il ne sera plus affiché. » + bouton « Terminé » (ferme). Soumission : `body = customize ? {fullName,email,phone,role,permissions: value} : {fullName,email,phone,role}` (omettre `phone` si vide). Gérer erreurs via `useToast`/`apiErrorMessage`.

> Respecter : labels au-dessus des champs, pas de hex en dur (tokens), Rules of Hooks (catalog query inconditionnelle), focus ring/tactile MUI par défaut.

- [ ] **Step 4 : succès** — `npx vitest run src/components/farms/AddMemberDialog.test.tsx` → PASS ; `npx tsc --noEmit` exit 0.

- [ ] **Step 5 : commit**
```bash
git add web/src/components/farms/AddMemberDialog.tsx web/src/components/farms/AddMemberDialog.test.tsx
git commit -m "feat(web): add-member dialog with access customization and temp password reveal"
```

---

### Task 9 : `EditMemberDialog` (TDD)

**Files:**
- Create: `web/src/components/farms/EditMemberDialog.tsx`
- Test: `web/src/components/farms/EditMemberDialog.test.tsx`

**Interfaces:**
- Consumes : `useUpdateMemberMutation`, `useResetMemberPasswordMutation`, `useRemoveMemberMutation`, `useGetPermissionCatalogQuery`, `PermissionEditor`, `ASSIGNABLE_FARM_ROLES`/`FARM_ROLE_LABELS`, `Member` (Task 6), `useToast`, `apiErrorMessage`, `colors`, `ConfirmDialog` (`@/components/shared/ConfirmDialog`).
- Produces : `EditMemberDialog({ open, onClose, farmId, member }: { open: boolean; onClose: () => void; farmId: number; member: Member })`.

- [ ] **Step 1 : test** `EditMemberDialog.test.tsx` — vérifie : en-tête affiche `member.fullName` + email ; soumission « Enregistrer » envoie `{role, permissions, active}` ; bouton « Réinitialiser le mot de passe » affiche le nouveau temp pw retourné. Stub `fetch` (`/permissions/catalog` ; PUT `/users/{id}` → member ; POST `/reset-password` → `{temporaryPassword:"New456xyz"}`).

- [ ] **Step 2 : échec** — `npx vitest run src/components/farms/EditMemberDialog.test.tsx` → FAIL.

- [ ] **Step 3 : implémenter** `EditMemberDialog.tsx` (design Stitch `8d615c93…`) : en-tête identité (`Avatar` initiales de `fullName` sur `colors.primary[50]` + nom + `email · phone`) ; select Rôle (initial `member.role`) + lien texte « Réinitialiser aux accès par défaut du rôle » (remet `value = catalog.roleDefaults[role]`) ; `PermissionEditor` initialisé à `member.permissions` ; section Compte : bouton outline « Réinitialiser le mot de passe » (appelle la mutation, affiche le pw dans un `Alert`/zone copiable) + `Switch` « Compte actif » (initial `member.active`) ; bouton texte rouge « Retirer de la ferme » (ouvre `ConfirmDialog` → `removeMember`) ; CTA « Enregistrer les modifications » (orange) → `updateMember({farmId, userId: member.userId, role, permissions: value, active})`. Au changement de rôle, réinitialiser `value` aux défauts du nouveau rôle.

- [ ] **Step 4 : succès** — `npx vitest run src/components/farms/EditMemberDialog.test.tsx` → PASS ; `npx tsc --noEmit` exit 0.

- [ ] **Step 5 : commit**
```bash
git add web/src/components/farms/EditMemberDialog.tsx web/src/components/farms/EditMemberDialog.test.tsx
git commit -m "feat(web): edit-member dialog (role, access, reset password, active, remove)"
```

---

### Task 10 : câblage `FarmTeamTab` + vérif complète

**Files:**
- Modify: `web/src/components/farms/FarmTeamTab.tsx`
- Delete: `web/src/components/farms/InviteMemberDialog.tsx` (+ son test s'il existe)

**Interfaces:**
- Consumes : `AddMemberDialog` (Task 8), `EditMemberDialog` (Task 9), `useGetMembersQuery`.

- [ ] **Step 1 : remplacer** dans `FarmTeamTab.tsx` : importer `AddMemberDialog` + `EditMemberDialog` à la place d'`InviteMemberDialog`. Le bouton « Inviter/Ajouter » ouvre `AddMemberDialog`. Afficher les membres avec **`member.fullName`** (et `email`) au lieu de « Utilisateur #id ». Un clic sur une ligne (ou un bouton « Modifier ») ouvre `EditMemberDialog` avec le `member` sélectionné. Retirer l'usage direct de `useRemoveMemberMutation`/`ConfirmDialog` du tab si désormais géré dans `EditMemberDialog` (ou le garder pour une action rapide — au choix, mais sans casser tsc/lint).

- [ ] **Step 2 : supprimer** `InviteMemberDialog.tsx` (et son test) :
```bash
git rm web/src/components/farms/InviteMemberDialog.tsx
git rm web/src/components/farms/InviteMemberDialog.test.tsx 2>/dev/null || true
```
(vérifier d'abord qu'aucun autre fichier ne l'importe : `grep -rn InviteMemberDialog web/src`.)

- [ ] **Step 3 : vérification complète** —
```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npx next build
```
Attendu : tsc 0 ; lint 0 erreur ; vitest tout vert ; next build « Compiled successfully ».

- [ ] **Step 4 : commit**
```bash
git add web/src/components/farms/FarmTeamTab.tsx
git commit -m "feat(web): wire member account create/edit dialogs into the farm team tab"
```

---

## Self-Review (couverture spec)

- §3 Provisioning + temp pw → Task 1 (générateur) + Task 2 (provisionUser) + Task 4 (createMemberAccount) ✓
- §3 Catalogue backend → Task 1 (PermissionCatalog) + Task 3 (endpoint) ✓
- §3 Validation permissions → Task 1 (validator) + Task 4 (appel) ✓
- §3 OWNER refusé → Task 4 (422) + Task 6/8 (ASSIGNABLE exclut OWNER) ✓
- §3 Reset pw / active → Task 4/5 (backend) + Task 9 (UI) ✓
- §5 Enrich MemberResponse (identité) + phone UserInfo → Task 2 + Task 4 ✓
- §6 PermissionEditor partagé → Task 7 ; AddMemberDialog (design `4524f35d…`) → Task 8 ; EditMemberDialog (design `8d615c93…`) → Task 9 ; câblage → Task 10 ✓
- §8 Tests backend (générateur/validator/catalog/IT) → Tasks 1,3,5 ; frontend (editor/dialogs) → Tasks 7,8,9 ✓
- Cohérence types : `Member`/`CreateMemberInput`/`CreateMemberResult`/`PermissionCatalog` (Task 6) consommés tels quels en 7–10 ; `ProvisionUserCommand`/`UserInfo(+phone)` (Task 2) en Task 4 ; `createMemberAccount`/`resetMemberPassword` (Task 4) en Task 5. ✓
- Aucune migration. ✓
