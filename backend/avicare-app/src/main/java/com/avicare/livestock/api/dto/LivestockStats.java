package com.avicare.livestock.api.dto;

import com.avicare.common.api.dto.DayValue;
import java.util.List;

/**
 * Aggregated livestock dashboard snapshot produced by {@link
 * com.avicare.livestock.api.LivestockFacade#livestockStats}. Snapshot KPIs ({@code activeBatches},
 * {@code totalHeadcount}) reflect the current state of the farm and ignore the period. Period KPIs
 * ({@code deaths}, {@code mortalitySeries}, {@code avgDailyGainG}, {@code layingRate}, {@code
 * layingSeries}, {@code vaccinationsCount}, {@code treatmentsCount}) honour the caller-supplied
 * [from, to] window.
 *
 * <p>Rates are percentages (0–100). {@code mortalityRate} is null when no initial effectif is
 * known; {@code avgDailyGainG} is null when fewer than two weighing samples exist in the window;
 * {@code layingRate} is null when no daily egg production records exist in the window. Series lists
 * are empty (never null) when there is no data for the period.
 *
 * <p>In {@link DayValue}, the {@code valueXof} field carries a generic integer count: death counts
 * for {@code mortalitySeries}, egg counts for {@code layingSeries}.
 */
public record LivestockStats(
    long activeBatches,
    long totalHeadcount,
    long deaths,
    Double mortalityRate,
    List<DayValue> mortalitySeries,
    Double avgDailyGainG,
    Double layingRate,
    List<DayValue> layingSeries,
    long vaccinationsCount,
    long treatmentsCount) {}
