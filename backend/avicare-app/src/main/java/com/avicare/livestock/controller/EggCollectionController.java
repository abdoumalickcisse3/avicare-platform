package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.EggCollection;
import com.avicare.livestock.dto.request.EggCollectionCreateRequest;
import com.avicare.livestock.dto.response.EggCollectionResponse;
import com.avicare.livestock.layer.EggCollectionCommand;
import com.avicare.livestock.layer.EggCollectionService;
import com.avicare.livestock.service.LivestockService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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

/**
 * Egg collection endpoints for the poultry layer module (Sprint B2-3). Farm-scoped and gated behind
 * {@code module.poultry.layer}; reading needs farm access, recording (upsert) needs an operational
 * role, deleting needs a supervisory role. The unit is verified to belong to the path farm (404
 * otherwise) to prevent cross-farm access.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/egg-production/collections")
@RequiredArgsConstructor
public class EggCollectionController {

  private final EggCollectionService eggCollectionService;
  private final LivestockService livestockService;

  @GetMapping
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<List<EggCollectionResponse>> list(
      @PathVariable Long farmId,
      @RequestParam Long unitId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    assertUnitInFarm(farmId, unitId);
    List<EggCollection> collections =
        (from != null && to != null)
            ? eggCollectionService.listForUnitInPeriod(unitId, from, to)
            : eggCollectionService.listForUnit(unitId);
    return ApiResponse.of(collections.stream().map(EggCollectionController::toResponse).toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(LayerAccess.WRITE_FARMER)
  public ApiResponse<EggCollectionResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid EggCollectionCreateRequest request) {
    assertUnitInFarm(farmId, request.unitId());
    EggCollection saved =
        eggCollectionService.record(
            request.unitId(),
            new EggCollectionCommand(
                request.collectionDate(),
                request.timeslotKey(),
                request.totalEggs(),
                request.brokenEggs(),
                request.gradesCount(),
                request.collectorUserId(),
                request.notes()),
            TenancyContext.currentUserId());
    return ApiResponse.of(toResponse(saved));
  }

  @GetMapping("/{id}")
  @PreAuthorize(LayerAccess.READ)
  public ApiResponse<EggCollectionResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(toResponse(getInFarm(farmId, id)));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(LayerAccess.WRITE_MANAGER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    getInFarm(farmId, id); // 404 if missing or not in this farm
    eggCollectionService.delete(id);
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }

  private EggCollection getInFarm(Long farmId, Long id) {
    EggCollection collection = eggCollectionService.get(id);
    if (!collection.getProductionUnit().getFarmId().equals(farmId)) {
      throw NotFoundException.of("EggCollection", id);
    }
    return collection;
  }

  static EggCollectionResponse toResponse(EggCollection c) {
    return new EggCollectionResponse(
        c.getId(),
        c.getProductionUnit().getId(),
        c.getCollectionDate(),
        c.getTimeslotKey(),
        c.getTotalEggs(),
        c.getBrokenEggs(),
        c.getGradesCount(),
        c.getCollectorUserId(),
        c.getNotes(),
        c.getCreatedBy(),
        c.getCreatedAt(),
        c.getUpdatedAt());
  }
}
