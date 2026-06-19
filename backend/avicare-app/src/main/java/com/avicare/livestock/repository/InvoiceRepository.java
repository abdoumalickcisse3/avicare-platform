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
}
