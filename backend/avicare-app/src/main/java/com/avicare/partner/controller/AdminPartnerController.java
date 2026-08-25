package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.dto.request.AttachFarmRequest;
import com.avicare.partner.dto.request.CreatePartnerRequest;
import com.avicare.partner.dto.request.CreatePartnerUserRequest;
import com.avicare.partner.dto.request.GenerateInviteCodeRequest;
import com.avicare.partner.dto.request.UpdatePartnerRequest;
import com.avicare.partner.dto.response.InviteCodeResponse;
import com.avicare.partner.dto.response.MembershipResponse;
import com.avicare.partner.dto.response.PartnerResponse;
import com.avicare.partner.dto.response.PartnerUserResponse;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform-admin management of partners and their farm networks. Restricted to Jawdi staff ({@code
 * ROLE_ADMIN}). This is the "ready-to-sign" manual path (MANUAL_ADMIN origin) before a dedicated
 * partner portal exists.
 */
@RestController
@RequestMapping("/api/v1/admin/partners")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminPartnerController {

  private final PartnerService partnerService;
  private final PartnerNetworkService partnerNetworkService;

  @PostMapping
  public ApiResponse<PartnerResponse> create(@RequestBody @Valid CreatePartnerRequest req) {
    return ApiResponse.of(
        PartnerResponse.of(
            partnerService.create(
                req.name(),
                req.type(),
                req.contactName(),
                req.contactPhone(),
                req.contactEmail(),
                req.logoUrl(),
                TenancyContext.currentUserId())));
  }

  /** Partial update — the co-branding path: an ADMIN sets the logo shown in the farmer app. */
  @PatchMapping("/{partnerId}")
  public ApiResponse<PartnerResponse> update(
      @PathVariable Long partnerId, @RequestBody @Valid UpdatePartnerRequest req) {
    return ApiResponse.of(
        PartnerResponse.of(
            partnerService.update(
                partnerId,
                req.name(),
                req.contactName(),
                req.contactPhone(),
                req.contactEmail(),
                req.logoUrl())));
  }

  @GetMapping
  public ApiResponse<List<PartnerResponse>> list() {
    return ApiResponse.of(partnerService.list().stream().map(PartnerResponse::of).toList());
  }

  @GetMapping("/{partnerId}")
  public ApiResponse<PartnerResponse> get(@PathVariable Long partnerId) {
    return ApiResponse.of(PartnerResponse.of(partnerService.get(partnerId)));
  }

  @PostMapping("/{partnerId}/suspend")
  public ApiResponse<PartnerResponse> suspend(@PathVariable Long partnerId) {
    return ApiResponse.of(
        PartnerResponse.of(partnerService.setStatus(partnerId, PartnerStatus.SUSPENDED)));
  }

  @PostMapping("/{partnerId}/activate")
  public ApiResponse<PartnerResponse> activate(@PathVariable Long partnerId) {
    return ApiResponse.of(
        PartnerResponse.of(partnerService.setStatus(partnerId, PartnerStatus.ACTIVE)));
  }

  @PostMapping("/{partnerId}/farms")
  public ApiResponse<MembershipResponse> attachFarm(
      @PathVariable Long partnerId, @RequestBody @Valid AttachFarmRequest req) {
    return ApiResponse.of(
        MembershipResponse.of(
            partnerNetworkService.attachFarmManually(
                partnerId, req.farmId(), TenancyContext.currentUserId())));
  }

  @GetMapping("/{partnerId}/farms")
  public ApiResponse<List<MembershipResponse>> listFarms(@PathVariable Long partnerId) {
    return ApiResponse.of(
        partnerNetworkService.listForPartner(partnerId).stream()
            .map(MembershipResponse::of)
            .toList());
  }

  @PostMapping("/{partnerId}/invite-codes")
  public ApiResponse<InviteCodeResponse> generateInviteCode(
      @PathVariable Long partnerId, @RequestBody @Valid GenerateInviteCodeRequest req) {
    return ApiResponse.of(
        InviteCodeResponse.of(
            partnerService.generateInviteCode(
                partnerId, req.maxUses(), req.expiresAt(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{partnerId}/users")
  public ApiResponse<PartnerUserResponse> createUser(
      @PathVariable Long partnerId, @RequestBody @Valid CreatePartnerUserRequest req) {
    var result = partnerService.createPartnerUser(partnerId, req.email(), req.fullName());
    return ApiResponse.of(PartnerUserResponse.of(result.user(), result.temporaryPassword()));
  }
}
