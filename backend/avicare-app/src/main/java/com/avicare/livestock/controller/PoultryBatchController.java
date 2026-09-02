package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.dto.request.CreatePoultryBatchRequest;
import com.avicare.livestock.dto.response.PoultryBatchResponse;
import com.avicare.livestock.poultry.PoultryBatchCreate;
import com.avicare.livestock.poultry.PoultryBatchService;
import com.avicare.livestock.repository.LifecycleEventRepository;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
  // Broiler writes (batch create, weighing entry) — grantable via poultry:write for per-member
  // sub-access (OWNER *, MANAGER poultry:*, FARMER poultry:write carry it by default).
  static final String WRITE = "@farmAccess.hasPermission(#farmId, 'poultry:write') and " + FEATURE;

  private final PoultryBatchService poultryBatchService;
  private final LifecycleEventRepository lifecycleEventRepository;

  @GetMapping
  @PreAuthorize(READ)
  public ApiResponse<List<PoultryBatchResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) UnitStatus status) {
    List<PoultryBatch> batches = poultryBatchService.list(farmId, status);
    Map<Long, Long> deathsByUnit = deathsFor(batches.stream().map(PoultryBatch::getId).toList());
    return ApiResponse.of(
        batches.stream()
            .map(b -> toResponse(b, deathsByUnit.getOrDefault(b.getId(), 0L)))
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
    return ApiResponse.of(toResponse(batch, 0L)); // a batch is born with no losses
  }

  @GetMapping("/{batchId}")
  @PreAuthorize(READ)
  public ApiResponse<PoultryBatchResponse> get(
      @PathVariable Long farmId, @PathVariable Long batchId) {
    PoultryBatch batch = poultryBatchService.get(batchId);
    return ApiResponse.of(toResponse(batch, -lifecycleEventRepository.sumMortalityDelta(batchId)));
  }

  /**
   * Real losses, from the MORTALITY ledger — never {@code initialCount - currentCount}, which a
   * sale decrements just as a death does.
   */
  private Map<Long, Long> deathsFor(List<Long> unitIds) {
    if (unitIds.isEmpty()) {
      return Map.of();
    }
    return lifecycleEventRepository.sumMortalityDeltaByUnits(unitIds).stream()
        .collect(
            Collectors.toMap(
                row -> ((Number) row[0]).longValue(), row -> -((Number) row[1]).longValue()));
  }

  static PoultryBatchResponse toResponse(PoultryBatch b, long deaths) {
    return new PoultryBatchResponse(
        b.getId(),
        b.getFarmId(),
        b.getBreedId(),
        b.getName(),
        b.getStartDate(),
        b.getStatus(),
        b.getCurrentCount(),
        b.getInitialCount(),
        (int) deaths,
        b.getTargetWeightG(),
        b.getTargetAgeDays());
  }
}
