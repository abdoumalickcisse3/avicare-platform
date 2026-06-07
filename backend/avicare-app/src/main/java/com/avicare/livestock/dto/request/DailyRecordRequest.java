package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Record (upsert) a daily entry on a batch. */
public record DailyRecordRequest(
    @NotNull LocalDate recordDate,
    @PositiveOrZero int mortalityCount,
    @PositiveOrZero BigDecimal feedKg,
    @PositiveOrZero BigDecimal waterL,
    @Size(max = 2000) String observations) {}
