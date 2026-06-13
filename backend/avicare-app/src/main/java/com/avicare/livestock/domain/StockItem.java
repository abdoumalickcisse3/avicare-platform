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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Per-farm stock of a single article (Sprint B4-1). One row per {@code (farmId, articleSource,
 * articleKey)} — granularity is per-farm, not per-lot (V1 decision). {@code articleKey} resolves
 * against the platform catalog: {@code inventory_items} when {@link #articleSource} is {@code
 * INVENTORY}, {@code treatments} when {@code TREATMENT} (medications are referenced, not
 * duplicated). {@code unit} and {@code typicalUnitPriceXof} are a snapshot taken from the catalog
 * at creation.
 *
 * <p>{@code currentQuantity} MAY be negative (Décision 19 — insufficient stock is a non-blocking
 * warning, never a hard stop). Soft-deleted via {@code active=false}. Timestamps DB-owned
 * (trigger).
 */
@Entity
@Table(name = "stock_items")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class StockItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "article_key", nullable = false)
  private String articleKey;

  @Enumerated(EnumType.STRING)
  @Column(name = "article_source", nullable = false)
  private ArticleSource articleSource = ArticleSource.INVENTORY;

  @Column(name = "current_quantity", nullable = false)
  private BigDecimal currentQuantity = BigDecimal.ZERO;

  @Column private String unit;

  @Column(name = "alert_threshold")
  private BigDecimal alertThreshold;

  @Column(name = "typical_unit_price_xof")
  private Integer typicalUnitPriceXof;

  @Column(name = "last_movement_at")
  private LocalDateTime lastMovementAt;

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
