package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.dto.response.LayerConfigEntryResponse;
import com.avicare.livestock.dto.response.TraySettingsResponse;
import com.avicare.parameters.api.ParametersFacade;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only layer configuration endpoints (Sprint B2-3): the time-slots, egg grades and tray
 * settings effective for a farm (platform defaults + per-farm overrides), feeding the frontend.
 * Farm-scoped and gated behind {@code module.poultry.layer}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/egg-production/config")
@RequiredArgsConstructor
public class LayerConfigController {

  static final String CATEGORY_TIMESLOTS = "egg_timeslots";
  static final String CATEGORY_GRADES = "egg_grades";
  static final String CATEGORY_COLLECTION = "egg_collection";
  static final int DEFAULT_TRAY_SIZE = 30;
  static final int DEFAULT_TRAY_PRICE_XOF = 2500;

  private final ParametersFacade parametersFacade;

  @GetMapping("/timeslots")
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<List<LayerConfigEntryResponse>> timeslots(@PathVariable Long farmId) {
    return ApiResponse.of(entries(farmId, CATEGORY_TIMESLOTS));
  }

  @GetMapping("/grades")
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<List<LayerConfigEntryResponse>> grades(@PathVariable Long farmId) {
    return ApiResponse.of(entries(farmId, CATEGORY_GRADES));
  }

  @GetMapping("/tray-settings")
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<TraySettingsResponse> traySettings(@PathVariable Long farmId) {
    int size = resolveInt(farmId, "tray_size", DEFAULT_TRAY_SIZE);
    int price = resolveInt(farmId, "tray_price_xof", DEFAULT_TRAY_PRICE_XOF);
    return ApiResponse.of(new TraySettingsResponse(size, price));
  }

  private List<LayerConfigEntryResponse> entries(Long farmId, String category) {
    return parametersFacade.listForFarm(farmId, category).stream()
        .map(e -> new LayerConfigEntryResponse(e.key(), e.value()))
        .toList();
  }

  /** Resolve a scalar wrapped as {@code {"value": n}}, falling back to {@code defaultValue}. */
  private int resolveInt(Long farmId, String key, int defaultValue) {
    Map<String, Object> value =
        parametersFacade.resolve(null, farmId, CATEGORY_COLLECTION, key).orElse(null);
    if (value == null || !(value.get("value") instanceof Number n)) {
      return defaultValue;
    }
    return n.intValue();
  }
}
