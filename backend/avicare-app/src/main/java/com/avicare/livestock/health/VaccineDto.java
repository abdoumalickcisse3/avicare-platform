package com.avicare.livestock.health;

/**
 * A platform vaccine reference (catalog category {@code vaccines}, Sprint B3-1). {@code usage} is
 * an optional hint such as {@code DAY_OLD}; {@code activeStrain} flags a live vaccine.
 */
public record VaccineDto(
    String key,
    String label,
    String disease,
    String route,
    boolean activeStrain,
    String usage,
    String wave,
    boolean custom) {}
