package com.avicare.livestock.dto.request;

import com.avicare.livestock.inventory.dto.StockConsumptionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Record (upsert) a daily entry on a batch. {@code feedConsumption} is optional (Décision D18):
 * when present, the feed is drawn from stock as an automatic OUT movement. It is rejected with 422
 * if {@code module.inventory} is inactive for the farm (Option α).
 */
public record DailyRecordRequest(
    @NotNull LocalDate recordDate,
    @PositiveOrZero int mortalityCount,
    @PositiveOrZero BigDecimal feedKg,
    @PositiveOrZero BigDecimal waterL,
    @Size(max = 2000) String observations,
    @Valid StockConsumptionRequest feedConsumption,
    @Valid FeedFormulaRequest feedFormula) {}
