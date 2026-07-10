package com.avicare.livestock.repository;

import com.avicare.livestock.domain.StockMovement;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

  List<StockMovement> findByStockItemIdOrderByMovementDateDescIdDesc(Long stockItemId);

  List<StockMovement> findByStockItemIdAndMovementDateBetween(
      Long stockItemId, LocalDate from, LocalDate to);

  List<StockMovement> findByProductionUnitIdOrderByMovementDateDesc(Long productionUnitId);

  /** All movements of a farm, most recent first (the service caps the overview to N rows). */
  List<StockMovement> findByStockItem_FarmIdOrderByMovementDateDescIdDesc(Long farmId);

  /** Same ordering, capped via {@code pageable} (activity feed, Task 3). */
  List<StockMovement> findByStockItem_FarmIdOrderByMovementDateDescIdDesc(
      Long farmId, Pageable pageable);

  /** Total moved value of a stock item over a period (0 when none / no priced movement). */
  @Query(
      "SELECT COALESCE(SUM(m.totalValueXof), 0) FROM StockMovement m "
          + "WHERE m.stockItem.id = :stockItemId AND m.movementDate BETWEEN :from AND :to")
  long sumValueInBetween(
      @Param("stockItemId") Long stockItemId,
      @Param("from") LocalDate from,
      @Param("to") LocalDate to);
}
