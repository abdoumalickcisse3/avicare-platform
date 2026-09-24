package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Create a broiler batch on a farm.
 *
 * <p>{@code chickUnitPriceXof} is optional — the price paid per chick. When present, the service
 * records a {@code CHICK_PURCHASE} expense of {@code chickUnitPriceXof * initialCount}. {@code
 * @Positive} on a nullable field only validates when a value is actually supplied.
 */
public record CreatePoultryBatchRequest(
    @NotNull Long breedId,
    @Size(max = 200) String name,
    LocalDate startDate,
    Integer targetWeightG,
    Integer targetAgeDays,
    @Positive int initialCount,
    @Positive Long chickUnitPriceXof) {}
