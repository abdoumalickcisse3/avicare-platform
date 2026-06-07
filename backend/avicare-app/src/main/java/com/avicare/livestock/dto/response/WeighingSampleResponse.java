package com.avicare.livestock.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** HTTP view of a weighing sample (aggregate stats; raw weights omitted). */
public record WeighingSampleResponse(
    Long id,
    Long poultryBatchId,
    LocalDate sampleDate,
    int ageDays,
    int sampleSize,
    BigDecimal avgWeightG,
    BigDecimal minWeightG,
    BigDecimal maxWeightG,
    BigDecimal stdDeviation,
    BigDecimal uniformityPercent,
    String notes) {}
