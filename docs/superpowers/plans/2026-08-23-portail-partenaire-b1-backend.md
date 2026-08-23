# Portail partenaire B1 (backend + Couche « Voir ») — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux partenaires un compte de connexion cloisonné (`partner_users`) et des endpoints **read-only** `/api/v1/partner/**` qui exposent, pour chaque partenaire, **uniquement les données que ses éleveurs partagent** (Couche « Voir »). Le portail front est le cycle B2.

**Architecture:** Auth partenaire **séparée** du monde éleveur : un `PartnerPrincipal` distinct, un JWT à `type=partner_access` (rejeté par la validation éleveur et inversement → cloisonnement), un `PartnerContext` ThreadLocal miroir de `TenancyContext`, une gate `@partnerAccess`. Les endpoints lisent les façades métier existantes et **masquent par scope** via `PartnerFacade.sharedScopes` (frontière de confiance dans le service). Refresh partenaire dans une table dédiée `partner_refresh_tokens`.

**Tech Stack:** Java 21, Spring Boot, Spring Security, Spring Data JPA / Hibernate 6.4, PostgreSQL + Flyway, jjwt (RS256), Lombok, JUnit 5 + Mockito + AssertJ, Testcontainers (repo slices, CI).

**Spec:** `docs/superpowers/specs/2026-08-23-portail-partenaire-b1-design.md`

## Global Constraints

- **Contexte** : backend dans `com.avicare.partner` ; auth dans `com.avicare.common.security`. Références `partners`/`farms` par ID. Aucun `@ManyToOne` cross-context.
- **Migration** : prochaine version **`V37`** (plus haute mergée = `V36__partner_foundation.sql`). Immuable une fois mergée. Emplacement `backend/avicare-app/src/main/resources/db/migration/`.
- **SQL** (doc 04) : `snake_case` pluriel ; `BIGSERIAL PRIMARY KEY` ; `TIMESTAMP` UTC ; FK explicites `ON DELETE` ; index sur FK ; trigger `update_updated_at_column()` nommé `trg_<table>_updated_at` pour les tables à `updated_at`.
- **JPA** : `@Id @GeneratedValue(IDENTITY)` ; `@Enumerated(STRING)` ; `created_at`/`updated_at` lecture seule (`insertable=false, updatable=false`) ; `@Table(name=...)` explicite. Jamais de `password_hash`/`token` dans un `toString` (`@ToString(exclude=...)` ou pas de champ).
- **Cloisonnement (invariant)** : le `partnerId` vient **toujours du token** (`PartnerContext`/principal), jamais du path/body. Un token `type=partner_access` ne satisfait jamais `@farmAccess` ; un token `type=access` ne satisfait jamais `@partnerAccess`. C'est le **test-clé**.
- **Masquage par scope** : appliqué **dans le service** via `PartnerFacade.sharedScopes(partnerId, farmId)` ; jamais délégué au front. Métrique non partagée = `null` ; ferme hors réseau/ne partageant rien = 404.
- **Auth** : `PasswordEncoder` (BCrypt strength 12, bean existant) ; réutiliser les clés RSA + `JwtService`. Refresh partenaire = table `partner_refresh_tokens` (source de vérité, révocation `revoked_at`), **jamais** `refresh_tokens` (qui FK `users`).
- **Tests DB-less (RÉCURRENT)** : les nouveaux repos `PartnerUserRepository` **et** `PartnerRefreshTokenRepository` doivent être `@MockitoBean` dans **les 4** contextes DB-less : `SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`, `NotificationControllerIT`. Sinon vert local, rouge CI. (Fait dès la Task 1.)
- **Testcontainers ne tourne pas sur ce Mac** : suites Mockito/DB-less = boucle TDD locale ; ITs Testcontainers validés en CI. Ne jamais merger sur CI rouge.
- **Build** (ADR-003) : `cd backend && ./mvnw clean verify` (les 3 tests TC — `NotificationRepositoryTest`, `IdentityTenancyMappingTest`, `*RepositoryIT` — échouent en local faute de Docker ; valider les suites non-TC + compter sur la CI).
- **Spotless** : `./mvnw spotless:apply -pl avicare-app` et `-pl common/common-security` (jamais `-am`).
- **Commits** : Conventional Commits, scope `feat(backend:partner):` ou `feat(common-security):`. **AUCUNE** mention Claude/IA.

---

### Task 1: Migration V37 + entités + repositories + câblage DB-less

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V37__partner_users.sql`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerUser.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerRefreshToken.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerUserRepository.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerRefreshTokenRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/repository/PartnerUserRepositoryIT.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/security/SecurityE2ETest.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/security/SecurityIntegrationTest.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/reporting/controller/DashboardControllerIT.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/notification/controller/NotificationControllerIT.java`

**Interfaces:**
- Produces: entities `PartnerUser`, `PartnerRefreshToken`; `PartnerUserRepository extends JpaRepository<PartnerUser, Long>` with `Optional<PartnerUser> findByEmail(String email)`; `PartnerRefreshTokenRepository extends JpaRepository<PartnerRefreshToken, Long>` with `Optional<PartnerRefreshToken> findByToken(String token)`, `List<PartnerRefreshToken> findByPartnerUserIdAndRevokedAtIsNull(Long partnerUserId)`.

- [ ] **Step 1: Write `V37__partner_users.sql`**

```sql
-- V37 — Portail partenaire B1 : comptes de connexion partenaires (cloisonnés) + refresh tokens.
CREATE TABLE partner_users (
    id            BIGSERIAL PRIMARY KEY,
    partner_id    BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(200),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_users_partner ON partner_users(partner_id);
CREATE TRIGGER trg_partner_users_updated_at
    BEFORE UPDATE ON partner_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE partner_refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    partner_user_id BIGINT NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
    token           VARCHAR(500) NOT NULL UNIQUE,
    expires_at      TIMESTAMP NOT NULL,
    revoked_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_refresh_tokens_user ON partner_refresh_tokens(partner_user_id);
```

- [ ] **Step 2: Write `PartnerUser`**

```java
package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A partner-portal login account. Belongs to one {@link Partner}. Deactivated via {@code isActive}. */
@Entity
@Table(name = "partner_users")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "passwordHash")
public class PartnerUser {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_id", nullable = false)
  private Long partnerId;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "full_name")
  private String fullName;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
```

