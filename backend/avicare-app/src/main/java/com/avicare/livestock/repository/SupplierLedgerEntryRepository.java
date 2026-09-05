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
