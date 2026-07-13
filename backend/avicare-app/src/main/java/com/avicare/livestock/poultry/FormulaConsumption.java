package com.avicare.livestock.poultry;

import java.math.BigDecimal;

/**
 * Optional feed-formula reference at daily entry (Décision D20 révisée). When set on a {@link
 * DailyRecordCommand}, the formula's ingredients are each drawn from stock as an OUT movement
 * proportional to {@code totalKg}. Mutually exclusive with {@code
 * DailyRecordCommand#feedConsumption}. Exactly one of {@code formulaKey} (platform template) /
 * {@code formulaId} (farm formula) is set.
 */
public record FormulaConsumption(
    String formulaKey, Long formulaId, BigDecimal totalKg, String notes) {}
