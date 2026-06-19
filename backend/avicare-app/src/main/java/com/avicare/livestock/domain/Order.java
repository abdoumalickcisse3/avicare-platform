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
 * A sales order for one client (Sprint B5-1) — header of a multi-line order driving the workflow
 * {@link OrderStatus} (D23). Farm-scoped (farm referenced by id, no cross-context association); the
 * client is in the same sub-domain so it is a real {@code @ManyToOne} (ADR-008). {@code
 * orderNumber} is generated {@code ORD-YYYY-NNN} per farm per year (D24). {@code totalXof} is the
 * sum of the line totals (HT only — no VAT in V1, D25). Delivery actually creates a Delivery +
 * stock cascade (D21) in B5-2; here {@link #markDelivered} only flips the status. Timestamps
 * DB-owned (trigger).
 */
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "items")
public class Order {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "order_number", nullable = false)
  private String orderNumber;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "client_id", nullable = false)
  private Client client;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private OrderStatus status = OrderStatus.PENDING;

  @Column(name = "order_date", nullable = false)
  private LocalDate orderDate;

  @Column(name = "expected_delivery_date")
  private LocalDate expectedDeliveryDate;

  @Column(name = "actual_delivery_date")
  private LocalDate actualDeliveryDate;

  @Column(name = "delivery_address")
  private String deliveryAddress;

  @Column(name = "delivery_notes")
  private String deliveryNotes;

  @Column(name = "expected_payment_method")
  private String expectedPaymentMethod;

  @Column(name = "expected_payment_due_date")
  private LocalDate expectedPaymentDueDate;

  @Column(name = "total_xof", nullable = false)
  private Long totalXof = 0L;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "confirmed_by")
  private Long confirmedBy;

  @Column(name = "confirmed_at")
  private LocalDateTime confirmedAt;

  @Column(name = "delivered_by")
  private Long deliveredBy;

  @Column(name = "delivered_at")
  private LocalDateTime deliveredAt;

  @Column(name = "cancelled_by")
  private Long cancelledBy;

  @Column(name = "cancelled_at")
  private LocalDateTime cancelledAt;

  @Column(name = "cancellation_reason")
  private String cancellationReason;

  @Column private String notes;

  @OneToMany(
      mappedBy = "order",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @OrderBy("id ASC")
  private List<OrderItem> items = new ArrayList<>();

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /** Add a line and keep both sides of the association in sync. */
  public void addItem(OrderItem item) {
    item.setOrder(this);
    items.add(item);
  }
}
