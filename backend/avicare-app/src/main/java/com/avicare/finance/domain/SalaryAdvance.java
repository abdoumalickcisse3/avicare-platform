package com.avicare.finance.domain;

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
 * Salary advance request for a farm member (Sprint B6 P2). Farm-scoped — farm and user are
 * referenced by id (no cross-context {@code @ManyToOne} per ADR-008). Employees may request
 * advances on their future salary, subject to approval.
 *
 * <p>{@code amountXof} is the requested advance amount in XOF. {@code reason} provides context for
 * the request. {@code status} indicates PENDING, APPROVED, or REJECTED. {@code requestedAt} is set
 * automatically when created. {@code decidedBy} and {@code decidedAt} are set when the request is
 * approved or rejected. {@code remainingXof} tracks the remaining balance of the advance after
 * deductions from salaries.
 *
 * <p>Timestamps DB-owned (trigger). No soft delete.
 */
@Entity
@Table(name = "salary_advances")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class SalaryAdvance {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "amount_xof", nullable = false)
  private Long amountXof;

  @Column(length = 200)
  private String reason;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private AdvanceStatus status;

  @Column(name = "requested_at", insertable = false, updatable = false)
  private LocalDateTime requestedAt;

  @Column(name = "decided_by")
  private Long decidedBy;

  @Column(name = "decided_at")
  private LocalDateTime decidedAt;

  @Column(name = "remaining_xof", nullable = false)
  private Long remainingXof;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
