package com.avicare.reporting.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DashboardResponse(
    PeriodInfo period,
    CommercialSection commercial,
    LivestockSection livestock,
    InventorySection inventory) {

  public record PeriodInfo(String kind, String value, String from, String to) {}

  // Phase 1 enrichira ce record (CA, encours, ...).
  public record CommercialSection() {}

  // Phase 2 enrichira ce record (bandes, mortalité, ponte, ...).
  public record LivestockSection() {}

  // Phase 3 enrichira ce record (stock bas, valeur, consommation).
  public record InventorySection() {}
}
