package com.avicare.subscription.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.subscription.domain.SubscriptionChangeRequest;
import com.avicare.subscription.dto.request.CreateChangeRequestRequest;
import com.avicare.subscription.dto.response.ChangeRequestResponse;
import com.avicare.subscription.service.ChangeRequestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farm-side subscription change requests. The OWNER drafts and submits a request; reading needs
 * farm access. Approval/rejection is a platform-admin action handled by {@link
 * AdminChangeRequestController}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/subscription/change-requests")
@RequiredArgsConstructor
public class ChangeRequestController {

  private final ChangeRequestService changeRequestService;
  private final ObjectMapper objectMapper;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<ChangeRequestResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        changeRequestService.listForFarm(farmId).stream().map(this::toResponse).toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public ApiResponse<ChangeRequestResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid CreateChangeRequestRequest request) {
    ArrayNode modules =
        objectMapper.valueToTree(
            request.requestedModules() != null ? request.requestedModules() : List.of());
    SubscriptionChangeRequest created =
        changeRequestService.create(
            farmId, TenancyContext.currentUserId(), request.requestedPlan(), modules);
    return ApiResponse.of(toResponse(created));
  }

  @PostMapping("/{requestId}/submit")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public ApiResponse<ChangeRequestResponse> submit(
      @PathVariable Long farmId, @PathVariable Long requestId) {
    return ApiResponse.of(toResponse(changeRequestService.submit(requestId)));
  }

  private ChangeRequestResponse toResponse(SubscriptionChangeRequest r) {
    List<String> modules = new ArrayList<>();
    if (r.getRequestedModules() != null && r.getRequestedModules().isArray()) {
      r.getRequestedModules().forEach(node -> modules.add(node.asText()));
    }
    return new ChangeRequestResponse(
        r.getId(),
        r.getSubscriptionId(),
        r.getRequestedPlan(),
        modules,
        r.getStatus(),
        r.getRequestedBy(),
        r.getReviewerId(),
        r.getReviewedAt(),
        r.getReason());
  }
}
