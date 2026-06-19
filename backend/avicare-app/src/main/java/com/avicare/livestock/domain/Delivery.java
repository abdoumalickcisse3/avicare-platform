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
 * A delivery fulfilling a confirmed {@link Order} (Sprint B5-2, Décision D22): in V1 a delivery is
 * always created from an order ({@code order} NOT NULL). Farm-scoped (farm by id, ADR-008); the
 * order and client are intra-livestock {@code @ManyToOne}. {@code deliveryNumber} is generated
 * {@code LIV-YYYY-NNN} per farm per year (D24). {@code totalXof} is the sum of the delivered line
 * totals (HT only, D25).
 *
 * <p>Creating a delivery decrements PRODUCT stock via OUT movements ({@code reason=SALE}, D21) and
 * marks the order DELIVERED, atomically. Cancelling reverses the stock (compensating IN movements)
 * and reopens the order. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "deliveries")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "items")
public class Delivery {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "delivery_number", nullable = false)
  private String deliveryNumber;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", nullable = false)
  private Order order;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "client_id")
  private Client client;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private DeliveryStatus status = DeliveryStatus.DELIVERED;

  @Column(name = "delivery_date", nullable = false)
  private LocalDate deliveryDate;

  @Column private String carrier;

  @Column(name = "total_xof", nullable = false)
  private Long totalXof = 0L;

  @Column private String notes;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "cancelled_by")
  private Long cancelledBy;

  @Column(name = "cancelled_at")
  private LocalDateTime cancelledAt;

  @Column(name = "cancellation_reason")
  private String cancellationReason;

  @OneToMany(
      mappedBy = "delivery",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @OrderBy("id ASC")
  private List<DeliveryItem> items = new ArrayList<>();

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /** Add a line and keep both sides of the association in sync. */
  public void addItem(DeliveryItem item) {
    item.setDelivery(this);
    items.add(item);
  }
}
