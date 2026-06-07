package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A computed growth-performance snapshot for a broiler batch on a given date (one row per (batch,
 * date), upserted by {@code GrowthAnalysisService}). Derived from the latest weighing, the daily
 * records (cumulative feed/water/mortality) and the batch slaughter targets. Not user-editable;
 * only {@code computedAt} is refreshed on each recompute (no trigger).
 */
@Entity
@Table(name = "growth_performance")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class GrowthPerformance {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "poultry_batch_id", nullable = false)
  private Long poultryBatchId;

  @Column(name = "snapshot_date", nullable = false)
  private LocalDate snapshotDate;

  @Column(name = "age_days", nullable = false)
  private int ageDays;

  @Column(name = "current_weight_g")
  private BigDecimal currentWeightG;

  @Column(name = "gmq_g_per_day")
  private BigDecimal gmqGPerDay;

  @Column(name = "feed_conversion_ratio")
  private BigDecimal feedConversionRatio;

  @Column(name = "cumulative_mortality_percent")
  private BigDecimal cumulativeMortalityPercent;

  @Column(name = "cumulative_feed_kg")
  private BigDecimal cumulativeFeedKg;

  @Column(name = "cumulative_water_l")
  private BigDecimal cumulativeWaterL;

  @Column(name = "forecasted_target_date")
  private LocalDate forecastedTargetDate;

  @Column(name = "performance_score")
  private String performanceScore;

  @Column(name = "computed_at")
  private LocalDateTime computedAt;
}