- [ ] **Step 3: Write `PartnerRefreshToken`**

```java
package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** Source of truth for partner sessions. Revocation via {@code revokedAt}. */
@Entity
@Table(name = "partner_refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "token")
public class PartnerRefreshToken {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_user_id", nullable = false)
  private Long partnerUserId;

  @Column(nullable = false, unique = true)
  private String token;

  @Column(name = "expires_at", nullable = false)
  private LocalDateTime expiresAt;

  @Column(name = "revoked_at")
  private LocalDateTime revokedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Write the repositories**

`PartnerUserRepository.java`:
```java
package com.avicare.partner.repository;

import com.avicare.partner.domain.PartnerUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartnerUserRepository extends JpaRepository<PartnerUser, Long> {
  Optional<PartnerUser> findByEmail(String email);
}
```
`PartnerRefreshTokenRepository.java`:
```java
package com.avicare.partner.repository;

import com.avicare.partner.domain.PartnerRefreshToken;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartnerRefreshTokenRepository extends JpaRepository<PartnerRefreshToken, Long> {
  Optional<PartnerRefreshToken> findByToken(String token);

  List<PartnerRefreshToken> findByPartnerUserIdAndRevokedAtIsNull(Long partnerUserId);
}
```

- [ ] **Step 5: Repository slice test (CI only)**

`PartnerUserRepositoryIT.java` — copy the class annotation + Testcontainers base + `@DynamicPropertySource` block **verbatim** from `backend/avicare-app/src/test/java/com/avicare/partner/repository/PartnerRepositoryIT.java`. Seed a `partners` row (via `PartnerRepository`) then assert: `findByEmail` round-trips a saved `PartnerUser`; the `email` UNIQUE constraint rejects a duplicate (`assertThatThrownBy(...).isInstanceOf(DataIntegrityViolationException.class)` on `saveAndFlush`).

- [ ] **Step 6: Wire the two new repos as `@MockitoBean` in the 4 DB-less contexts**

In **each** of `SecurityE2ETest.java`, `SecurityIntegrationTest.java`, `DashboardControllerIT.java`, `NotificationControllerIT.java`, add the imports and fields next to the existing partner repo mocks (find the anchor `@MockitoBean private PartnerRepository partnerRepository;`):
```java
import com.avicare.partner.repository.PartnerRefreshTokenRepository;
import com.avicare.partner.repository.PartnerUserRepository;
```
```java
  @MockitoBean private PartnerUserRepository partnerUserRepository;
  @MockitoBean private PartnerRefreshTokenRepository partnerRefreshTokenRepository;
```

- [ ] **Step 7: Compile + the 4 DB-less suites + spotless + commit**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=SecurityE2ETest,SecurityIntegrationTest,DashboardControllerIT,NotificationControllerIT`
Expected: PASS (context still boots with the new repos mocked).
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/resources/db/migration/V37__partner_users.sql \
        backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerUser.java \
        backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerRefreshToken.java \
        backend/avicare-app/src/main/java/com/avicare/partner/repository \
        backend/avicare-app/src/test/java/com/avicare/partner/repository/PartnerUserRepositoryIT.java \
        backend/avicare-app/src/test/java/com/avicare/security backend/avicare-app/src/test/java/com/avicare/reporting/controller/DashboardControllerIT.java backend/avicare-app/src/test/java/com/avicare/notification/controller/NotificationControllerIT.java
git commit -m "feat(backend:partner): partner_users + partner_refresh_tokens (V37)

login accounts + dedicated refresh store; repos mocked in the 4 DB-less contexts"
```

---

### Task 2: `PartnerPrincipal` + JWT partner tokens + `PartnerContext`

**Files:**
- Create: `backend/common/common-security/src/main/java/com/avicare/common/security/principal/PartnerPrincipal.java`
- Create: `backend/common/common-security/src/main/java/com/avicare/common/tenancy/context/PartnerContext.java`
- Modify: `backend/common/common-security/src/main/java/com/avicare/common/security/jwt/JwtService.java`
- Test: `backend/common/common-security/src/test/java/com/avicare/common/security/jwt/JwtServicePartnerTest.java`

**Interfaces:**
- Produces:
  - `record PartnerPrincipal(Long partnerUserId, String email, Long partnerId)`.
  - `PartnerContext` (ThreadLocal): `set(Long partnerId)`, `Long currentPartnerId()`, `Optional<Long> tryCurrentPartnerId()`, `clear()`.
  - `JwtService.generatePartnerAccessToken(PartnerPrincipal) : String` (claims `sub`=partnerUserId, `email`, `partner_id`, `type=partner_access`).
  - `JwtService.generatePartnerRefreshToken(Long partnerUserId) : String` (`type=partner_refresh`).
  - `JwtService.validatePartnerAccessToken(String) : PartnerPrincipal` (throws on wrong type/expired/invalid).
  - `JwtService.validatePartnerRefreshToken(String) : Long`.

- [ ] **Step 1: Write `PartnerPrincipal`**

```java
package com.avicare.common.security.principal;

/** The identity carried by a partner-portal JWT. Distinct from {@link AvicarePrincipal}: no farm
 * memberships — a partner acts only on its own network, resolved from {@code partnerId}. */
public record PartnerPrincipal(Long partnerUserId, String email, Long partnerId) {}
```

- [ ] **Step 2: Write `PartnerContext`** (mirror `TenancyContext`, single Long payload)

```java
package com.avicare.common.tenancy.context;

import java.util.Objects;
import java.util.Optional;

/** ThreadLocal store for the current request's partner id (partner-portal auth). Mirror of
 * {@link TenancyContext}; MUST be cleared in a finally block (thread reuse). */
public final class PartnerContext {

  private static final ThreadLocal<Long> CONTEXT = new ThreadLocal<>();

  private PartnerContext() {}

  public static void set(Long partnerId) {
    CONTEXT.set(Objects.requireNonNull(partnerId, "partnerId must not be null"));
  }

  public static Long currentPartnerId() {
    Long id = CONTEXT.get();
    if (id == null) {
      throw new IllegalStateException("No partner context bound to the current thread.");
    }
    return id;
  }

