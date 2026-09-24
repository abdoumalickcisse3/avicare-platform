package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;

/**
 * HTTP view of a broiler batch.
 *
 * <p>{@code deaths} is served rather than left to the client: computing it as {@code initialCount -
 * currentCount} counts every sold bird as a dead one, and both mobile screens did exactly that.
 *
 * <p>{@code chickPurchaseCostXof} is resolved from the farm's expense ledger (not stored on the
 * batch itself) — {@code null} means no chick-purchase cost has been recorded yet. Resolved only on
 * single-batch reads ({@code get}/{@code create}/the new correction endpoint), never on the list
 * endpoint, to avoid an N+1 lookup the list screen does not need.
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
    Integer targetAgeDays,
    Long chickPurchaseCostXof) {}
