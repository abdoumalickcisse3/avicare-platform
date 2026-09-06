# Compte-courant fournisseur — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'éleveur un compte-courant par fournisseur — ce qu'il doit, ce qu'il a payé, ce qui reste — et prévenir le fournisseur par WhatsApp quand il commande et quand il paie.

**Architecture:** Un registre à deux sens (`supplier_ledger_entries`) dans `com.avicare.livestock.inventory`, à côté des fournisseurs et des bons d'achat. Les débits arrivent automatiquement à la réception d'un bon d'achat, sur la **valeur reçue** ; les paiements et les dettes de carnet sont saisis à la main. Le registre n'importe **rien** du contexte `finance`, ce qui rend structurellement impossible qu'il crée une dépense — l'aliment ne peut donc pas être compté deux fois. L'avis au fournisseur passe par le port existant `WhatsAppOutboxFacade`, sous interrupteur par fournisseur, défaut désactivé.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Hibernate 6.6 / Flyway / PostgreSQL · Next.js 16 + MUI + RTK Query · Expo / React Native + RTK Query · JUnit 5 + AssertJ + Mockito + Testcontainers · Vitest · Jest

**Spec:** `docs/superpowers/specs/2026-09-05-compte-courant-fournisseur-design.md`

## Global Constraints

- **L'invariant, avant tout le reste :** aucune ligne du registre ne crée jamais d'`Expense`. Le paquet `com.avicare.livestock.inventory` n'importe rien de `com.avicare.finance`. Si une tâche vous pousse à ajouter cet import, la tâche est mal comprise — arrêtez-vous et demandez.
- **Aucune signature Claude dans les messages de commit** (`CLAUDE.md`). Conventional Commits, scope par contexte : `feat(backend:livestock)`, `feat(web)`, `feat(mobile)`.
- **Une migration mergée ne se modifie jamais.** Les numéros `V54`/`V55` suivent l'**ordre de merge** : si une autre migration part avant, renumérotez avant de pousser.
- **Montants :** `BIGINT amount_xof` / `Long amountXof`. Le franc CFA n'a pas de décimales.
- **Java :** `@Service` + `@RequiredArgsConstructor`, DTO en records Java 21, `@Transactional` en écriture et `(readOnly = true)` en lecture, AssertJ pour les assertions, Spotless Google Java Format (2 espaces).
- **Codes d'erreur** (règle fixée par la PR #303) : règle métier violée → **422** ; corps malformé → **400** ; ressource d'une autre ferme → **404**.
- **Six contextes DB-less.** Tout nouveau repository JPA doit être déclaré `@MockitoBean` dans les six fichiers listés en Task 4. Ne vous fiez pas au nombre : `grep -rl "MockitoBean" backend/avicare-app/src/test/java --include='*.java' | xargs grep -l "FarmRepository"`.
- **Testcontainers ne tourne pas sur le Mac de dev** (Docker 29 × docker-java). Les tests `@DataJpaTest` et `*IT` se valident en CI. Localement, lancez tout le reste.
- **Règle permanente web ↔ mobile :** ce qui part sur le web part aussi sur le mobile. `web/src/store/api/parity.test.ts` le vérifie et échoue si une URL n'existe que d'un côté.

**Commandes de test :**

```bash
# backend, une classe
cd backend && ./mvnw -o test -pl avicare-app -Dtest=SupplierLedgerServiceTest
# backend, tout le module
cd backend && ./mvnw -o test -pl avicare-app
# formatage (obligatoire avant commit backend)
cd backend && ./mvnw -o spotless:apply -pl avicare-app
# web
cd web && npx vitest run src/chemin/du/test.tsx
cd web && npx tsc --noEmit && npm run lint
# mobile
cd mobile && npx jest "motif"
cd mobile && npx tsc --noEmit
```

---

## Structure des fichiers

**Backend — créés**

| Fichier | Responsabilité |
|---|---|
| `db/migration/V54__supplier_ledger.sql` | la table, ses index, son trigger |
| `db/migration/V55__supplier_whatsapp_optin.sql` | l'interrupteur sur `suppliers` |
| `livestock/domain/SupplierLedgerEntry.java` | l'entité |
| `livestock/domain/LedgerDirection.java` | `DEBIT` / `CREDIT` |
| `livestock/domain/LedgerSource.java` | `PURCHASE_ORDER` / `MANUAL` |
| `livestock/repository/SupplierLedgerEntryRepository.java` | lecture, agrégation du solde |
| `livestock/inventory/SupplierLedgerService.java` | solde, relevé, écritures |
| `livestock/inventory/SupplierLedgerCommand.java` | l'entrée d'une écriture manuelle |
| `livestock/inventory/SupplierBalance.java` | un solde par fournisseur |
| `livestock/inventory/SupplierStatementLine.java` | une ligne de relevé + solde progressif |
| `livestock/inventory/SupplierNotifier.java` | la rédaction des deux messages WhatsApp |
| `livestock/controller/SupplierLedgerController.java` | les cinq endpoints |
| `livestock/controller/dto/…` | requêtes et réponses HTTP |

**Backend — modifiés**

| Fichier | Changement |
|---|---|
| `livestock/domain/Supplier.java` | champ `notifyWhatsapp` |
| `livestock/inventory/PurchaseOrderService.java` | débit automatique à la réception, avis à l'envoi |
| `scripts/api-journey.py` | les nouveaux endpoints dans le parcours CI |

**Web — créés**

`store/api/supplierLedgerApi.ts` · `components/inventory/SupplierLedgerView.tsx` · `components/inventory/SupplierPaymentDialog.tsx` · `app/(dashboard)/stocks/fournisseurs/[id]/page.tsx` (+ leurs tests)

**Mobile — créés**

`store/api/supplierLedgerApi.ts` · `app/(field)/stocks/fournisseurs/[id].tsx` (+ tests)

---

## Task 1 — La table et l'entité

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V54__supplier_ledger.sql`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/LedgerDirection.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/LedgerSource.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/SupplierLedgerEntry.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/SupplierLedgerEntryRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/SupplierLedgerRepositoryTest.java`

**Interfaces:**
- Consumes: rien.
- Produces: `SupplierLedgerEntry` (getters/setters Lombok) ; `LedgerDirection.DEBIT|CREDIT` ; `LedgerSource.PURCHASE_ORDER|MANUAL` ; `SupplierLedgerEntryRepository.findByFarmIdAndSupplierIdOrderByEntryDateAscIdAsc(Long, Long)`, `balanceFor(Long farmId, Long supplierId) : long`, `balancesBySupplier(Long farmId) : List<Object[]>`, `existsByPurchaseOrderId(Long) : boolean`, `findByFarmIdAndId(Long, Long) : Optional<SupplierLedgerEntry>`.

- [ ] **Step 1 : écrire la migration**

`V54__supplier_ledger.sql` :

```sql
-- Compte-courant fournisseur : ce que la ferme doit, ce qu'elle a payé.
-- Un seul journal chronologique, la colonne `direction` porte le sens.
-- La table ne connaît PAS les dépenses : la charge est enregistrée ailleurs
-- (bon d'achat reçu, entrée de stock). Voir la spec §1.6.
CREATE TABLE supplier_ledger_entries (
    id                BIGSERIAL PRIMARY KEY,
    farm_id           BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    supplier_id       BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    direction         VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    source            VARCHAR(20) NOT NULL CHECK (source IN ('PURCHASE_ORDER', 'MANUAL')),
    amount_xof        BIGINT NOT NULL CHECK (amount_xof > 0),
    entry_date        DATE NOT NULL,
    label             VARCHAR(200),
    method            VARCHAR(20),
    reference         VARCHAR(100),
    notes             TEXT,
    purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_supplier_ledger_farm_supplier
    ON supplier_ledger_entries(farm_id, supplier_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_supplier_ledger_farm
    ON supplier_ledger_entries(farm_id) WHERE deleted_at IS NULL;

-- Un bon d'achat n'endette qu'une fois, gravé dans la base et pas seulement
-- dans le service.
CREATE UNIQUE INDEX uq_supplier_ledger_purchase_order
    ON supplier_ledger_entries(purchase_order_id)
    WHERE purchase_order_id IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_supplier_ledger_entries_updated_at
    BEFORE UPDATE ON supplier_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2 : écrire les deux enums**

`LedgerDirection.java` :

```java
package com.avicare.livestock.domain;

/** Le sens d'une écriture du compte-courant fournisseur. */
public enum LedgerDirection {
  /** Ce que la ferme doit : une livraison prise. */
  DEBIT,
  /** Ce que la ferme a versé. */
  CREDIT
}
```

`LedgerSource.java` :

```java
package com.avicare.livestock.domain;

/** Qui a écrit la ligne — le système, ou l'éleveur. */
public enum LedgerSource {
  /** Dérivée d'un bon d'achat reçu. Non supprimable : elle se corrige en corrigeant le bon. */
  PURCHASE_ORDER,
  /** Saisie par l'éleveur — un paiement, ou une livraison prise sans bon d'achat. */
  MANUAL
}
```

- [ ] **Step 3 : écrire l'entité**

`SupplierLedgerEntry.java` :

```java
package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Une écriture du compte-courant d'un fournisseur : une dette contractée, ou un versement.
 *
 * <p>Cette entité vit dans le contexte livestock et n'a délibérément aucun lien vers le contexte
 * finance. La charge d'un achat est enregistrée ailleurs — à la réception du bon d'achat, ou à
 * l'entrée du stock. Compter une écriture d'ici comme une dépense doublerait le coût de l'aliment
 * et fausserait le coût de revient au kilo du rapport de clôture.
 */
@Entity
@Table(name = "supplier_ledger_entries")
@Getter
@Setter
@NoArgsConstructor
@ToString
@SQLDelete(sql = "UPDATE supplier_ledger_entries SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class SupplierLedgerEntry {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "supplier_id", nullable = false)
  private Long supplierId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private LedgerDirection direction;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private LedgerSource source;

  @Column(name = "amount_xof", nullable = false)
  private Long amountXof;

  @Column(name = "entry_date", nullable = false)
  private LocalDate entryDate;

  @Column private String label;

  /** Renseignés pour un CREDIT seulement ; le service est le seul écrivain et le garantit. */
  @Column private String method;

  @Column private String reference;

  @Column private String notes;

  @Column(name = "purchase_order_id")
  private Long purchaseOrderId;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;
}
```

- [ ] **Step 4 : écrire le repository**

```java
package com.avicare.livestock.repository;

