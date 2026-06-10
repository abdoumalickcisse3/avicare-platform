package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Farm-scoped egg tray inventory (Sprint B2-1): full and empty tray counts mutualised across the
 * farm's lots (not per unit). One row per farm (UNIQUE {@code farm_id}), auto-created by {@code
 * EggTrayStockService}. The farm is referenced by id (no cross-context {@code @ManyToOne}).
 * Timestamps are DB-owned (trigger), mapped read-only.
 */
@Entity
@Table(name = "egg_tray_stocks")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class EggTrayStock {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "full_trays_count", nullable = false)
  private int fullTraysCount = 0;

  @Column(name = "empty_trays_count", nullable = false)
  private int emptyTraysCount = 0;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
