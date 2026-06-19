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
 * An invoice generated from a {@link Sale} or a {@link Delivery} (Sprint B5-3). Farm-scoped (farm
 * by id, ADR-008); the client is an intra-livestock {@code @ManyToOne} (OPTIONAL — null when the
 * source had no client, e.g. a walk-in sale). The source is referenced by id ({@code saleId} /
 * {@code deliveryId}, exactly one set per {@link #sourceType}). {@code invoiceNumber} is generated
 * {@code F-YYYY-NNN} per farm per year (D24); {@code totalXof} is HT only (D25).
 *
 * <p>Issuing an invoice increases the client's receivable (encours); {@code amountPaidXof} is moved
 * by payments (B5-4), which also drive the {@link InvoiceStatus} transitions. "Overdue" is derived
 * from {@code dueDate}, not stored. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "items")
public class Invoice {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "invoice_number", nullable = false)
  private String invoiceNumber;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "client_id")
  private Client client;

  @Enumerated(EnumType.STRING)
  @Column(name = "source_type", nullable = false)
  private InvoiceSourceType sourceType;

  @Column(name = "sale_id")
  private Long saleId;

  @Column(name = "delivery_id")
  private Long deliveryId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private InvoiceStatus status = InvoiceStatus.ISSUED;

  @Column(name = "issue_date", nullable = false)
  private LocalDate issueDate;

  @Column(name = "due_date")
  private LocalDate dueDate;

  @Column(name = "total_xof", nullable = false)
  private Long totalXof = 0L;

  @Column(name = "amount_paid_xof", nullable = false)
  private Long amountPaidXof = 0L;

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
      mappedBy = "invoice",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @OrderBy("id ASC")
  private List<InvoiceItem> items = new ArrayList<>();

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /** Outstanding amount still owed on this invoice (total minus what has been paid). */
  public long outstandingXof() {
    return totalXof - amountPaidXof;
  }

  /** Add a line and keep both sides of the association in sync. */
  public void addItem(InvoiceItem item) {
    item.setInvoice(this);
    items.add(item);
  }
}
