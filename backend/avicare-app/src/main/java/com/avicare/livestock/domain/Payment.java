package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A payment received against an {@link Invoice} (Sprint B5-4). Farm-scoped (farm by id, ADR-008).
 * The invoice and client are soft references by id ({@code invoiceId} NOT NULL; {@code clientId}
 * null for a walk-in invoice) — same pattern as {@link StockMovement}'s backrefs. {@code
 * paymentNumber} is generated {@code P-YYYY-NNN} per farm per year (D24); {@code amountXof} is HT
 * (D25) and never exceeds the invoice's outstanding (overpayment refused).
 *
 * <p>Recording a payment raises the invoice's {@code amount_paid} (→ PARTIALLY_PAID / PAID) and
 * lowers the client's receivable (encours, D26); voiding it reverses both. Timestamps DB-owned
 * (trigger).
 */
@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Payment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "payment_number", nullable = false)
  private String paymentNumber;

  @Column(name = "invoice_id", nullable = false)
  private Long invoiceId;

  @Column(name = "client_id")
  private Long clientId;

  @Column(name = "amount_xof", nullable = false)
  private Long amountXof;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PaymentMethod method;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PaymentStatus status = PaymentStatus.COMPLETED;

  @Column(name = "payment_date", nullable = false)
  private LocalDate paymentDate;

  @Column private String reference;

  @Column private String notes;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "cancelled_by")
  private Long cancelledBy;

  @Column(name = "cancelled_at")
  private LocalDateTime cancelledAt;

  @Column(name = "cancellation_reason")
  private String cancellationReason;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
