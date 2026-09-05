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
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
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
                    "INSERT INTO farms (name, created_by) VALUES ('Ferme Registre', :u) RETURNING id")
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
                        + "order_date, created_by) VALUES (:f, 'BC-2026-001', :s, 'RECEIVED', "
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
    SupplierLedgerEntry debit =
        repository.save(entry(ids[0], ids[1], LedgerDirection.DEBIT, 90_000L));
    repository.delete(debit);

    assertThat(repository.balanceFor(ids[0], ids[1])).isZero();
  }
}
