package com.avicare.livestock.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** HTTP view of a computed growth-performance snapshot. */
public record GrowthPerformanceResponse(
    Long poultryBatchId,
    LocalDate snapshotDate,
    int ageDays,
    BigDecimal currentWeightG,
    BigDecimal gmqGPerDay,
    BigDecimal feedConversionRatio,
    BigDecimal cumulativeMortalityPercent,
    BigDecimal cumulativeFeedKg,
    BigDecimal cumulativeWaterL,
    LocalDate forecastedTargetDate,
    String performanceScore) {}
