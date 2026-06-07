package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A daily entry on a {@link ProductionUnit} (mortality, feed, water, free-text observations). One
 * row per (unit, date) — upserted by {@code DailyRecordService}. {@code mortalityCount} is the raw
 * input and may exceed the current count in a catastrophe; the actual head-count change is
 * journaled as lifecycle events (clamped to {@code >= 0}). Timestamps are DB-owned (trigger),
 * mapped read-only. The unit is referenced by the parent type, not a species subclass.
 */
@Entity
@Table(name = "daily_records")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class DailyRecord {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @Column(name = "record_date", nullable = false)
  private LocalDate recordDate;

  @Column(name = "mortality_count", nullable = false)
  private int mortalityCount = 0;

  @Column(name = "feed_kg", nullable = false)
  private BigDecimal feedKg = BigDecimal.ZERO;

  @Column(name = "water_l", nullable = false)
  private BigDecimal waterL = BigDecimal.ZERO;

  @Column private String observations;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
