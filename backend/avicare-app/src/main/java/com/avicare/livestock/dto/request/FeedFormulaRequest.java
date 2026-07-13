package com.avicare.livestock.dto.request;

import com.avicare.livestock.poultry.FormulaConsumption;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Optional feed-formula reference on a daily-record request (Décision D20 révisée). Exactly one of
 * {@code formulaKey} (platform) / {@code formulaId} (farm) is expected; maps to {@link
 * FormulaConsumption}.
 */
public record FeedFormulaRequest(
    @Size(max = 80) String formulaKey,
    Long formulaId,
    @Positive BigDecimal totalKg,
    @Size(max = 500) String notes) {

  public FormulaConsumption toModel() {
    return new FormulaConsumption(formulaKey, formulaId, totalKg, notes);
  }
}
