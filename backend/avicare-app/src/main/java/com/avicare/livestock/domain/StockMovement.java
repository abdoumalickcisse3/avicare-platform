package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * One change to a {@link StockItem}'s quantity (Sprint B4-2) — the append-only stock journal.
 * {@code quantity} is always the positive magnitude of the change; {@link #movementType} carries
 * the direction and {@code quantityBefore}/{@code quantityAfter} snapshot the stock around it. The
 * service applies the change to {@code StockItem.currentQuantity} atomically; {@code quantityAfter}
 * may be negative (Décision 19). The optional {@code *Id} columns are cross-module soft references
 * (lot / daily record / vaccination / treatment) kept for traceability — no JPA association, no
 * cross-context validation in V1. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "stock_movements")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class StockMovement {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "stock_item_id", nullable = false)
  private StockItem stockItem;

  @Enumerated(EnumType.STRING)
  @Column(name = "movement_type", nullable = false)
  private MovementType movementType;

  @Column(name = "movement_date", nullable = false)
  private LocalDate movementDate;

  @Column(nullable = false)
  private BigDecimal quantity;

  @Column(name = "quantity_before", nullable = false)
  private BigDecimal quantityBefore;

  @Column(name = "quantity_after", nullable = false)
  private BigDecimal quantityAfter;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private MovementReason reason;

  @Column(name = "production_unit_id")
  private Long productionUnitId;

  @Column(name = "purchase_order_id")
  private Long purchaseOrderId;

  @Column(name = "sale_id")
  private Long saleId;

  @Column(name = "delivery_id")
  private Long deliveryId;

  @Column(name = "daily_record_id")
  private Long dailyRecordId;

  @Column(name = "vaccination_id")
  private Long vaccinationId;

  @Column(name = "treatment_executed_id")
  private Long treatmentExecutedId;

  @Column(name = "unit_price_xof")
  private Integer unitPriceXof;

  @Column(name = "total_value_xof")
  private Long totalValueXof;

  @Column private String notes;

  @Column(name = "performed_by_user_id")
  private Long performedByUserId;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