  public static Optional<Long> tryCurrentPartnerId() {
    return Optional.ofNullable(CONTEXT.get());
  }

  public static void clear() {
    CONTEXT.remove();
  }
}
```

- [ ] **Step 3: Write the failing test `JwtServicePartnerTest`**

Copy the RSA key setup from an existing JwtService test (search `src/test` under `common-security` for a test that builds a `JwtService` with in-memory keys; reuse its `@BeforeEach`/key wiring verbatim). Then:
```java
  @Test
  void partnerAccessTokenRoundTrips() {
    String t = jwtService.generatePartnerAccessToken(new PartnerPrincipal(5L, "p@x.io", 3L));
    PartnerPrincipal p = jwtService.validatePartnerAccessToken(t);
    assertThat(p.partnerUserId()).isEqualTo(5L);
    assertThat(p.partnerId()).isEqualTo(3L);
    assertThat(p.email()).isEqualTo("p@x.io");
  }

  @Test
  void farmerAccessTokenRejectedByPartnerValidation() {
    String farmer = jwtService.generateAccessToken(
        new AvicarePrincipal(1L, "u@x.io", UserRole.USER, java.util.List.of()));
    assertThatThrownBy(() -> jwtService.validatePartnerAccessToken(farmer))
        .isInstanceOf(WrongTokenTypeException.class);
  }

  @Test
  void partnerAccessTokenRejectedByFarmerValidation() {
    String partner = jwtService.generatePartnerAccessToken(new PartnerPrincipal(5L, "p@x.io", 3L));
    assertThatThrownBy(() -> jwtService.validateAccessToken(partner))
        .isInstanceOf(WrongTokenTypeException.class);
  }
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd backend && ./mvnw -q -pl common/common-security test -Dtest=JwtServicePartnerTest`
Expected: FAIL — partner methods undefined.

- [ ] **Step 5: Implement the partner methods in `JwtService`**

Add constants and methods (mirror `generateAccessToken`/`validateAccessToken`):
```java
  private static final String CLAIM_PARTNER_ID = "partner_id";
  private static final String TYPE_PARTNER_ACCESS = "partner_access";
  private static final String TYPE_PARTNER_REFRESH = "partner_refresh";

  public String generatePartnerAccessToken(PartnerPrincipal principal) {
    requireKeys();
    Instant now = Instant.now();
    return Jwts.builder()
        .issuer(props.issuer())
        .subject(principal.partnerUserId().toString())
        .id(UUID.randomUUID().toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(props.accessTokenTtl())))
        .claims(
            Map.of(
                CLAIM_EMAIL, principal.email(),
                CLAIM_PARTNER_ID, principal.partnerId(),
                CLAIM_TYPE, TYPE_PARTNER_ACCESS))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  public String generatePartnerRefreshToken(Long partnerUserId) {
    requireKeys();
    Instant now = Instant.now();
    return Jwts.builder()
        .issuer(props.issuer())
        .subject(partnerUserId.toString())
        .id(UUID.randomUUID().toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(props.refreshTokenTtl())))
        .claims(Map.of(CLAIM_TYPE, TYPE_PARTNER_REFRESH))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  public PartnerPrincipal validatePartnerAccessToken(String token) {
    Claims claims = parseClaims(token);
    requireType(claims, TYPE_PARTNER_ACCESS);
    try {
      Long partnerUserId = Long.parseLong(claims.getSubject());
      String email = claims.get(CLAIM_EMAIL, String.class);
      Long partnerId = claims.get(CLAIM_PARTNER_ID, Number.class).longValue();
      return new PartnerPrincipal(partnerUserId, email, partnerId);
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new InvalidTokenException("Cannot reconstruct partner principal: " + e.getMessage(), e);
    }
  }

  public Long validatePartnerRefreshToken(String token) {
    Claims claims = parseClaims(token);
    requireType(claims, TYPE_PARTNER_REFRESH);
    return Long.parseLong(claims.getSubject());
  }
```
Add the import `com.avicare.common.security.principal.PartnerPrincipal`.

- [ ] **Step 6: Run to verify it passes + commit**

Run: `cd backend && ./mvnw -q -pl common/common-security test -Dtest=JwtServicePartnerTest`
Expected: PASS.
```bash
cd backend && ./mvnw -q spotless:apply -pl common/common-security
git add backend/common/common-security/src/main/java/com/avicare/common/security/principal/PartnerPrincipal.java \
        backend/common/common-security/src/main/java/com/avicare/common/tenancy/context/PartnerContext.java \
        backend/common/common-security/src/main/java/com/avicare/common/security/jwt/JwtService.java \
        backend/common/common-security/src/test/java/com/avicare/common/security/jwt/JwtServicePartnerTest.java
git commit -m "feat(common-security): partner JWT tokens + PartnerPrincipal + PartnerContext

type=partner_access/partner_refresh; cross-type validation rejects the other audience"
```

---

### Task 3: JwtFilter partner branch + PartnerAccessChecker + SecurityConfig

**Files:**
- Modify: `backend/common/common-security/src/main/java/com/avicare/common/security/jwt/JwtFilter.java`
- Create: `backend/common/common-security/src/main/java/com/avicare/common/security/access/PartnerAccessChecker.java`
- Modify: `backend/common/common-security/src/main/java/com/avicare/common/security/config/SecurityConfig.java`

**Interfaces:**
- Consumes: `JwtService.validatePartnerAccessToken` (Task 2), `PartnerContext` (Task 2).
- Produces: `@Component("partnerAccess") PartnerAccessChecker` with `boolean isPartner()` and `Long currentPartnerId()`. A partner request authenticates as authority `ROLE_PARTNER` with the `PartnerPrincipal` as `details` and `PartnerContext` set.

- [ ] **Step 1: Add the partner branch to `JwtFilter`**

In `doFilterInternal`, replace the single `authenticate(...)` try/catch with a cascade that tries the farmer token first, then the partner token on a wrong-type outcome. Also clear `PartnerContext` in the `finally`.
```java
    if (token != null) {
      try {
        authenticate(jwtService.validateAccessToken(token));
      } catch (WrongTokenTypeException wrongType) {
        try {
          authenticatePartner(jwtService.validatePartnerAccessToken(token));
        } catch (TokenValidationException e) {
          log.warn("Rejected partner JWT: {}", e.getMessage());
        }
      } catch (TokenValidationException e) {
        log.warn("Rejected JWT: {}", e.getMessage());
      }
    }

    try {
      chain.doFilter(request, response);
    } finally {
      TenancyContext.clear();
      PartnerContext.clear();
      SecurityContextHolder.clearContext();
    }
