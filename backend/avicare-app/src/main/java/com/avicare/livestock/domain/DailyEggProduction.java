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
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A computed daily egg-production snapshot for a layer unit (one row per (unit, date), upserted by
 * {@code EggProductionService.closeDay}). Aggregates the day's {@link EggCollection} rows across
 * all time-slots and derives the laying / break rates against the unit's head count at close time.
 *
 * <p>Recomputable and idempotent: re-closing a day recomputes every field from the collections and
 * only refreshes {@code closedAt}/{@code closedBy}. The unit is referenced through the {@code
 * productionUnit} association; the author is referenced by id. Timestamps are DB-owned (trigger),
 * mapped read-only; {@code closedAt} is set by the service.
 */
@Entity
@Table(name = "daily_egg_productions")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class DailyEggProduction {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @Column(name = "production_date", nullable = false)
  private LocalDate productionDate;

  @Column(name = "total_eggs_collected", nullable = false)
  private int totalEggsCollected = 0;

  @Column(name = "total_broken_eggs", nullable = false)
  private int totalBrokenEggs = 0;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "grades_aggregate", nullable = false)
  private Map<String, Integer> gradesAggregate = Map.of();

  @Column(name = "laying_rate_pct")
  private BigDecimal layingRatePct;

  @Column(name = "break_rate_pct")
  private BigDecimal breakRatePct;

  @Column(name = "active_layers_count")
  private Integer activeLayersCount;

  @Column(name = "closed_at", nullable = false)
  private LocalDateTime closedAt;

  @Column(name = "closed_by")
  private Long closedById;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
