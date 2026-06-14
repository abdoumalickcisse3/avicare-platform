package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A per-farm custom feed formula (Sprint B4-4) — created from scratch or cloned from a platform
 * template ({@code sourceFormulaKey} keeps the origin). Farm-scoped (farm referenced by id). {@code
 * ingredients} and {@code targetBreedKeys} are JSONB (house mapping pattern). {@code
 * totalPercentage} and {@code estimatedCostPer100kgXof} are computed snapshots — the cost is
 * derived from catalog typical prices and can drift, so {@code estimatedCostCalculatedAt} records
 * when it was last refreshed. Soft-deleted via {@code active=false}. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "feed_formulas")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class FeedFormula {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(nullable = false)
  private String name;

  @Column private String description;

  @Column(name = "source_formula_key")
  private String sourceFormulaKey;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "target_breed_keys", nullable = false)
  private List<String> targetBreedKeys = List.of();

  @Enumerated(EnumType.STRING)
  @Column(name = "target_phase", nullable = false)
  private FeedPhase targetPhase;

  @Column(name = "target_age_days_min")
  private Integer targetAgeDaysMin;

  @Column(name = "target_age_days_max")
  private Integer targetAgeDaysMax;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private List<FormulaIngredient> ingredients = List.of();

  @Column(name = "total_percentage")
  private BigDecimal totalPercentage;

  @Column(name = "estimated_cost_per_100kg_xof")
  private Integer estimatedCostPer100kgXof;

  @Column(name = "estimated_cost_calculated_at")
  private LocalDateTime estimatedCostCalculatedAt;

  @Column(nullable = false)
  private boolean active = true;

  @Column private String notes;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
