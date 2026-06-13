package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.TreatmentExecuted;
import com.avicare.livestock.health.TreatmentCommand;
import com.avicare.livestock.health.TreatmentExecutedService;
import com.avicare.livestock.health.dto.TreatmentCreateRequest;
import com.avicare.livestock.health.dto.TreatmentResponse;
import com.avicare.livestock.service.LivestockService;
import jakarta.validation.Valid;
import java.time.LocalDate;
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

/** Treatment recording endpoints (Sprint B3-4, {@code module.health.advanced}). */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/treatments")
@RequiredArgsConstructor
public class TreatmentController {

  private final TreatmentExecutedService treatmentService;
  private final LivestockService livestockService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public ApiResponse<TreatmentResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid TreatmentCreateRequest request) {
    assertUnitInFarm(farmId, request.unitId());
    TreatmentExecuted saved =
        treatmentService.record(
            request.unitId(),
            new TreatmentCommand(
                request.treatmentKey(),
                request.startDate(),
                request.durationDays(),
                request.doseAmount(),
                request.doseUnit(),
                request.route(),
                request.subjectsCount(),
                request.reason(),
                request.prescribedBy(),
                request.veterinarianId(),
                request.notes(),
                request.administeredByUserId()),
            TenancyContext.currentUserId());
    return ApiResponse.of(TreatmentResponse.from(saved));
  }

  @GetMapping
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<List<TreatmentResponse>> list(
      @PathVariable Long farmId, @RequestParam Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        treatmentService.listForUnit(unitId).stream().map(TreatmentResponse::from).toList());
  }

  @GetMapping("/active-withdrawals")
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<List<TreatmentResponse>> activeWithdrawals(
      @PathVariable Long farmId, @RequestParam Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        treatmentService.getActiveWithdrawals(unitId, LocalDate.now()).stream()
            .map(TreatmentResponse::from)
            .toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<TreatmentResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(TreatmentResponse.from(getInFarm(farmId, id)));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.ADMIN_ADVANCED_OWNER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    getInFarm(farmId, id);
    treatmentService.delete(id);
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }

  private TreatmentExecuted getInFarm(Long farmId, Long id) {
    TreatmentExecuted t = treatmentService.get(id);
    if (!t.getProductionUnit().getFarmId().equals(farmId)) {
      throw NotFoundException.of("TreatmentExecuted", id);
    }
    return t;
  }
}
