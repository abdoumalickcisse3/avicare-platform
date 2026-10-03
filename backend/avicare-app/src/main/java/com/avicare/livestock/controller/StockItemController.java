package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.inventory.InventoryCatalogService;
import com.avicare.livestock.inventory.StockItemService;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.inventory.StockValuationResponse;
import com.avicare.livestock.inventory.dto.NotesUpdateRequest;
import com.avicare.livestock.inventory.dto.StockItemResponse;
import com.avicare.livestock.inventory.dto.ThresholdUpdateRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
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
 * Stock items endpoints (Sprint B4-6). Stock rows are created implicitly, so there is no direct
 * POST; this controller exposes reads, the low-stock view, the farm valuation, threshold/notes
 * management and soft-delete.
 *
 * <p>The list endpoint first materializes the farm's configured-but-never-stocked articles (see
 * {@link StockItemService#syncCatalogArticles}). It is a write on a GET, which the rest of the
 * codebase avoids — deliberately: the inventory context owns stock rows and the catalog lives in
 * {@code parameters}, so having a catalog write call back into inventory would invert the context
 * dependency (doc 00). Doing it on the read keeps the dependency pointing the right way and also
 * repairs farms created before this change, with no backfill migration. Two concurrent readers can
 * race on the {@code (farm, source, key)} unique index; the loser's insert is swallowed because the
 * winner has already put the rows in place.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/stock-items")
@RequiredArgsConstructor
public class StockItemController {

  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;
  private final InventoryCatalogService inventoryCatalogService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ_OR_CONSUME)
  public ApiResponse<List<StockItemResponse>> list(@PathVariable Long farmId) {
    try {
      stockItemService.syncCatalogArticles(farmId, TenancyContext.currentUserId());
    } catch (DataIntegrityViolationException concurrentReaderWon) {
      // The rows are there either way; listing them is the point.
    }
    Map<String, String> labels = inventoryCatalogService.labelsByKey(farmId);
    return ApiResponse.of(
        stockItemService.listForFarm(farmId).stream()
            .map(s -> StockItemResponse.from(s, labels))
            .toList());
  }

  @GetMapping("/low-stock")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<StockItemResponse>> lowStock(@PathVariable Long farmId) {
    Map<String, String> labels = inventoryCatalogService.labelsByKey(farmId);
    return ApiResponse.of(
        stockItemService.listLowStock(farmId).stream()
            .map(s -> StockItemResponse.from(s, labels))
            .toList());
  }

  @GetMapping("/valuation")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<StockValuationResponse> valuation(@PathVariable Long farmId) {
    return ApiResponse.of(stockMovementService.getStockValuation(farmId));
  }

  @GetMapping("/{id}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<StockItemResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(
        StockItemResponse.from(
            stockItemService.get(farmId, id), inventoryCatalogService.labelsByKey(farmId)));
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
                farmId, id, request.threshold(), TenancyContext.currentUserId()),
            inventoryCatalogService.labelsByKey(farmId)));
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
                farmId, id, request.notes(), TenancyContext.currentUserId()),
            inventoryCatalogService.labelsByKey(farmId)));
  }

  @PostMapping("/{id}/deactivate")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void deactivate(@PathVariable Long farmId, @PathVariable Long id) {
    stockItemService.deactivate(farmId, id, TenancyContext.currentUserId());
  }
}
