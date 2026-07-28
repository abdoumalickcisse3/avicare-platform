package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.inventory.FeedFormulaService;
import com.avicare.livestock.inventory.dto.CloneFormulaRequest;
import com.avicare.livestock.inventory.dto.FeedFormulaRequest;
import com.avicare.livestock.inventory.dto.FeedFormulaResponse;
import com.avicare.livestock.inventory.dto.FeedFormulasAvailableResponse;
import jakarta.validation.Valid;
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
 * Farm feed-formula endpoints (Sprint B4-6): list the formulas a farm can use (platform templates +
 * its own), and manage its own — create from scratch, clone a template, update, recompute the cost,
 * soft-delete.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/feed-formulas")
@RequiredArgsConstructor
public class FeedFormulaController {

  private final FeedFormulaService feedFormulaService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ_OR_CONSUME)
  public ApiResponse<FeedFormulasAvailableResponse> listAvailable(@PathVariable Long farmId) {
    return ApiResponse.of(
        FeedFormulasAvailableResponse.from(feedFormulaService.listAllAvailable(farmId)));
  }

  @GetMapping("/{id}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<FeedFormulaResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(FeedFormulaResponse.from(feedFormulaService.get(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<FeedFormulaResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid FeedFormulaRequest request) {
    return ApiResponse.of(
        FeedFormulaResponse.from(
            feedFormulaService.createFromScratch(
                farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/clone")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<FeedFormulaResponse> clone(
      @PathVariable Long farmId, @RequestBody @Valid CloneFormulaRequest request) {
    return ApiResponse.of(
        FeedFormulaResponse.from(
            feedFormulaService.cloneFromPlatform(
                farmId,
                request.sourceFormulaKey(),
                request.newName(),
                TenancyContext.currentUserId())));
  }

  @PutMapping("/{id}")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<FeedFormulaResponse> update(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid FeedFormulaRequest request) {
    return ApiResponse.of(
        FeedFormulaResponse.from(
            feedFormulaService.update(
                farmId, id, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/recompute-cost")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<FeedFormulaResponse> recomputeCost(
      @PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(
        FeedFormulaResponse.from(
            feedFormulaService.recomputeCost(farmId, id, TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/deactivate")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void deactivate(@PathVariable Long farmId, @PathVariable Long id) {
    feedFormulaService.deactivate(farmId, id, TenancyContext.currentUserId());
  }
}
