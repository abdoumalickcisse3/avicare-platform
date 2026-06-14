package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.FeedFormula;
import com.avicare.livestock.domain.FeedPhase;
import com.avicare.livestock.domain.FormulaIngredient;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** A farm feed formula (Sprint B4-6). */
public record FeedFormulaResponse(
    Long id,
    Long farmId,
    String name,
    String description,
    String sourceFormulaKey,
    List<String> targetBreedKeys,
    FeedPhase targetPhase,
    Integer targetAgeDaysMin,
    Integer targetAgeDaysMax,
    List<FormulaIngredient> ingredients,
    BigDecimal totalPercentage,
    Integer estimatedCostPer100kgXof,
    LocalDateTime estimatedCostCalculatedAt,
    boolean active,
    String notes) {

  public static FeedFormulaResponse from(FeedFormula f) {
    return new FeedFormulaResponse(
        f.getId(),
        f.getFarmId(),
        f.getName(),
        f.getDescription(),
        f.getSourceFormulaKey(),
        f.getTargetBreedKeys(),
        f.getTargetPhase(),
        f.getTargetAgeDaysMin(),
        f.getTargetAgeDaysMax(),
        f.getIngredients(),
        f.getTotalPercentage(),
        f.getEstimatedCostPer100kgXof(),
        f.getEstimatedCostCalculatedAt(),
        f.isActive(),
        f.getNotes());
  }
}
