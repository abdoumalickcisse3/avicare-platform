package com.avicare.livestock.domain;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A purchase order for one supplier (Sprint B4-3) — header of a multi-line order driving the
 * workflow {@link PurchaseOrderStatus}. Farm-scoped (farm referenced by id, no cross-context
 * association); the supplier is in the same context so it is a real {@code @ManyToOne}. {@code
 * orderNumber} is generated {@code BC-YYYY-NNN} per farm per year. {@code totalXof} is the sum of
 * the line totals. Reception fills {@code actualDeliveryDate} and emits the stock movements.
 * Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "purchase_orders")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "items")
public class PurchaseOrder {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "order_number", nullable = false)
  private String orderNumber;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "supplier_id", nullable = false)
  private Supplier supplier;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PurchaseOrderStatus status = PurchaseOrderStatus.DRAFT;

  @Column(name = "order_date", nullable = false)
  private LocalDate orderDate;

  @Column(name = "expected_delivery_date")
  private LocalDate expectedDeliveryDate;

  @Column(name = "actual_delivery_date")
  private LocalDate actualDeliveryDate;

  @Column(name = "total_xof")
  private Long totalXof;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "sent_by")
  private Long sentBy;

  @Column(name = "sent_at")
  private LocalDateTime sentAt;

  @Column(name = "received_by")
  private Long receivedBy;

  @Column(name = "received_at")
  private LocalDateTime receivedAt;

  @Column(name = "cancelled_by")
  private Long cancelledBy;

  @Column(name = "cancelled_at")
  private LocalDateTime cancelledAt;

  @Column(name = "cancellation_reason")
  private String cancellationReason;

  @Column private String notes;

  @OneToMany(
      mappedBy = "purchaseOrder",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @OrderBy("id ASC")
  private List<PurchaseOrderItem> items = new ArrayList<>();

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /** Add a line and keep both sides of the association in sync. */
  public void addItem(PurchaseOrderItem item) {
    item.setPurchaseOrder(this);
    items.add(item);
  }
}
