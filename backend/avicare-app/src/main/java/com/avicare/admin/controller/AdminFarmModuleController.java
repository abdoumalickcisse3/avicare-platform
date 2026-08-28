package com.avicare.admin.controller;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.subscription.service.SubscriptionService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Per-farm module toggles from the console.
 *
 * <p>Staff could already reach the tenant endpoints directly — ADMIN bypasses the OWNER check — so
 * these exist for the audit trail: {@code farm.module.enable} with the module in its metadata reads
 * far better than the interceptor's generic "POST /api/v1/farms/{farmId}/subscription/modules".
 */
@RestController
@RequestMapping("/api/v1/admin/farms/{farmId}/modules")
@RequiredArgsConstructor
public class AdminFarmModuleController {

  private final SubscriptionService subscriptionService;
  private final SubscriptionFacade subscriptionFacade;
  private final AdminAuditService auditService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('tenants:read')")
  public ApiResponse<List<String>> list(@PathVariable Long farmId) {
    return ApiResponse.of(subscriptionFacade.listEnabledModules(farmId));
  }

  @PostMapping("/{moduleKey}")
  @PreAuthorize("@adminAccess.can('tenants:write')")
  public ApiResponse<Void> enable(@PathVariable Long farmId, @PathVariable String moduleKey) {
    subscriptionService.enableModule(farmId, moduleKey, null, null);
    auditService.record("farm.module.enable", "Farm", farmId, farmId, Map.of("module", moduleKey));
    return ApiResponse.of(null);
  }

  @DeleteMapping("/{moduleKey}")
  @PreAuthorize("@adminAccess.can('tenants:write')")
  public ApiResponse<Void> disable(@PathVariable Long farmId, @PathVariable String moduleKey) {
    subscriptionService.disableModule(farmId, moduleKey);
    auditService.record("farm.module.disable", "Farm", farmId, farmId, Map.of("module", moduleKey));
    return ApiResponse.of(null);
  }
}
