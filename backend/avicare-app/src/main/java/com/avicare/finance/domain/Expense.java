package com.avicare.finance.domain;

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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Expense record in a farm's expense ledger (Sprint B6 P1). Farm-scoped — farm is referenced by id
 * (no cross-context {@code @ManyToOne} to tenancy, per ADR-008). {@code source} indicates whether
 * the expense was manually entered, auto-recorded from a purchase receipt, stock movement, or
 * payroll.
 *
 * <p>{@code amountXof} is in XOF (West African franc, per design spec D21). {@code categoryKey}
 * classifies the expense (e.g., feed, medicine, labor) and is validated against catalog parameters.
 * {@code productionUnitId} optionally links the expense to a specific production unit (batch, herd)
 * for analytics. {@code purchaseOrderId}, {@code stockMovementId}, {@code salaryId} link to
 * originating transactions when applicable (set during auto-recording, sparse for MANUAL entries).
 *
 * <p>Soft-deleted via {@code deleted_at}. Timestamps DB-owned (trigger). Audit: {@code createdBy}
 * is the user who created the expense.
 */
@Entity
@Table(name = "expenses")
@Getter
@Setter
@NoArgsConstructor
@ToString
@SQLDelete(sql = "UPDATE expenses SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Expense {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "category_key", nullable = false)
  private String categoryKey;

  @Column(name = "amount_xof", nullable = false)
  private Long amountXof;

  @Column(name = "expense_date", nullable = false)
  private LocalDate expenseDate;

  @Column(nullable = false)
  private String label;

  @Column private String notes;

  @Column(name = "production_unit_id")
  private Long productionUnitId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ExpenseSource source;

  @Column(name = "purchase_order_id")
  private Long purchaseOrderId;

  @Column(name = "stock_movement_id")
  private Long stockMovementId;

  @Column(name = "salary_id")
  private Long salaryId;

  @Column(name = "vet_visit_id")
  private Long vetVisitId;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;
}
