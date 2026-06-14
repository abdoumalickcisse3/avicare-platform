package com.avicare.livestock.inventory.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/** Set a stock item's low-stock alert threshold (Sprint B4-6). */
public record ThresholdUpdateRequest(@NotNull @PositiveOrZero BigDecimal threshold) {}
