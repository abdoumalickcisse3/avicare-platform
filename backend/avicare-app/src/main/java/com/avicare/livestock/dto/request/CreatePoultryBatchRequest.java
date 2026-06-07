package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Create a broiler batch on a farm. */
public record CreatePoultryBatchRequest(
    @NotNull Long breedId,
    @Size(max = 200) String name,
    LocalDate startDate,
    Integer targetWeightG,
    Integer targetAgeDays,
    @Positive int initialCount) {}
