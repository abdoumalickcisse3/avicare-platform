package com.avicare.livestock.commercial.dto;

import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import java.util.List;

/**
 * Aggregated commercial dashboard snapshot produced by {@link
 * com.avicare.livestock.commercial.CommercialFacade#commercialStats}. Period KPIs ({@code
 * revenueXof}, {@code revenueSeries}, {@code topClients}) reflect the caller-supplied [from, to]
 * window. Snapshot KPIs ({@code outstandingXof}, {@code overdueXof}, {@code ordersToDeliver},
 * {@code invoicesToCollect}, {@code topDebtors}) reflect the current state of the farm and ignore
 * the period. All amounts are in XOF (integer, HT — D25).
 */
public record CommercialStats(
    long revenueXof,
    List<DayValue> revenueSeries,
    long outstandingXof,
    long overdueXof,
    List<NamedValue> topClients,
    List<NamedValue> topDebtors,
    long ordersToDeliver,
    long invoicesToCollect) {}
