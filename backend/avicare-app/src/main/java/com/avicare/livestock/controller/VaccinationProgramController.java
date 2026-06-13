package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.health.ScheduleStatusDto;
import com.avicare.livestock.health.VaccinationProgramAssignmentService;
import com.avicare.livestock.health.dto.AssignProgramRequest;
import com.avicare.livestock.health.dto.ProgramAssignmentResponse;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Vaccination program assignment per lot and its schedule status (Sprint B3-4, {@code
 * module.health.basic}). Assigning/removing is a supervisory action.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/lots/{unitId}/program")
@RequiredArgsConstructor
public class VaccinationProgramController {

  private final VaccinationProgramAssignmentService programService;
  private final LivestockService livestockService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)
  public ApiResponse<ProgramAssignmentResponse> assign(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @RequestBody @Valid AssignProgramRequest request) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        ProgramAssignmentResponse.from(
            programService.assignProgram(
                unitId, request.programKey(), TenancyContext.currentUserId())));
  }

  @GetMapping
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<ProgramAssignmentResponse> get(
      @PathVariable Long farmId, @PathVariable Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        programService
            .getAssignedProgram(unitId)
            .map(ProgramAssignmentResponse::from)
            .orElseThrow(() -> NotFoundException.of("VaccinationProgramLot", unitId)));
  }

  @GetMapping("/schedule")
  @PreAuthorize(HealthAccess.READ_BASIC)
  public ApiResponse<List<ScheduleStatusDto>> schedule(
      @PathVariable Long farmId, @PathVariable Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(programService.computeScheduleStatus(unitId));
  }

  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)
  public void remove(@PathVariable Long farmId, @PathVariable Long unitId) {
    assertUnitInFarm(farmId, unitId);
    programService.removeProgram(unitId, TenancyContext.currentUserId());
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }
}