```
Add the `authenticatePartner` method and imports (`PartnerPrincipal`, `PartnerContext`, `WrongTokenTypeException`):
```java
  private void authenticatePartner(PartnerPrincipal principal) {
    PartnerContext.set(principal.partnerId());
    var auth =
        new UsernamePasswordAuthenticationToken(
            principal.partnerUserId(),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_PARTNER")));
    auth.setDetails(principal);
    SecurityContextHolder.getContext().setAuthentication(auth);
    log.debug("Partner JWT authenticated partnerUserId={} partnerId={}",
        principal.partnerUserId(), principal.partnerId());
  }
```
> Note: `validateAccessToken` throws `WrongTokenTypeException` for a `partner_access` token (its `requireType` expects `access`), so the cascade routes partner tokens to `authenticatePartner`. A farmer token never reaches the partner branch.

- [ ] **Step 2: Write `PartnerAccessChecker`**

```java
package com.avicare.common.security.access;

import com.avicare.common.tenancy.context.PartnerContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** SpEL helper for partner-portal endpoints: {@code @PreAuthorize("@partnerAccess.isPartner()")}. */
@Component("partnerAccess")
public class PartnerAccessChecker {

  public boolean isPartner() {
    Authentication a = SecurityContextHolder.getContext().getAuthentication();
    return a != null
        && a.getAuthorities().stream().anyMatch(g -> "ROLE_PARTNER".equals(g.getAuthority()));
  }

  /** The authenticated partner's id (from the token). */
  public Long currentPartnerId() {
    return PartnerContext.currentPartnerId();
  }
}
```

- [ ] **Step 3: Open the partner auth path in `SecurityConfig`**

Next to the existing `.requestMatchers("/api/v1/auth/**").permitAll()`, add:
```java
                    .requestMatchers("/api/v1/partner/auth/**")
                    .permitAll()
```
(Everything else — including `/api/v1/partner/**` — stays `authenticated()`.)

- [ ] **Step 4: Compile + spotless + commit**

Run: `cd backend && ./mvnw -q -pl common/common-security test-compile`
Expected: BUILD SUCCESS.
```bash
cd backend && ./mvnw -q spotless:apply -pl common/common-security
git add backend/common/common-security/src/main/java/com/avicare/common/security/jwt/JwtFilter.java \
        backend/common/common-security/src/main/java/com/avicare/common/security/access/PartnerAccessChecker.java \
        backend/common/common-security/src/main/java/com/avicare/common/security/config/SecurityConfig.java
git commit -m "feat(common-security): authenticate partner tokens (ROLE_PARTNER + @partnerAccess)

JwtFilter routes partner_access tokens to a PartnerPrincipal; /api/v1/partner/auth public"
```

---

### Task 4: Partner auth service + `PartnerAuthController`

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerRefreshTokenService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerAuthService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/PartnerLoginRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/PartnerRefreshRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/PartnerAuthTokens.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/controller/PartnerAuthController.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/exception/PartnerAuthException.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerAuthServiceTest.java`

**Interfaces:**
- Consumes: `PartnerUserRepository`, `PartnerRefreshTokenRepository`, `JwtService`, `PasswordEncoder`, `JwtProperties` (for TTL seconds).
- Produces:
  - `PartnerRefreshTokenService`: `String issue(Long partnerUserId)`, `Rotation rotate(String token)` (record `Rotation(Long partnerUserId, String refreshToken)`), `void revoke(String token)`.
  - `PartnerAuthService`: `PartnerAuthTokens login(PartnerLoginRequest)`, `PartnerAuthTokens refresh(String refreshToken)`, `void logout(String refreshToken)`.
  - `PartnerAuthTokens(String accessToken, String refreshToken, long expiresIn)`.
  - `PartnerAuthException(String message)` extends `BusinessException`, code `PARTNER_AUTH_FAILED`, HTTP 401.

- [ ] **Step 1: Write `PartnerAuthException` + the DTOs**

`PartnerAuthException.java`:
```java
package com.avicare.partner.exception;

import com.avicare.common.api.exception.BusinessException;
import org.springframework.http.HttpStatus;

/** Bad partner credentials, inactive account, or invalid/expired refresh (HTTP 401). */
public class PartnerAuthException extends BusinessException {
  public PartnerAuthException(String message) {
    super("PARTNER_AUTH_FAILED", message, HttpStatus.UNAUTHORIZED);
  }
}
```
`PartnerLoginRequest.java`:
```java
package com.avicare.partner.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PartnerLoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
```
`PartnerRefreshRequest.java`:
```java
package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotBlank;

public record PartnerRefreshRequest(@NotBlank String refreshToken) {}
```
`PartnerAuthTokens.java`:
```java
package com.avicare.partner.dto.response;

public record PartnerAuthTokens(String accessToken, String refreshToken, long expiresIn) {}
```

- [ ] **Step 2: Write `PartnerRefreshTokenService`** (mirror `com.avicare.identity.service.RefreshTokenService`, substituting `PartnerRefreshTokenRepository` and `PartnerRefreshToken`)

Use `jwtService.generatePartnerRefreshToken(partnerUserId)` for the token string; persist a `PartnerRefreshToken` (token, expiresAt = now + refresh TTL, partnerUserId). `rotate(token)`: load by token via `findByToken`; if missing/revoked/expired → `PartnerAuthException`; set `revokedAt=now`, save; issue a fresh one; return `new Rotation(partnerUserId, newToken)`. `revoke(token)`: set `revokedAt=now` if present.
```java
package com.avicare.partner.service;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.domain.PartnerRefreshToken;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerRefreshTokenRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PartnerRefreshTokenService {

  public record Rotation(Long partnerUserId, String refreshToken) {}

  private final PartnerRefreshTokenRepository repository;
  private final JwtService jwtService;
  private final JwtProperties props;

  @Transactional
  public String issue(Long partnerUserId) {
    String token = jwtService.generatePartnerRefreshToken(partnerUserId);
    PartnerRefreshToken row = new PartnerRefreshToken();
    row.setPartnerUserId(partnerUserId);
    row.setToken(token);
    row.setExpiresAt(LocalDateTime.now().plus(props.refreshTokenTtl()));
    repository.save(row);
    return token;
  }

  @Transactional
  public Rotation rotate(String token) {
    PartnerRefreshToken row =
        repository
            .findByToken(token)
            .orElseThrow(() -> new PartnerAuthException("Unknown refresh token"));
    if (row.getRevokedAt() != null || row.getExpiresAt().isBefore(LocalDateTime.now())) {
      throw new PartnerAuthException("Refresh token is revoked or expired");
    }
    row.setRevokedAt(LocalDateTime.now());
    repository.save(row);
    Long partnerUserId = jwtService.validatePartnerRefreshToken(token);
    return new Rotation(partnerUserId, issue(partnerUserId));
  }

  @Transactional
  public void revoke(String token) {
    repository
        .findByToken(token)
        .ifPresent(
            row -> {
              row.setRevokedAt(LocalDateTime.now());
              repository.save(row);
            });
  }
}
```

- [ ] **Step 3: Write the failing test `PartnerAuthServiceTest`**

```java
package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.PartnerUser;
import com.avicare.partner.dto.request.PartnerLoginRequest;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerUserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PartnerAuthServiceTest {

  @Mock PartnerUserRepository partnerUserRepository;
  @Mock com.avicare.common.security.jwt.JwtService jwtService;
  @Mock PartnerRefreshTokenService refreshTokenService;
  @Mock com.avicare.common.security.jwt.JwtProperties props;
  final PasswordEncoder encoder = new BCryptPasswordEncoder(12);

  PartnerAuthService service() {
    return new PartnerAuthService(partnerUserRepository, jwtService, refreshTokenService, encoder, props);
  }

  private PartnerUser activeUser() {
    PartnerUser u = new PartnerUser();
    u.setEmail("p@x.io");
    u.setPartnerId(3L);
    u.setActive(true);
    u.setPasswordHash(encoder.encode("secret"));
    return u;
  }

  @Test
  void loginRejectsWrongPassword() {
    when(partnerUserRepository.findByEmail("p@x.io")).thenReturn(Optional.of(activeUser()));
    assertThatThrownBy(() -> service().login(new PartnerLoginRequest("p@x.io", "WRONG")))
        .isInstanceOf(PartnerAuthException.class);
  }

  @Test
  void loginRejectsInactiveAccount() {
    PartnerUser u = activeUser();
    u.setActive(false);
    when(partnerUserRepository.findByEmail("p@x.io")).thenReturn(Optional.of(u));
    assertThatThrownBy(() -> service().login(new PartnerLoginRequest("p@x.io", "secret")))
        .isInstanceOf(PartnerAuthException.class);
  }

  @Test
  void loginIssuesTokensOnValidCredentials() {
    when(partnerUserRepository.findByEmail("p@x.io")).thenReturn(Optional.of(activeUser()));
    when(jwtService.generatePartnerAccessToken(any())).thenReturn("acc");
    when(refreshTokenService.issue(any())).thenReturn("ref");
    when(props.accessTokenTtl()).thenReturn(java.time.Duration.ofMinutes(15));

    var tokens = service().login(new PartnerLoginRequest("p@x.io", "secret"));

    assertThat(tokens.accessToken()).isEqualTo("acc");
    assertThat(tokens.refreshToken()).isEqualTo("ref");
    assertThat(tokens.expiresIn()).isEqualTo(900);
  }
}
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerAuthServiceTest`
Expected: FAIL — `PartnerAuthService` undefined.

- [ ] **Step 5: Write `PartnerAuthService`**

```java
package com.avicare.partner.service;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.PartnerPrincipal;
import com.avicare.partner.domain.PartnerUser;
import com.avicare.partner.dto.request.PartnerLoginRequest;
import com.avicare.partner.dto.response.PartnerAuthTokens;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Partner-portal authentication: login, refresh rotation, logout. Cloisonned from farmer auth. */
@Service
@RequiredArgsConstructor
public class PartnerAuthService {

  private final PartnerUserRepository partnerUserRepository;
  private final JwtService jwtService;
  private final PartnerRefreshTokenService refreshTokenService;
  private final PasswordEncoder passwordEncoder;
  private final JwtProperties props;

  @Transactional
  public PartnerAuthTokens login(PartnerLoginRequest request) {
    PartnerUser user =
        partnerUserRepository
            .findByEmail(request.email())
            .orElseThrow(() -> new PartnerAuthException("Invalid credentials"));
    if (!user.isActive() || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new PartnerAuthException("Invalid credentials");
    }
    return issue(user);
  }

  @Transactional
  public PartnerAuthTokens refresh(String refreshToken) {
    PartnerRefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
    PartnerUser user =
        partnerUserRepository
            .findById(rotation.partnerUserId())
            .orElseThrow(() -> new PartnerAuthException("Unknown partner user"));
    String access =
        jwtService.generatePartnerAccessToken(
            new PartnerPrincipal(user.getId(), user.getEmail(), user.getPartnerId()));
    return new PartnerAuthTokens(access, rotation.refreshToken(), accessTtlSeconds());
  }

  @Transactional
  public void logout(String refreshToken) {
    refreshTokenService.revoke(refreshToken);
  }

  private PartnerAuthTokens issue(PartnerUser user) {
    String access =
        jwtService.generatePartnerAccessToken(
            new PartnerPrincipal(user.getId(), user.getEmail(), user.getPartnerId()));
    String refresh = refreshTokenService.issue(user.getId());
    return new PartnerAuthTokens(access, refresh, accessTtlSeconds());
  }

  private long accessTtlSeconds() {
    return props.accessTokenTtl().toSeconds();
  }
}
```

- [ ] **Step 6: Write `PartnerAuthController`**

```java
package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.partner.dto.request.PartnerLoginRequest;
import com.avicare.partner.dto.request.PartnerRefreshRequest;
import com.avicare.partner.dto.response.PartnerAuthTokens;
import com.avicare.partner.service.PartnerAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public partner-portal auth endpoints (cloisonned; under the permitAll /api/v1/partner/auth/**). */
@RestController
@RequestMapping("/api/v1/partner/auth")
@RequiredArgsConstructor
public class PartnerAuthController {

  private final PartnerAuthService partnerAuthService;

  @PostMapping("/login")
  public ApiResponse<PartnerAuthTokens> login(@RequestBody @Valid PartnerLoginRequest req) {
    return ApiResponse.of(partnerAuthService.login(req));
  }

  @PostMapping("/refresh")
  public ApiResponse<PartnerAuthTokens> refresh(@RequestBody @Valid PartnerRefreshRequest req) {
    return ApiResponse.of(partnerAuthService.refresh(req.refreshToken()));
  }

  @PostMapping("/logout")
  public ApiResponse<Void> logout(@RequestBody @Valid PartnerRefreshRequest req) {
    partnerAuthService.logout(req.refreshToken());
    return ApiResponse.of(null);
  }
}
```

- [ ] **Step 7: Run tests to verify they pass + spotless + commit**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerAuthServiceTest`
Expected: PASS.
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerRefreshTokenService.java \
        backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerAuthService.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto \
        backend/avicare-app/src/main/java/com/avicare/partner/controller/PartnerAuthController.java \
        backend/avicare-app/src/main/java/com/avicare/partner/exception/PartnerAuthException.java \
        backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerAuthServiceTest.java
git commit -m "feat(backend:partner): partner-portal auth (login/refresh/logout)

PartnerAuthService + dedicated refresh rotation store; 401 on bad/inactive creds"
```

---

### Task 5: ADMIN provisioning of partner users

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/CreatePartnerUserRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/PartnerUserResponse.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/partner/controller/AdminPartnerController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerServiceTest.java` (modify)

**Interfaces:**
- Consumes: `PartnerUserRepository`, `PasswordEncoder`, `PartnerService.get`.
- Produces:
  - `PartnerService.createPartnerUser(Long partnerId, String email, String fullName) : PartnerUserResult` where `record PartnerUserResult(PartnerUser user, String temporaryPassword)`.
  - `PartnerUserResponse(Long id, Long partnerId, String email, String fullName, boolean active, String temporaryPassword)` + `static of(PartnerUser, String tempPw)`.
  - `AdminPartnerController.POST /{partnerId}/users` (gated by the class-level `@PreAuthorize("hasRole('ADMIN')")`).

- [ ] **Step 1: Write the DTOs**

`CreatePartnerUserRequest.java`:
```java
package com.avicare.partner.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreatePartnerUserRequest(@NotBlank @Email String email, String fullName) {}
```
`PartnerUserResponse.java`:
```java
package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerUser;

/** {@code temporaryPassword} is returned ONCE at creation, never stored in clear. */
public record PartnerUserResponse(
    Long id, Long partnerId, String email, String fullName, boolean active, String temporaryPassword) {

  public static PartnerUserResponse of(PartnerUser u, String temporaryPassword) {
    return new PartnerUserResponse(
        u.getId(), u.getPartnerId(), u.getEmail(), u.getFullName(), u.isActive(), temporaryPassword);
  }
}
```

- [ ] **Step 2: Write the failing test in `PartnerServiceTest`**

`PartnerService` gains a `PartnerUserRepository` + `PasswordEncoder` dependency — update the `@InjectMocks`/`@Mock` setup: add `@Mock PartnerUserRepository partnerUserRepository;` and `final PasswordEncoder encoder = new BCryptPasswordEncoder(12);`, and build the service explicitly in a helper if `@InjectMocks` can't supply the encoder (construct `new PartnerService(partnerRepository, inviteCodeRepository, partnerUserRepository, encoder)`). Add:
```java
  @Test
  void createPartnerUserHashesPasswordAndReturnsTempOnce() {
    when(partnerRepository.findById(3L)).thenReturn(java.util.Optional.of(new Partner()));
    when(partnerUserRepository.save(any(com.avicare.partner.domain.PartnerUser.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    var result = service.createPartnerUser(3L, "p@x.io", "Awa");

    assertThat(result.user().getEmail()).isEqualTo("p@x.io");
    assertThat(result.user().getPartnerId()).isEqualTo(3L);
    assertThat(result.temporaryPassword()).hasSizeGreaterThanOrEqualTo(10);
    assertThat(result.user().getPasswordHash()).isNotEqualTo(result.temporaryPassword());
  }
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerServiceTest`
Expected: FAIL — `createPartnerUser` undefined / constructor arity.

- [ ] **Step 4: Implement `createPartnerUser` in `PartnerService`**

Add the two dependencies to the constructor (via `@RequiredArgsConstructor` fields `private final PartnerUserRepository partnerUserRepository;` and `private final PasswordEncoder passwordEncoder;`) and:
```java
  public record PartnerUserResult(PartnerUser user, String temporaryPassword) {}

  @Transactional
  public PartnerUserResult createPartnerUser(Long partnerId, String email, String fullName) {
    get(partnerId); // 404 if the partner does not exist
    String tempPassword = uniqueCode() + uniqueCode(); // reuse the 8-char generator → 16 chars
    PartnerUser u = new PartnerUser();
    u.setPartnerId(partnerId);
    u.setEmail(email);
    u.setFullName(fullName);
    u.setActive(true);
    u.setPasswordHash(passwordEncoder.encode(tempPassword));
    return new PartnerUserResult(partnerUserRepository.save(u), tempPassword);
  }
```
Add imports (`com.avicare.partner.domain.PartnerUser`, `com.avicare.partner.repository.PartnerUserRepository`, `org.springframework.security.crypto.password.PasswordEncoder`).

- [ ] **Step 5: Add the endpoint to `AdminPartnerController`**

```java
  @PostMapping("/{partnerId}/users")
  public ApiResponse<PartnerUserResponse> createUser(
      @PathVariable Long partnerId, @RequestBody @Valid CreatePartnerUserRequest req) {
    var result = partnerService.createPartnerUser(partnerId, req.email(), req.fullName());
    return ApiResponse.of(PartnerUserResponse.of(result.user(), result.temporaryPassword()));
  }
```
Add imports for `CreatePartnerUserRequest` and `PartnerUserResponse`.

- [ ] **Step 6: Run tests + spotless + commit**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerServiceTest,AdminPartnerControllerTest`
Expected: PASS.
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerService.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto/request/CreatePartnerUserRequest.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto/response/PartnerUserResponse.java \
        backend/avicare-app/src/main/java/com/avicare/partner/controller/AdminPartnerController.java \
        backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerServiceTest.java
git commit -m "feat(backend:partner): ADMIN provisions partner-user accounts

POST /admin/partners/{id}/users → temp password returned once (BCrypt hashed)"
```

---

### Task 6: Couche « Voir » — read service + `PartnerPortalController` + cloisonnement IT

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerNetworkReadService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/NetworkDashboardResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/NetworkFarmRow.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/PartnerProfileResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/controller/PartnerPortalController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerNetworkReadServiceTest.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/controller/PartnerPortalControllerIT.java`

**Interfaces:**
- Consumes: `PartnerFacade` (`farmIdsInNetwork`, `sharedScopes`), `PartnerService.get`, `TenancyFacade.findById`, `LivestockFacade` (mortality/feed/activity), `FinanceFacade.farmPnl`, `PartnerContext.currentPartnerId()`.
- Produces:
  - `NetworkFarmRow(Long farmId, String farmName, Boolean active, Long feedKg, Double mortalityRate, Long salesVolume, Long netProfitXof)` — nullable metrics = not shared.
  - `NetworkDashboardResponse(int farmCount, int activeFarmCount, Long totalFeedKg, Double avgMortalityRate)`.
  - `PartnerProfileResponse(Long partnerId, String name, String type, String logoUrl, int farmCount)`.
  - `PartnerNetworkReadService`: `PartnerProfileResponse profile(Long partnerId)`, `NetworkDashboardResponse dashboard(Long partnerId)`, `List<NetworkFarmRow> farms(Long partnerId)`, `NetworkFarmRow farm(Long partnerId, Long farmId)` (404 via `NotFoundException` if not a CONFIRMED member or shares nothing).

- [ ] **Step 1: Inspect the facade record shapes**

Read `LivestockFacade` and its returned records (e.g. `LivestockStats`) and `FinanceFacade.FarmPnl` to find the exact fields for **feed consumed (kg)**, **mortality rate**, **sales volume**, **net profit**. Use those exact accessors in Step 3. If a needed aggregate is absent from a facade, add a **read-only** method to that facade (mirror an existing read method) rather than reaching into another context's repository. Note the chosen accessors here before coding.

- [ ] **Step 2: Write the response records** (per the Interfaces block above — six-field `NetworkFarmRow`, etc., with nullable boxed metrics).

- [ ] **Step 3: Write the failing service test `PartnerNetworkReadServiceTest`**

Mock `PartnerFacade`, `PartnerService`, `TenancyFacade`, `LivestockFacade`, `FinanceFacade`. Cover:
```java
  @Test
  void dashboardCountsOnlyFarmsSharingEachScope() {
    // farm 10 shares feed_consumption + flock_health; farm 11 shares nothing money/health.
    when(partnerFacade.farmIdsInNetwork(1L)).thenReturn(java.util.List.of(10L, 11L));
    when(partnerFacade.sharedScopes(1L, 10L)).thenReturn(java.util.Set.of("feed_consumption", "flock_health"));
    when(partnerFacade.sharedScopes(1L, 11L)).thenReturn(java.util.Set.of("activity"));
    // stub LivestockFacade so farm 10 has 500kg feed + 3% mortality (exact accessors from Step 1)
    // ...
    var dash = service().dashboard(1L);
    assertThat(dash.farmCount()).isEqualTo(2);
    assertThat(dash.totalFeedKg()).isEqualTo(500L);      // farm 11 excluded (doesn't share feed)
    assertThat(dash.avgMortalityRate()).isEqualTo(3.0);  // only farm 10 counted
  }

  @Test
  void farmRowMasksUnsharedMetrics() {
    when(partnerFacade.farmIdsInNetwork(1L)).thenReturn(java.util.List.of(10L));
    when(partnerFacade.sharedScopes(1L, 10L)).thenReturn(java.util.Set.of("activity")); // no feed/health/money
    // ... tenancy name stub ...
    var rows = service().farms(1L);
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).feedKg()).isNull();
    assertThat(rows.get(0).mortalityRate()).isNull();
    assertThat(rows.get(0).netProfitXof()).isNull();
  }

  @Test
  void farmDetailIsNotFoundForFarmOutsideNetwork() {
    when(partnerFacade.farmIdsInNetwork(1L)).thenReturn(java.util.List.of(10L));
    assertThatThrownBy(() -> service().farm(1L, 999L)).isInstanceOf(NotFoundException.class);
  }