import com.avicare.livestock.domain.SupplierLedgerEntry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupplierLedgerEntryRepository extends JpaRepository<SupplierLedgerEntry, Long> {

  List<SupplierLedgerEntry> findByFarmIdAndSupplierIdOrderByEntryDateAscIdAsc(
      Long farmId, Long supplierId);

  Optional<SupplierLedgerEntry> findByFarmIdAndId(Long farmId, Long id);

  boolean existsByPurchaseOrderId(Long purchaseOrderId);

  /** Σ débits − Σ crédits. Positif : la ferme doit. Négatif : elle a payé d'avance. */
  @Query(
      "SELECT COALESCE(SUM(CASE WHEN e.direction = com.avicare.livestock.domain.LedgerDirection.DEBIT "
          + "THEN e.amountXof ELSE -e.amountXof END), 0) "
          + "FROM SupplierLedgerEntry e WHERE e.farmId = :farmId AND e.supplierId = :supplierId")
  long balanceFor(@Param("farmId") Long farmId, @Param("supplierId") Long supplierId);

  /** [supplierId, solde] pour toute la ferme, en une requête plutôt qu'une par fournisseur. */
  @Query(
      "SELECT e.supplierId, COALESCE(SUM(CASE WHEN e.direction = com.avicare.livestock.domain.LedgerDirection.DEBIT "
          + "THEN e.amountXof ELSE -e.amountXof END), 0) "
          + "FROM SupplierLedgerEntry e WHERE e.farmId = :farmId GROUP BY e.supplierId")
  List<Object[]> balancesBySupplier(@Param("farmId") Long farmId);
}
```

- [ ] **Step 5 : écrire le test de slice (échoue d'abord)**

`SupplierLedgerRepositoryTest.java` — même patron que `NotificationRepositoryTest` (Testcontainers, CI seulement) :

```java
package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.domain.SupplierLedgerEntry;
import com.avicare.livestock.repository.SupplierLedgerEntryRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Slice sur PostgreSQL réel : le solde signé, et l'index unique qui interdit qu'un bon d'achat
 * endette deux fois. CI seulement — Testcontainers ne tourne pas sur la machine de dev.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class SupplierLedgerRepositoryTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @Autowired private SupplierLedgerEntryRepository repository;
  @Autowired private EntityManager em;

  /**
   * Une ferme, un utilisateur et un fournisseur réels : la table porte de vraies clés étrangères,
   * un identifiant inventé remonterait en 23503.
   */
  private long[] seed() {
    Long userId =
        (Long)
            em.createNativeQuery(
                    "INSERT INTO users (email, password_hash, full_name, role, is_active) "
                        + "VALUES ('ledger@test.local', 'x', 'Ledger', 'USER', TRUE) RETURNING id")
                .getSingleResult();
    Long farmId =
        (Long)
            em.createNativeQuery(
                    "INSERT INTO farms (name, owner_id) VALUES ('Ferme Registre', :u) RETURNING id")
                .setParameter("u", userId)
                .getSingleResult();
    Long supplierId =
        (Long)
            em.createNativeQuery(
                    "INSERT INTO suppliers (farm_id, commercial_name, types, active) "
                        + "VALUES (:f, 'Provende du Sahel', '[]'::jsonb, TRUE) RETURNING id")
                .setParameter("f", farmId)
                .getSingleResult();
    return new long[] {farmId, supplierId};
  }

  private SupplierLedgerEntry entry(
      long farmId, long supplierId, LedgerDirection direction, long amount) {
    SupplierLedgerEntry e = new SupplierLedgerEntry();
    e.setFarmId(farmId);
    e.setSupplierId(supplierId);
    e.setDirection(direction);
    e.setSource(LedgerSource.MANUAL);
    e.setAmountXof(amount);
    e.setEntryDate(LocalDate.of(2026, 9, 5));
    return e;
  }

  @Test
  void balanceIsDebitsMinusCredits() {
    long[] ids = seed();
    repository.save(entry(ids[0], ids[1], LedgerDirection.DEBIT, 500_000L));
    repository.save(entry(ids[0], ids[1], LedgerDirection.CREDIT, 200_000L));

    assertThat(repository.balanceFor(ids[0], ids[1])).isEqualTo(300_000L);
  }

  @Test
  void balanceGoesNegativeWhenTheFarmPaidAhead() {
    long[] ids = seed();
    repository.save(entry(ids[0], ids[1], LedgerDirection.DEBIT, 100_000L));
    repository.save(entry(ids[0], ids[1], LedgerDirection.CREDIT, 150_000L));

    assertThat(repository.balanceFor(ids[0], ids[1])).isEqualTo(-50_000L);
  }

  @Test
  void aPurchaseOrderCannotBeDebitedTwice() {
    long[] ids = seed();
    Long poId =
        (Long)
            em.createNativeQuery(
                    "INSERT INTO purchase_orders (farm_id, order_number, supplier_id, status, "
                        + "order_date, created_by) VALUES (:f, 'BA-1', :s, 'RECEIVED', "
                        + "CURRENT_DATE, NULL) RETURNING id")
                .setParameter("f", ids[0])
                .setParameter("s", ids[1])
                .getSingleResult();

    SupplierLedgerEntry first = entry(ids[0], ids[1], LedgerDirection.DEBIT, 400_000L);
    first.setPurchaseOrderId(poId);
    repository.saveAndFlush(first);

    SupplierLedgerEntry second = entry(ids[0], ids[1], LedgerDirection.DEBIT, 400_000L);
    second.setPurchaseOrderId(poId);

    assertThatThrownBy(() -> repository.saveAndFlush(second))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void aSoftDeletedEntryLeavesTheBalance() {
    long[] ids = seed();
    SupplierLedgerEntry debit = repository.save(entry(ids[0], ids[1], LedgerDirection.DEBIT, 90_000L));
    repository.delete(debit);

    assertThat(repository.balanceFor(ids[0], ids[1])).isZero();
  }
}
```

- [ ] **Step 6 : vérifier la compilation et le formatage**

```bash
cd backend && ./mvnw -o spotless:apply -pl avicare-app && ./mvnw -o clean test-compile -pl avicare-app
```

Attendu : `BUILD SUCCESS`. Le test lui-même échouera localement sur « Could not find a valid Docker environment » — c'est la limite connue de la machine, pas un échec du code. Il tournera en CI.

> **Avant de commiter**, ouvrez la migration `V15__inventory_catalog_stock_suppliers.sql` et `V17__inventory_purchase_orders.sql` et vérifiez les noms de colonnes utilisés dans `seed()` (`commercial_name`, `types`, `order_number`, `status`). Si l'un diffère, corrigez le test — pas la migration.

- [ ] **Step 7 : commit**

```bash
git add backend/avicare-app/src/main/resources/db/migration/V54__supplier_ledger.sql \
        backend/avicare-app/src/main/java/com/avicare/livestock/domain/LedgerDirection.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/domain/LedgerSource.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/domain/SupplierLedgerEntry.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/repository/SupplierLedgerEntryRepository.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/inventory/SupplierLedgerRepositoryTest.java
git commit -m "feat(backend:livestock): la table du compte-courant fournisseur

Un seul journal chronologique, la colonne direction porte le sens. Le solde est
une agrégation signée : positif la ferme doit, négatif elle a payé d'avance.

Un index unique partiel sur purchase_order_id interdit qu'un bon d'achat endette
deux fois — gravé dans la base et pas seulement dans le service.

RESTRICT sur supplier_id est sûr : suppliers n'a pas de deleted_at, un
fournisseur se retire par un booléen active."
```

---

## Task 2 — Le service : solde, relevé, écritures

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/SupplierBalance.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/SupplierStatementLine.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/SupplierLedgerCommand.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/SupplierLedgerService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/SupplierLedgerServiceTest.java`

**Interfaces:**
- Consumes: Task 1 (`SupplierLedgerEntry`, `LedgerDirection`, `LedgerSource`, `SupplierLedgerEntryRepository`), et `SupplierRepository.findByFarmIdAndId(Long, Long)`.
- Produces:
  - `SupplierBalance(Long supplierId, String supplierName, long balanceXof)`
  - `SupplierStatementLine(Long id, LocalDate entryDate, LedgerDirection direction, LedgerSource source, long amountXof, String label, String method, String reference, Long purchaseOrderId, long runningBalanceXof)`
  - `SupplierLedgerCommand(long amountXof, LocalDate entryDate, String label, String method, String reference, String notes)`
  - `SupplierLedgerService.balance(Long, Long) : long`
  - `SupplierLedgerService.balances(Long) : List<SupplierBalance>`
  - `SupplierLedgerService.statement(Long, Long) : List<SupplierStatementLine>`
  - `SupplierLedgerService.recordPayment(Long farmId, Long supplierId, SupplierLedgerCommand cmd, Long userId) : SupplierLedgerEntry`
  - `SupplierLedgerService.recordCharge(Long farmId, Long supplierId, SupplierLedgerCommand cmd, Long userId) : SupplierLedgerEntry`
  - `SupplierLedgerService.recordPurchaseOrderDebit(Long farmId, Long supplierId, Long poId, String orderNumber, long amountXof, LocalDate date, Long userId) : void`
  - `SupplierLedgerService.deleteEntry(Long farmId, Long entryId) : void`

- [ ] **Step 1 : écrire les trois records**

```java
package com.avicare.livestock.inventory;

/** Le solde d'un fournisseur. Positif : la ferme doit. Négatif : elle a payé d'avance. */
public record SupplierBalance(Long supplierId, String supplierName, long balanceXof) {}
```

```java
package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import java.time.LocalDate;

/**
 * Une ligne de relevé, avec le solde après elle.
 *
 * <p>Le solde progressif est calculé côté serveur : deux clients qui recalculeraient la même
 * colonne seraient deux occasions de diverger.
 */
public record SupplierStatementLine(
    Long id,
    LocalDate entryDate,
    LedgerDirection direction,
    LedgerSource source,
    long amountXof,
    String label,
    String method,
    String reference,
    Long purchaseOrderId,
    long runningBalanceXof) {}
```

