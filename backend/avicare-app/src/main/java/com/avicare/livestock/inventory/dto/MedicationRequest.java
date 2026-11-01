package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.inventory.MedicationCommand;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Create or update a medication as one product (ADR-020): the stock fields the farmer buys against
 * and the medical fields the treatment form reads, in a single request.
 *
 * <p>The {@code key} is the slug the frontends derive from the label, so both catalog faces and any
 * existing stock row line up under one identifier.
 */
public record MedicationRequest(
    @NotBlank @Size(max = 100) String key,
    @NotBlank @Size(max = 200) String label,
    @Size(max = 20) String unit,
    @PositiveOrZero Integer typicalUnitPriceXof,
    @Size(max = 200) String molecule,
    List<String> routes,
    @PositiveOrZero Integer withdrawalDaysMeat,
    @PositiveOrZero Integer withdrawalDaysEggs) {

  public MedicationCommand toCommand() {
    return new MedicationCommand(
        key,
        label,
        unit,
        typicalUnitPriceXof,
        molecule,
        routes == null ? List.of() : routes,
        withdrawalDaysMeat,
        withdrawalDaysEggs);
  }
}
