package com.avicare.livestock.inventory;

import java.util.List;

/**
 * One medication as the farmer describes it, in a single command covering both faces written by
 * {@link MedicationCatalogService}: the stock side ({@code unit}, indicative price) and the medical
 * side (molecule, routes, withdrawal delays).
 *
 * <p>The {@code key} is the slug the frontends already derive from the label, so the two faces and
 * any existing stock row line up under one identifier.
 */
public record MedicationCommand(
    String key,
    String label,
    String unit,
    Integer typicalUnitPriceXof,
    String molecule,
    List<String> routes,
    Integer withdrawalDaysMeat,
    Integer withdrawalDaysEggs) {}