```java
package com.avicare.livestock.inventory;

import java.time.LocalDate;

/**
 * Ce que l'éleveur saisit pour un paiement ou une dette de carnet.
 *
 * <p>{@code notify} porte la case « Prévenir le fournisseur » : l'interrupteur de la fiche dit si
 * l'avis est possible, cette case dit si l'éleveur le veut pour CE versement. Les deux doivent être
 * vrais. Un versement corrigeant une erreur de saisie n'a pas à partir chez le fournisseur.
 */
public record SupplierLedgerCommand(
    long amountXof,
    LocalDate entryDate,
    String label,
    String method,
    String reference,
    String notes,
    boolean notify) {}
```

- [ ] **Step 2 : écrire le test (il doit échouer)**

`SupplierLedgerServiceTest.java` :

```java
package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.domain.SupplierLedgerEntry;
import com.avicare.livestock.repository.SupplierLedgerEntryRepository;
import com.avicare.livestock.repository.SupplierRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class SupplierLedgerServiceTest {

  private SupplierLedgerEntryRepository ledgerRepository;
  private SupplierRepository supplierRepository;
  private SupplierLedgerService service;

  private static final Long FARM = 7L;
  private static final Long SUPPLIER = 3L;
  private static final Long USER = 42L;

  @BeforeEach
  void setUp() {
    ledgerRepository = Mockito.mock(SupplierLedgerEntryRepository.class);
    supplierRepository = Mockito.mock(SupplierRepository.class);
    service = new SupplierLedgerService(ledgerRepository, supplierRepository);

    Supplier supplier = new Supplier();
    supplier.setId(SUPPLIER);
    supplier.setFarmId(FARM);
    supplier.setCommercialName("Provende du Sahel");
    lenient()
        .when(supplierRepository.findByFarmIdAndId(FARM, SUPPLIER))
        .thenReturn(Optional.of(supplier));
    lenient()
        .when(ledgerRepository.save(any(SupplierLedgerEntry.class)))
        .thenAnswer(inv -> inv.getArgument(0));
  }

  private static SupplierLedgerEntry line(
      long id, LocalDate date, LedgerDirection direction, long amount, LedgerSource source) {
    SupplierLedgerEntry e = new SupplierLedgerEntry();
    e.setId(id);
    e.setFarmId(FARM);
    e.setSupplierId(SUPPLIER);
    e.setEntryDate(date);
    e.setDirection(direction);
    e.setAmountXof(amount);
    e.setSource(source);
    return e;
  }

  private static SupplierLedgerCommand cmd(long amount) {
    return new SupplierLedgerCommand(
        amount, LocalDate.of(2026, 9, 5), "Versement", "CASH", null, null, true);
  }

  @Test
  void recordsAPaymentAsACreditWrittenByHand() {
    service.recordPayment(FARM, SUPPLIER, cmd(200_000L), USER);

    ArgumentCaptor<SupplierLedgerEntry> saved = ArgumentCaptor.forClass(SupplierLedgerEntry.class);
    verify(ledgerRepository).save(saved.capture());
    assertThat(saved.getValue().getDirection()).isEqualTo(LedgerDirection.CREDIT);
    assertThat(saved.getValue().getSource()).isEqualTo(LedgerSource.MANUAL);
    assertThat(saved.getValue().getAmountXof()).isEqualTo(200_000L);
    assertThat(saved.getValue().getCreatedBy()).isEqualTo(USER);
  }

  @Test
  void recordsAManualChargeAsADebit() {
    service.recordCharge(FARM, SUPPLIER, cmd(240_000L), USER);

    ArgumentCaptor<SupplierLedgerEntry> saved = ArgumentCaptor.forClass(SupplierLedgerEntry.class);
    verify(ledgerRepository).save(saved.capture());
    assertThat(saved.getValue().getDirection()).isEqualTo(LedgerDirection.DEBIT);
    assertThat(saved.getValue().getSource()).isEqualTo(LedgerSource.MANUAL);
  }

  @Test
  void refusesAnAmountThatIsNotStrictlyPositive() {
    assertThatThrownBy(() -> service.recordPayment(FARM, SUPPLIER, cmd(0L), USER))
        .isInstanceOf(ValidationException.class);
    verify(ledgerRepository, never()).save(any());
  }

  @Test
  void refusesASupplierOfAnotherFarm() {
    when(supplierRepository.findByFarmIdAndId(FARM, 99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.recordPayment(FARM, 99L, cmd(1_000L), USER))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void buildsAStatementWithARunningBalance() {
    when(ledgerRepository.findByFarmIdAndSupplierIdOrderByEntryDateAscIdAsc(FARM, SUPPLIER))
        .thenReturn(
            List.of(
                line(1L, LocalDate.of(2026, 9, 1), LedgerDirection.DEBIT, 500_000L, LedgerSource.PURCHASE_ORDER),
                line(2L, LocalDate.of(2026, 9, 3), LedgerDirection.CREDIT, 200_000L, LedgerSource.MANUAL),
                line(3L, LocalDate.of(2026, 9, 4), LedgerDirection.DEBIT, 100_000L, LedgerSource.MANUAL)));

    List<SupplierStatementLine> statement = service.statement(FARM, SUPPLIER);

    assertThat(statement).extracting(SupplierStatementLine::runningBalanceXof)
        .containsExactly(500_000L, 300_000L, 400_000L);
  }

  @Test
  void recordsThePurchaseOrderDebitOnlyOnce() {
    when(ledgerRepository.existsByPurchaseOrderId(88L)).thenReturn(true);

    service.recordPurchaseOrderDebit(
        FARM, SUPPLIER, 88L, "BA-12", 400_000L, LocalDate.of(2026, 9, 5), USER);

    verify(ledgerRepository, never()).save(any());
  }

  @Test
  void deletesAManualLine() {
    SupplierLedgerEntry manual = line(5L, LocalDate.of(2026, 9, 5), LedgerDirection.CREDIT, 10_000L, LedgerSource.MANUAL);
    when(ledgerRepository.findByFarmIdAndId(FARM, 5L)).thenReturn(Optional.of(manual));

    service.deleteEntry(FARM, 5L);

    verify(ledgerRepository).delete(manual);
  }

  @Test
  void refusesToDeleteALineDerivedFromAPurchaseOrder() {
    SupplierLedgerEntry derived = line(6L, LocalDate.of(2026, 9, 5), LedgerDirection.DEBIT, 400_000L, LedgerSource.PURCHASE_ORDER);
    when(ledgerRepository.findByFarmIdAndId(FARM, 6L)).thenReturn(Optional.of(derived));

    assertThatThrownBy(() -> service.deleteEntry(FARM, 6L))
        .isInstanceOf(BusinessRuleException.class);
    verify(ledgerRepository, never()).delete(any(SupplierLedgerEntry.class));
  }
}
```

- [ ] **Step 3 : lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw -o test -pl avicare-app -Dtest=SupplierLedgerServiceTest
```

Attendu : échec de compilation, `SupplierLedgerService` n'existe pas.

- [ ] **Step 4 : écrire le service**

```java
package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.domain.SupplierLedgerEntry;
import com.avicare.livestock.repository.SupplierLedgerEntryRepository;
import com.avicare.livestock.repository.SupplierRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Le compte-courant d'un fournisseur : ce que la ferme doit, ce qu'elle a versé, ce qui reste.
 *
 * <p>Ce service n'écrit JAMAIS de dépense. La charge d'un achat est enregistrée ailleurs — à la
 * réception du bon d'achat, ou à l'entrée du stock. C'est pourquoi il vit dans le contexte
 * livestock et n'importe rien de finance : la frontière de paquet tient la garantie, pas la
 * discipline.
 */
@Service
@RequiredArgsConstructor
public class SupplierLedgerService {

  private final SupplierLedgerEntryRepository ledgerRepository;
  private final SupplierRepository supplierRepository;

  @Transactional(readOnly = true)
  public long balance(Long farmId, Long supplierId) {
    requireSupplier(farmId, supplierId);
    return ledgerRepository.balanceFor(farmId, supplierId);
  }

  /** Le solde de chaque fournisseur actif, ceux sans écriture compris — à zéro. */
  @Transactional(readOnly = true)
  public List<SupplierBalance> balances(Long farmId) {
    Map<Long, Long> bySupplier =
        ledgerRepository.balancesBySupplier(farmId).stream()
            .collect(
                Collectors.toMap(row -> (Long) row[0], row -> ((Number) row[1]).longValue()));

    return supplierRepository.findByFarmIdAndActiveTrueOrderByCommercialName(farmId).stream()
        .map(
            s ->
                new SupplierBalance(
                    s.getId(), s.getCommercialName(), bySupplier.getOrDefault(s.getId(), 0L)))
        .toList();
  }

  @Transactional(readOnly = true)
  public List<SupplierStatementLine> statement(Long farmId, Long supplierId) {
    requireSupplier(farmId, supplierId);

    List<SupplierStatementLine> lines = new ArrayList<>();
    long running = 0;
    for (SupplierLedgerEntry e :
        ledgerRepository.findByFarmIdAndSupplierIdOrderByEntryDateAscIdAsc(farmId, supplierId)) {
      running += e.getDirection() == LedgerDirection.DEBIT ? e.getAmountXof() : -e.getAmountXof();
      lines.add(
          new SupplierStatementLine(
              e.getId(),
              e.getEntryDate(),
              e.getDirection(),
              e.getSource(),
              e.getAmountXof(),
              e.getLabel(),
              e.getMethod(),
              e.getReference(),
              e.getPurchaseOrderId(),
              running));
    }
    return lines;
  }

  @Transactional
  public SupplierLedgerEntry recordPayment(
      Long farmId, Long supplierId, SupplierLedgerCommand cmd, Long userId) {
    return recordManual(farmId, supplierId, cmd, LedgerDirection.CREDIT, userId);
  }

  @Transactional
  public SupplierLedgerEntry recordCharge(
      Long farmId, Long supplierId, SupplierLedgerCommand cmd, Long userId) {
    return recordManual(farmId, supplierId, cmd, LedgerDirection.DEBIT, userId);
  }

