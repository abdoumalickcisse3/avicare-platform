package com.avicare.finance.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Create or update the monthly salary setting for a farm member (Sprint B6 P2). */
public record SalarySettingRequest(
    @NotNull Long userId, @NotNull @Positive Long monthlySalaryXof, Boolean active) {}
