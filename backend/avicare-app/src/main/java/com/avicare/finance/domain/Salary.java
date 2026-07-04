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
 * Salary record for a farm member in a given period (Sprint B6 P2). Farm-scoped — farm and user are
 * referenced by id (no cross-context {@code @ManyToOne} per ADR-008). Records the gross salary,
 * deductions (e.g., advances), and net amount paid to an employee.
 *
 * <p>{@code period} is in format YYYY-MM (7 characters, e.g., "2026-06"). {@code grossXof}, {@code
 * advanceDeductedXof}, and {@code netXof} are in XOF. {@code status} indicates DUE or PAID. {@code
 * paidAt} is set when the salary is marked as paid. {@code createdBy} is the user who created the
 * salary record.
 *
 * <p>Timestamps DB-owned (trigger). No soft delete.
 */
@Entity
@Table(name = "salaries")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Salary {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(nullable = false)
  private String period;

  @Column(name = "gross_xof", nullable = false)
  private Long grossXof;

  @Column(name = "advance_deducted_xof", nullable = false)
  private Long advanceDeductedXof;

  @Column(name = "net_xof", nullable = false)
  private Long netXof;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SalaryStatus status;

  @Column(name = "paid_at")
  private LocalDateTime paidAt;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