```

- [ ] **Step 4: Run to verify it fails**, then **Step 5: Write `PartnerNetworkReadService`**

Orchestration: `farmIdsInNetwork(partnerId)` → for each farm, `sharedScopes(partnerId, farmId)`; pull a metric **only if** its scope key is present (`feed_consumption`→feedKg, `flock_health`→mortalityRate, `sales_volume`→salesVolume, `finances`→netProfitXof, `activity`→active), else leave `null`; farm name always via `TenancyFacade.findById`. `dashboard` = aggregate over the rows (sum feedKg over non-null; average mortalityRate over non-null; counts). `farm(partnerId, farmId)`: if `farmId` not in `farmIdsInNetwork` → `NotFoundException.of("Farm", farmId)`. All methods `@Transactional(readOnly = true)`. **No writes.**

- [ ] **Step 6: Write `PartnerPortalController`**

```java
package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.PartnerContext;
import com.avicare.partner.dto.response.NetworkDashboardResponse;
import com.avicare.partner.dto.response.NetworkFarmRow;
import com.avicare.partner.dto.response.PartnerProfileResponse;
import com.avicare.partner.service.PartnerNetworkReadService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Partner-portal read-only network view ("Voir"). partnerId comes from the token — never the path. */
@RestController
@RequestMapping("/api/v1/partner")
@RequiredArgsConstructor
@PreAuthorize("@partnerAccess.isPartner()")
public class PartnerPortalController {

