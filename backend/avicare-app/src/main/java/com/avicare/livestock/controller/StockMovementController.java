package com.avicare.livestock.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.inventory.dto.StockMovementRequest;
import com.avicare.livestock.inventory.dto.StockMovementResponse;
import com.avicare.livestock.service.LivestockService;
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
 * Stock movements endpoints (Sprint B4-6) — the append-only journal. Movements are queryable by
 * stock item or by lot, and created manually (field entry). No update/delete in V1: history is
 * immutable, corrections go through an {@code ADJUSTMENT} movement.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/movements")
@RequiredArgsConstructor
public class StockMovementController {

  private final StockMovementService stockMovementService;
  private final LivestockService livestockService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<StockMovementResponse>> listForItem(
      @PathVariable Long farmId, @RequestParam Long stockItemId) {
    return ApiResponse.of(
        stockMovementService.listForStockItem(farmId, stockItemId).stream()
            .map(StockMovementResponse::from)
            .toList());
  }

  @GetMapping("/by-lot")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<StockMovementResponse>> listForLot(
      @PathVariable Long farmId, @RequestParam Long unitId) {
    assertUnitInFarm(farmId, unitId);
    return ApiResponse.of(
        stockMovementService.listForProductionUnit(unitId).stream()
            .map(StockMovementResponse::from)
            .toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<StockMovementResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(StockMovementResponse.from(stockMovementService.get(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_FARMER)
  public ApiResponse<StockMovementResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid StockMovementRequest request) {
    return ApiResponse.of(
        StockMovementResponse.from(
            stockMovementService.recordMovement(
                farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  private void assertUnitInFarm(Long farmId, Long unitId) {
    if (!livestockService.getUnit(unitId).getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
  }
}