  /**
   * Le débit dérivé d'un bon d'achat reçu. Idempotent : appelé deux fois pour le même bon, il ne
   * fait rien la seconde. L'index unique de la base dit la même chose ; les deux se valent mieux
   * qu'un seul.
   */
  @Transactional
  public void recordPurchaseOrderDebit(
      Long farmId,
      Long supplierId,
      Long purchaseOrderId,
      String orderNumber,
      long amountXof,
      LocalDate date,
      Long userId) {
    if (amountXof <= 0 || ledgerRepository.existsByPurchaseOrderId(purchaseOrderId)) {
      return;
    }
    SupplierLedgerEntry entry = new SupplierLedgerEntry();
    entry.setFarmId(farmId);
    entry.setSupplierId(supplierId);
    entry.setDirection(LedgerDirection.DEBIT);
    entry.setSource(LedgerSource.PURCHASE_ORDER);
    entry.setAmountXof(amountXof);
    entry.setEntryDate(date);
    entry.setLabel("Bon d'achat " + orderNumber);
    entry.setPurchaseOrderId(purchaseOrderId);
    entry.setCreatedBy(userId);
    ledgerRepository.save(entry);
  }

  /** Seule une ligne saisie à la main s'efface : une ligne dérivée se corrige par son bon d'achat. */
  @Transactional
  public void deleteEntry(Long farmId, Long entryId) {
    SupplierLedgerEntry entry =
        ledgerRepository
            .findByFarmIdAndId(farmId, entryId)
            .orElseThrow(() -> NotFoundException.of("SupplierLedgerEntry", entryId));

    if (entry.getSource() != LedgerSource.MANUAL) {
      throw new BusinessRuleException(
          "LEDGER_ENTRY_DERIVED",
          "A ledger entry derived from a purchase order cannot be deleted; correct the order.");
    }
    ledgerRepository.delete(entry);
  }

  private SupplierLedgerEntry recordManual(
      Long farmId,
      Long supplierId,
      SupplierLedgerCommand cmd,
      LedgerDirection direction,
      Long userId) {
    requireSupplier(farmId, supplierId);
    if (cmd.amountXof() <= 0) {
      throw new ValidationException("LEDGER_AMOUNT_NOT_POSITIVE", "Amount must be greater than 0");
    }

    SupplierLedgerEntry entry = new SupplierLedgerEntry();
    entry.setFarmId(farmId);
    entry.setSupplierId(supplierId);
    entry.setDirection(direction);
    entry.setSource(LedgerSource.MANUAL);
    entry.setAmountXof(cmd.amountXof());
    entry.setEntryDate(cmd.entryDate() != null ? cmd.entryDate() : LocalDate.now());
    entry.setLabel(cmd.label());
    entry.setNotes(cmd.notes());
    // method et reference ne valent que pour un versement.
    if (direction == LedgerDirection.CREDIT) {
      entry.setMethod(cmd.method());
      entry.setReference(cmd.reference());
    }
    entry.setCreatedBy(userId);
    return ledgerRepository.save(entry);
  }

  private Supplier requireSupplier(Long farmId, Long supplierId) {
    return supplierRepository
        .findByFarmIdAndId(farmId, supplierId)
        .orElseThrow(() -> NotFoundException.of("Supplier", supplierId));
  }
}
```

> Avant d'écrire : ouvrez `common-api/src/main/java/com/avicare/common/api/exception/` et confirmez les constructeurs de `ValidationException`, `BusinessRuleException` et la fabrique `NotFoundException.of`. S'ils diffèrent, alignez-vous sur eux — pas l'inverse.

- [ ] **Step 5 : lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw -o spotless:apply -pl avicare-app && ./mvnw -o test -pl avicare-app -Dtest=SupplierLedgerServiceTest
```

Attendu : `Tests run: 8, Failures: 0, Errors: 0`.

- [ ] **Step 6 : commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/inventory/ \
        backend/avicare-app/src/test/java/com/avicare/livestock/inventory/SupplierLedgerServiceTest.java
git commit -m "feat(backend:livestock): solde, relevé et écritures du compte-courant

Le solde progressif est calculé côté serveur : deux clients qui recalculeraient
la même colonne seraient deux occasions de diverger.

Une ligne dérivée d'un bon d'achat ne se supprime pas (422) — elle se corrige en
corrigeant le bon. Seul le manuel s'efface.

Le débit d'un bon d'achat est idempotent dans le service en plus de l'être dans
la base : les deux se valent mieux qu'un seul."
```

---

## Task 3 — Le débit automatique, et l'invariant prouvé

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/PurchaseOrderService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/PurchaseOrderLedgerTest.java`

**Interfaces:**
- Consumes: Task 2 (`SupplierLedgerService.recordPurchaseOrderDebit`).
- Produces: rien de nouveau ; `PurchaseOrderService` gagne une dépendance `SupplierLedgerService`.

- [ ] **Step 1 : écrire le test (il doit échouer)**

```java
package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Deux garanties tenues ici plutôt que dans un commentaire.
 *
 * <p>1. Le débit porte sur la valeur REÇUE. La réception est partielle possible : endetter la
 * ferme du total commandé lui ferait devoir des sacs qui ne sont jamais arrivés.
 *
 * <p>2. Le paquet du registre n'importe rien du contexte finance. C'est ce qui rend structurellement
 * impossible qu'une écriture du compte-courant crée une dépense — et donc que l'aliment soit compté
 * deux fois.
 */
class PurchaseOrderLedgerTest {

  /**
   * Les deux seuls fichiers du paquet autorisés à connaître les dépenses, et pourquoi.
   *
   * <p>Ils enregistrent la CHARGE — c'est leur travail et il précède ce chantier. Le compte-courant
   * enregistre la TRÉSORERIE, et ne doit jamais toucher aux dépenses : les deux ensemble
   * doubleraient le coût de l'aliment.
   *
   * <p>Cette liste est une porte, pas une passoire : y ajouter un fichier est une décision qui se
   * défend en revue, et c'est exactement la friction voulue.
   */
  private static final java.util.Set<String> ALLOWED =
      java.util.Set.of(
          // Reçoit un bon d'achat : enregistre la dépense d'achat, et (Task 3) le débit du
          // compte-courant. C'est le point précis où charge et trésorerie se croisent.
          "PurchaseOrderService.java",
          // Enregistre la dépense d'une entrée de stock directe (garde V25). Antérieur à ce
          // chantier, sans rapport avec le compte-courant.
          "StockMovementService.java");

  @Test
  void theLedgerPackageNeverImportsFinance() throws Exception {
    java.nio.file.Path root =
        java.nio.file.Path.of("src/main/java/com/avicare/livestock/inventory");

    List<String> offenders;
    try (var files = java.nio.file.Files.walk(root)) {
      offenders =
          files
              .filter(p -> p.toString().endsWith(".java"))
              .filter(
                  p -> {
                    try {
                      return java.nio.file.Files.readString(p).contains("com.avicare.finance");
                    } catch (java.io.IOException e) {
                      throw new IllegalStateException(e);
                    }
                  })
              .map(p -> p.getFileName().toString())
              .filter(name -> !ALLOWED.contains(name))
              .toList();
    }

    assertThat(offenders)
        .as(
            "Le compte-courant ne doit pas pouvoir écrire de dépense. Deux fichiers du paquet "
                + "connaissent les dépenses et sont listés dans ALLOWED avec leur raison ; tout "
                + "autre est un aller simple vers l'aliment compté deux fois.")
        .isEmpty();
  }
}
```

- [ ] **Step 2 : lancer le test, vérifier qu'il passe déjà**

```bash
cd backend && ./mvnw -o test -pl avicare-app -Dtest=PurchaseOrderLedgerTest
```

Attendu : PASS. Ce test garde un état, il ne pilote pas une écriture — il échouera le jour où quelqu'un ajoutera l'import interdit.

- [ ] **Step 3 : brancher le débit dans la réception**

Dans `PurchaseOrderService.java`, ajoutez le champ à côté de `financeFacade` :

```java
  private final SupplierLedgerService supplierLedgerService;
```

Puis, dans `receive(...)`, **juste après** le bloc `if (!expenseLines.isEmpty()) { financeFacade.recordPurchaseExpenses(...); }` et **avant** le `return po;` :

```java
    // Le compte-courant du fournisseur : la contrepartie de trésorerie de la charge
    // enregistrée juste au-dessus. Même somme — la valeur REÇUE, jamais le total commandé,
    // parce que la réception est partielle possible.
    long receivedValueXof =
        expenseLines.stream().mapToLong(FinanceFacade.PurchaseExpenseLine::lineTotalXof).sum();
    if (receivedValueXof > 0 && po.getSupplier() != null) {
      supplierLedgerService.recordPurchaseOrderDebit(
          farmId,
          po.getSupplier().getId(),
          po.getId(),
          po.getOrderNumber(),
          receivedValueXof,
          deliveryDate,
          userId);
    }
```

- [ ] **Step 4 : compiler et lancer le module**

```bash
cd backend && ./mvnw -o spotless:apply -pl avicare-app && ./mvnw -o test -pl avicare-app
```

Attendu : `BUILD SUCCESS`, avec pour seules erreurs les deux tests Testcontainers (`NotificationRepositoryTest`, `IdentityTenancyMappingTest`, plus le nouveau `SupplierLedgerRepositoryTest`) qui échouent sur « Could not find a valid Docker environment ». Toute autre erreur est la vôtre.

> Si une classe de test échoue sur un bean manquant `SupplierLedgerService`, c'est un test `@SpringBootTest` : ajoutez-y le mock (voir Task 4, Step 4).

- [ ] **Step 5 : commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/inventory/PurchaseOrderService.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/inventory/PurchaseOrderLedgerTest.java
git commit -m "feat(backend:livestock): endetter le compte-courant à la réception

Le débit porte sur la valeur reçue, la même somme que celle passée aux dépenses.
La réception est partielle possible : utiliser le total commandé ferait devoir à
la ferme des sacs qui ne sont jamais arrivés.

Un test garde la frontière de paquet : le registre n'importe rien du contexte
finance, donc il ne peut pas créer de dépense et l'aliment ne peut pas être
compté deux fois."
```

---

## Task 4 — Les endpoints

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/dto/SupplierLedgerEntryRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/dto/SupplierLedgerEntryResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/dto/SupplierStatementResponse.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/SupplierLedgerController.java`
- Modify: les six contextes DB-less (liste au Step 4)
- Modify: `scripts/api-journey.py`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/controller/SupplierLedgerControllerTest.java`

**Interfaces:**
- Consumes: Task 2 (`SupplierLedgerService`, `SupplierBalance`, `SupplierStatementLine`, `SupplierLedgerCommand`).
- Produces: les cinq routes HTTP listées au §5 de la spec.

- [ ] **Step 1 : écrire les DTO**

```java
package com.avicare.livestock.controller.dto;

