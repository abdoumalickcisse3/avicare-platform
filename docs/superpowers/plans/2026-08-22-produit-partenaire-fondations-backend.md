# Produit Partenaire — Fondations backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le socle backend du produit partenaire/coopérative (le lien ferme↔partenaire qui manque aujourd'hui) : schéma, domaine, services et façade, plus une surface REST ADMIN pour le rattachement manuel (chemin « prêt à signer »).

**Architecture:** Nouveau contexte racine DDD `com.avicare.partner` (peer de `finance`), qui référence `farms`/`users` par ID (aucun `@ManyToOne` cross-context, cf. ADR-008). Trois agrégats — `Partner`, `PartnerFarmMembership`, `PartnerInviteCode` — avec repositories JPA, deux services applicatifs (`PartnerService`, `PartnerNetworkService`), une façade publique `PartnerFacade` (contrat de lecture pour les futurs plans éleveur/portail), et un contrôleur `AdminPartnerController` gaté `hasRole('ADMIN')`. Les curseurs de partage de l'éleveur sont des colonnes booléennes sur l'adhésion (défaut : opérationnel ON, finances OFF).

**Tech Stack:** Java 21, Spring Boot, Spring Data JPA / Hibernate 6.4, PostgreSQL + Flyway, Lombok, MapStruct (non requis ici), JUnit 5 + Mockito + AssertJ, Testcontainers (repo slices, CI uniquement).

**Spec:** `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md`

## Global Constraints

- **Contexte racine** : `com.avicare.partner` sous `backend/avicare-app/src/main/java/`. Aucun import de `com.avicare.livestock.*`, `com.avicare.finance.*` etc. — communication par façades/ID uniquement.
- **Migration Flyway** : la prochaine version est **`V36`** (la plus haute mergée = `V35__whatsapp_outbox.sql`). Fichier immuable une fois mergé. Emplacement : `backend/avicare-app/src/main/resources/db/migration/`.
- **SQL** (doc 04, verrouillé) : tables `snake_case` pluriel ; `BIGSERIAL PRIMARY KEY` ; enums `VARCHAR` + `CHECK (... IN (...))` ; `TIMESTAMP` (UTC, sans TZ) ; audit `created_at`/`updated_at` via trigger **`update_updated_at_column()`** nommé `trg_<table>_updated_at` ; `deleted_at TIMESTAMP NULL` seulement sur tables à soft delete ; FK explicites `REFERENCES ... ON DELETE ...` ; index sur les FK et colonnes filtrées ; index unique partiel `WHERE ...` si pertinent.
- **JPA** : `@Id @GeneratedValue(strategy = IDENTITY)` ; `@Enumerated(EnumType.STRING)` ; `created_at`/`updated_at` mappés lecture seule (`insertable=false, updatable=false`), **jamais** `@UpdateTimestamp` ; soft delete via `@SQLDelete` + `@SQLRestriction("deleted_at IS NULL")` ; `@Table(name=...)` explicite.
- **Services** : `@Service` + `@RequiredArgsConstructor` ; `@Transactional` sur écriture, `@Transactional(readOnly = true)` sur lecture ; `@Valid` sur DTOs entrants.
- **DTOs** : records Java 21. **Exceptions** métier : héritent de `com.avicare.common.api.exception.BusinessException` ; réutiliser `NotFoundException.of("Partner", id)` pour les 404. Messages techniques en anglais.
- **Tests DB-less (RÉCURRENT, cf. mémoire projet)** : tout nouveau repository JPA doit être ajouté en `@MockitoBean` dans **les TROIS** contextes DB-less : `SecurityE2ETest`, `SecurityIntegrationTest`, `DashboardControllerIT`. Sinon ces tests cassent (vert local, rouge CI).
- **Testcontainers ne tourne PAS sur ce Mac** (Docker 29.x vs docker-java). Les tests service (Mockito, DB-less) tournent en local = la boucle TDD. Les tests repository `@DataJpaTest` + Testcontainers et la migration sont validés **en CI**. Ne jamais merger sur CI rouge.
- **Build local** (ADR-003) : valider avec `cd backend && ./mvnw clean verify` avant merge ; `make backend-run` + `curl localhost:8080/actuator/health` → UP.
- **Spotless** Google Java Format, 2 espaces. Appliquer avec `./mvnw spotless:apply -pl avicare-app` (jamais `-am`).
- **Commits** : Conventional Commits, scope `feat(backend:partner):`. **AUCUNE** signature/mention Claude/IA. Message pro, comme un humain solo dev.
- **Sécurité** : `AdminPartnerController` gaté `@PreAuthorize("hasRole('ADMIN')")` (patron = `subscription.controller.AdminChangeRequestController`). Endpoints sous `/api/v1/admin/**` (déjà publics-exclus dans `common-security` `SecurityConfig` → authentifiés).
- **Invariant de confiance** : les scopes de partage par défaut = opérationnel ON (`share_activity`, `share_flock_health`, `share_feed_consumption`), argent OFF (`share_sales_volume`, `share_finances`).

---

### Task 1: Enums + entités + migration V36

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerType.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerStatus.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/MembershipStatus.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/MembershipOrigin.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/Partner.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerFarmMembership.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/domain/PartnerInviteCode.java`
- Create: `backend/avicare-app/src/main/resources/db/migration/V36__partner_foundation.sql`

**Interfaces:**
- Produces: enums `PartnerType{FEED_SUPPLIER,VET}`, `PartnerStatus{ACTIVE,SUSPENDED}`, `MembershipStatus{DECLARED,CONFIRMED,LEFT}`, `MembershipOrigin{MANUAL_ADMIN,INVITE_CODE,FARMER_DECLARED}`; entities `Partner`, `PartnerFarmMembership`, `PartnerInviteCode` with getters/setters (Lombok `@Getter @Setter`).

- [ ] **Step 1: Write the four enums**

`PartnerType.java`:
```java
package com.avicare.partner.domain;

/** Kind of partner network operator. FEED_SUPPLIER = provendier; VET = veterinarian (prescriber). */
public enum PartnerType {
  FEED_SUPPLIER,
  VET
}
```

`PartnerStatus.java`:
```java
package com.avicare.partner.domain;

/** Lifecycle of a partner account. */
public enum PartnerStatus {
  ACTIVE,
  SUSPENDED
}
```

`MembershipStatus.java`:
```java
package com.avicare.partner.domain;

/**
 * Lifecycle of a farm's membership in a partner network. DECLARED = pending (farmer or invite code);
 * CONFIRMED = validated (admin or partner); LEFT = the farm left the network.
 */
public enum MembershipStatus {
  DECLARED,
  CONFIRMED,
  LEFT
}
```

`MembershipOrigin.java`:
```java
package com.avicare.partner.domain;

/** How a farm became attached to a partner network. */
public enum MembershipOrigin {
  MANUAL_ADMIN,
  INVITE_CODE,
  FARMER_DECLARED
}
```

- [ ] **Step 2: Write the `Partner` entity**

`Partner.java`:
```java
package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A partner network operator (feed supplier or vet) that equips a network of farms. Cross-tenant:
 * NOT scoped to a single farm. Farms are linked via {@link PartnerFarmMembership} (referenced by
 * id). Soft-deletable; timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "partners")
