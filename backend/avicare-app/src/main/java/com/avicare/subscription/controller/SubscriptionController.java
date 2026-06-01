package com.avicare.subscription.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.dto.request.EnableModuleRequest;
import com.avicare.subscription.dto.response.ModuleResponse;
import com.avicare.subscription.dto.response.SubscriptionResponse;
import com.avicare.subscription.service.SubscriptionService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * A farm's subscription and its modules. Reading needs farm access; changing the module set is
 * restricted to the farm OWNER via the {@code @farmAccess} SpEL bean. (Module activation is also a
 * platform-admin / billing concern; broader admin endpoints land in a later session.)
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/subscription")
@RequiredArgsConstructor
public class SubscriptionController {

  private final SubscriptionService subscriptionService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<SubscriptionResponse> get(@PathVariable Long farmId) {
    Subscription sub = subscriptionService.getOrCreate(farmId);
    List<ModuleResponse> modules =
        subscriptionService.listModules(farmId).stream()
            .map(SubscriptionController::toModuleResponse)
            .toList();
    return ApiResponse.of(
        new SubscriptionResponse(
            sub.getId(),
            sub.getFarmId(),
            sub.getStatus(),
            sub.getPlanKey(),
            sub.getExpiresAt(),
            modules));
  }

  @GetMapping("/modules")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<ModuleResponse>> listModules(@PathVariable Long farmId) {
    return ApiResponse.of(
        subscriptionService.listModules(farmId).stream()
            .map(SubscriptionController::toModuleResponse)
            .toList());
  }

  @PostMapping("/modules")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public ApiResponse<ModuleResponse> enableModule(
      @PathVariable Long farmId, @RequestBody @Valid EnableModuleRequest request) {
    return ApiResponse.of(
        toModuleResponse(
            subscriptionService.enableModule(
                farmId, request.moduleKey(), request.mode(), request.expiresAt())));
  }

  @DeleteMapping("/modules/{moduleKey}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public void disableModule(@PathVariable Long farmId, @PathVariable String moduleKey) {
    subscriptionService.disableModule(farmId, moduleKey);
  }

  private static ModuleResponse toModuleResponse(SubscriptionModule m) {
    return new ModuleResponse(m.getModuleKey(), m.getMode(), m.getExpiresAt());
  }
}