import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

/**
 * Ce que le client envoie pour un paiement ou une dette de carnet.
 *
 * <p>{@code notify} est un {@code Boolean} et non un {@code boolean} : un client qui l'omet ne doit
 * pas être lu comme « surtout ne préviens pas ». Absent, il vaut vrai — l'interrupteur de la fiche
 * reste seul juge.
 */
public record SupplierLedgerEntryRequest(
    @Positive(message = "amountXof must be greater than 0") long amountXof,
    LocalDate entryDate,
    String label,
    String method,
    String reference,
    String notes,
    Boolean notify) {}
```

```java
package com.avicare.livestock.controller.dto;

import com.avicare.livestock.inventory.SupplierStatementLine;
import java.time.LocalDate;

/** Une ligne de relevé telle que l'interface la lit. */
public record SupplierLedgerEntryResponse(
    Long id,
    LocalDate entryDate,
    String direction,
    String source,
    long amountXof,
    String label,
    String method,
    String reference,
    Long purchaseOrderId,
    long runningBalanceXof) {

  public static SupplierLedgerEntryResponse from(SupplierStatementLine line) {
    return new SupplierLedgerEntryResponse(
        line.id(),
        line.entryDate(),
        line.direction().name(),
        line.source().name(),
        line.amountXof(),
        line.label(),
        line.method(),
        line.reference(),
        line.purchaseOrderId(),
        line.runningBalanceXof());
  }
}
```

```java
package com.avicare.livestock.controller.dto;

import java.util.List;

/** Le relevé d'un fournisseur : ses lignes, et le solde après la dernière. */
public record SupplierStatementResponse(
    Long supplierId, long balanceXof, List<SupplierLedgerEntryResponse> entries) {}
```

- [ ] **Step 2 : écrire le contrôleur**

```java
package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.livestock.controller.dto.SupplierLedgerEntryRequest;
import com.avicare.livestock.controller.dto.SupplierLedgerEntryResponse;
import com.avicare.livestock.controller.dto.SupplierStatementResponse;
import com.avicare.livestock.inventory.SupplierBalance;
import com.avicare.livestock.inventory.SupplierLedgerCommand;
import com.avicare.livestock.inventory.SupplierLedgerService;
import com.avicare.livestock.inventory.SupplierStatementLine;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Le compte-courant fournisseur : solde, relevé, versements et dettes de carnet. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/suppliers")
@RequiredArgsConstructor
public class SupplierLedgerController {

  private final SupplierLedgerService supplierLedgerService;

  @GetMapping("/balances")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<SupplierBalance>> balances(@PathVariable Long farmId) {
    return ApiResponse.of(supplierLedgerService.balances(farmId));
  }

  @GetMapping("/{supplierId}/ledger")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<SupplierStatementResponse> statement(
      @PathVariable Long farmId, @PathVariable Long supplierId) {
    List<SupplierStatementLine> lines = supplierLedgerService.statement(farmId, supplierId);
    return ApiResponse.of(
        new SupplierStatementResponse(
            supplierId,
            supplierLedgerService.balance(farmId, supplierId),
            lines.stream().map(SupplierLedgerEntryResponse::from).toList()));
  }

  @PostMapping("/{supplierId}/ledger/payments")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<Long> recordPayment(
      @PathVariable Long farmId,
      @PathVariable Long supplierId,
      @RequestBody @Valid SupplierLedgerEntryRequest request,
      @AuthenticationPrincipal AvicarePrincipal principal) {
    return ApiResponse.of(
        supplierLedgerService
            .recordPayment(farmId, supplierId, toCommand(request), principal.userId())
            .getId());
  }

  @PostMapping("/{supplierId}/ledger/charges")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<Long> recordCharge(
      @PathVariable Long farmId,
      @PathVariable Long supplierId,
      @RequestBody @Valid SupplierLedgerEntryRequest request,
      @AuthenticationPrincipal AvicarePrincipal principal) {
    return ApiResponse.of(
        supplierLedgerService
            .recordCharge(farmId, supplierId, toCommand(request), principal.userId())
            .getId());
  }

  @DeleteMapping("/{supplierId}/ledger/entries/{entryId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void deleteEntry(
      @PathVariable Long farmId, @PathVariable Long supplierId, @PathVariable Long entryId) {
    supplierLedgerService.deleteEntry(farmId, entryId);
  }

  private static SupplierLedgerCommand toCommand(SupplierLedgerEntryRequest r) {
    return new SupplierLedgerCommand(
        r.amountXof(),
        r.entryDate(),
        r.label(),
        r.method(),
        r.reference(),
        r.notes(),
        r.notify() == null || r.notify());
  }
}
```

> `AvicarePrincipal` s'obtient différemment selon les contrôleurs de ce dépôt (parfois via `getDetails()`). **Ouvrez `SupplierController.java` et copiez sa façon exacte de récupérer l'utilisateur courant** plutôt que la ligne ci-dessus si elle diffère.

- [ ] **Step 3 : écrire le test du contrôleur**

```java
package com.avicare.livestock.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.controller.dto.SupplierLedgerEntryRequest;
import com.avicare.livestock.controller.dto.SupplierStatementResponse;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.inventory.SupplierLedgerService;
import com.avicare.livestock.inventory.SupplierStatementLine;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Le contrôleur ne fait que traduire : on vérifie qu'il traduit juste. */
class SupplierLedgerControllerTest {

  private final SupplierLedgerService service = Mockito.mock(SupplierLedgerService.class);
  private final SupplierLedgerController controller = new SupplierLedgerController(service);

  @Test
  void theStatementCarriesTheBalanceAndTheRunningColumn() {
    when(service.statement(7L, 3L))
        .thenReturn(
            List.of(
                new SupplierStatementLine(
                    1L,
                    LocalDate.of(2026, 9, 1),
                    LedgerDirection.DEBIT,
                    LedgerSource.PURCHASE_ORDER,
                    500_000L,
                    "Bon d'achat BA-12",
                    null,
                    null,
                    88L,
                    500_000L)));
    when(service.balance(7L, 3L)).thenReturn(500_000L);

    SupplierStatementResponse body = controller.statement(7L, 3L).data();

    assertThat(body.balanceXof()).isEqualTo(500_000L);
    assertThat(body.entries()).singleElement().satisfies(
        e -> {
          assertThat(e.direction()).isEqualTo("DEBIT");
          assertThat(e.source()).isEqualTo("PURCHASE_ORDER");
          assertThat(e.runningBalanceXof()).isEqualTo(500_000L);
        });
  }

  @Test
  void deletingAnEntryReachesTheService() {
    controller.deleteEntry(7L, 3L, 5L);

    verify(service).deleteEntry(7L, 5L);
  }
}
```

> `ApiResponse.data()` : vérifiez l'accesseur réel dans `common-api/.../ApiResponse.java` et alignez le test dessus.

- [ ] **Step 4 : déclarer le repository dans les six contextes DB-less**

Ces six `@SpringBootTest` démarrent sans base : tout repository JPA manquant les fait échouer au démarrage — vert en local, rouge en CI.

```bash
grep -rl "MockitoBean" backend/avicare-app/src/test/java --include='*.java' | xargs grep -l "FarmRepository"
```

Aujourd'hui : `DashboardControllerIT`, `SecurityIntegrationTest`, `NotificationControllerIT`, `SecurityE2ETest`, `PartnerPortalControllerIT`, `FarmerPartnerControllerIT`. **Fiez-vous à la commande, pas à cette liste** — elle a déjà grandi de 2 à 6.

Dans chacun, à côté des autres `@MockitoBean` :

```java
  @MockitoBean private SupplierLedgerEntryRepository supplierLedgerEntryRepository;
```

avec l'import `com.avicare.livestock.repository.SupplierLedgerEntryRepository`.

- [ ] **Step 5 : ajouter les endpoints au parcours CI**

Dans `scripts/api-journey.py`, après les appels fournisseurs existants, ajoutez le trajet : créer un fournisseur → `GET /ledger` (vide, solde 0) → `POST /ledger/charges` → `POST /ledger/payments` → `GET /ledger` (solde attendu) → `GET /balances`. Suivez la forme exacte des appels déjà présents dans le fichier ; tout 5xx rend le build rouge.

- [ ] **Step 6 : lancer le module entier**

```bash
cd backend && ./mvnw -o spotless:apply -pl avicare-app && ./mvnw -o test -pl avicare-app
```

Attendu : seules les erreurs Testcontainers connues.

- [ ] **Step 7 : commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/controller/ \
        backend/avicare-app/src/test/java/com/avicare/livestock/controller/SupplierLedgerControllerTest.java \
        backend/avicare-app/src/test/java/com/avicare/ scripts/api-journey.py
git commit -m "feat(backend:livestock): les endpoints du compte-courant fournisseur

Cinq routes sous /inventory/suppliers : les soldes, le relevé d'un fournisseur,
un versement, une dette de carnet, et la suppression d'une ligne manuelle.

Gardes identiques au SupplierController — lecture par permission, écriture
réservée au gérant : un mouvement d'argent n'est pas une saisie de terrain.

Le parcours API rejoué en CI couvre le trajet complet, donc tout 5xx sur ces
routes rendra le build rouge."
```

---

## Task 5 — Prévenir le fournisseur

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V55__supplier_whatsapp_optin.sql`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/SupplierNotifier.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/Supplier.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/PurchaseOrderService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/SupplierLedgerService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/SupplierNotifierTest.java`

**Interfaces:**
- Consumes: `WhatsAppOutboxFacade.enqueue(String rawPhone, String message)` (`com.avicare.notification.api`) et `TenancyFacade.findById(Long) : FarmInfo` (`com.avicare.tenancy.api`), dont le record est `FarmInfo(Long id, String name, String currency, String timezone, boolean active)`. Les deux sont des façades publiques : l'import entre contextes est celui que `CLAUDE.md` autorise.
- Produces: `SupplierNotifier.paymentRecorded(Long farmId, Supplier supplier, long amountXof, long balanceAfterXof, LocalDate date)` ; `SupplierNotifier.purchaseOrderSent(Long farmId, Supplier supplier, String orderNumber, long totalXof)`. **Le notifieur résout le nom de la ferme lui-même** — les appelants n'ont pas à le porter.

