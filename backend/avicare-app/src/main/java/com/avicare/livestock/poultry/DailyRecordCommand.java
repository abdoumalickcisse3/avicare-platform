package com.avicare.livestock.poultry;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Command to record (upsert) a daily entry on a production unit. */
public record DailyRecordCommand(
    LocalDate recordDate,
    int mortalityCount,
    BigDecimal feedKg,
    BigDecimal waterL,
    String observations) {}
