package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.PositiveOrZero;

/** Set a farm's tray stock to exact values. */
public record TrayStockUpdateRequest(
    @PositiveOrZero int fullTraysCount, @PositiveOrZero int emptyTraysCount) {}