  private final PartnerNetworkReadService readService;

  @GetMapping("/me")
  public ApiResponse<PartnerProfileResponse> me() {
    return ApiResponse.of(readService.profile(PartnerContext.currentPartnerId()));
  }

  @GetMapping("/network")
  public ApiResponse<NetworkDashboardResponse> network() {
    return ApiResponse.of(readService.dashboard(PartnerContext.currentPartnerId()));
  }

  @GetMapping("/network/farms")
  public ApiResponse<List<NetworkFarmRow>> farms() {
    return ApiResponse.of(readService.farms(PartnerContext.currentPartnerId()));
  }

  @GetMapping("/network/farms/{farmId}")
  public ApiResponse<NetworkFarmRow> farm(@PathVariable Long farmId) {
    return ApiResponse.of(readService.farm(PartnerContext.currentPartnerId(), farmId));
  }
}
```

- [ ] **Step 7: Write the cloisonnement IT `PartnerPortalControllerIT` (DB-less)**

Copy the full DB-less harness from `FarmerPartnerControllerIT` (`@SpringBootTest(MOCK)` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`, the entire `@MockitoBean` repo block **plus the two new partner repos**, the RSA key helpers). `@MockitoBean private PartnerNetworkReadService readService;` and `@MockitoBean private com.avicare.partner.service.PartnerAuthService partnerAuthService;`. Forge tokens with `jwtService.generatePartnerAccessToken(new PartnerPrincipal(5L,"p@x.io",3L))` and a farmer token via `generateAccessToken(...)`. Assert the **cloisonnement**:
```java
  @Test
  void partnerToken_get_network_returns200() throws Exception {
    when(readService.dashboard(3L)).thenReturn(new NetworkDashboardResponse(0, 0, 0L, 0.0));
    mockMvc.perform(get("/api/v1/partner/network")
            .header("Authorization", "Bearer " + partnerToken()))
        .andExpect(status().isOk());
  }

  @Test
  void farmerToken_on_partnerEndpoint_returns403() throws Exception {
    mockMvc.perform(get("/api/v1/partner/network")
            .header("Authorization", "Bearer " + farmerToken()))
        .andExpect(status().isForbidden());
  }

  @Test
  void partnerToken_on_farmerEndpoint_returns403() throws Exception {
    mockMvc.perform(get("/api/v1/farms/42/partners")
            .header("Authorization", "Bearer " + partnerToken()))
        .andExpect(status().isForbidden());
  }

  @Test
  void noToken_returns401() throws Exception {
    mockMvc.perform(get("/api/v1/partner/network")).andExpect(status().isUnauthorized());
  }
```
where `partnerToken()` uses `generatePartnerAccessToken` and `farmerToken()` uses `generateAccessToken(new AvicarePrincipal(10L,"u@x.io",UserRole.USER,List.of(new Membership(42L,FarmRole.OWNER,List.of("*")))))`.

