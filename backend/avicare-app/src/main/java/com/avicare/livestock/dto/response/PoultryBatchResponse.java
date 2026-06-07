package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;

/** HTTP view of a broiler batch. */
public record PoultryBatchResponse(
    Long id,
    Long farmId,
    Long breedId,
    String name,
    LocalDate startDate,
    UnitStatus status,
    int currentCount,
    int initialCount,
    Integer targetWeightG,
    Integer targetAgeDays) {}
