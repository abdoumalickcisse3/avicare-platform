package com.avicare.finance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Create or update a manual expense entry. */
public record ExpenseRequest(
    @NotBlank @Size(max = 100) String categoryKey,
    @NotNull @Positive Long amountXof,
    @NotNull LocalDate expenseDate,
    @NotBlank @Size(max = 200) String label,
    @Size(max = 2000) String notes,
    Long productionUnitId) {}
