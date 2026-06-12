package com.avicare.livestock.health;

import java.util.List;

/**
 * A standard vaccination program (catalog category {@code vaccination_programs}, Sprint B3-1): an
 * ordered schedule linked to one or more breed keys. Cloning + per-lot override come in B3-2.
 */
public record VaccinationProgramDto(
    String key,
    String label,
    String species,
    List<String> breedKeys,
    List<VaccinationScheduleEntryDto> schedule) {}
