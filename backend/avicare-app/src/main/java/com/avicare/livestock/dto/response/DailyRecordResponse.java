package com.avicare.livestock.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** HTTP view of a daily record. */
public record DailyRecordResponse(
    Long id,
    Long productionUnitId,
    LocalDate recordDate,
    int mortalityCount,
    BigDecimal feedKg,
    BigDecimal waterL,
    String observations) {}
