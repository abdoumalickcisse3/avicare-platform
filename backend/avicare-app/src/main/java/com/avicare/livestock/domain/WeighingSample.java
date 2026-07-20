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
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A periodic sample weighing of a broiler batch (weekly by default). {@code individualWeights} is
 * the raw JSONB array of gram weights; the aggregate stats (avg/min/max/std/uniformity) are derived
 * by {@code GrowthAnalysisService}. Soft-deletable — a mis-entered sample is corrected by re-entry.
 * Timestamps are DB-owned (trigger), mapped read-only.
 */
@Entity
@Table(name = "weighing_samples")
@SQLDelete(sql = "UPDATE weighing_samples SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class WeighingSample {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "poultry_batch_id", nullable = false)
  private Long poultryBatchId;

  @Column(name = "sample_date", nullable = false)
  private LocalDate sampleDate;

  @Column(name = "age_days", nullable = false)
  private int ageDays;

  @Column(name = "sample_size", nullable = false)
  private int sampleSize;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "individual_weights", nullable = false)
  private List<Integer> individualWeights = List.of();

  @Column(name = "avg_weight_g", nullable = false)
  private BigDecimal avgWeightG;

  @Column(name = "min_weight_g")
  private BigDecimal minWeightG;

  @Column(name = "max_weight_g")
  private BigDecimal maxWeightG;

  @Column(name = "std_deviation")
  private BigDecimal stdDeviation;

  @Column(name = "uniformity_percent")
  private BigDecimal uniformityPercent;

  @Column private String notes;

  @Column(name = "recorded_by")
  private Long recordedBy;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /**
   * Mobile replay key (doc 08 §9): when set, a retry with the same value returns the original
   * sample instead of inserting a duplicate. NULL for web-originated samples (partial unique
   * index).
   */
  @Column(name = "client_ref")
  private UUID clientRef;
}