@Getter
@Setter
@NoArgsConstructor
@ToString
@SQLDelete(sql = "UPDATE partners SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Partner {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PartnerType type;

  @Column(name = "contact_name")
  private String contactName;

  @Column(name = "contact_phone")
  private String contactPhone;

  @Column(name = "contact_email")
  private String contactEmail;

  @Column(name = "logo_url")
  private String logoUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PartnerStatus status = PartnerStatus.ACTIVE;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;
}
```

- [ ] **Step 3: Write the `PartnerFarmMembership` entity**

`PartnerFarmMembership.java`:
```java
package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * The link between a farm and a partner network. Farm and partner referenced by id. The five
 * {@code share*} booleans are the farmer-controlled sharing sliders (default: operational ON,
 * money OFF). No soft delete: lifecycle is carried by {@link MembershipStatus} (LEFT).
 */
@Entity
@Table(name = "partner_farm_memberships")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class PartnerFarmMembership {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_id", nullable = false)
  private Long partnerId;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private MembershipStatus status = MembershipStatus.DECLARED;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private MembershipOrigin origin;

  @Column(name = "invite_code_id")
  private Long inviteCodeId;

  @Column(name = "share_activity", nullable = false)
  private boolean shareActivity = true;

  @Column(name = "share_flock_health", nullable = false)
  private boolean shareFlockHealth = true;

  @Column(name = "share_feed_consumption", nullable = false)
  private boolean shareFeedConsumption = true;

  @Column(name = "share_sales_volume", nullable = false)
  private boolean shareSalesVolume = false;

  @Column(name = "share_finances", nullable = false)
  private boolean shareFinances = false;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "confirmed_at")
  private LocalDateTime confirmedAt;

  @Column(name = "left_at")
  private LocalDateTime leftAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
```

- [ ] **Step 4: Write the `PartnerInviteCode` entity**

`PartnerInviteCode.java`:
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

/**
 * A distributable network invite code for a partner. A farm joining via a code creates a
 * {@link PartnerFarmMembership} with origin {@code INVITE_CODE}. {@code maxUses} null = unlimited.
 */
@Entity
@Table(name = "partner_invite_codes")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class PartnerInviteCode {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_id", nullable = false)
  private Long partnerId;

  @Column(nullable = false, unique = true)
  private String code;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "max_uses")
  private Integer maxUses;

  @Column(name = "uses_count", nullable = false)
  private int usesCount = 0;

  @Column(name = "expires_at")
  private LocalDateTime expiresAt;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
```

- [ ] **Step 5: Write the migration `V36__partner_foundation.sql`**

```sql
-- V36 — Produit partenaire/coopérative (B2B2C, item J) : socle du lien ferme↔partenaire.
-- Contexte racine cross-tenant. Curseurs de partage = colonnes booléennes (défaut : opérationnel
-- ON, argent OFF). Cf. spec 2026-08-20-produit-partenaire-cooperative-design.

CREATE TABLE partners (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    type          VARCHAR(20) NOT NULL CHECK (type IN ('FEED_SUPPLIER','VET')),
    contact_name  VARCHAR(200),
    contact_phone VARCHAR(40),
    contact_email VARCHAR(200),
    logo_url      TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
    created_by    BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMP
);
CREATE INDEX idx_partners_type ON partners(type) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_partners_updated_at
    BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE partner_invite_codes (
    id          BIGSERIAL PRIMARY KEY,
    partner_id  BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    code        VARCHAR(40) NOT NULL UNIQUE,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    max_uses    INTEGER,
    uses_count  INTEGER NOT NULL DEFAULT 0,
    expires_at  TIMESTAMP,
    created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_invite_codes_partner ON partner_invite_codes(partner_id);
CREATE TRIGGER trg_partner_invite_codes_updated_at
    BEFORE UPDATE ON partner_invite_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE partner_farm_memberships (
    id                     BIGSERIAL PRIMARY KEY,
    partner_id             BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    farm_id                BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    status                 VARCHAR(20) NOT NULL DEFAULT 'DECLARED'
                             CHECK (status IN ('DECLARED','CONFIRMED','LEFT')),
    origin                 VARCHAR(20) NOT NULL
                             CHECK (origin IN ('MANUAL_ADMIN','INVITE_CODE','FARMER_DECLARED')),
    invite_code_id         BIGINT REFERENCES partner_invite_codes(id) ON DELETE SET NULL,
    share_activity         BOOLEAN NOT NULL DEFAULT TRUE,
    share_flock_health     BOOLEAN NOT NULL DEFAULT TRUE,
    share_feed_consumption BOOLEAN NOT NULL DEFAULT TRUE,
    share_sales_volume     BOOLEAN NOT NULL DEFAULT FALSE,
    share_finances         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at           TIMESTAMP,
    left_at                TIMESTAMP,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_partner_farm_active
    ON partner_farm_memberships(partner_id, farm_id) WHERE status <> 'LEFT';
CREATE INDEX idx_partner_farm_by_partner ON partner_farm_memberships(partner_id, status);
CREATE INDEX idx_partner_farm_by_farm ON partner_farm_memberships(farm_id, status);
CREATE TRIGGER trg_partner_farm_memberships_updated_at
    BEFORE UPDATE ON partner_farm_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 6: Compile + Spotless**

Run: `cd backend && ./mvnw -q -pl avicare-app compile spotless:apply -pl avicare-app`
Expected: BUILD SUCCESS, no compile errors.

- [ ] **Step 7: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/partner/domain backend/avicare-app/src/main/resources/db/migration/V36__partner_foundation.sql
git commit -m "feat(backend:partner): partner foundation schema + domain entities

partners, partner_invite_codes, partner_farm_memberships (V36)
Partner/PartnerFarmMembership/PartnerInviteCode entities + 4 enums
Sharing sliders as boolean columns (operational ON, money OFF by default)
Per spec 2026-08-20-produit-partenaire-cooperative-design"
```

---

### Task 2: Repositories + repository slice tests

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerRepository.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerFarmMembershipRepository.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/repository/PartnerInviteCodeRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/repository/PartnerRepositoryIT.java`

**Interfaces:**
- Consumes: entities from Task 1.
- Produces:
  - `PartnerRepository extends JpaRepository<Partner, Long>` : `List<Partner> findByType(PartnerType type)`.
  - `PartnerFarmMembershipRepository extends JpaRepository<PartnerFarmMembership, Long>` :
    `List<PartnerFarmMembership> findByPartnerIdAndStatusNot(Long partnerId, MembershipStatus status)`,
    `List<PartnerFarmMembership> findByFarmIdAndStatusNot(Long farmId, MembershipStatus status)`,
    `Optional<PartnerFarmMembership> findByPartnerIdAndFarmIdAndStatusNot(Long partnerId, Long farmId, MembershipStatus status)`.
  - `PartnerInviteCodeRepository extends JpaRepository<PartnerInviteCode, Long>` :
    `Optional<PartnerInviteCode> findByCode(String code)`,
    `List<PartnerInviteCode> findByPartnerId(Long partnerId)`.

- [ ] **Step 1: Write the three repositories**

`PartnerRepository.java`:
```java
package com.avicare.partner.repository;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link Partner} entities. Soft-deleted rows filtered by {@code @SQLRestriction}. */
public interface PartnerRepository extends JpaRepository<Partner, Long> {