- [ ] **Step 8: Run the service test + the IT + spotless + commit**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerNetworkReadServiceTest,PartnerPortalControllerIT`
Expected: PASS (scope masking + the 3 cloisonnement assertions + 401).
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerNetworkReadService.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto/response/NetworkDashboardResponse.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto/response/NetworkFarmRow.java \
        backend/avicare-app/src/main/java/com/avicare/partner/dto/response/PartnerProfileResponse.java \
        backend/avicare-app/src/main/java/com/avicare/partner/controller/PartnerPortalController.java \
        backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerNetworkReadServiceTest.java \
        backend/avicare-app/src/test/java/com/avicare/partner/controller/PartnerPortalControllerIT.java
git commit -m "feat(backend:partner): Voir network read endpoints (/api/v1/partner)

profile/dashboard/farms/farm masked by shared scopes; DB-less cloisonnement IT (partner↔farmer 403)"
```

---

### Task 7: Validation complète + PR

- [ ] **Step 1: Full reactor build**

Run: `cd backend && ./mvnw clean verify`
Expected: BUILD SUCCESS hors les 3 échecs Testcontainers connus (`NotificationRepositoryTest`, `IdentityTenancyMappingTest`, `*RepositoryIT` — Docker indisponible en local). Valider explicitement les suites non-TC :
`./mvnw -pl avicare-app test -Dtest='com.avicare.partner.service.*,com.avicare.partner.controller.*,SecurityE2ETest,SecurityIntegrationTest,DashboardControllerIT,NotificationControllerIT'` + `./mvnw -pl common/common-security test`.

