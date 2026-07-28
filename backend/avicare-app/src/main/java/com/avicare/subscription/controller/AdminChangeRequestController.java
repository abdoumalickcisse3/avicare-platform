package com.avicare.subscription.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.subscription.domain.SubscriptionChangeRequest;
import com.avicare.subscription.dto.request.RejectRequest;
import com.avicare.subscription.dto.response.ChangeRequestResponse;
import com.avicare.subscription.service.ChangeRequestService;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform-admin review of subscription change requests. Restricted to Jawdi staff ({@code
 * ROLE_ADMIN}); approval applies the requested modules and plan to the farm's subscription.
 */
@RestController
@RequestMapping("/api/v1/admin/change-requests")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminChangeRequestController {

  private final ChangeRequestService changeRequestService;

  @PostMapping("/{requestId}/approve")
  public ApiResponse<ChangeRequestResponse> approve(@PathVariable Long requestId) {
    return ApiResponse.of(
        toResponse(changeRequestService.approve(requestId, TenancyContext.currentUserId())));
  }

  @PostMapping("/{requestId}/reject")
  public ApiResponse<ChangeRequestResponse> reject(
      @PathVariable Long requestId, @RequestBody @Valid RejectRequest request) {
    return ApiResponse.of(
        toResponse(
            changeRequestService.reject(
                requestId, TenancyContext.currentUserId(), request.reason())));
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