  List<Partner> findByType(PartnerType type);
}
```

`PartnerFarmMembershipRepository.java`:
```java
package com.avicare.partner.repository;

import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerFarmMembership} entities. */
public interface PartnerFarmMembershipRepository
    extends JpaRepository<PartnerFarmMembership, Long> {

  List<PartnerFarmMembership> findByPartnerIdAndStatusNot(Long partnerId, MembershipStatus status);

  List<PartnerFarmMembership> findByFarmIdAndStatusNot(Long farmId, MembershipStatus status);

  Optional<PartnerFarmMembership> findByPartnerIdAndFarmIdAndStatusNot(
      Long partnerId, Long farmId, MembershipStatus status);
}
```

`PartnerInviteCodeRepository.java`:
```java
package com.avicare.partner.repository;

import com.avicare.partner.domain.PartnerInviteCode;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerInviteCode} entities. */
public interface PartnerInviteCodeRepository extends JpaRepository<PartnerInviteCode, Long> {

  Optional<PartnerInviteCode> findByCode(String code);

  List<PartnerInviteCode> findByPartnerId(Long partnerId);
}
```

- [ ] **Step 2: Write the repository slice test (validated in CI)**

> NOTE: Testcontainers ne tourne pas en local (cf. Global Constraints). Écrire ce test, le compiler en local, mais s'attendre à ce qu'il ne s'exécute qu'en CI. **Template exact à copier** : `backend/avicare-app/src/test/java/com/avicare/notification/NotificationRepositoryTest.java` (annotation de classe, base Testcontainers, bloc `@DynamicPropertySource`). Reproduire ce bloc **à l'identique** (datasource + `spring.flyway.enabled=true`).

`PartnerRepositoryIT.java`:
```java
package com.avicare.partner.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerType;
// + les imports @DataJpaTest / Testcontainers copiés d'un IT repository existant.

class PartnerRepositoryIT /* extends <base Testcontainers du projet, cf. IT existant> */ {

  // @Autowired PartnerRepository partnerRepository;
  // @Autowired PartnerFarmMembershipRepository membershipRepository;

  // @Test
  void savesAndFiltersSoftDeletedPartners() {
    // Given a persisted partner
    // Partner p = new Partner(); p.setName("Provendier X"); p.setType(PartnerType.FEED_SUPPLIER);
    // p.setCreatedBy(1L); p = partnerRepository.saveAndFlush(p);
    // Then findByType returns it
    // assertThat(partnerRepository.findByType(PartnerType.FEED_SUPPLIER)).extracting(Partner::getId).contains(p.getId());
    // When soft-deleted
    // partnerRepository.delete(p);
    // Then it is filtered out
    // assertThat(partnerRepository.findById(p.getId())).isEmpty();
  }

  // @Test
  void uniqueActiveMembershipPerPartnerFarm() {
    // Persist a partner + a farm (seed a farm row via the tenancy repository or SQL), then a
    // CONFIRMED membership; a second non-LEFT membership for the same (partner, farm) must violate
    // uq_partner_farm_active. Assert a DataIntegrityViolationException on saveAndFlush.
  }
}
```

> Décommenter et compléter en suivant EXACTEMENT le patron d'un IT repository existant du projet (annotation de classe, base, `@DynamicPropertySource`). Semer une `farms` row via le repository tenancy disponible dans le slice, ou via `@Sql`.

- [ ] **Step 3: Compile + Spotless**

Run: `cd backend && ./mvnw -q -pl avicare-app test-compile spotless:apply -pl avicare-app`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/partner/repository backend/avicare-app/src/test/java/com/avicare/partner/repository
git commit -m "feat(backend:partner): repositories + repository slice test

PartnerRepository / PartnerFarmMembershipRepository / PartnerInviteCodeRepository
PartnerRepositoryIT covers soft-delete filtering + unique active membership (CI)"
```

---

### Task 3: PartnerService (partner CRUD + invite codes)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/exception/InviteCodeInvalidException.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerServiceTest.java`

**Interfaces:**
- Consumes: `PartnerRepository`, `PartnerInviteCodeRepository` (Task 2).
- Produces (public methods on `PartnerService`):
  - `Partner create(String name, PartnerType type, String contactName, String contactPhone, String contactEmail, String logoUrl, Long actorUserId)`
  - `List<Partner> list()`
  - `Partner get(Long partnerId)` — throws `NotFoundException` if absent
  - `Partner setStatus(Long partnerId, PartnerStatus status)`
  - `PartnerInviteCode generateInviteCode(Long partnerId, Integer maxUses, LocalDateTime expiresAt, Long actorUserId)` — generates an 8-char uppercase alphanumeric unique `code`.
- `InviteCodeInvalidException(String message)` extends `BusinessException` with code `INVITE_CODE_INVALID`, HTTP 422.

- [ ] **Step 1: Write `InviteCodeInvalidException`**

```java
package com.avicare.partner.exception;

import com.avicare.common.api.exception.BusinessException;
import org.springframework.http.HttpStatus;

/** An invite code is unknown, inactive, expired, or exhausted (HTTP 422). */
public class InviteCodeInvalidException extends BusinessException {

  public InviteCodeInvalidException(String message) {
    super("INVITE_CODE_INVALID", message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
```

- [ ] **Step 2: Write the failing test**

`PartnerServiceTest.java`:
```java
package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerServiceTest {

  @Mock PartnerRepository partnerRepository;
  @Mock PartnerInviteCodeRepository inviteCodeRepository;
  @InjectMocks PartnerService service;

  @Test
  void createPersistsActivePartnerWithActor() {
    when(partnerRepository.save(any(Partner.class))).thenAnswer(inv -> inv.getArgument(0));

    Partner p =
        service.create("Provendier X", PartnerType.FEED_SUPPLIER, "Awa", "770000000", null, null, 7L);

    assertThat(p.getName()).isEqualTo("Provendier X");
    assertThat(p.getType()).isEqualTo(PartnerType.FEED_SUPPLIER);
    assertThat(p.getCreatedBy()).isEqualTo(7L);
  }

  @Test
  void generateInviteCodeProducesUniqueUppercaseCode() {
    when(inviteCodeRepository.findByCode(any())).thenReturn(Optional.empty());
    when(inviteCodeRepository.save(any(PartnerInviteCode.class))).thenAnswer(inv -> inv.getArgument(0));

    PartnerInviteCode code = service.generateInviteCode(3L, 50, null, 7L);

    assertThat(code.getPartnerId()).isEqualTo(3L);
    assertThat(code.getCode()).hasSize(8).matches("[A-Z0-9]{8}");
    assertThat(code.getMaxUses()).isEqualTo(50);
    assertThat(code.isActive()).isTrue();
  }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerServiceTest`
Expected: FAIL — `PartnerService` does not exist / methods undefined.

- [ ] **Step 4: Write `PartnerService`**

