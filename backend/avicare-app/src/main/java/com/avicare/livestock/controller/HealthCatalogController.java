package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.health.HealthCatalogService;
import com.avicare.livestock.health.TreatmentDto;
import com.avicare.livestock.health.VaccinationProgramDto;
import com.avicare.livestock.health.VaccineDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only health library endpoints (Sprint B3-4). Vaccines and vaccination programs are part of
 * {@code module.health.basic}; treatments require {@code module.health.advanced}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/catalog")
@RequiredArgsConstructor
public class HealthCatalogController {

  private final HealthCatalogService healthCatalogService;

  @GetMapping("/vaccines")
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<List<VaccineDto>> vaccines(@PathVariable Long farmId) {
    return ApiResponse.of(healthCatalogService.listVaccines());
  }

  @GetMapping("/treatments")
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<List<TreatmentDto>> treatments(@PathVariable Long farmId) {
    return ApiResponse.of(healthCatalogService.listTreatments());
  }

  @GetMapping("/programs")
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<List<VaccinationProgramDto>> programs(@PathVariable Long farmId) {
    return ApiResponse.of(healthCatalogService.listVaccinationPrograms());
  }

  @GetMapping("/programs/by-breed/{breedKey}")
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<List<VaccinationProgramDto>> programsByBreed(
      @PathVariable Long farmId, @PathVariable String breedKey) {
    return ApiResponse.of(healthCatalogService.getVaccinationProgramsForBreed(breedKey));
  }
}
