package com.avicare.parameters.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.parameters.domain.AlertThreshold;
import com.avicare.parameters.dto.request.ThresholdRequest;
import com.avicare.parameters.dto.response.ThresholdResponse;
import com.avicare.parameters.service.ThresholdService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farm alert thresholds. Reading needs the {@code settings:read} permission; mutating is restricted
 * to OWNER/MANAGER. One threshold per (farm, type); the type is the path key.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/thresholds")
@RequiredArgsConstructor
public class AlertThresholdController {

  private final ThresholdService thresholdService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasPermission(#farmId, 'settings:read')")
  public ApiResponse<List<ThresholdResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        thresholdService.list(farmId).stream().map(AlertThresholdController::toResponse).toList());
  }

  @PutMapping("/{type}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<ThresholdResponse> upsert(
      @PathVariable Long farmId,
      @PathVariable String type,
      @RequestBody @Valid ThresholdRequest request) {
    return ApiResponse.of(
        toResponse(thresholdService.upsert(farmId, type, request.value(), request.severity())));
  }

  @DeleteMapping("/{type}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public void delete(@PathVariable Long farmId, @PathVariable String type) {
    thresholdService.delete(farmId, type);
  }

  private static ThresholdResponse toResponse(AlertThreshold t) {
    return new ThresholdResponse(
        t.getThresholdType(), t.getThresholdValue(), t.getSeverity(), t.isActive());
  }
}
