package com.avicare.subscription.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.subscription.dto.response.PlanResponse;
import com.avicare.subscription.service.SubscriptionService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public catalog of V1 subscription plans (pré-bundles), the backend source of truth for the Plan →
 * Modules mapping (Décision 16). Read-only and unauthenticated — the signup wizard and the pricing
 * page consume it before any farm exists. Path is allow-listed in {@code SecurityConfig}.
 */
@RestController
@RequestMapping("/api/v1/subscription/plans")
@RequiredArgsConstructor
public class SubscriptionPlanController {

  private final SubscriptionService subscriptionService;

  @GetMapping
  public ApiResponse<List<PlanResponse>> list() {
    return ApiResponse.of(subscriptionService.listPlans());
  }
}
