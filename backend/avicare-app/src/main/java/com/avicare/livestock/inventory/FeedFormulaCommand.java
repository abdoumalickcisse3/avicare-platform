package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.FeedPhase;
import com.avicare.livestock.domain.FormulaIngredient;
import java.util.List;

/** Input to create or update a farm feed formula (Sprint B4-4). */
public record FeedFormulaCommand(
    String name,
    String description,
    List<String> targetBreedKeys,
    FeedPhase targetPhase,
    Integer targetAgeDaysMin,
    Integer targetAgeDaysMax,
    List<FormulaIngredient> ingredients,
    String notes) {}
