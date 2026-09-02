package com.avicare.livestock.closure;

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
 * The frozen end-of-cycle report of a production unit. Written once at closing time and never
 * recomputed: an expense recorded three weeks later, or a corrected article price, would otherwise
 * silently rewrite a past result, and a report that moves is not a report.
 *
 * <p>No soft delete — reopening a unit removes the row outright.
 *
 * <p>{@code consumedArticles} / {@code valuedArticles} carry the valuation coverage. An article
 * consumed without a price weighs zero in the total, so a report that hid the gap would always
 * flatter.
 */
@Entity
@Table(name = "unit_closures")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class UnitClosure {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "production_unit_id", nullable = false)
  private Long productionUnitId;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "closed_at", nullable = false)
  private LocalDateTime closedAt;

  @Column(name = "closed_by")
  private Long closedBy;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Column(name = "duration_days", nullable = false)
  private int durationDays;

  @Column(name = "initial_count", nullable = false)
  private int initialCount;

  /** Subjects still on the farm at closing time — a batch is often closed before the last bird. */
  @Column(name = "remaining_count", nullable = false)
  private int remainingCount;

  @Column(nullable = false)
  private int deaths;

  @Column(name = "mortality_percent")
  private BigDecimal mortalityPercent;

  // ── Technical: null for a unit the species does not compute them for ──────

  @Column(name = "exit_weight_g")
  private BigDecimal exitWeightG;

  @Column(name = "avg_daily_gain_g")
  private BigDecimal avgDailyGainG;

  @Column(name = "total_feed_kg")
  private BigDecimal totalFeedKg;

  @Column(name = "feed_conversion_ratio")
  private BigDecimal feedConversionRatio;

  // ── Money: whole XOF ──────────────────────────────────────────────────────

  @Column(name = "revenue_xof", nullable = false)
  private long revenueXof;

  @Column(name = "feed_cost_xof", nullable = false)
  private long feedCostXof;

  @Column(name = "chick_cost_xof", nullable = false)
  private long chickCostXof;

  @Column(name = "other_expense_xof", nullable = false)
  private long otherExpenseXof;

  @Column(name = "total_cost_xof", nullable = false)
  private long totalCostXof;

  @Column(name = "margin_xof", nullable = false)
  private long marginXof;

  /** Cost of one live kilo produced. Null rather than wrong when the batch was never weighed. */
  @Column(name = "cost_per_kg_xof")
  private Integer costPerKgXof;

  // ── Valuation coverage ────────────────────────────────────────────────────

  @Column(name = "consumed_articles", nullable = false)
  private int consumedArticles;

  @Column(name = "valued_articles", nullable = false)
  private int valuedArticles;

  @Column private String notes;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
