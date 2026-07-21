package com.avicare.livestock.repository;

import com.avicare.livestock.domain.WeighingSample;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Data access for {@link WeighingSample}. Soft-deleted samples are filtered by the entity's
 * {@code @SQLRestriction}.
 */
public interface WeighingSampleRepository extends JpaRepository<WeighingSample, Long> {

  List<WeighingSample> findByPoultryBatchIdOrderBySampleDateDesc(Long poultryBatchId);

  Optional<WeighingSample> findFirstByPoultryBatchIdOrderBySampleDateDesc(Long poultryBatchId);

  /**
   * Mobile replay lookup (doc 08 §9): find the sample already recorded for this client-generated
   * key.
   */
  Optional<WeighingSample> findByClientRef(UUID clientRef);

  // ── Dashboard aggregations (Task 2.1, Spec B) ────────────────────────────

  /**
   * Farm-level average daily weight gain (GMQ, g/day) within the inclusive period [{@code from},
   * {@code to}]. For each broiler batch with at least 2 non-soft-deleted samples in the window, the
   * per-batch GMQ is computed as {@code (MAX(avg_weight_g) − MIN(avg_weight_g)) / MAX(age_days) −
   * MIN(age_days))}. The farm GMQ is the average of per-batch GMQs. Returns {@code null} when no
   * batch has two or more samples in the window (no data to compute a gain). Native SQL — joins
   * {@code weighing_samples → poultry_batches → production_units}; the soft-delete filter on {@code
   * weighing_samples} ({@code deleted_at IS NULL}) and {@code production_units} ({@code deleted_at
   * IS NULL}) are applied explicitly since {@code @SQLRestriction} does not apply to native
   * queries.
   */
  @Query(
      value =
          "SELECT AVG(batch_gmq) "
              + "FROM ( "
              + "  SELECT (MAX(ws.avg_weight_g) - MIN(ws.avg_weight_g)) "
              + "         / NULLIF(MAX(ws.age_days) - MIN(ws.age_days), 0) AS batch_gmq "
              + "  FROM weighing_samples ws "
              + "  JOIN poultry_batches pb ON pb.id = ws.poultry_batch_id "
              + "  JOIN production_units pu ON pu.id = pb.id "
              + "  WHERE pu.farm_id = :farmId "
              + "    AND pu.deleted_at IS NULL "
              + "    AND ws.sample_date BETWEEN :from AND :to "
              + "    AND ws.deleted_at IS NULL "
              + "  GROUP BY ws.poultry_batch_id "
              + "  HAVING COUNT(*) >= 2 "
              + ") batches_with_gmq",
      nativeQuery = true)
  Double avgDailyGainGByFarmAndPeriod(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
