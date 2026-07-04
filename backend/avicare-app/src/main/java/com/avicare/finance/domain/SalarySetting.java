package com.avicare.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Salary settings for a farm member (Sprint B6 P2). Farm-scoped — farm and user are referenced by
 * id (no cross-context {@code @ManyToOne} per ADR-008). Defines the monthly base salary in XOF for
 * an employee.
 *
 * <p>{@code active} indicates whether the salary setting is currently in use. Timestamps DB-owned
 * (trigger). No soft delete.
 */
@Entity
@Table(name = "salary_settings")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class SalarySetting {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "monthly_salary_xof", nullable = false)
  private Long monthlySalaryXof;

  @Column(nullable = false)
  private Boolean active;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
