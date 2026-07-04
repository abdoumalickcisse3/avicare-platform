package com.avicare.finance.dto.response;

import java.time.LocalDate;

/** Expense entry as returned by the API. {@code source} is the raw {@code ExpenseSource} name. */
public record ExpenseResponse(
    Long id,
    String categoryKey,
    Long amountXof,
    LocalDate expenseDate,
    String label,
    String notes,
    Long productionUnitId,
    String source,
    Long purchaseOrderId,
    Long stockMovementId) {}
