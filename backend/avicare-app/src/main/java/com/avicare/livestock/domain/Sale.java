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
 * A direct (cash) sale of products to a client (Sprint B5-2, Décision D22). Farm-scoped (farm by
 * id, no cross-context association — ADR-008). The client is OPTIONAL ({@code client} null = a
 * walk-in cash sale). {@code saleNumber} is generated {@code V-YYYY-NNN} per farm per year (D24).
 * {@code totalXof} is the sum of the line totals (HT only — no VAT in V1, D25).
 *
 * <p>A sale decrements PRODUCT stock immediately via OUT movements ({@code reason=SALE}, D21); it
 * does NOT touch the client balance (that moves only with payments, B5-4, D26). Cancelling reverses
 * the stock with compensating IN movements. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "sales")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "items")
public class Sale {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "sale_number", nullable = false)
  private String saleNumber;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "client_id")
  private Client client;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SaleStatus status = SaleStatus.COMPLETED;

  @Column(name = "sale_date", nullable = false)
  private LocalDate saleDate;

  @Column(name = "payment_method")
  private String paymentMethod;

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
      mappedBy = "sale",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @OrderBy("id ASC")
  private List<SaleItem> items = new ArrayList<>();

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /** Add a line and keep both sides of the association in sync. */
  public void addItem(SaleItem item) {
    item.setSale(this);
    items.add(item);
  }
}