> **Cette tâche change le constructeur de `SupplierLedgerService`** (deux dépendances → trois). Le test écrit en Task 2 ne compilera plus : son Step 7 ci-dessous corrige l'appel. Ne le découvrez pas au build.

- [ ] **Step 1 : écrire la migration**

```sql
-- Prévenir un fournisseur par WhatsApp est un message à un TIERS : quelqu'un qui
-- n'a rien accepté de la plateforme, et à qui l'éleveur doit de l'argent. Le défaut
-- est donc FALSE, et c'est l'éleveur qui l'active, fournisseur par fournisseur.
ALTER TABLE suppliers ADD COLUMN notify_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2 : ajouter le champ à l'entité**

Dans `Supplier.java`, à côté de `active` :

```java
  @Column(name = "notify_whatsapp", nullable = false)
  private boolean notifyWhatsapp = false;
```

- [ ] **Step 3 : écrire le test du rédacteur (il doit échouer)**

```java
package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.avicare.livestock.domain.Supplier;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.api.FarmInfo;
import com.avicare.tenancy.api.TenancyFacade;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Le message part chez un tiers. Les tests portent donc autant sur ce qui NE part PAS que sur le
 * contenu de ce qui part.
 */
class SupplierNotifierTest {

  private final WhatsAppOutboxFacade whatsApp = Mockito.mock(WhatsAppOutboxFacade.class);
  private final TenancyFacade tenancy = Mockito.mock(TenancyFacade.class);
  private final SupplierNotifier notifier = new SupplierNotifier(whatsApp, tenancy);

  @BeforeEach
  void namedFarm() {
    Mockito.lenient()
        .when(tenancy.findById(7L))
        .thenReturn(new FarmInfo(7L, "Ferme Ndiaye", "XOF", "Africa/Dakar", true));
  }

  private static Supplier supplier(boolean notify, String phone) {
    Supplier s = new Supplier();
    s.setId(3L);
    s.setFarmId(7L);
    s.setCommercialName("Provende du Sahel");
    s.setPhone(phone);
    s.setNotifyWhatsapp(notify);
    return s;
  }

  @Test
  void sendsNothingWhenTheSwitchIsOff() {
    notifier.paymentRecorded(
        7L, supplier(false, "+221770000001"), 200_000L, 300_000L, LocalDate.of(2026, 9, 5));

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  @Test
  void sendsNothingWithoutAPhoneNumber() {
    notifier.paymentRecorded(
        7L, supplier(true, null), 200_000L, 300_000L, LocalDate.of(2026, 9, 5));

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  @Test
  void namesTheFarmFirst_thenTheAmountAndWhatRemains() {
    notifier.paymentRecorded(
        7L, supplier(true, "+221770000001"), 200_000L, 300_000L, LocalDate.of(2026, 9, 5));

    ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());

    String text = message.getValue();
    // Sans le nom de la ferme, un numéro inconnu écrit des chiffres.
    assertThat(text).startsWith("Ferme Ndiaye");
    assertThat(text).contains("200 000");
    assertThat(text).contains("300 000");
    // Le solde est la position de la ferme, pas une vérité opposable.
    assertThat(text).contains("selon mes comptes");
  }

  @Test
  void announcesAnOrderWithItsNumber() {
    notifier.purchaseOrderSent(7L, supplier(true, "+221770000001"), "BA-12", 450_000L);

    ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    assertThat(message.getValue()).contains("BA-12").contains("450 000");
  }
}
```

- [ ] **Step 4 : lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw -o test -pl avicare-app -Dtest=SupplierNotifierTest
```

Attendu : échec de compilation, `SupplierNotifier` n'existe pas.

- [ ] **Step 5 : écrire le rédacteur**

```java
package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.Supplier;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.api.TenancyFacade;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Écrit au fournisseur — quelqu'un qui n'a pas de compte sur la plateforme et n'a rien accepté
 * d'elle. Trois règles tiennent ces messages :
 *
 * <p>La ferme est nommée en premier : sans elle, un numéro inconnu envoie des chiffres.
 *
 * <p>Le solde est présenté comme la position de la ferme — « selon mes comptes » — et non comme une
 * vérité opposable. Un compte-courant se réconcilie ; l'énoncer comme un fait ferait d'un outil de
 * confiance une source de litige.
 *
 * <p>Aucune promesse de désabonnement : l'instance Konekt est un téléphone connecté dont personne
 * ne lit les réponses. Le message nomme la ferme, et c'est à elle que le fournisseur s'adresse.
 */
@Component
@RequiredArgsConstructor
public class SupplierNotifier {

  private final WhatsAppOutboxFacade whatsApp;
  private final TenancyFacade tenancyFacade;

  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

  public void paymentRecorded(
      Long farmId, Supplier supplier, long amountXof, long balanceAfterXof, LocalDate date) {
    if (!shouldNotify(supplier)) return;
    String farmName = farmName(farmId);

    String remaining =
        balanceAfterXof > 0
            ? "Reste dû : " + money(balanceAfterXof) + " FCFA selon mes comptes."
            : "Mon compte est soldé selon mes comptes.";

    whatsApp.enqueue(
        supplier.getPhone(),
        farmName
            + " — paiement enregistré le "
            + DATE.format(date)
            + " : "
            + money(amountXof)
            + " FCFA. "
            + remaining);
  }

  public void purchaseOrderSent(
      Long farmId, Supplier supplier, String orderNumber, long totalXof) {
    if (!shouldNotify(supplier)) return;
    String farmName = farmName(farmId);

    whatsApp.enqueue(
        supplier.getPhone(),
        farmName
            + " — nouvelle commande "
            + orderNumber
            + " d'un montant de "
            + money(totalXof)
            + " FCFA. Merci de confirmer la livraison.");
  }

  /** Le nom que le fournisseur reconnaîtra. Résolu ici pour qu'aucun appelant n'ait à le porter. */
  private String farmName(Long farmId) {
    return tenancyFacade.findById(farmId).name();
  }

  /** L'interrupteur, et un numéro pour y aller. Un interrupteur sans numéro n'envoie rien. */
  private static boolean shouldNotify(Supplier supplier) {
    return supplier != null
        && supplier.isNotifyWhatsapp()
        && supplier.getPhone() != null
        && !supplier.getPhone().isBlank();
  }

  private static String money(long xof) {
    return NumberFormat.getNumberInstance(Locale.FRANCE).format(xof);
  }
}
```

- [ ] **Step 6 : lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw -o spotless:apply -pl avicare-app && ./mvnw -o test -pl avicare-app -Dtest=SupplierNotifierTest
```

Attendu : `Tests run: 4, Failures: 0`. Si l'assertion sur `"200 000"` échoue, c'est l'espace insécable de `NumberFormat` en `Locale.FRANCE` — adaptez **l'assertion** (comparez avec le même formateur), pas le message.

- [ ] **Step 7 : brancher les deux déclencheurs, et réparer le test de la Task 2**

`SupplierLedgerService` gagne une dépendance :

```java
  private final SupplierNotifier supplierNotifier;
```

et, à la fin de `recordManual`, **seulement pour un versement** — on n'écrit pas au fournisseur pour lui annoncer qu'on a noté une dette envers lui :

```java
    if (direction == LedgerDirection.CREDIT && cmd.notify()) {
      supplierNotifier.paymentRecorded(
          farmId,
          supplier,
          entry.getAmountXof(),
          ledgerRepository.balanceFor(farmId, supplierId),
          entry.getEntryDate());
    }
```

`recordManual` doit donc conserver le `Supplier` que `requireSupplier` renvoie déjà :

```java
    Supplier supplier = requireSupplier(farmId, supplierId);
```

**Le constructeur du service passe de deux à trois dépendances**, donc `SupplierLedgerServiceTest`
ne compile plus. Dans son `setUp()` :

```java
    supplierNotifier = Mockito.mock(SupplierNotifier.class);
    service = new SupplierLedgerService(ledgerRepository, supplierRepository, supplierNotifier);
```

Dans `PurchaseOrderService.send(...)`, après `po.setSentAt(...)` :

```java
    // La commande part : c'est le moment où le fournisseur a besoin de la connaître.
    if (po.getSupplier() != null && po.getTotalXof() != null) {
      supplierNotifier.purchaseOrderSent(
          farmId, po.getSupplier(), po.getOrderNumber(), po.getTotalXof());
    }
```

avec le champ correspondant à côté de `supplierLedgerService`.

- [ ] **Step 8 : lancer le module et commiter**

```bash
cd backend && ./mvnw -o spotless:apply -pl avicare-app && ./mvnw -o test -pl avicare-app
git add backend/ && git commit -m "feat(backend:livestock): prévenir le fournisseur par WhatsApp

Un fournisseur n'a pas de compte : son téléphone est le seul canal. Le port
existait déjà — WhatsAppOutboxFacade met en file vers n'importe quel numéro et
ne lève jamais, donc un échec d'envoi ne peut pas annuler un paiement.

Interrupteur par fournisseur, défaut FALSE (V55) : le message part chez
quelqu'un qui n'a rien accepté de la plateforme, et à qui l'on doit de l'argent.

Deux messages seulement — la commande et le reçu. Le texte nomme la ferme
d'abord, et présente le solde comme la position de la ferme et non comme une
vérité opposable."
```

---

## Task 6 — Le web : l'API et la fiche compte-courant

**Files:**
- Create: `web/src/store/api/supplierLedgerApi.ts`
- Create: `web/src/components/inventory/SupplierLedgerView.tsx`
- Create: `web/src/components/inventory/SupplierPaymentDialog.tsx`
- Create: `web/src/app/(dashboard)/stocks/fournisseurs/[id]/page.tsx`
- Create: `web/src/components/inventory/SupplierLedgerView.test.tsx`
- Modify: `web/src/types/index.ts`

**Interfaces:**
- Consumes: Task 4 (les cinq routes).
- Produces: `useGetSupplierBalancesQuery({farmId})`, `useGetSupplierLedgerQuery({farmId, supplierId})`, `useRecordSupplierPaymentMutation`, `useRecordSupplierChargeMutation`, `useDeleteLedgerEntryMutation`.

- [ ] **Step 1 : ajouter les types**

Dans `web/src/types/index.ts` :

```typescript
/** Une ligne du compte-courant fournisseur (miroir de SupplierLedgerEntryResponse). */
export interface SupplierLedgerEntry {
  id: number;
  entryDate: string;
  direction: "DEBIT" | "CREDIT";
  source: "PURCHASE_ORDER" | "MANUAL";
  amountXof: number;
  label: string | null;
  method: string | null;
  reference: string | null;
  purchaseOrderId: number | null;
  runningBalanceXof: number;
}

/** Le relevé complet d'un fournisseur. */
export interface SupplierStatement {
  supplierId: number;
  balanceXof: number;
  entries: SupplierLedgerEntry[];
}

/** Le solde d'un fournisseur dans la vue d'ensemble. */
export interface SupplierBalance {
  supplierId: number;
  supplierName: string;
  balanceXof: number;
}
```

- [ ] **Step 2 : écrire le slice**

```typescript
import { baseApi } from "./baseApi";
import type { SupplierBalance, SupplierStatement } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/suppliers`;

/**
 * Le compte-courant fournisseur — ce que la ferme doit, ce qu'elle a payé.
 *
 * <p>Une écriture ici ne crée jamais de dépense côté serveur : la charge est enregistrée à la
 * réception du bon d'achat. Mais elle change la trésorerie, donc le tableau de bord et les soldes
 * sont invalidés.
 */
export const supplierLedgerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSupplierBalances: build.query<SupplierBalance[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/balances`,
      transformResponse: (r: ApiEnvelope<SupplierBalance[]>) => r.data,
      providesTags: [{ type: "Supplier", id: "balances" }],
    }),
    getSupplierLedger: build.query<
      SupplierStatement,
      { farmId: number; supplierId: number }
    >({
      query: ({ farmId, supplierId }) => `${base(farmId)}/${supplierId}/ledger`,
      transformResponse: (r: ApiEnvelope<SupplierStatement>) => r.data,
      providesTags: (_r, _e, { supplierId }) => [{ type: "Supplier", id: `ledger-${supplierId}` }],
    }),
    recordSupplierPayment: build.mutation<
      number,
      {
        farmId: number;
        supplierId: number;
        body: { amountXof: number; entryDate: string; label?: string; method?: string; reference?: string };
      }
    >({
      query: ({ farmId, supplierId, body }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/payments`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<number>) => r.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
        { type: "Supplier", id: "balances" },
      ],
    }),
    recordSupplierCharge: build.mutation<
      number,
      { farmId: number; supplierId: number; body: { amountXof: number; entryDate: string; label?: string } }
    >({
      query: ({ farmId, supplierId, body }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/charges`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<number>) => r.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
        { type: "Supplier", id: "balances" },
      ],
    }),
    deleteLedgerEntry: build.mutation<
      void,
      { farmId: number; supplierId: number; entryId: number }
    >({
      query: ({ farmId, supplierId, entryId }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/entries/${entryId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
        { type: "Supplier", id: "balances" },
      ],
    }),
  }),
});

