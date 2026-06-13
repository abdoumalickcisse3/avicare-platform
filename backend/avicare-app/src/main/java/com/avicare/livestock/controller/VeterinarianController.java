package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.health.VeterinarianCommand;
import com.avicare.livestock.health.VeterinarianService;
import com.avicare.livestock.health.dto.VeterinarianRequest;
import com.avicare.livestock.health.dto.VeterinarianResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Per-farm veterinarian directory endpoints (Sprint B3-4, {@code module.health.advanced}). All
 * routes are farm-scoped — the service keys every mutation by {@code (farmId, vetId)}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/health/veterinarians")
@RequiredArgsConstructor
public class VeterinarianController {

  private final VeterinarianService veterinarianService;

  @GetMapping
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<List<VeterinarianResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        veterinarianService.listForFarm(farmId).stream().map(VeterinarianResponse::from).toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public ApiResponse<VeterinarianResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid VeterinarianRequest request) {
    return ApiResponse.of(
        VeterinarianResponse.from(
            veterinarianService.create(
                farmId, toCommand(request), TenancyContext.currentUserId())));
  }

  @GetMapping("/{id}")
  @PreAuthorize(HealthAccess.READ_ADVANCED)
  public ApiResponse<VeterinarianResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(VeterinarianResponse.from(veterinarianService.get(farmId, id)));
  }

  @PutMapping("/{id}")
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public ApiResponse<VeterinarianResponse> update(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid VeterinarianRequest req) {
    return ApiResponse.of(
        VeterinarianResponse.from(
            veterinarianService.update(
                farmId, id, toCommand(req), TenancyContext.currentUserId())));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)
  public void deactivate(@PathVariable Long farmId, @PathVariable Long id) {
    veterinarianService.deactivate(farmId, id, TenancyContext.currentUserId());
  }

  private static VeterinarianCommand toCommand(VeterinarianRequest r) {
    return new VeterinarianCommand(
        r.fullName(),
        r.phone(),
        r.email(),
        r.speciality(),
        r.licenseNumber(),
        r.location(),
        r.notes());
  }
}
