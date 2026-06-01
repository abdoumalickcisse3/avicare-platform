package com.avicare.parameters.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.parameters.domain.UserSetting;
import com.avicare.parameters.dto.request.SettingRequest;
import com.avicare.parameters.dto.response.SettingResponse;
import com.avicare.parameters.service.FarmSettingService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Per-user preferences (layer 3). The user id comes from the {@link TenancyContext}, so a caller
 * can only read or edit their own preferences.
 */
@RestController
@RequestMapping("/api/v1/account/settings")
@RequiredArgsConstructor
public class UserSettingsController {

  private final FarmSettingService farmSettingService;

  @GetMapping
  public ApiResponse<List<SettingResponse>> list() {
    List<SettingResponse> settings =
        farmSettingService.getUserSettings(TenancyContext.currentUserId()).stream()
            .map(UserSettingsController::toResponse)
            .toList();
    return ApiResponse.of(settings);
  }

  @PutMapping("/{key}")
  public ApiResponse<SettingResponse> upsert(
      @PathVariable String key, @RequestBody @Valid SettingRequest request) {
    return ApiResponse.of(
        toResponse(
            farmSettingService.setUserSetting(
                TenancyContext.currentUserId(), key, request.value())));
  }

  private static SettingResponse toResponse(UserSetting setting) {
    return new SettingResponse(setting.getKey(), setting.getValue());
  }
}
