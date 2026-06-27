package com.avicare.reporting.service;

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

  // Phase 1+ : private final CommercialFacade commercialFacade; (etc.)

  public DashboardResponse buildDashboard(Long farmId, DashboardPeriod period) {
    CommercialSection commercial =
        subscriptionFacade.isModuleEnabled(farmId, "module.commercial.basic")
            ? new CommercialSection()
            : null;
    boolean livestockActive =
        subscriptionFacade.isModuleEnabled(farmId, "module.poultry.broiler")
            || subscriptionFacade.isModuleEnabled(farmId, "module.poultry.layer");
    LivestockSection livestock = livestockActive ? new LivestockSection() : null;
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