```java
package com.avicare.partner.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Partner account lifecycle and invite-code generation (admin side). */
@Service
@RequiredArgsConstructor
public class PartnerService {

  private static final String CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  private static final int CODE_LENGTH = 8;
  private static final SecureRandom RANDOM = new SecureRandom();

  private final PartnerRepository partnerRepository;
  private final PartnerInviteCodeRepository inviteCodeRepository;

  @Transactional
  public Partner create(
      String name,
      PartnerType type,
      String contactName,
      String contactPhone,
      String contactEmail,
      String logoUrl,
      Long actorUserId) {
    Partner p = new Partner();
    p.setName(name);
    p.setType(type);
    p.setContactName(contactName);
    p.setContactPhone(contactPhone);
    p.setContactEmail(contactEmail);
    p.setLogoUrl(logoUrl);
    p.setStatus(PartnerStatus.ACTIVE);
    p.setCreatedBy(actorUserId);
    return partnerRepository.save(p);
  }

  @Transactional(readOnly = true)
  public List<Partner> list() {
    return partnerRepository.findAll();
  }

  @Transactional(readOnly = true)
  public Partner get(Long partnerId) {
    return partnerRepository
        .findById(partnerId)
        .orElseThrow(() -> NotFoundException.of("Partner", partnerId));
  }

  @Transactional
  public Partner setStatus(Long partnerId, PartnerStatus status) {
    Partner p = get(partnerId);
    p.setStatus(status);
    return partnerRepository.save(p);
  }

  @Transactional
  public PartnerInviteCode generateInviteCode(
      Long partnerId, Integer maxUses, LocalDateTime expiresAt, Long actorUserId) {
    get(partnerId); // 404 if the partner does not exist
    PartnerInviteCode code = new PartnerInviteCode();
    code.setPartnerId(partnerId);
    code.setCode(uniqueCode());
    code.setActive(true);
    code.setMaxUses(maxUses);
    code.setExpiresAt(expiresAt);
    code.setCreatedBy(actorUserId);
    return inviteCodeRepository.save(code);
  }

  private String uniqueCode() {
    String candidate;
    do {
      StringBuilder sb = new StringBuilder(CODE_LENGTH);
      for (int i = 0; i < CODE_LENGTH; i++) {
        sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
      }
      candidate = sb.toString();
    } while (inviteCodeRepository.findByCode(candidate).isPresent());
    return candidate;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerServiceTest`
Expected: PASS.

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerService.java backend/avicare-app/src/main/java/com/avicare/partner/exception backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerServiceTest.java
git commit -m "feat(backend:partner): PartnerService (CRUD + invite code generation)

create/list/get/setStatus + generateInviteCode (8-char unique code)
InviteCodeInvalidException (422); PartnerServiceTest DB-less"
```

---

### Task 4: PartnerNetworkService (memberships + join flows)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerNetworkService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/exception/DuplicateMembershipException.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/SharingScopes.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerNetworkServiceTest.java`

**Interfaces:**
- Consumes: `PartnerFarmMembershipRepository`, `PartnerInviteCodeRepository`, `PartnerService` (for `get`).
- Produces (public methods on `PartnerNetworkService`):
  - `PartnerFarmMembership attachFarmManually(Long partnerId, Long farmId, Long actorUserId)` — origin `MANUAL_ADMIN`, status `CONFIRMED`, `confirmedAt` set.
  - `PartnerFarmMembership declareSupplier(Long partnerId, Long farmId, Long farmerUserId)` — origin `FARMER_DECLARED`, status `DECLARED`.
  - `PartnerFarmMembership joinViaCode(String code, Long farmId, Long farmerUserId)` — validates the code, origin `INVITE_CODE`, status `DECLARED`, increments `usesCount`; throws `InviteCodeInvalidException`.
  - `PartnerFarmMembership confirm(Long membershipId)` — status `CONFIRMED`, `confirmedAt` set.
  - `PartnerFarmMembership updateSharingScopes(Long membershipId, SharingScopes scopes)`
  - `PartnerFarmMembership leave(Long membershipId)` — status `LEFT`, `leftAt` set.
  - `List<PartnerFarmMembership> listForPartner(Long partnerId)` — excludes `LEFT`.
  - `List<PartnerFarmMembership> listForFarm(Long farmId)` — excludes `LEFT`.
- `SharingScopes` record: `record SharingScopes(boolean activity, boolean flockHealth, boolean feedConsumption, boolean salesVolume, boolean finances) {}`
- `DuplicateMembershipException(Long partnerId, Long farmId)` extends `BusinessException`, code `MEMBERSHIP_EXISTS`, HTTP 409.

- [ ] **Step 1: Write `SharingScopes` + `DuplicateMembershipException`**

`SharingScopes.java`:
```java
package com.avicare.partner.service;

/** Farmer-controlled sharing sliders for a partner membership. */
public record SharingScopes(
    boolean activity,
    boolean flockHealth,
    boolean feedConsumption,
    boolean salesVolume,
    boolean finances) {}
```

`DuplicateMembershipException.java`:
```java
package com.avicare.partner.exception;

import com.avicare.common.api.exception.BusinessException;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** A non-LEFT membership already exists for this (partner, farm) pair (HTTP 409). */
public class DuplicateMembershipException extends BusinessException {

  public DuplicateMembershipException(Long partnerId, Long farmId) {
    super(
        "MEMBERSHIP_EXISTS",
        "Farm " + farmId + " already belongs to partner " + partnerId,
        HttpStatus.CONFLICT,
        Map.of("partnerId", partnerId, "farmId", farmId));
  }
}
```

- [ ] **Step 2: Write the failing test**

