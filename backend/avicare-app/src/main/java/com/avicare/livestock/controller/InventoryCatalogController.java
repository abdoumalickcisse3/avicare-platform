package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.inventory.FeedFormulaService;
import com.avicare.livestock.inventory.InventoryCatalogItemDto;
import com.avicare.livestock.inventory.InventoryCatalogService;
import com.avicare.livestock.inventory.PlatformFormulaDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inventory catalog browsing (Sprint B4-6): the platform articles a farm can stock and the platform
 * feed-formula templates it can clone. Read-only, gated behind {@code module.inventory}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/catalog")
@RequiredArgsConstructor
public class InventoryCatalogController {

  private final InventoryCatalogService catalogService;
  private final FeedFormulaService feedFormulaService;

  /** Platform inventory articles (feed, supplies…). */
  @GetMapping("/articles")
  @PreAuthorize(InventoryAccess.READ_OR_CONSUME)
  public ApiResponse<List<InventoryCatalogItemDto>> articles(@PathVariable Long farmId) {
    return ApiResponse.of(catalogService.listInventoryArticles(farmId));
  }

  /** All stockable articles: inventory items ∪ medications referenced from the health catalog. */
  @GetMapping("/articles/all")
  @PreAuthorize(InventoryAccess.READ_OR_CONSUME)
  public ApiResponse<List<InventoryCatalogItemDto>> allArticles(@PathVariable Long farmId) {
    return ApiResponse.of(catalogService.listAllAvailableArticles(farmId));
  }

  /** Platform feed-formula templates (the source for cloning). */
  @GetMapping("/feed-formulas")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<PlatformFormulaDto>> platformFormulas(@PathVariable Long farmId) {
    return ApiResponse.of(feedFormulaService.listPlatformFormulas(farmId));
  }

  /** A single platform feed-formula template by key. */
  @GetMapping("/feed-formulas/{key}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<PlatformFormulaDto> platformFormula(
      @PathVariable Long farmId, @PathVariable String key) {
    return ApiResponse.of(feedFormulaService.getPlatformFormula(farmId, key));
  }
}
