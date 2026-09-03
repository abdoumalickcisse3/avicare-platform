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

  /**
   * Stock outflows charged to a production unit, article loaded — the raw material of a batch's
   * cost. {@code JOIN FETCH} because the caller reads {@code stockItem} on every row.
   */
  @Query(
      "SELECT m FROM StockMovement m JOIN FETCH m.stockItem "
          + "WHERE m.productionUnitId = :unitId "
          + "AND m.movementType = com.avicare.livestock.domain.MovementType.OUT")
  List<StockMovement> findOutMovementsForUnit(@Param("unitId") Long unitId);

  /**
   * Stock outflows of a whole farm over a window, article loaded — what the dashboard values as
   * "consumed over the period". {@code JOIN FETCH} because every row is priced through its article.
   */
  @Query(
      "SELECT m FROM StockMovement m JOIN FETCH m.stockItem "
          + "WHERE m.stockItem.farmId = :farmId "
          + "AND m.movementType = com.avicare.livestock.domain.MovementType.OUT "
          + "AND m.movementDate BETWEEN :from AND :to")
  List<StockMovement> findOutMovementsForFarmBetween(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

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
