package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.domain.EggTrayStock;
import com.avicare.livestock.dto.request.TrayStockAdjustRequest;
import com.avicare.livestock.dto.request.TrayStockUpdateRequest;
import com.avicare.livestock.dto.response.TrayStockResponse;
import com.avicare.livestock.layer.EggTrayStockService;
import com.avicare.livestock.layer.EggTrayStockUpdate;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Egg tray stock endpoints (Sprint B2-3). Farm-scoped (one stock per farm, auto-created) and gated
 * behind {@code module.poultry.layer}; reading and delta adjustments need an operational role while
 * setting exact values (overwrite) needs a supervisory role.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/egg-production/tray-stock")
@RequiredArgsConstructor
public class EggTrayStockController {

  private final EggTrayStockService eggTrayStockService;

  @GetMapping
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<TrayStockResponse> get(@PathVariable Long farmId) {
    return ApiResponse.of(toResponse(eggTrayStockService.getOrCreateForFarm(farmId)));
  }

  @PutMapping
  @PreAuthorize(LayerAccess.WRITE_MANAGER)
  public ApiResponse<TrayStockResponse> set(
      @PathVariable Long farmId, @RequestBody @Valid TrayStockUpdateRequest request) {
    return ApiResponse.of(
        toResponse(
            eggTrayStockService.record(
                farmId,
                new EggTrayStockUpdate(request.fullTraysCount(), request.emptyTraysCount()))));
  }

  @PostMapping("/adjust")
  @PreAuthorize(LayerAccess.WRITE_FARMER)
  public ApiResponse<TrayStockResponse> adjust(
      @PathVariable Long farmId, @RequestBody TrayStockAdjustRequest request) {
    return ApiResponse.of(
        toResponse(
            eggTrayStockService.adjustStock(farmId, request.fullDelta(), request.emptyDelta())));
  }

  static TrayStockResponse toResponse(EggTrayStock s) {
    return new TrayStockResponse(
        s.getFarmId(), s.getFullTraysCount(), s.getEmptyTraysCount(), s.getUpdatedAt());
  }
}