export const {
  useGetSupplierBalancesQuery,
  useGetSupplierLedgerQuery,
  useRecordSupplierPaymentMutation,
  useRecordSupplierChargeMutation,
  useDeleteLedgerEntryMutation,
} = supplierLedgerApi;
```

- [ ] **Step 3 : écrire le test de la vue (il doit échouer)**

`SupplierLedgerView.test.tsx` — suivez la forme de `web/src/app/(dashboard)/reglages/notifications/page.test.tsx` (stub de `fetch`, `renderWithProviders`) :

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { SupplierLedgerView } from "./SupplierLedgerView";

vi.mock("@/hooks/useSelectedFarm", () => ({
  useSelectedFarm: () => ({ farmId: 7, isLoading: false, hasFarm: true }),
}));

const roleMock = vi.fn(() => "OWNER");
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => roleMock(),
}));

const STATEMENT = {
  supplierId: 3,
  balanceXof: 300000,
  entries: [
    {
      id: 1,
      entryDate: "2026-09-01",
      direction: "DEBIT",
      source: "PURCHASE_ORDER",
      amountXof: 500000,
      label: "Bon d'achat BA-12",
      method: null,
      reference: null,
      purchaseOrderId: 88,
      runningBalanceXof: 500000,
    },
    {
      id: 2,
      entryDate: "2026-09-03",
      direction: "CREDIT",
      source: "MANUAL",
      amountXof: 200000,
      label: "Versement",
      method: "CASH",
      reference: null,
      purchaseOrderId: null,
      runningBalanceXof: 300000,
    },
  ],
};

function mockFetch(onPost?: (url: string) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "POST") {
        onPost?.(url);
        return new Response(JSON.stringify({ data: 9 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      const data = url.includes("/ledger") ? STATEMENT : { id: 3, commercialName: "Provende du Sahel" };
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("SupplierLedgerView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    roleMock.mockReturnValue("OWNER");
  });

  it("montre le solde et le relevé", async () => {
    mockFetch();
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    expect(await screen.findByText("Bon d'achat BA-12")).toBeInTheDocument();
    expect(screen.getByText("Versement")).toBeInTheDocument();
  });

  it("enregistre un paiement", async () => {
    const post = vi.fn();
    mockFetch(post);
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await userEvent.click(await screen.findByRole("button", { name: /enregistrer un paiement/i }));
    await userEvent.type(screen.getByLabelText("Montant"), "100000");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/farms/7/inventory/suppliers/3/ledger/payments"),
      ),
    );
  });

  it("cache les actions à un membre qui n'est ni propriétaire ni gérant", async () => {
    roleMock.mockReturnValue("FARMER");
    mockFetch();
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    expect(await screen.findByText("Bon d'achat BA-12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enregistrer un paiement/i })).toBeNull();
  });
});
```

- [ ] **Step 4 : écrire la vue**

`SupplierLedgerView.tsx` — la charpente, à habiller avec les composants MUI déjà utilisés dans
`web/src/components/inventory/` :

```tsx
"use client";

import { useState } from "react";
import { Box, Button, Card, CardContent, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Trash2 } from "lucide-react";
import { useDeleteLedgerEntryMutation, useGetSupplierLedgerQuery } from "@/store/api/supplierLedgerApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { canManageCatalog, useFarmRole } from "@/hooks/useFarmRole";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SupplierPaymentDialog } from "./SupplierPaymentDialog";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { SupplierLedgerEntry } from "@/types";

/** Ce que dit un solde, en français plutôt qu'en signe. */
function balanceLabel(balanceXof: number): string {
  if (balanceXof > 0) return `Vous devez ${formatCurrency(balanceXof)}`;
  if (balanceXof < 0) return `Avance de ${formatCurrency(-balanceXof)}`;
  return "Compte soldé";
}

export function SupplierLedgerView({ supplierId }: { supplierId: number }) {
  const { farmId, hasFarm } = useSelectedFarm();
  const { data, isLoading } = useGetSupplierLedgerQuery(
    { farmId: farmId as number, supplierId },
    { skip: !hasFarm },
  );

  // Le backend réserve l'écriture au propriétaire et au gérant : on cache plutôt que de
  // proposer un geste qui répondra 403.
  const canWrite = canManageCatalog(useFarmRole(farmId));

  const [dialog, setDialog] = useState<"payment" | "charge" | null>(null);
  const [toRemove, setToRemove] = useState<SupplierLedgerEntry | null>(null);
  const [removeEntry, { isLoading: removing }] = useDeleteLedgerEntryMutation();
  const { showToast } = useToast();

  const confirmRemove = async () => {
    if (!toRemove || !farmId) return;
    try {
      await removeEntry({ farmId, supplierId, entryId: toRemove.id }).unwrap();
      setToRemove(null);
      showToast("Ligne supprimée.", "success");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {isLoading ? "…" : balanceLabel(data?.balanceXof ?? 0)}
        </Typography>
        {canWrite && (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => setDialog("payment")}>
              Enregistrer un paiement
            </Button>
            <Button variant="outlined" onClick={() => setDialog("charge")}>
              Ajouter une dette
            </Button>
          </Stack>
        )}
      </Stack>

      <Card>
        <CardContent>
          {!data?.entries.length ? (
            <Typography variant="body2" color="text.secondary">
              Aucun mouvement avec ce fournisseur.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Libellé</TableCell>
                    <TableCell align="right">Dette</TableCell>
                    <TableCell align="right">Payé</TableCell>
                    <TableCell align="right">Solde</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.entryDate)}</TableCell>
                      <TableCell>{e.label ?? "—"}</TableCell>
                      <TableCell align="right">
                        {e.direction === "DEBIT" ? formatCurrency(e.amountXof) : ""}
                      </TableCell>
                      <TableCell align="right">
                        {e.direction === "CREDIT" ? formatCurrency(e.amountXof) : ""}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(e.runningBalanceXof)}
                      </TableCell>
                      <TableCell align="right">
                        {/* Une ligne dérivée d'un bon d'achat se corrige par son bon, pas ici. */}
                        {canWrite && e.source === "MANUAL" && (
                          <IconButton
                            size="small"
                            aria-label={`Supprimer la ligne du ${formatDate(e.entryDate)}`}
                            onClick={() => setToRemove(e)}
                            sx={{ color: colors.neutral[500] }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <SupplierPaymentDialog
        open={dialog !== null}
        direction={dialog === "charge" ? "DEBIT" : "CREDIT"}
        supplierId={supplierId}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Supprimer cette ligne ?"
        message="Elle disparaîtra du relevé et le solde sera recalculé."
        confirmLabel="Supprimer"
        danger
        loading={removing}
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
```

- [ ] **Step 5 : écrire la boîte de dialogue**

