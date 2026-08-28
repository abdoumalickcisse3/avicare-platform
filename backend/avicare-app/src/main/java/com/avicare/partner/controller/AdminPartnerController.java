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
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
  private final com.avicare.admin.service.AdminAuditService auditService;

  @PostMapping
  @PreAuthorize("@adminAccess.can('partners:write')")
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
  @PreAuthorize("@adminAccess.can('partners:write')")
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
  @PreAuthorize("@adminAccess.can('partners:read')")
  public ApiResponse<List<PartnerResponse>> list() {
    return ApiResponse.of(partnerService.list().stream().map(PartnerResponse::of).toList());
  }

  @GetMapping("/{partnerId}")
  @PreAuthorize("@adminAccess.can('partners:read')")
  public ApiResponse<PartnerResponse> get(@PathVariable Long partnerId) {
    return ApiResponse.of(PartnerResponse.of(partnerService.get(partnerId)));
  }

  @PostMapping("/{partnerId}/suspend")
  @PreAuthorize("@adminAccess.can('partners:write')")
  public ApiResponse<PartnerResponse> suspend(@PathVariable Long partnerId) {
    return ApiResponse.of(
        PartnerResponse.of(partnerService.setStatus(partnerId, PartnerStatus.SUSPENDED)));
  }

  @PostMapping("/{partnerId}/activate")
  @PreAuthorize("@adminAccess.can('partners:write')")
  public ApiResponse<PartnerResponse> activate(@PathVariable Long partnerId) {
    return ApiResponse.of(
        PartnerResponse.of(partnerService.setStatus(partnerId, PartnerStatus.ACTIVE)));
  }

  @PostMapping("/{partnerId}/farms")
  @PreAuthorize("@adminAccess.can('partners:attach')")
  public ApiResponse<MembershipResponse> attachFarm(
      @PathVariable Long partnerId, @RequestBody @Valid AttachFarmRequest req) {
    return ApiResponse.of(
        MembershipResponse.of(
            partnerNetworkService.attachFarmManually(
                partnerId, req.farmId(), TenancyContext.currentUserId())));
  }

  @GetMapping("/{partnerId}/farms")
  @PreAuthorize("@adminAccess.can('partners:read')")
  public ApiResponse<List<MembershipResponse>> listFarms(@PathVariable Long partnerId) {
    return ApiResponse.of(
        partnerNetworkService.listForPartner(partnerId).stream()
            .map(MembershipResponse::of)
            .toList());
  }

  @PostMapping("/{partnerId}/invite-codes")
  @PreAuthorize("@adminAccess.can('partners:write')")
  public ApiResponse<InviteCodeResponse> generateInviteCode(
      @PathVariable Long partnerId, @RequestBody @Valid GenerateInviteCodeRequest req) {
    return ApiResponse.of(
        InviteCodeResponse.of(
            partnerService.generateInviteCode(
                partnerId, req.maxUses(), req.expiresAt(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{partnerId}/users")
  @PreAuthorize("@adminAccess.can('partners:users')")
  public ApiResponse<PartnerUserResponse> createUser(
      @PathVariable Long partnerId, @RequestBody @Valid CreatePartnerUserRequest req) {
    var result = partnerService.createPartnerUser(partnerId, req.email(), req.fullName());
    return ApiResponse.of(PartnerUserResponse.of(result.user(), result.temporaryPassword()));
  }

  /**
   * Detach a farm from a partner network.
   *
   * <p>The single most sensitive action of the whole back-office alongside its opposite: it closes
   * a third party's access to a farmer's data. Audited with the farm as tenant.
   */
  @DeleteMapping("/{partnerId}/farms/{membershipId}")
  @PreAuthorize("@adminAccess.can('partners:attach')")
  public ApiResponse<MembershipResponse> detachFarm(
      @PathVariable Long partnerId, @PathVariable Long membershipId) {
    var membership = partnerNetworkService.leave(membershipId);
    auditService.record(
        "partner.farm.detach",
        "PartnerFarmMembership",
        membershipId,
        membership.getFarmId(),
        Map.of("partnerId", partnerId));
    return ApiResponse.of(MembershipResponse.of(membership));
  }

  @GetMapping("/{partnerId}/users")
  @PreAuthorize("@adminAccess.can('partners:read')")
  public ApiResponse<List<PartnerUserResponse>> listUsers(@PathVariable Long partnerId) {
    return ApiResponse.of(
        partnerService.listPartnerUsers(partnerId).stream()
            .map(u -> PartnerUserResponse.of(u, null))
            .toList());
  }

  @PostMapping("/{partnerId}/users/{partnerUserId}/deactivate")
  @PreAuthorize("@adminAccess.can('partners:users')")
  public ApiResponse<PartnerUserResponse> deactivateUser(
      @PathVariable Long partnerId, @PathVariable Long partnerUserId) {
    var user = partnerService.setPartnerUserActive(partnerUserId, false);
    auditService.record(
        "partner.user.deactivate",
        "PartnerUser",
        partnerUserId,
        null,
        Map.of("partnerId", partnerId));
    return ApiResponse.of(PartnerUserResponse.of(user, null));
  }

  @PostMapping("/{partnerId}/users/{partnerUserId}/activate")
  @PreAuthorize("@adminAccess.can('partners:users')")
  public ApiResponse<PartnerUserResponse> activateUser(
      @PathVariable Long partnerId, @PathVariable Long partnerUserId) {
    var user = partnerService.setPartnerUserActive(partnerUserId, true);
    auditService.record(
        "partner.user.activate",
        "PartnerUser",
        partnerUserId,
        null,
        Map.of("partnerId", partnerId));
    return ApiResponse.of(PartnerUserResponse.of(user, null));
  }

  @PostMapping("/{partnerId}/users/{partnerUserId}/reset-password")
  @PreAuthorize("@adminAccess.can('partners:users')")
  public ApiResponse<Map<String, String>> resetUserPassword(
      @PathVariable Long partnerId, @PathVariable Long partnerUserId) {
    String temporary = partnerService.resetPartnerUserPassword(partnerUserId);
    auditService.record(
        "partner.user.password.reset",
        "PartnerUser",
        partnerUserId,
        null,
        Map.of("partnerId", partnerId));
    return ApiResponse.of(Map.of("temporaryPassword", temporary));
  }

  @GetMapping("/{partnerId}/invite-codes")
  @PreAuthorize("@adminAccess.can('partners:read')")
  public ApiResponse<List<InviteCodeResponse>> listInviteCodes(@PathVariable Long partnerId) {
    return ApiResponse.of(
        partnerService.listInviteCodes(partnerId).stream().map(InviteCodeResponse::of).toList());
  }

  @PostMapping("/{partnerId}/invite-codes/{codeId}/revoke")
  @PreAuthorize("@adminAccess.can('partners:write')")
  public ApiResponse<InviteCodeResponse> revokeInviteCode(
      @PathVariable Long partnerId, @PathVariable Long codeId) {
    var code = partnerService.revokeInviteCode(codeId);
    auditService.record(
        "partner.invite-code.revoke",
        "PartnerInviteCode",
        codeId,
        null,
        Map.of("partnerId", partnerId));
    return ApiResponse.of(InviteCodeResponse.of(code));
  }
}
