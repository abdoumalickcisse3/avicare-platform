package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.dto.request.CreatePoultryBatchRequest;
import com.avicare.livestock.dto.response.PoultryBatchResponse;
import com.avicare.livestock.poultry.PoultryBatchCreate;
import com.avicare.livestock.poultry.PoultryBatchService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Broiler batch endpoints (Sprint B1-3). Farm-scoped and gated behind the {@code
 * module.poultry.broiler} feature; reading needs the {@code poultry:read} permission, creating
 * needs an operational role (FARMER/MANAGER/OWNER).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/poultry-batches")
@RequiredArgsConstructor
public class PoultryBatchController {

  static final String FEATURE = "@features.isEnabled(#farmId, 'module.poultry.broiler')";
  static final String READ = "@farmAccess.hasPermission(#farmId, 'poultry:read') and " + FEATURE;
  static final String WRITE =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER, "
          + "T(com.avicare.common.security.principal.FarmRole).FARMER) and "
          + FEATURE;

  private final PoultryBatchService poultryBatchService;

  @GetMapping
  @PreAuthorize(READ)
  public ApiResponse<List<PoultryBatchResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) UnitStatus status) {
    return ApiResponse.of(
        poultryBatchService.list(farmId, status).stream()
            .map(PoultryBatchController::toResponse)
            .toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(WRITE)
  public ApiResponse<PoultryBatchResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid CreatePoultryBatchRequest request) {
    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(
                farmId,
                request.breedId(),
                request.name(),
                request.startDate(),
                request.targetWeightG(),
                request.targetAgeDays(),
                request.initialCount()),
            TenancyContext.currentUserId());
    return ApiResponse.of(toResponse(batch));
  }

  @GetMapping("/{batchId}")
  @PreAuthorize(READ)
  public ApiResponse<PoultryBatchResponse> get(
      @PathVariable Long farmId, @PathVariable Long batchId) {
    return ApiResponse.of(toResponse(poultryBatchService.get(batchId)));
  }

  static PoultryBatchResponse toResponse(PoultryBatch b) {
    return new PoultryBatchResponse(
        b.getId(),
        b.getFarmId(),
        b.getBreedId(),
        b.getName(),
        b.getStartDate(),
        b.getStatus(),
        b.getCurrentCount(),
        b.getInitialCount(),
        b.getTargetWeightG(),
        b.getTargetAgeDays());
  }
}
