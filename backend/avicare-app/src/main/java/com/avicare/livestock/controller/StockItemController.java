package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.inventory.StockItemService;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.inventory.StockValuationResponse;
import com.avicare.livestock.inventory.dto.NotesUpdateRequest;
import com.avicare.livestock.inventory.dto.StockItemResponse;
import com.avicare.livestock.inventory.dto.ThresholdUpdateRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Stock items endpoints (Sprint B4-6). Stock rows are created implicitly (movement / PO reception),
 * so there is no direct POST; this controller exposes reads, the low-stock view, the farm
 * valuation, threshold/notes management and soft-delete.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/stock-items")
@RequiredArgsConstructor
public class StockItemController {

  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ_OR_CONSUME)
  public ApiResponse<List<StockItemResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        stockItemService.listForFarm(farmId).stream().map(StockItemResponse::from).toList());
  }

  @GetMapping("/low-stock")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<StockItemResponse>> lowStock(@PathVariable Long farmId) {
    return ApiResponse.of(
        stockItemService.listLowStock(farmId).stream().map(StockItemResponse::from).toList());
  }

  @GetMapping("/valuation")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<StockValuationResponse> valuation(@PathVariable Long farmId) {
    return ApiResponse.of(stockMovementService.getStockValuation(farmId));
  }

  @GetMapping("/{id}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<StockItemResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(StockItemResponse.from(stockItemService.get(farmId, id)));
  }

  @PutMapping("/{id}/threshold")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<StockItemResponse> updateThreshold(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid ThresholdUpdateRequest request) {
    return ApiResponse.of(
        StockItemResponse.from(
            stockItemService.updateThreshold(
                farmId, id, request.threshold(), TenancyContext.currentUserId())));
  }

  @PutMapping("/{id}/notes")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<StockItemResponse> updateNotes(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid NotesUpdateRequest request) {
    return ApiResponse.of(
        StockItemResponse.from(
            stockItemService.updateNotes(
                farmId, id, request.notes(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/deactivate")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void deactivate(@PathVariable Long farmId, @PathVariable Long id) {
    stockItemService.deactivate(farmId, id, TenancyContext.currentUserId());
  }
}