- [ ] **Step 2: Boot + smoke (optionnel, DB requise)**

`make backend-run`. Créer un partner + un partner-user via ADMIN (`POST /admin/partners`, `POST /admin/partners/{id}/users`), noter le mot de passe temporaire, puis `POST /api/v1/partner/auth/login` → token ; `GET /api/v1/partner/network` → `{"data":{...}}`. Vérifier qu'un token éleveur sur `/api/v1/partner/network` renvoie 403.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/partner-portal-b1-backend
gh pr create --fill --base main
gh pr checks --watch
```
Expected: CI verte (dont les ITs Testcontainers). Ne PAS merger sur CI rouge. **PR body : aucune mention Claude/IA** (cf. CLAUDE.md). Merge : `gh pr merge --rebase --delete-branch`.

---

## Notes d'exécution

- **Branche** : `feat/partner-portal-b1-backend` (déjà créée ; spec committé dessus).
- **Ordre** : 1→7 strict. L'auth (2-3) est le socle ; les endpoints (6) dépendent de tout le reste.
- **Déviation assumée vs spec** : le cloisonnement passe par le claim **`type=partner_access`** (et non `aud`) — même garantie (`requireType` rejette le croisement), et réutilise la machinerie `JwtService` existante. Le `partner_id` reste un claim dédié.
- **`common-security` a son propre cycle Maven** : builder/formatter avec `-pl common/common-security` pour les Tasks 2-3, `-pl avicare-app` pour le reste.
- **Après un merge de `main`** pendant le dev : `./mvnw clean install` si l'app démarre en erreur alors que le build passe (bytecode incrémental périmé).
- **B2 (hors ce plan)** : portail front `partner.jawdi.app` (login + dashboard read-only consommant `/api/v1/partner/**`).