`SupplierPaymentDialog.tsx` : un `Dialog` MUI avec Montant (obligatoire, chiffres seulement),
Date (par défaut aujourd'hui), et — pour un `CREDIT` uniquement — Méthode et Référence, plus **une
case « Prévenir <nom du fournisseur> par WhatsApp », cochée d'avance et rendue seulement si le
fournisseur a `notifyWhatsapp` actif**. Une prop `direction: "DEBIT" | "CREDIT"` choisit la mutation
(`useRecordSupplierChargeMutation` / `useRecordSupplierPaymentMutation`), le titre et les champs
affichés. Suivez la structure de `web/src/components/inventory/StockMovementDialog.tsx`, qui a déjà
la forme « dialogue MUI + mutation + toast » de ce dossier.

> La case voyage : le corps de la requête porte `notify: boolean` (Task 4), et `recordPayment` ne
> prévient que si l'interrupteur de la fiche **et** cette case sont vrais. Deux garde-fous à deux
> échelles — la relation d'un côté, ce versement-là de l'autre. Ne rendez jamais la case sans
> l'envoyer : une case qui ne fait rien est pire que pas de case.

`app/(dashboard)/stocks/fournisseurs/[id]/page.tsx` — miroir exact de la route client :

```tsx
import { SupplierLedgerView } from "@/components/inventory/SupplierLedgerView";

/**
 * Fiche fournisseur — compte-courant. En Next 16 `params` est une Promise ; on l'attend dans ce
 * composant serveur et on passe l'identifiant à la vue client qui possède le chargement.
 */
export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SupplierLedgerView supplierId={Number(id)} />;
}
```

- [ ] **Step 7 : lancer les tests web**

```bash
cd web && npx vitest run src/components/inventory/SupplierLedgerView.test.tsx
cd web && npx tsc --noEmit && npm run lint
```

Attendu : 3 tests verts, `tsc` propre, `eslint` sans erreur (les avertissements `_args` préexistants restent).

- [ ] **Step 8 : commit**

```bash
git add web/src/store/api/supplierLedgerApi.ts web/src/components/inventory/ \
        "web/src/app/(dashboard)/stocks/fournisseurs/[id]/page.tsx" web/src/types/index.ts
git commit -m "feat(web): la fiche fournisseur devient un compte-courant

Solde en tête, relevé chronologique avec solde progressif, versement et dette de
carnet. Miroir de la fiche client, dont le patron était déjà là.

Le solde progressif vient du serveur : le recalculer ici serait une seconde
occasion de diverger. Seules les lignes saisies à la main portent une action de
suppression — une ligne dérivée d'un bon d'achat se corrige par son bon."
```

---

## Task 7 — Le web : la liste, le total, l'interrupteur

**Files:**
- Modify: `web/src/app/(dashboard)/stocks/fournisseurs/page.tsx`
- Modify: `web/src/store/api/suppliersApi.ts`
- Modify: le formulaire fournisseur (le dialogue utilisé par la page ci-dessus)
- Modify: l'écran Finance (`web/src/app/(dashboard)/finance/page.tsx` ou le composant de synthèse qu'il monte)
- Test: étendre le test existant de la page fournisseurs, ou en créer un

**Interfaces:**
- Consumes: Task 6 (`useGetSupplierBalancesQuery`).
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1 : ajouter `notifyWhatsapp` au type et au slice**

Dans `web/src/types/index.ts`, ajoutez `notifyWhatsapp: boolean;` à l'interface `Supplier`. Vérifiez que `createSupplier` et `updateSupplier` de `suppliersApi.ts` transmettent le champ — **un PUT de remplacement qui l'omet le remettrait à `false`** (piège déjà rencontré sur ce dépôt).

- [ ] **Step 2 : la colonne solde et le lien**

Sur la page fournisseurs, chaque ligne devient cliquable vers `/stocks/fournisseurs/{id}` et affiche son solde, lu depuis `useGetSupplierBalancesQuery`. Un solde nul s'affiche « — », pas « 0 ».

- [ ] **Step 3 : l'interrupteur dans le formulaire**

Un `Switch` MUI « Prévenir par WhatsApp », **désactivé** quand la fiche n'a pas de téléphone, avec un texte d'aide qui dit pourquoi : « Renseignez un téléphone pour activer les avis. » Un interrupteur qu'on peut activer sans effet est un mensonge d'interface.

- [ ] **Step 4 : le total sur l'écran Finance**

Un seul nombre : « Dû aux fournisseurs », somme des soldes strictement positifs (une avance chez l'un ne compense pas une dette chez l'autre). Placez-le à côté des indicateurs existants, sans nouvelle carte si la grille en a déjà une adaptée.

- [ ] **Step 5 : tests, typecheck, lint, commit**

```bash
cd web && npx vitest run && npx tsc --noEmit && npm run lint
git add web/ && git commit -m "feat(web): solde fournisseur dans la liste, total en finance

La somme retenue ne compte que les soldes positifs : une avance chez un
fournisseur ne compense pas une dette chez un autre.

L'interrupteur WhatsApp est désactivé tant que la fiche n'a pas de téléphone,
avec la raison affichée — un interrupteur sans effet est un mensonge."
```

---

## Task 8 — Le mobile

**Files:**
- Create: `mobile/src/store/api/supplierLedgerApi.ts`
- Create: `mobile/app/(field)/stocks/fournisseurs/[id].tsx`
- Modify: `mobile/app/(field)/stocks/fournisseurs.tsx`
- Modify: `mobile/src/store/api/suppliersApi.ts`
- Modify: `mobile/src/types/index.ts`
- Test: `mobile/app/(field)/stocks/fournisseurs/__tests__/[id].test.tsx`

**Interfaces:**
- Consumes: Task 4 (les mêmes routes).
- Produces: rien.

- [ ] **Step 1 : porter le slice**

Copiez `web/src/store/api/supplierLedgerApi.ts` en adaptant les imports (`@/store/api/baseApi`, `@/types`) et le style de guillemets du mobile (simples). **Les URL doivent être identiques au caractère près** : `web/src/store/api/parity.test.ts` compare les URL normalisées des deux applications et échoue sinon.

- [ ] **Step 2 : le solde sur la liste**

Dans `fournisseurs.tsx`, chaque fournisseur affiche son solde et devient pressable vers `/(field)/stocks/fournisseurs/{id}`.

- [ ] **Step 3 : l'écran fiche**

Solde en tête, relevé, et un bouton « Enregistrer un paiement » ouvrant une feuille — même patron que la feuille de création déjà présente dans `fournisseurs.tsx`. **En ligne uniquement, sans passer par `enqueueFieldMutation`** : les écritures d'argent ne vont pas dans la file (`mobile/src/sync/types.ts` le dit et le pourquoi), et un avis WhatsApp rejoué enverrait deux reçus au fournisseur.

- [ ] **Step 4 : l'interrupteur WhatsApp**

Le formulaire de création/édition d'un fournisseur (la feuille de `fournisseurs.tsx`) gagne le même
interrupteur que le web, désactivé sans téléphone et avec la raison affichée. Ajoutez
`notifyWhatsapp` au type `Supplier` de `mobile/src/types/index.ts` et vérifiez que
`createSupplier`/`updateSupplier` le transmettent — un PUT de remplacement qui l'omet éteindrait
l'interrupteur en silence.

- [ ] **Step 5 : le test**

Suivez `mobile/app/(field)/lots/[unitId]/__tests__/mortalite.test.tsx` pour les mocks (`expo-router`, `react-redux`) et rappelez-vous que `render` et les gestes doivent être `await`és (React 19 + RNTL 14). Vérifiez : le relevé s'affiche, un paiement part en POST sur la bonne URL, et l'action est absente pour un rôle `FARMER`.

- [ ] **Step 6 : gates et commit**

```bash
cd mobile && npx jest && npx tsc --noEmit
cd web && npx vitest run src/store/api/parity.test.ts
git add mobile/ && git commit -m "feat(mobile): le compte-courant fournisseur sur le téléphone

Solde sur la liste, relevé et enregistrement d'un paiement sur la fiche.

En ligne uniquement, comme les autres écritures d'argent : la file ne déduplique
pas côté serveur, et un avis WhatsApp rejoué enverrait deux reçus au fournisseur
pour un seul versement."
```

---

## Task 9 — Fermer le chantier

**Files:**
- Modify: `docs/superpowers/specs/2026-09-05-compte-courant-fournisseur-design.md`

- [ ] **Step 1 : lancer les trois suites une dernière fois**

```bash
cd backend && ./mvnw -o clean test -pl avicare-app
cd web && npx vitest run && npx tsc --noEmit && npm run lint
cd mobile && npx jest && npx tsc --noEmit
```

- [ ] **Step 2 : marquer la spec livrée**

Dans l'en-tête de la spec, remplacez « design validé le 2026-09-05, prêt à planifier » par « **livré le \<date\>** », en nommant les PR et en disant lesquelles des sept décisions ont tenu telles quelles. Si l'une a bougé pendant l'implémentation, **dites laquelle et pourquoi** — une spec qui décrit une intention et non un état envoie la décision suivante dans la mauvaise direction.

- [ ] **Step 3 : commit**

```bash
git add docs/superpowers/specs/2026-09-05-compte-courant-fournisseur-design.md
git commit -m "docs(spec): compte-courant fournisseur livré"
```

---

## Notes de revue

**Ce qu'un relecteur doit vérifier en priorité :**

1. **L'invariant.** `grep -rn "com.avicare.finance" backend/avicare-app/src/main/java/com/avicare/livestock/inventory/` ne doit remonter que `PurchaseOrderService.java`. Task 3 en fait un test ; le relecteur le vérifie quand même.
2. **La somme du débit.** Task 3 Step 3 doit sommer `expenseLines`, pas lire `po.getTotalXof()`. C'est la différence entre endetter de ce qui est arrivé et de ce qui a été commandé.
3. **Les six contextes DB-less.** Le build local passe sans eux ; la CI échoue. Vérifier que le `grep` a été rejoué et pas la liste recopiée.
4. **Le PUT de remplacement.** Task 7 Step 1 et Task 8 Step 4 : si `updateSupplier` omet `notifyWhatsapp`, chaque modification de fiche éteindra l'interrupteur en silence.
5. **La case « Prévenir » voyage.** Le corps porte `notify`, et le service ne prévient que si l'interrupteur de la fiche ET la case sont vrais. Une case rendue mais non envoyée est un mensonge d'interface — vérifier le trajet complet, pas seulement la case.
6. **La parité.** Les URL du slice mobile doivent être identiques à celles du web, sinon `parity.test.ts` casse — et si une divergence est délibérée, elle s'inscrit dans `KNOWN_DIVERGENCES` avec sa raison.
