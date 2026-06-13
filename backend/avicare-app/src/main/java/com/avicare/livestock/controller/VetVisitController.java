package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.VetVisit;
import com.avicare.livestock.health.VetVisitCommand;
import com.avicare.livestock.health.VetVisitService;
import com.avicare.livestock.health.dto.VetVisitCreateRequest;
import com.avicare.livestock.health.dto.VetVisitResponse;
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

/** Vet visit endpoints (Sprint B3-4, {@code module.health.advanced}). */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/vet-visits")
@RequiredArgsConstructor
public class VetVisitController {

  private final VetVisitService vetVisitService;
  private final LivestockService livestockService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public ApiResponse<VetVisitResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid VetVisitCreateRequest request) {
    assertUnitInFarm(farmId, request.unitId());
    VetVisit saved =
        vetVisitService.record(
            request.unitId(),
            new VetVisitCommand(
                request.veterinarianId(),
                request.visitDate(),
                request.reason(),
                request.diagnosis(),
                request.recommendations(),
                request.costXof(),
                request.followUpNeeded(),
                request.followUpDate(),
                request.notes()),
            TenancyContext.currentUserId());
    return ApiResponse.of(VetVisitResponse.from(saved));
  }

  @GetMapping
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<List<VetVisitResponse>> list(
      @PathVariable Long farmId, @RequestParam Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        vetVisitService.listForUnit(unitId).stream().map(VetVisitResponse::from).toList());
  }

  @GetMapping("/upcoming-follow-ups")
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<List<VetVisitResponse>> upcomingFollowUps(
      @PathVariable Long farmId, @RequestParam(defaultValue = "30") int days) {
    return ApiResponse.of(
        vetVisitService.listUpcomingFollowUps(farmId, days).stream()
            .map(VetVisitResponse::from)
            .toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<VetVisitResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(VetVisitResponse.from(getInFarm(farmId, id)));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    getInFarm(farmId, id);
    vetVisitService.delete(id);
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }

  private VetVisit getInFarm(Long farmId, Long id) {
    VetVisit v = vetVisitService.get(id);
    if (!v.getProductionUnit().getFarmId().equals(farmId)) {
      throw NotFoundException.of("VetVisit", id);
    }
    return v;
  }
}
