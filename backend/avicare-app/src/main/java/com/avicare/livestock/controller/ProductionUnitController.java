package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.dto.request.CreateProductionUnitRequest;
import com.avicare.livestock.dto.request.LifecycleEventRequest;
import com.avicare.livestock.dto.request.RecordMortalityRequest;
import com.avicare.livestock.dto.response.LifecycleEventResponse;
import com.avicare.livestock.dto.response.ProductionUnitResponse;
import com.avicare.livestock.service.LivestockService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Transverse, species-agnostic read + lifecycle endpoints over a farm's production units. Reading
 * needs {@code poultry:read} (parity with the per-species controllers); recording events/mortality
 * needs an operational role (FARMER/MANAGER/OWNER). Unit creation is species-specific and lives in
 * the species contexts (Sprint B1+).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/production-units")
@RequiredArgsConstructor
public class ProductionUnitController {

  private static final String WRITE_ROLES =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER, "
          + "T(com.avicare.common.security.principal.FarmRole).FARMER)";

  // Creating a unit is structuring — restricted to OWNER/MANAGER (no FARMER).
  private static final String CREATE_ROLES =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER)";

  // Reads on this transverse endpoint expose production units (all poultry in V1), so they
  // require poultry:read — parity with the per-species PoultryBatch/Layer read gating.
  private static final String READ_PERMISSION =
      "@farmAccess.hasPermission(#farmId, 'poultry:read')";

  private final LivestockService livestockService;

  @GetMapping
  @PreAuthorize(READ_PERMISSION)
  public ApiResponse<List<ProductionUnitResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        livestockService.listByFarm(farmId).stream()
            .map(ProductionUnitController::toResponse)
            .toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CREATE_ROLES)
  public ApiResponse<ProductionUnitResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid CreateProductionUnitRequest request) {
    ProductionUnit unit =
        livestockService.createUnit(
            farmId,
            request.breedId(),
            request.unitKind(),
            request.name(),
            request.initialCount(),
            request.startDate(),
            request.notes(),
            TenancyContext.currentUserId());
    return ApiResponse.of(toResponse(unit));
  }

  @GetMapping("/{unitId}")
  @PreAuthorize(READ_PERMISSION)
  public ApiResponse<ProductionUnitResponse> get(
      @PathVariable Long farmId, @PathVariable Long unitId) {
    return ApiResponse.of(toResponse(livestockService.getUnit(unitId)));
  }

  @GetMapping("/{unitId}/events")
  @PreAuthorize(READ_PERMISSION)
  public ApiResponse<List<LifecycleEventResponse>> events(
      @PathVariable Long farmId, @PathVariable Long unitId) {
    return ApiResponse.of(
        livestockService.listEvents(unitId).stream()
            .map(ProductionUnitController::toEventResponse)
            .toList());
  }

  @PostMapping("/{unitId}/events")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(WRITE_ROLES)
  public ApiResponse<LifecycleEventResponse> recordEvent(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @RequestBody @Valid LifecycleEventRequest request) {
    LifecycleEvent event =
        livestockService.recordEvent(
            unitId,
            request.eventType(),
            request.quantityDelta(),
            request.reason(),
            request.details(),
            TenancyContext.currentUserId());
    return ApiResponse.of(toEventResponse(event));
  }

  @PostMapping("/{unitId}/mortality")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(WRITE_ROLES)
  public ApiResponse<LifecycleEventResponse> recordMortality(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @RequestBody @Valid RecordMortalityRequest request) {
    LifecycleEvent event =
        livestockService.recordMortality(
            unitId,
            request.count(),
            request.reason(),
            TenancyContext.currentUserId(),
            request.clientRef());
    return ApiResponse.of(toEventResponse(event));
  }

  private static ProductionUnitResponse toResponse(ProductionUnit u) {
    return new ProductionUnitResponse(
        u.getId(),
        u.getFarmId(),
        u.getSpecies(),
        u.getUnitKind(),
        u.getBreedId(),
        u.getName(),
        u.getStartDate(),
        u.getEndDate(),
        u.getCurrentCount(),
        u.getStatus());
  }

  private static LifecycleEventResponse toEventResponse(LifecycleEvent e) {
    return new LifecycleEventResponse(
        e.getId(),
        e.getProductionUnitId(),
        e.getEventType(),
        e.getQuantityDelta(),
        e.getReason(),
        e.getDetails(),
        e.getOccurredAt());
  }
}
