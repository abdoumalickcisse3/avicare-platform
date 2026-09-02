package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;

/**
 * HTTP view of a broiler batch.
 *
 * <p>{@code deaths} is served rather than left to the client: computing it as {@code initialCount -
 * currentCount} counts every sold bird as a dead one, and both mobile screens did exactly that.
 */
public record PoultryBatchResponse(
    Long id,
    Long farmId,
    Long breedId,
    String name,
    LocalDate startDate,
    UnitStatus status,
    int currentCount,
    int initialCount,
    int deaths,
    Integer targetWeightG,
    Integer targetAgeDays) {}
