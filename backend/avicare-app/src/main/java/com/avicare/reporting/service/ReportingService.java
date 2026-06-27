package com.avicare.reporting.service;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import com.avicare.reporting.api.dto.DashboardResponse;
import com.avicare.reporting.api.dto.DashboardResponse.CommercialSection;
import com.avicare.reporting.api.dto.DashboardResponse.InventorySection;
import com.avicare.reporting.api.dto.DashboardResponse.LivestockSection;
import com.avicare.reporting.api.dto.DashboardResponse.PeriodInfo;
import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.subscription.api.SubscriptionFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Compose le dashboard cross-module en lecture seule, section par section selon le gating. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportingService {

  private final SubscriptionFacade subscriptionFacade;
  private final CommercialFacade commercialFacade;
  private final LivestockFacade livestockFacade;

  public DashboardResponse buildDashboard(Long farmId, DashboardPeriod period) {
    CommercialSection commercial = null;
    if (subscriptionFacade.isModuleEnabled(farmId, "module.commercial.basic")) {
      CommercialStats stats = commercialFacade.commercialStats(farmId, period.from(), period.to());
      commercial =
          new CommercialSection(
              stats.revenueXof(),
              stats.revenueSeries(),
              stats.outstandingXof(),
              stats.overdueXof(),
              stats.topClients(),
              stats.topDebtors(),
              stats.ordersToDeliver(),
              stats.invoicesToCollect());
    }
    boolean livestockActive =
        subscriptionFacade.isModuleEnabled(farmId, "module.poultry.broiler")
            || subscriptionFacade.isModuleEnabled(farmId, "module.poultry.layer");
    LivestockSection livestock = null;
    if (livestockActive) {
      LivestockStats ls = livestockFacade.livestockStats(farmId, period.from(), period.to());
      livestock =
          new LivestockSection(
              ls.activeBatches(),
              ls.totalHeadcount(),
              ls.deaths(),
              ls.mortalityRate(),
              ls.mortalitySeries(),
              ls.avgDailyGainG(),
              ls.layingRate(),
              ls.layingSeries(),
              ls.vaccinationsCount(),
              ls.treatmentsCount());
    }
    InventorySection inventory =
        subscriptionFacade.isModuleEnabled(farmId, "module.inventory")
            ? new InventorySection()
            : null;
    return new DashboardResponse(
        new PeriodInfo(
            period.kind(), period.value(), period.from().toString(), period.to().toString()),
        commercial,
        livestock,
        inventory);
  }
}
