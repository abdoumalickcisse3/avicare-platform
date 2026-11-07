package com.avicare.livestock.dto.request;

import com.avicare.livestock.poultry.GrowthReferenceService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Create a broiler batch on a farm.
 *
 * <p>{@code chickUnitPriceXof} is optional — the price paid per chick. When present, the service
 * records a {@code CHICK_PURCHASE} expense of {@code chickUnitPriceXof * initialCount}.
 * {@code @Positive} on a nullable field only validates when a value is actually supplied.
 *
 * <p>{@code targetAgeDays}'s {@code @Max} is {@link GrowthReferenceService#MAX_TARGET_AGE_DAYS} —
 * the same bound {@code GrowthReferenceService.expectedCurve} enforces defensively and the {@code
 * poultry_batches} CHECK constraint (migration V70) enforces in the database. An unbounded {@code
 * targetAgeDays} used to be merely inert data; it is now the iteration count of a sampling loop, so
 * this validation is what keeps a typo from becoming a denial of service. {@code targetWeightG}'s
 * {@code @Max} is plain data sanity — no shared bound elsewhere needs it.
 */
public record CreatePoultryBatchRequest(
    @NotNull Long breedId,
    @Size(max = 200) String name,
    LocalDate startDate,
    @Positive @Max(50_000) Integer targetWeightG,
    @Positive @Max(GrowthReferenceService.MAX_TARGET_AGE_DAYS) Integer targetAgeDays,
    @Positive int initialCount,
    @Positive Long chickUnitPriceXof) {}