`PartnerNetworkServiceTest.java`:
```java
package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.exception.DuplicateMembershipException;
import com.avicare.partner.exception.InviteCodeInvalidException;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerNetworkServiceTest {

  @Mock PartnerFarmMembershipRepository membershipRepository;
  @Mock PartnerInviteCodeRepository inviteCodeRepository;
  @Mock PartnerService partnerService;

  PartnerNetworkService service() {
    return new PartnerNetworkService(membershipRepository, inviteCodeRepository, partnerService);
  }

  @Test
  void attachFarmManuallyCreatesConfirmedManualMembership() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 2L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership m = service().attachFarmManually(1L, 2L, 7L);

    assertThat(m.getPartnerId()).isEqualTo(1L);
    assertThat(m.getFarmId()).isEqualTo(2L);
    assertThat(m.getOrigin()).isEqualTo(MembershipOrigin.MANUAL_ADMIN);
    assertThat(m.getStatus()).isEqualTo(MembershipStatus.CONFIRMED);
    assertThat(m.getConfirmedAt()).isNotNull();
    assertThat(m.isShareActivity()).isTrue();
    assertThat(m.isShareFinances()).isFalse();
  }

  @Test
  void attachFarmManuallyRejectsDuplicate() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 2L, MembershipStatus.LEFT))
        .thenReturn(Optional.of(new PartnerFarmMembership()));

    assertThatThrownBy(() -> service().attachFarmManually(1L, 2L, 7L))
        .isInstanceOf(DuplicateMembershipException.class);
  }

  @Test
  void joinViaCodeRejectsExpiredCode() {
    PartnerInviteCode code = new PartnerInviteCode();
    code.setPartnerId(1L);
    code.setActive(true);
    code.setExpiresAt(LocalDateTime.now().minusDays(1));
    when(inviteCodeRepository.findByCode("EXPIRED1")).thenReturn(Optional.of(code));

    assertThatThrownBy(() -> service().joinViaCode("EXPIRED1", 2L, 9L))
        .isInstanceOf(InviteCodeInvalidException.class);
  }

  @Test
  void joinViaCodeCreatesDeclaredMembershipAndIncrementsUses() {
    PartnerInviteCode code = new PartnerInviteCode();
    code.setId(5L);
    code.setPartnerId(1L);
    code.setActive(true);
    code.setMaxUses(10);
    code.setUsesCount(3);
    when(inviteCodeRepository.findByCode("GOOD1234")).thenReturn(Optional.of(code));
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 2L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership m = service().joinViaCode("GOOD1234", 2L, 9L);

    assertThat(m.getOrigin()).isEqualTo(MembershipOrigin.INVITE_CODE);
    assertThat(m.getStatus()).isEqualTo(MembershipStatus.DECLARED);
    assertThat(m.getInviteCodeId()).isEqualTo(5L);
    assertThat(code.getUsesCount()).isEqualTo(4);
  }

  @Test
  void updateSharingScopesAppliesAllFive() {
    PartnerFarmMembership existing = new PartnerFarmMembership();
    existing.setId(8L);
    when(membershipRepository.findById(8L)).thenReturn(Optional.of(existing));
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership m =
        service().updateSharingScopes(8L, new SharingScopes(true, true, false, true, false));

    assertThat(m.isShareActivity()).isTrue();
    assertThat(m.isShareFeedConsumption()).isFalse();
    assertThat(m.isShareSalesVolume()).isTrue();
    assertThat(m.isShareFinances()).isFalse();
  }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerNetworkServiceTest`
Expected: FAIL — `PartnerNetworkService` does not exist.

- [ ] **Step 4: Write `PartnerNetworkService`**

```java
package com.avicare.partner.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.exception.DuplicateMembershipException;
import com.avicare.partner.exception.InviteCodeInvalidException;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Farm↔partner membership lifecycle and join flows (manual, invite code, farmer-declared). */
@Service
@RequiredArgsConstructor
public class PartnerNetworkService {

  private final PartnerFarmMembershipRepository membershipRepository;
  private final PartnerInviteCodeRepository inviteCodeRepository;
  private final PartnerService partnerService;

  @Transactional
  public PartnerFarmMembership attachFarmManually(Long partnerId, Long farmId, Long actorUserId) {
    partnerService.get(partnerId); // 404 if absent
    requireNoActiveMembership(partnerId, farmId);
    PartnerFarmMembership m = newMembership(partnerId, farmId, MembershipOrigin.MANUAL_ADMIN, actorUserId);
    m.setStatus(MembershipStatus.CONFIRMED);
    m.setConfirmedAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership declareSupplier(Long partnerId, Long farmId, Long farmerUserId) {
    partnerService.get(partnerId);
    requireNoActiveMembership(partnerId, farmId);
    return membershipRepository.save(
        newMembership(partnerId, farmId, MembershipOrigin.FARMER_DECLARED, farmerUserId));
  }

  @Transactional
  public PartnerFarmMembership joinViaCode(String code, Long farmId, Long farmerUserId) {
    PartnerInviteCode invite =
        inviteCodeRepository
            .findByCode(code)
            .orElseThrow(() -> new InviteCodeInvalidException("Unknown invite code"));
    if (!invite.isActive()) {
      throw new InviteCodeInvalidException("Invite code is inactive");
    }
    if (invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(LocalDateTime.now())) {
      throw new InviteCodeInvalidException("Invite code has expired");
    }
    if (invite.getMaxUses() != null && invite.getUsesCount() >= invite.getMaxUses()) {
      throw new InviteCodeInvalidException("Invite code has reached its usage limit");
    }
    requireNoActiveMembership(invite.getPartnerId(), farmId);

    PartnerFarmMembership m =
        newMembership(invite.getPartnerId(), farmId, MembershipOrigin.INVITE_CODE, farmerUserId);
    m.setInviteCodeId(invite.getId());
    invite.setUsesCount(invite.getUsesCount() + 1);
    inviteCodeRepository.save(invite);
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership confirm(Long membershipId) {
    PartnerFarmMembership m = load(membershipId);
    m.setStatus(MembershipStatus.CONFIRMED);
    m.setConfirmedAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership updateSharingScopes(Long membershipId, SharingScopes scopes) {
    PartnerFarmMembership m = load(membershipId);
    m.setShareActivity(scopes.activity());
    m.setShareFlockHealth(scopes.flockHealth());
    m.setShareFeedConsumption(scopes.feedConsumption());
    m.setShareSalesVolume(scopes.salesVolume());
    m.setShareFinances(scopes.finances());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership leave(Long membershipId) {
    PartnerFarmMembership m = load(membershipId);
    m.setStatus(MembershipStatus.LEFT);
    m.setLeftAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional(readOnly = true)
  public List<PartnerFarmMembership> listForPartner(Long partnerId) {
    return membershipRepository.findByPartnerIdAndStatusNot(partnerId, MembershipStatus.LEFT);
  }

  @Transactional(readOnly = true)
  public List<PartnerFarmMembership> listForFarm(Long farmId) {
    return membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT);
  }

  private PartnerFarmMembership load(Long membershipId) {
    return membershipRepository
        .findById(membershipId)
        .orElseThrow(() -> NotFoundException.of("PartnerFarmMembership", membershipId));
  }

  private void requireNoActiveMembership(Long partnerId, Long farmId) {
    membershipRepository
        .findByPartnerIdAndFarmIdAndStatusNot(partnerId, farmId, MembershipStatus.LEFT)
        .ifPresent(
            existing -> {
              throw new DuplicateMembershipException(partnerId, farmId);
            });
  }

  private PartnerFarmMembership newMembership(
      Long partnerId, Long farmId, MembershipOrigin origin, Long actorUserId) {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setPartnerId(partnerId);
    m.setFarmId(farmId);
    m.setOrigin(origin);
    m.setStatus(MembershipStatus.DECLARED);
    m.setCreatedBy(actorUserId);
    return m; // sharing defaults come from the entity field initializers
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerNetworkServiceTest`
Expected: PASS.

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerNetworkService.java backend/avicare-app/src/main/java/com/avicare/partner/service/SharingScopes.java backend/avicare-app/src/main/java/com/avicare/partner/exception/DuplicateMembershipException.java backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerNetworkServiceTest.java
git commit -m "feat(backend:partner): PartnerNetworkService (memberships + join flows)

attach/declare/joinViaCode/confirm/updateScopes/leave + list views
invite-code validation (inactive/expired/exhausted), duplicate guard (409)
SharingScopes record; PartnerNetworkServiceTest DB-less"
```

---

### Task 5: PartnerFacade (cross-context read contract)

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/api/PartnerFacade.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/api/dto/PartnerLink.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerFacadeImpl.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerFacadeImplTest.java`

