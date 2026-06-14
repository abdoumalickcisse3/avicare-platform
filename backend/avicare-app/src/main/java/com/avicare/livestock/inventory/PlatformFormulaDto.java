package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.FormulaIngredient;
import java.util.List;

/**
 * A platform feed formula template (catalog category {@code feed_formulas}, Sprint B4-4). {@code
 * estimatedCostPer100kgXof} is computed live from current catalog prices (null when an ingredient
 * has no price).
 */
public record PlatformFormulaDto(
    String key,
    String label,
    List<String> targetBreedKeys,
    String targetPhase,
    Integer targetAgeDaysMin,
    Integer targetAgeDaysMax,
    List<FormulaIngredient> ingredients,
    Integer estimatedCostPer100kgXof) {}
