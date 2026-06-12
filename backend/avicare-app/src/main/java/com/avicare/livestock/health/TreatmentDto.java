package com.avicare.livestock.health;

import java.util.List;

/**
 * A platform treatment reference (catalog category {@code treatments}, Sprint B3-1). Withdrawal
 * periods (meat + eggs) feed the V1 UI warning (no hard block — décision chat).
 */
public record TreatmentDto(
    String key,
    String label,
    String molecule,
    String drugClass,
    Integer withdrawalDaysMeat,
    Integer withdrawalDaysEggs,
    List<String> routes,
    String wave) {}
