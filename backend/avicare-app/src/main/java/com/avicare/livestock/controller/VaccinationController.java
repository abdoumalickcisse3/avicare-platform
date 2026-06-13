package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.Vaccination;
import com.avicare.livestock.health.VaccinationCommand;
import com.avicare.livestock.health.VaccinationService;
import com.avicare.livestock.health.dto.VaccinationCreateRequest;
import com.avicare.livestock.health.dto.VaccinationResponse;
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

/** Vaccination recording endpoints (Sprint B3-4, {@code module.health.basic}). */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/vaccinations")
@RequiredArgsConstructor
public class VaccinationController {

  private final VaccinationService vaccinationService;
  private final LivestockService livestockService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_BASIC_FARMER)
  public ApiResponse<VaccinationResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid VaccinationCreateRequest request) {
    assertUnitInFarm(farmId, request.unitId());
    Vaccination saved =
        vaccinationService.record(
            request.unitId(),
            new VaccinationCommand(
                request.vaccineKey(),
                request.administeredDate(),
                request.route(),
                request.dosePerSubject(),
                request.doseUnit(),
                request.subjectsCount(),
                request.vaccineBatchNumber(),
                request.vaccineExpiryDate(),
                request.administeredByUserId(),
                request.notes()),
            TenancyContext.currentUserId());
    return ApiResponse.of(VaccinationResponse.from(saved));
  }

  @GetMapping
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<List<VaccinationResponse>> list(
      @PathVariable Long farmId, @RequestParam Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        vaccinationService.listForUnit(unitId).stream().map(VaccinationResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<VaccinationResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(VaccinationResponse.from(getInFarm(farmId, id)));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    getInFarm(farmId, id);
    vaccinationService.delete(id);
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }

  private Vaccination getInFarm(Long farmId, Long id) {
    Vaccination v = vaccinationService.get(id);
    if (!v.getProductionUnit().getFarmId().equals(farmId)) {
      throw NotFoundException.of("Vaccination", id);
    }
    return v;
  }
}
