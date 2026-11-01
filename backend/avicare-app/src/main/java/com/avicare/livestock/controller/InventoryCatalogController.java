package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.inventory.FeedFormulaService;
import com.avicare.livestock.inventory.InventoryCatalogItemDto;
import com.avicare.livestock.inventory.InventoryCatalogService;
import com.avicare.livestock.inventory.MedicationCatalogService;
import com.avicare.livestock.inventory.MedicationDto;
import com.avicare.livestock.inventory.PlatformFormulaDto;
import com.avicare.livestock.inventory.dto.MedicationRequest;
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
 * Inventory catalog (Sprint B4-6): the platform articles a farm can stock and the platform
 * feed-formula templates it can clone — plus the medication write route (ADR-020), the one place
 * that declares a medication on both of its faces at once. Gated behind {@code module.inventory}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/catalog")
@RequiredArgsConstructor
public class InventoryCatalogController {

  private final InventoryCatalogService catalogService;
  private final FeedFormulaService feedFormulaService;
  private final MedicationCatalogService medicationCatalogService;

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

  /**
   * Create or update a medication as one product (ADR-020): the stock article the farmer buys
   * against and the medical sheet the treatment form reads, written together under one key.
   *
   * <p>Gated on {@code module.inventory} because the stock article always lands; the medical sheet
   * is gated on {@code module.health.advanced} inside {@link MedicationCatalogService}, and the
   * response says whether it was written.
   */
  @PostMapping("/medications")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<MedicationDto> saveMedication(
      @PathVariable Long farmId, @RequestBody @Valid MedicationRequest request) {
    return ApiResponse.of(medicationCatalogService.save(farmId, request.toCommand()));
  }

  /** Hide a medication from both faces. */
  @DeleteMapping("/medications/{key}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void deleteMedication(@PathVariable Long farmId, @PathVariable String key) {
    medicationCatalogService.delete(farmId, key);
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
