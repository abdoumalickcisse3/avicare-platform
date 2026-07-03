package com.avicare.parameters.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.parameters.domain.FarmSetting;
import com.avicare.parameters.dto.request.SettingRequest;
import com.avicare.parameters.dto.response.SettingResponse;
import com.avicare.parameters.service.FarmSettingService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farm-level settings (layer 2). Reading needs the {@code settings:read} permission; writing is
 * restricted to OWNER/MANAGER via the {@code @farmAccess} SpEL bean.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/settings")
@RequiredArgsConstructor
public class FarmSettingsController {

  private final FarmSettingService farmSettingService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasPermission(#farmId, 'settings:read')")
  public ApiResponse<List<SettingResponse>> list(@PathVariable Long farmId) {
    List<SettingResponse> settings =
        farmSettingService.getFarmSettings(farmId).stream()
            .map(FarmSettingsController::toResponse)
            .toList();
    return ApiResponse.of(settings);
  }

  @PutMapping("/{key}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<SettingResponse> upsert(
      @PathVariable Long farmId,
      @PathVariable String key,
      @RequestBody @Valid SettingRequest request) {
    return ApiResponse.of(
        toResponse(farmSettingService.setFarmSetting(farmId, key, request.value())));
  }

  private static SettingResponse toResponse(FarmSetting setting) {
    return new SettingResponse(setting.getKey(), setting.getValue());
  }
}