**Interfaces:**
- Consumes: `PartnerNetworkService`, `PartnerService`, `PartnerFarmMembershipRepository`.
- Produces:
  - `record PartnerLink(Long partnerId, String partnerName, String partnerType, Long membershipId, String membershipStatus)`
  - `PartnerFacade` interface:
    - `List<Long> farmIdsInNetwork(Long partnerId)` — CONFIRMED farm ids only.
    - `java.util.Set<String> sharedScopes(Long partnerId, Long farmId)` — scope keys the farm shares (`"activity"`, `"flock_health"`, `"feed_consumption"`, `"sales_volume"`, `"finances"`), empty if no active membership.
    - `List<PartnerLink> partnersForFarm(Long farmId)` — a farm's non-LEFT partner links (for the future farmer app).

- [ ] **Step 1: Write `PartnerLink` + `PartnerFacade`**

`PartnerLink.java`:
```java
package com.avicare.partner.api.dto;

/** A farm's link to a partner, for cross-context reads (e.g. the farmer app's "your partners"). */
public record PartnerLink(
    Long partnerId,
    String partnerName,
    String partnerType,
    Long membershipId,
    String membershipStatus) {}
```

`PartnerFacade.java`:
```java
package com.avicare.partner.api;

import com.avicare.partner.api.dto.PartnerLink;
import java.util.List;
import java.util.Set;

/**
 * Public read contract of the partner context for other bounded contexts and future surfaces
 * (farmer app, partner portal). Scope filtering is the trust boundary: {@link #sharedScopes}
 * returns only what a farm has agreed to share with a given partner.
 */
public interface PartnerFacade {

  /** Confirmed farm ids in a partner's network. */
  List<Long> farmIdsInNetwork(Long partnerId);

  /** Scope keys a farm shares with a partner (empty if no active membership). */
  Set<String> sharedScopes(Long partnerId, Long farmId);

  /** A farm's non-LEFT partner links. */
  List<PartnerLink> partnersForFarm(Long farmId);
}
```

- [ ] **Step 2: Write the failing test**

`PartnerFacadeImplTest.java`:
```java
package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerFacadeImplTest {

  @Mock PartnerFarmMembershipRepository membershipRepository;

  private PartnerFarmMembership membership(long farmId, MembershipStatus status) {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setPartnerId(1L);
    m.setFarmId(farmId);
    m.setStatus(status);
    return m;
  }

  @Test
  void farmIdsInNetworkReturnsOnlyConfirmed() {
    when(membershipRepository.findByPartnerIdAndStatusNot(1L, MembershipStatus.LEFT))
        .thenReturn(
            List.of(
                membership(10L, MembershipStatus.CONFIRMED),
                membership(11L, MembershipStatus.DECLARED)));

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository);

    assertThat(facade.farmIdsInNetwork(1L)).containsExactly(10L);
  }

  @Test
  void sharedScopesReflectsBooleans() {
    PartnerFarmMembership m = membership(10L, MembershipStatus.CONFIRMED);
    m.setShareActivity(true);
    m.setShareFinances(false);
    m.setShareSalesVolume(true);
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 10L, MembershipStatus.LEFT))
        .thenReturn(Optional.of(m));

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository);

    assertThat(facade.sharedScopes(1L, 10L)).contains("activity", "sales_volume").doesNotContain("finances");
  }

  @Test
  void sharedScopesEmptyWhenNoMembership() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 99L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository);

    assertThat(facade.sharedScopes(1L, 99L)).isEmpty();
  }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerFacadeImplTest`
Expected: FAIL — `PartnerFacadeImpl` does not exist.

- [ ] **Step 4: Write `PartnerFacadeImpl`**

> Note : cette impl ne lit que le repository des adhésions ; `farmIdsInNetwork`/`sharedScopes` n'ont pas besoin de charger l'entité `Partner`. `partnersForFarm` a besoin du nom/type du partenaire → injecter aussi `PartnerRepository` et résoudre par id (les partenaires LEFT-only sont exclus par le filtre de statut).

```java
package com.avicare.partner.service;

import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.api.dto.PartnerLink;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link PartnerFacade} implementation. Scope filtering is the trust boundary. */
@Service
@RequiredArgsConstructor
public class PartnerFacadeImpl implements PartnerFacade {

  private final PartnerFarmMembershipRepository membershipRepository;

  @Override
  @Transactional(readOnly = true)
  public List<Long> farmIdsInNetwork(Long partnerId) {
    return membershipRepository.findByPartnerIdAndStatusNot(partnerId, MembershipStatus.LEFT).stream()
        .filter(m -> m.getStatus() == MembershipStatus.CONFIRMED)
        .map(PartnerFarmMembership::getFarmId)
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public Set<String> sharedScopes(Long partnerId, Long farmId) {
    return membershipRepository
        .findByPartnerIdAndFarmIdAndStatusNot(partnerId, farmId, MembershipStatus.LEFT)
        .map(PartnerFacadeImpl::scopesOf)
        .orElseGet(Set::of);
  }

  @Override
  @Transactional(readOnly = true)
  public List<PartnerLink> partnersForFarm(Long farmId) {
    return membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT).stream()
        .map(
            m ->
                new PartnerLink(
                    m.getPartnerId(), null, null, m.getId(), m.getStatus().name()))
        .toList();
  }

  private static Set<String> scopesOf(PartnerFarmMembership m) {
    Set<String> scopes = new LinkedHashSet<>();
    if (m.isShareActivity()) scopes.add("activity");
    if (m.isShareFlockHealth()) scopes.add("flock_health");
    if (m.isShareFeedConsumption()) scopes.add("feed_consumption");
    if (m.isShareSalesVolume()) scopes.add("sales_volume");
    if (m.isShareFinances()) scopes.add("finances");
    return scopes;
  }
}
```

> `partnersForFarm` renvoie `partnerName`/`partnerType` à `null` pour l'instant (le plan éleveur les résoudra en injectant `PartnerRepository`). Documenté comme dette assumée : ce plan pose le contrat, le plan éleveur enrichit. Si le reviewer préfère les résoudre maintenant, injecter `PartnerRepository` et `findAllById` sur les `partnerId` distincts.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=PartnerFacadeImplTest`
Expected: PASS.

- [ ] **Step 6: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/api backend/avicare-app/src/main/java/com/avicare/partner/service/PartnerFacadeImpl.java backend/avicare-app/src/test/java/com/avicare/partner/service/PartnerFacadeImplTest.java
git commit -m "feat(backend:partner): PartnerFacade read contract + impl

farmIdsInNetwork / sharedScopes (scope = trust boundary) / partnersForFarm
PartnerFacadeImplTest DB-less"
```

---

### Task 6: AdminPartnerController + DTOs + DB-less test wiring

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/controller/AdminPartnerController.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/CreatePartnerRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/AttachFarmRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/request/GenerateInviteCodeRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/PartnerResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/MembershipResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/partner/dto/response/InviteCodeResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/partner/controller/AdminPartnerControllerTest.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/security/SecurityE2ETest.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/security/SecurityIntegrationTest.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/reporting/controller/DashboardControllerIT.java`

