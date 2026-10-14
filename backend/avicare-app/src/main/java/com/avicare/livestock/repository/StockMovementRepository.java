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
   * Every movement a source action produced, outflows and their compensating inflows alike — the
   * raw material of a reversal, which nets them before crediting anything back.
   */
  List<StockMovement> findByDailyRecordId(Long dailyRecordId);

  List<StockMovement> findByVaccinationId(Long vaccinationId);

  List<StockMovement> findByTreatmentExecutedId(Long treatmentExecutedId);

  /**
   * What a production unit consumed, article loaded — the raw material of a batch's cost. Outflows
   * AND the compensating inflows that cancel them, because a corrected or deleted entry leaves both
   * in the journal and the batch must be charged the net. An inflow is a reversal when it carries a
   * source backref; a purchase or a manual entry never can (see {@code StockMovementRequest}).
   * {@code JOIN FETCH} because the caller reads {@code stockItem} on every row.
   */
  @Query(
      "SELECT m FROM StockMovement m JOIN FETCH m.stockItem "
          + "WHERE m.productionUnitId = :unitId "
          + "AND (m.movementType = com.avicare.livestock.domain.MovementType.OUT "
          + "OR (m.movementType = com.avicare.livestock.domain.MovementType.IN "
          + "AND (m.dailyRecordId IS NOT NULL OR m.vaccinationId IS NOT NULL "
          + "OR m.treatmentExecutedId IS NOT NULL)))")
  List<StockMovement> findConsumptionMovementsForUnit(@Param("unitId") Long unitId);

  /**
   * What a whole farm consumed over a window, article loaded — what the dashboard values as
   * "consumed over the period". Same netting as {@link #findConsumptionMovementsForUnit}: outflows
   * plus the reversals that cancel them. {@code JOIN FETCH} because every row is priced through its
   * article.
   */
  @Query(
      "SELECT m FROM StockMovement m JOIN FETCH m.stockItem "
          + "WHERE m.stockItem.farmId = :farmId "
          + "AND m.movementDate BETWEEN :from AND :to "
          + "AND (m.movementType = com.avicare.livestock.domain.MovementType.OUT "
          + "OR (m.movementType = com.avicare.livestock.domain.MovementType.IN "
          + "AND (m.dailyRecordId IS NOT NULL OR m.vaccinationId IS NOT NULL "
          + "OR m.treatmentExecutedId IS NOT NULL)))")
  List<StockMovement> findConsumptionMovementsForFarmBetween(
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
