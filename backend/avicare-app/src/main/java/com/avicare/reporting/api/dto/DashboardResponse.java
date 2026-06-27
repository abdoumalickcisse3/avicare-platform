package com.avicare.reporting.api.dto;

import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DashboardResponse(
    PeriodInfo period,
    CommercialSection commercial,
    LivestockSection livestock,
    InventorySection inventory) {

  public record PeriodInfo(String kind, String value, String from, String to) {}

  /**
   * Commercial KPIs aggregated by {@link
   * com.avicare.livestock.commercial.CommercialFacade#commercialStats}. Period KPIs ({@code
   * revenueXof}, {@code revenueSeries}, {@code topClients}) reflect the dashboard period window.
   * Snapshot KPIs ({@code outstandingXof}, {@code overdueXof}, {@code ordersToDeliver}, {@code
   * invoicesToCollect}, {@code topDebtors}) reflect the current state of the farm. All amounts in
   * XOF (integer, HT — D25).
   */
  public record CommercialSection(
      long revenueXof,
      List<DayValue> revenueSeries,
      long outstandingXof,
      long overdueXof,
      List<NamedValue> topClients,
      List<NamedValue> topDebtors,
      long ordersToDeliver,
      long invoicesToCollect) {}

  // Phase 2 enrichira ce record (bandes, mortalité, ponte, ...).
  public record LivestockSection() {}

  // Phase 3 enrichira ce record (stock bas, valeur, consommation).
  public record InventorySection() {}
}
