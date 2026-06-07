package com.avicare.livestock.poultry;

import java.time.LocalDate;

/** Command to create a {@link com.avicare.livestock.domain.PoultryBatch broiler batch}. */
public record PoultryBatchCreate(
    Long farmId,
    Long breedId,
    String name,
    LocalDate startDate,
    Integer targetWeightG,
    Integer targetAgeDays,
    int initialCount) {}
