package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.FeedPhase;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.inventory.FeedFormulaCommand;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Create or update a farm feed formula (Sprint B4-6). */
public record FeedFormulaRequest(
    @NotBlank @Size(max = 200) String name,
    @Size(max = 2000) String description,
    List<String> targetBreedKeys,
    @NotNull FeedPhase targetPhase,
    Integer targetAgeDaysMin,
    Integer targetAgeDaysMax,
    @NotEmpty List<FormulaIngredient> ingredients,
    @Size(max = 2000) String notes) {

  public FeedFormulaCommand toCommand() {
    return new FeedFormulaCommand(
        name,
        description,
        targetBreedKeys == null ? List.of() : targetBreedKeys,
        targetPhase,
        targetAgeDaysMin,
        targetAgeDaysMax,
        ingredients,
        notes);
  }
}
