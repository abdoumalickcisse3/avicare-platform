package com.avicare.livestock.poultry;

import com.avicare.livestock.inventory.StockConsumption;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Command to record (upsert) a daily entry on a production unit. {@code feedConsumption} is
 * optional (Décision D18): when set, the feed is drawn from stock as an automatic OUT movement;
 * when null, the daily record behaves as before (no stock coupling).
 */
public record DailyRecordCommand(
    LocalDate recordDate,
    int mortalityCount,
    BigDecimal feedKg,
    BigDecimal waterL,
    String observations,
    StockConsumption feedConsumption) {}
