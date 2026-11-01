package com.avicare.livestock.inventory;

import java.util.List;

/**
 * A saved medication, both faces in one view.
 *
 * @param medicalSheetWritten whether the {@code treatments} face was stored — {@code false} when
 *     the farm does not hold {@code module.health.advanced}, in which case only the stock article
 *     exists and the medication will not appear in the treatment form
 */
public record MedicationDto(
    String key,
    String label,
    String unit,
    Integer typicalUnitPriceXof,
    String molecule,
    List<String> routes,
    Integer withdrawalDaysMeat,
    Integer withdrawalDaysEggs,
    boolean medicalSheetWritten) {}
