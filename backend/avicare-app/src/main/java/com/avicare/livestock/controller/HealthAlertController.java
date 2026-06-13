package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.health.AlertService;
import com.avicare.livestock.health.dto.AlertsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * In-app health alerts for a farm (Sprint B3-4), computed on read. Gated by {@code
 * module.health.basic}; the advanced sections (withdrawals, follow-ups) are populated only when
 * {@code module.health.advanced} is active (handled in {@link AlertService}).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/alerts")
@RequiredArgsConstructor
public class HealthAlertController {

  private final AlertService alertService;

  @GetMapping
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<AlertsResponse> alerts(@PathVariable Long farmId) {
    return ApiResponse.of(alertService.computeAlertsForFarm(farmId));
  }
}
