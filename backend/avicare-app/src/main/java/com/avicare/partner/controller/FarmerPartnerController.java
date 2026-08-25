package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.dto.request.DeclarePartnerRequest;
import com.avicare.partner.dto.request.JoinNetworkRequest;
import com.avicare.partner.dto.request.UpdateSharingRequest;
import com.avicare.partner.dto.response.AvailablePartnerResponse;
import com.avicare.partner.dto.response.FarmPartnerResponse;
import com.avicare.partner.service.FarmPartnerView;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
import com.avicare.partner.service.SharingScopes;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farmer-facing partner network surface. Reads need farm membership
 * ({@code @farmAccess.hasAccess}); writes are OWNER/MANAGER only. The farmer owns their data:
 * sharing sliders default to operational ON / money OFF and the farm can leave a network at any
 * time.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/partners")
@RequiredArgsConstructor
public class FarmerPartnerController {

  private final PartnerService partnerService;
  private final PartnerNetworkService partnerNetworkService;

  @GetMapping("/available")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<AvailablePartnerResponse>> available(
      @PathVariable Long farmId, @RequestParam(required = false) PartnerType type) {
    return ApiResponse.of(
        partnerService.listActive(type).stream().map(AvailablePartnerResponse::of).toList());
  }

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<FarmPartnerResponse>> mine(@PathVariable Long farmId) {
    return ApiResponse.of(
        partnerNetworkService.listForFarmDetailed(farmId).stream()
            .map(FarmPartnerResponse::of)
            .toList());
  }

  @PostMapping("/declare")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> declare(
      @PathVariable Long farmId, @RequestBody @Valid DeclarePartnerRequest req) {
    var m =
        partnerNetworkService.declareSupplier(
            req.partnerId(), farmId, TenancyContext.currentUserId());
    return ApiResponse.of(FarmPartnerResponse.of(new FarmPartnerView(m, null)));
  }

  @PostMapping("/join")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> join(
      @PathVariable Long farmId, @RequestBody @Valid JoinNetworkRequest req) {
    var m = partnerNetworkService.joinViaCode(req.code(), farmId, TenancyContext.currentUserId());
    return ApiResponse.of(FarmPartnerResponse.of(new FarmPartnerView(m, null)));
  }

  @PutMapping("/{membershipId}/scopes")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> updateScopes(
      @PathVariable Long farmId,
      @PathVariable Long membershipId,
      @RequestBody @Valid UpdateSharingRequest req) {
    var m =
        partnerNetworkService.updateSharingScopesForFarm(
            farmId,
            membershipId,
            new SharingScopes(
                req.activity(),
                req.flockHealth(),
                req.feedConsumption(),
                req.salesVolume(),
                req.finances(),
                req.restockForecast()));
    return ApiResponse.of(FarmPartnerResponse.of(new FarmPartnerView(m, null)));
  }

  @DeleteMapping("/{membershipId}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmPartnerResponse> leave(
      @PathVariable Long farmId, @PathVariable Long membershipId) {
    var m = partnerNetworkService.leaveForFarm(farmId, membershipId);
    return ApiResponse.of(FarmPartnerResponse.of(new FarmPartnerView(m, null)));
  }
}
