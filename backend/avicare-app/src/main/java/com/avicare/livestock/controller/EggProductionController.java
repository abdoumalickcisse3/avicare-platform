package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.DailyEggProduction;
import com.avicare.livestock.dto.response.DailyProductionResponse;
import com.avicare.livestock.dto.response.RollingRateResponse;
import com.avicare.livestock.layer.EggProductionService;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Daily egg-production (day-close) endpoints (Sprint B2-3). Farm-scoped and gated behind {@code
 * module.poultry.layer}; reading needs farm access while closing a day needs a supervisory role.
 * The unit is verified to belong to the path farm (404 otherwise).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/egg-production/daily-production")
@RequiredArgsConstructor
public class EggProductionController {

  private final EggProductionService eggProductionService;
  private final LivestockService livestockService;

  @PostMapping("/{unitId}/close")
  @PreAuthorize(LayerAccess.WRITE_MANAGER)
  public ApiResponse<DailyProductionResponse> close(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate date) {
    assertUnitInFarm(farmId, unitId);
    LocalDate day = date != null ? date : LocalDate.now();
    return ApiResponse.of(
        toResponse(eggProductionService.closeDay(unitId, day, TenancyContext.currentUserId())));
  }

  @GetMapping
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<List<DailyProductionResponse>> history(
      @PathVariable Long farmId,
      @RequestParam Long unitId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    assertUnitInFarm(farmId, unitId);
    LocalDate end = to != null ? to : LocalDate.now();
    LocalDate start = from != null ? from : end.minusDays(30);
    return ApiResponse.of(
        eggProductionService.listForUnit(unitId, start, end).stream()
            .map(EggProductionController::toResponse)
            .toList());
  }

  @GetMapping("/{unitId}/{date}")
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<DailyProductionResponse> detail(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    assertUnitInFarm(farmId, unitId);
    DailyEggProduction p =
        eggProductionService
            .getDailyProduction(unitId, date)
            .orElseThrow(() -> NotFoundException.of("DailyEggProduction", unitId));
    return ApiResponse.of(toResponse(p));
  }

  @GetMapping("/{unitId}/rolling-rate")
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<RollingRateResponse> rollingRate(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @RequestParam(defaultValue = "7") int days) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        new RollingRateResponse(
            unitId, days, eggProductionService.getRollingLayingRate(unitId, days).orElse(null)));
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }

  static DailyProductionResponse toResponse(DailyEggProduction p) {
    return new DailyProductionResponse(
        p.getProductionUnit().getId(),
        p.getProductionDate(),
        p.getTotalEggsCollected(),
        p.getTotalBrokenEggs(),
        p.getGradesAggregate(),
        p.getLayingRatePct(),
        p.getBreakRatePct(),
        p.getActiveLayersCount(),
        p.getClosedAt(),
        p.getClosedById());
  }
}
