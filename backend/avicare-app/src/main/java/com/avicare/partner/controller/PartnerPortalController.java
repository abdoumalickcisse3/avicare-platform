package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.PartnerContext;
import com.avicare.partner.dto.response.NetworkDashboardResponse;
import com.avicare.partner.dto.response.NetworkFarmRow;
import com.avicare.partner.dto.response.PartnerProfileResponse;
import com.avicare.partner.service.PartnerNetworkReadService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
