package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.HealthObservation;
import com.avicare.livestock.domain.Severity;
import com.avicare.livestock.health.HealthObservationCommand;
import com.avicare.livestock.health.HealthObservationService;
import com.avicare.livestock.health.dto.ObservationCreateRequest;
import com.avicare.livestock.health.dto.ObservationResponse;
import com.avicare.livestock.service.LivestockService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Health observation endpoints (Sprint B3-4, {@code module.health.basic}). */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/observations")
@RequiredArgsConstructor
public class ObservationController {

  private final HealthObservationService observationService;
  private final LivestockService livestockService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_BASIC_FARMER)
  public ApiResponse<ObservationResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid ObservationCreateRequest request) {
    assertUnitInFarm(farmId, request.unitId());
    HealthObservation saved =
        observationService.record(
            request.unitId(),
            new HealthObservationCommand(
                request.observationDate(),
                request.severity(),
                request.title(),
                request.description(),
                request.suspectedDisease(),
                request.observedByUserId()),
            TenancyContext.currentUserId());
    return ApiResponse.of(ObservationResponse.from(saved));
  }

  @GetMapping
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<List<ObservationResponse>> list(
      @PathVariable Long farmId,
      @RequestParam Long unitId,
      @RequestParam(required = false) Severity severity) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        observationService.listForUnit(unitId).stream()
            .filter(o -> severity == null || o.getSeverity() == severity)
            .map(ObservationResponse::from)
            .toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<ObservationResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(ObservationResponse.from(getInFarm(farmId, id)));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    getInFarm(farmId, id);
    observationService.delete(id);
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }

  private HealthObservation getInFarm(Long farmId, Long id) {
    HealthObservation o = observationService.get(id);
    if (!o.getProductionUnit().getFarmId().equals(farmId)) {
      throw NotFoundException.of("HealthObservation", id);
    }
    return o;
  }
}
