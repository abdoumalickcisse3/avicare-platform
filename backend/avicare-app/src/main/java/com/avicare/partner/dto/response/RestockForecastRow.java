package com.avicare.partner.dto.response;

import java.time.LocalDate;

/**
 * One batch a partner may need to resupply (couche « Développer »). {@code estimatedFeedKg} is a
 * <b>floor</b>, not a target: it extrapolates the farm's observed daily consumption, which rises
 * with the birds' age — the real need until the end of the cycle is higher. Null when the farm has
 * no recent daily records to extrapolate from; the date is still worth showing.
 */
public record RestockForecastRow(
    Long farmId,
    String farmName,
    Long unitId,
    String batchName,
    int headcount,
    LocalDate expectedEndDate,
    long daysToEnd,
    Long estimatedFeedKg,
    String forecastMethod) {}