**Interfaces:**
- Consumes: `PartnerService`, `PartnerNetworkService`, `TenancyContext.currentUserId()`.
- Produces: REST endpoints under `/api/v1/admin/partners`, gated `@PreAuthorize("hasRole('ADMIN')")`, wrapping results in `ApiResponse.of(...)` (patron `AdminChangeRequestController`).

- [ ] **Step 1: Write the request/response records**

`CreatePartnerRequest.java`:
```java
package com.avicare.partner.dto.request;

import com.avicare.partner.domain.PartnerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Create a partner (admin). */
public record CreatePartnerRequest(
    @NotBlank String name,
    @NotNull PartnerType type,
    String contactName,
    String contactPhone,
    String contactEmail,
    String logoUrl) {}
```

`AttachFarmRequest.java`:
```java
package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotNull;

/** Manually attach a farm to a partner network (admin). */
public record AttachFarmRequest(@NotNull Long farmId) {}
```

`GenerateInviteCodeRequest.java`:
```java
package com.avicare.partner.dto.request;

import java.time.LocalDateTime;

/** Generate an invite code (admin). Both fields optional: null maxUses = unlimited. */
public record GenerateInviteCodeRequest(Integer maxUses, LocalDateTime expiresAt) {}
```

`PartnerResponse.java`:
```java
package com.avicare.partner.dto.response;

import com.avicare.partner.domain.Partner;

/** Partner as returned by the API. */
public record PartnerResponse(
    Long id,
    String name,
    String type,
    String contactName,
    String contactPhone,
    String contactEmail,
    String logoUrl,
    String status) {

  public static PartnerResponse of(Partner p) {
    return new PartnerResponse(
        p.getId(),
        p.getName(),
        p.getType().name(),
        p.getContactName(),
        p.getContactPhone(),
        p.getContactEmail(),
        p.getLogoUrl(),
        p.getStatus().name());
  }
}
```

`MembershipResponse.java`:
```java
package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerFarmMembership;

/** Membership as returned by the API. */
public record MembershipResponse(
    Long id,
    Long partnerId,
    Long farmId,
    String status,
    String origin,
    boolean shareActivity,
    boolean shareFlockHealth,
    boolean shareFeedConsumption,
    boolean shareSalesVolume,
    boolean shareFinances) {

  public static MembershipResponse of(PartnerFarmMembership m) {
    return new MembershipResponse(
        m.getId(),
        m.getPartnerId(),
        m.getFarmId(),
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

`InviteCodeResponse.java`:
```java
package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerInviteCode;
import java.time.LocalDateTime;

/** Invite code as returned by the API. */
public record InviteCodeResponse(
    Long id, Long partnerId, String code, boolean active, Integer maxUses, int usesCount, LocalDateTime expiresAt) {

  public static InviteCodeResponse of(PartnerInviteCode c) {
    return new InviteCodeResponse(
        c.getId(), c.getPartnerId(), c.getCode(), c.isActive(), c.getMaxUses(), c.getUsesCount(), c.getExpiresAt());
  }
}
```

- [ ] **Step 2: Write the failing controller test (DB-less)**

> Suivre le patron DB-less : `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`, avec TOUS les repositories en `@MockitoBean` (cf. `SecurityE2ETest`). Ici on teste surtout le gating ADMIN + le happy path create. Le token ADMIN se forge via `jwtService.generateAccessToken(new AvicarePrincipal(...ADMIN...))` (patron mémoire projet [[apiit_nonowner_write_needs_real_user]]).

`AdminPartnerControllerTest.java`:
```java
package com.avicare.partner.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
// + imports du harness DB-less du projet : @SpringBootTest, @AutoConfigureMockMvc, @ActiveProfiles,
//   MockMvc, ObjectMapper, tous les @MockitoBean repositories (copier depuis SecurityE2ETest),
//   plus JwtService + AvicarePrincipal + UserRole pour forger le token.

class AdminPartnerControllerTest /* copier le harness DB-less d'un *ControllerTest existant */ {

  // @Autowired MockMvc mockMvc;
  // @Autowired ObjectMapper objectMapper;
  // @Autowired JwtService jwtService;
  // @MockitoBean PartnerService partnerService;
  // @MockitoBean PartnerNetworkService partnerNetworkService;
  // ... + tous les @MockitoBean repositories comme dans SecurityE2ETest ...

  // private String adminToken() {
  //   return "Bearer " + jwtService.generateAccessToken(
  //       new AvicarePrincipal(1L, "admin@jawdi.app", UserRole.ADMIN, java.util.List.of()));
  // }

  // @Test
  void createPartnerReturns200ForAdmin() throws Exception {
    // Partner p = new Partner(); p.setId(5L); p.setName("Provendier X");
    // p.setType(PartnerType.FEED_SUPPLIER); p.setStatus(...ACTIVE);
    // when(partnerService.create(eq("Provendier X"), eq(PartnerType.FEED_SUPPLIER), any(), any(), any(), any(), any()))
    //     .thenReturn(p);
    // mockMvc.perform(post("/api/v1/admin/partners").header("Authorization", adminToken())
    //         .contentType("application/json")
    //         .content("{\"name\":\"Provendier X\",\"type\":\"FEED_SUPPLIER\"}"))
    //     .andExpect(status().isOk())
    //     .andExpect(jsonPath("$.data.id").value(5));
  }

  // @Test
  void createPartnerReturns403ForNonAdmin() throws Exception {
    // Forger un token UserRole.USER → attendre status().isForbidden()
  }
}
```

> Décommenter et compléter en copiant le harness exact d'un `*ControllerTest` DB-less existant (annotations de classe + liste `@MockitoBean`). Le point testé qui compte : **200 pour ADMIN, 403 pour USER**.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=AdminPartnerControllerTest`
Expected: FAIL — `AdminPartnerController` does not exist.

- [ ] **Step 4: Write `AdminPartnerController`**

