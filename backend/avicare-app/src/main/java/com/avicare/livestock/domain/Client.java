package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A commercial client in a farm's directory (Sprint B5-1). Farm-scoped — the farm is referenced by
 * id (no cross-context {@code @ManyToOne} to tenancy, per ADR-008). {@code displayName} is the
 * person's name (INDIVIDUAL) or the commercial name (BUSINESS / WHOLESALER); {@code legalName} is
 * the raison sociale when relevant.
 *
 * <p>Credit (Décision D26, indicative & non-blocking): {@code creditLimitXof} null = no limit;
 * {@code currentBalanceXof} is the running receivable (MAY be negative when the client paid an
 * advance). The balance is touched by {@code PaymentService} (B5-4), never by order operations.
 * Soft-deleted via {@code active=false}. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "clients")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Client {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(name = "client_type", nullable = false)
  private ClientType clientType;

  @Column(name = "display_name", nullable = false)
  private String displayName;

  @Column(name = "legal_name")
  private String legalName;

  @Column private String phone;

  @Column private String email;

  @Column private String address;

  @Column private String city;

  @Column(name = "credit_limit_xof")
  private Long creditLimitXof;

  @Column(name = "current_balance_xof", nullable = false)
  private Long currentBalanceXof = 0L;

  @Column(name = "default_payment_terms")
  private String defaultPaymentTerms;

  @Column private String notes;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
