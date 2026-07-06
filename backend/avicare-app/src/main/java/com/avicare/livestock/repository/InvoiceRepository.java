package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

  List<Invoice> findByFarmIdOrderByIssueDateDescIdDesc(Long farmId);

  List<Invoice> findByFarmIdAndStatusOrderByIssueDateDescIdDesc(Long farmId, InvoiceStatus status);

  List<Invoice> findByFarmIdAndClientIdOrderByIssueDateDescIdDesc(Long farmId, Long clientId);

  Optional<Invoice> findByFarmIdAndId(Long farmId, Long id);

  Optional<Invoice> findByFarmIdAndSaleId(Long farmId, Long saleId);

  Optional<Invoice> findByFarmIdAndDeliveryId(Long farmId, Long deliveryId);

  /**
   * Unpaid invoices whose due date has passed (D24 — "overdue" is derived, not a stored status):
   * still ISSUED or PARTIALLY_PAID and {@code due_date < :today}. Ordered by oldest due first.
   */
  @Query(
      "SELECT i FROM Invoice i WHERE i.farmId = :farmId "
          + "AND i.status IN (com.avicare.livestock.domain.InvoiceStatus.ISSUED, "
          + "com.avicare.livestock.domain.InvoiceStatus.PARTIALLY_PAID) "
          + "AND i.dueDate IS NOT NULL AND i.dueDate < :today ORDER BY i.dueDate ASC")
  List<Invoice> findOverdue(@Param("farmId") Long farmId, @Param("today") LocalDate today);

  /**
   * Highest sequence used by a farm for a given {@code F-YYYY-} prefix (0 when none), so the
   * service can mint the next {@code F-YYYY-NNN} (D24). Native — parses the trailing digits.
   */
  @Query(
      value =
          "SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) "
              + "FROM invoices WHERE farm_id = :farmId AND invoice_number LIKE :prefix",
      nativeQuery = true)
  int findMaxSequence(@Param("farmId") Long farmId, @Param("prefix") String prefix);

  // ── Dashboard aggregations (Task 1.1, Spec B) ────────────────────────────

  /**
   * Total outstanding receivable (totalXof − amountPaidXof) across all open invoices (ISSUED or
   * PARTIALLY_PAID) for a farm. Snapshot — ignores period. Returns 0 when none. Uses native SQL to
   * allow arithmetic inside SUM (JPQL restricts SUM to single field paths).
   */
  @Query(
      value =
          "SELECT CAST(COALESCE(SUM(total_xof - amount_paid_xof), 0) AS BIGINT) "
              + "FROM invoices WHERE farm_id = :farmId "
              + "AND status IN ('ISSUED', 'PARTIALLY_PAID')",
      nativeQuery = true)
  long sumOutstanding(@Param("farmId") Long farmId);

  /**
   * Outstanding receivable on overdue invoices (due_date strictly before {@code today}, not yet
   * PAID or CANCELLED). Snapshot — ignores period. Returns 0 when none.
   */
  @Query(
      value =
          "SELECT CAST(COALESCE(SUM(total_xof - amount_paid_xof), 0) AS BIGINT) "
              + "FROM invoices WHERE farm_id = :farmId "
              + "AND status IN ('ISSUED', 'PARTIALLY_PAID') "
              + "AND due_date IS NOT NULL AND due_date < :today",
      nativeQuery = true)
  long sumOverdue(@Param("farmId") Long farmId, @Param("today") LocalDate today);

  /**
   * Count of open invoices not yet fully paid (ISSUED or PARTIALLY_PAID). Snapshot KPI for the
   * "invoices to collect" worklist badge.
   */
  @Query(
      "SELECT COUNT(i) FROM Invoice i WHERE i.farmId = :farmId "
          + "AND i.status IN (com.avicare.livestock.domain.InvoiceStatus.ISSUED, "
          + "com.avicare.livestock.domain.InvoiceStatus.PARTIALLY_PAID)")
  long countToCollect(@Param("farmId") Long farmId);

  /**
   * Top 5 clients with the highest outstanding balance (snapshot). Clients without a linked invoice
   * are excluded. Each row is {@code [Long clientId, String displayName, Long outstanding]},
   * ordered descending by outstanding.
   */
  @Query(
      value =
          "SELECT i.client_id, c.display_name, "
              + "CAST(COALESCE(SUM(i.total_xof - i.amount_paid_xof), 0) AS BIGINT) AS outstanding "
              + "FROM invoices i JOIN clients c ON c.id = i.client_id "
              + "WHERE i.farm_id = :farmId AND i.status IN ('ISSUED', 'PARTIALLY_PAID') "
              + "AND i.client_id IS NOT NULL "
              + "GROUP BY i.client_id, c.display_name "
              + "ORDER BY outstanding DESC "
              + "LIMIT 5",
      nativeQuery = true)
  List<Object[]> topDebtors(@Param("farmId") Long farmId);

  /**
   * Σ des montants encaissés sur les factures issues d'une LIVRAISON (non annulées) pour la ferme,
   * tous exercices confondus (finance P&L : « commandes payées »). 0 si aucune.
   */
  @Query(
      "SELECT COALESCE(SUM(i.amountPaidXof), 0) FROM Invoice i "
          + "WHERE i.farmId = :farmId "
          + "AND i.sourceType = com.avicare.livestock.domain.InvoiceSourceType.DELIVERY "
          + "AND i.status <> com.avicare.livestock.domain.InvoiceStatus.CANCELLED")
  long sumPaidFromDeliveries(@Param("farmId") Long farmId);
}