```java
package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.partner.dto.request.AttachFarmRequest;
import com.avicare.partner.dto.request.CreatePartnerRequest;
import com.avicare.partner.dto.request.GenerateInviteCodeRequest;
import com.avicare.partner.dto.response.InviteCodeResponse;
import com.avicare.partner.dto.response.MembershipResponse;
import com.avicare.partner.dto.response.PartnerResponse;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform-admin management of partners and their farm networks. Restricted to Jawdi staff ({@code
 * ROLE_ADMIN}). This is the "ready-to-sign" manual path (MANUAL_ADMIN origin) before a dedicated
 * partner portal exists.
 */
@RestController
@RequestMapping("/api/v1/admin/partners")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminPartnerController {

  private final PartnerService partnerService;
  private final PartnerNetworkService partnerNetworkService;

  @PostMapping
  public ApiResponse<PartnerResponse> create(@RequestBody @Valid CreatePartnerRequest req) {
    return ApiResponse.of(
        PartnerResponse.of(
            partnerService.create(
                req.name(),
                req.type(),
                req.contactName(),
                req.contactPhone(),
                req.contactEmail(),
                req.logoUrl(),
                TenancyContext.currentUserId())));
  }

  @GetMapping
  public ApiResponse<List<PartnerResponse>> list() {
    return ApiResponse.of(partnerService.list().stream().map(PartnerResponse::of).toList());
  }

  @GetMapping("/{partnerId}")
  public ApiResponse<PartnerResponse> get(@PathVariable Long partnerId) {
    return ApiResponse.of(PartnerResponse.of(partnerService.get(partnerId)));
  }

  @PostMapping("/{partnerId}/suspend")
  public ApiResponse<PartnerResponse> suspend(@PathVariable Long partnerId) {
    return ApiResponse.of(
        PartnerResponse.of(partnerService.setStatus(partnerId, PartnerStatus.SUSPENDED)));
  }

  @PostMapping("/{partnerId}/activate")
  public ApiResponse<PartnerResponse> activate(@PathVariable Long partnerId) {
    return ApiResponse.of(
        PartnerResponse.of(partnerService.setStatus(partnerId, PartnerStatus.ACTIVE)));
  }

  @PostMapping("/{partnerId}/farms")
  public ApiResponse<MembershipResponse> attachFarm(
      @PathVariable Long partnerId, @RequestBody @Valid AttachFarmRequest req) {
    return ApiResponse.of(
        MembershipResponse.of(
            partnerNetworkService.attachFarmManually(
                partnerId, req.farmId(), TenancyContext.currentUserId())));
  }

  @GetMapping("/{partnerId}/farms")
  public ApiResponse<List<MembershipResponse>> listFarms(@PathVariable Long partnerId) {
    return ApiResponse.of(
        partnerNetworkService.listForPartner(partnerId).stream()
            .map(MembershipResponse::of)
            .toList());
  }

  @PostMapping("/{partnerId}/invite-codes")
  public ApiResponse<InviteCodeResponse> generateInviteCode(
      @PathVariable Long partnerId, @RequestBody @Valid GenerateInviteCodeRequest req) {
    return ApiResponse.of(
        InviteCodeResponse.of(
            partnerService.generateInviteCode(
                partnerId, req.maxUses(), req.expiresAt(), TenancyContext.currentUserId())));
  }
}
```

> Vérifier la signature exacte de `ApiResponse.of(...)` et de `TenancyContext.currentUserId()` dans le code existant (utilisés à l'identique par les contrôleurs finance/subscription). Ajuster si l'API réelle diffère.

- [ ] **Step 5: Wire new repositories as `@MockitoBean` in the THREE DB-less contexts**

Dans **chacun** des fichiers `SecurityE2ETest.java`, `SecurityIntegrationTest.java`, `DashboardControllerIT.java` : ajouter les imports et les trois champs `@MockitoBean` (respecter l'ordre alphabétique local des déclarations existantes) :
```java
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
```
```java
  @MockitoBean private PartnerRepository partnerRepository;
  @MockitoBean private PartnerFarmMembershipRepository partnerFarmMembershipRepository;
  @MockitoBean private PartnerInviteCodeRepository partnerInviteCodeRepository;
```

- [ ] **Step 6: Run the DB-less suites + the controller test**

Run: `cd backend && ./mvnw -q -pl avicare-app test -Dtest=AdminPartnerControllerTest,SecurityE2ETest,SecurityIntegrationTest`
Expected: PASS (ADMIN → 200, USER → 403 ; les deux suites sécurité restent vertes avec les nouveaux mocks).

- [ ] **Step 7: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/partner/controller backend/avicare-app/src/main/java/com/avicare/partner/dto backend/avicare-app/src/test/java/com/avicare/partner/controller backend/avicare-app/src/test/java/com/avicare/security backend/avicare-app/src/test/java/com/avicare/reporting/controller/DashboardControllerIT.java
git commit -m "feat(backend:partner): AdminPartnerController (ADMIN-gated) + DTOs

CRUD partners, manual farm attach, list network, generate invite code
DB-less controller test (ADMIN 200 / USER 403)
register partner repositories as @MockitoBean in the 3 DB-less contexts"
```

---

### Task 7: Integration validation + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md` (statut)

- [ ] **Step 1: Full reactor build (ADR-003 local gate)**

Run: `cd backend && ./mvnw clean verify`
Expected: BUILD SUCCESS, all tests green (note : les IT Testcontainers, dont `PartnerRepositoryIT`, ne s'exécutent qu'en CI ; en local vérifier au minimum que la compilation et les tests DB-less passent).

- [ ] **Step 2: Boot the app + health + migration**

Run: `make backend-run` (in one shell), then `curl -s http://localhost:8080/actuator/health`
Expected: `{"status":"UP"}` and startup log shows Flyway applying `V36__partner_foundation`. Stop the app.

- [ ] **Step 3: Smoke-check Swagger exposes the admin endpoints**

Open `http://localhost:8080/swagger-ui/index.html` (or GET `/v3/api-docs`) and confirm the `/api/v1/admin/partners` group is present.

- [ ] **Step 4: Update the design doc status**

Dans `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md`, mettre à jour l'entête de statut pour noter que **les fondations backend sont implémentées** (plan `2026-08-22-produit-partenaire-fondations-backend.md`), et que les surfaces éleveur + portail restent à faire.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md
git commit -m "docs(partner): mark backend foundation implemented in design status"
```

- [ ] **Step 6: Push branch + open PR**

```bash
git push -u origin feat/partner-foundation-backend
gh pr create --fill --base main
gh pr checks --watch
```
Expected: CI green (y compris les IT Testcontainers). Ne PAS merger sur CI rouge. Merge : `gh pr merge --rebase --delete-branch`.

---

## Notes d'exécution

- **Branche** : créer `feat/partner-foundation-backend` depuis `main` à jour AVANT la Task 1 (`git checkout main && git pull && git checkout -b feat/partner-foundation-backend`).
- **Après un merge de `main`** pendant le dev : si l'app démarre en erreur alors que le build passe, faire `./mvnw clean install` (footgun connu : bytecode incrémental périmé après reset des mtimes par git merge, cf. mémoire projet).
- **Ordre des tâches** : 1→7 strict (chaque tâche dépend des types produits par la précédente).
- **YAGNI assumé dans ce plan** : pas de contrôleur éleveur (déclaration fournisseur / curseurs / join-code côté éleveur) ni de portail partenaire — ce sont des plans séparés qui consomment ce socle. `PartnerFacade.partnersForFarm` renvoie name/type à null en attendant le plan éleveur.
- **`partner_users` (comptes de login du portail) est HORS de ce plan** : il appartient au plan « portail partenaire » (avec l'auth cloisonnée `partner.jawdi.app`). Le socle ici est piloté côté ADMIN uniquement — c'est le chemin « prêt à signer » de la spec §6. Les 4 tables de la spec §5 deviennent donc 3 ici (partners, partner_farm_memberships, partner_invite_codes).
- **Décomposition des plans suivants** : (a) surfaces éleveur dans l'app existante (déclarer son fournisseur + curseurs de partage + rejoindre par code), (b) portail `partner.jawdi.app` + `partner_users` + Couche 1 « Voir », (c) Couches « Garder » et « Développer ». Chacun aura son propre spec→plan.
```
