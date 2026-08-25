package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.PartnerContext;
import com.avicare.partner.dto.response.NetworkDashboardResponse;
import com.avicare.partner.dto.response.NetworkFarmRow;
import com.avicare.partner.dto.response.PartnerAlertResponse;
import com.avicare.partner.dto.response.PartnerProfileResponse;
import com.avicare.partner.dto.response.RestockForecastResponse;
import com.avicare.partner.service.PartnerAlertService;
import com.avicare.partner.service.PartnerNetworkReadService;
import com.avicare.partner.service.PartnerRestockForecastService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Partner-portal read-only network view ("Voir"). partnerId comes from the token — never the path.
 */
@RestController
@RequestMapping("/api/v1/partner")
@RequiredArgsConstructor
@PreAuthorize("@partnerAccess.isPartner()")
public class PartnerPortalController {

  private final PartnerNetworkReadService readService;
  private final PartnerAlertService alertService;
  private final PartnerRestockForecastService restockForecastService;

  @GetMapping("/me")
  public ApiResponse<PartnerProfileResponse> me() {
    return ApiResponse.of(readService.profile(PartnerContext.currentPartnerId()));
  }

  @GetMapping("/network")
  public ApiResponse<NetworkDashboardResponse> network() {
    return ApiResponse.of(readService.dashboard(PartnerContext.currentPartnerId()));
  }

  @GetMapping("/network/farms")
  public ApiResponse<List<NetworkFarmRow>> farms() {
    return ApiResponse.of(readService.farms(PartnerContext.currentPartnerId()));
  }

  @GetMapping("/network/farms/{farmId}")
  public ApiResponse<NetworkFarmRow> farm(@PathVariable Long farmId) {
    return ApiResponse.of(readService.farm(PartnerContext.currentPartnerId(), farmId));
  }

  /**
   * Upcoming restocks across the network (couche « Développer »). Only farms that opted into the
   * {@code restock_forecast} scope appear — the filtering is done server-side, in the read model.
   */
  @GetMapping("/network/restock")
  public ApiResponse<RestockForecastResponse> restock(
      @RequestParam(defaultValue = "30") int horizonDays) {
    return ApiResponse.of(
        restockForecastService.forecast(PartnerContext.currentPartnerId(), horizonDays));
  }

  /** Open network alerts of the calling partner, newest first (couche « Garder »). */
  @GetMapping("/network/alerts")
  public ApiResponse<List<PartnerAlertResponse>> alerts() {
    return ApiResponse.of(
        alertService.listActive(PartnerContext.currentPartnerId()).stream()
            .map(PartnerAlertResponse::of)
            .toList());
  }
}
