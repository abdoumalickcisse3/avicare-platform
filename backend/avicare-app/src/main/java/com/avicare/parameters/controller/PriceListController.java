package com.avicare.parameters.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.parameters.domain.PriceList;
import com.avicare.parameters.domain.PriceListItem;
import com.avicare.parameters.dto.request.CreatePriceListRequest;
import com.avicare.parameters.dto.request.PriceListItemRequest;
import com.avicare.parameters.dto.response.PriceListItemResponse;
import com.avicare.parameters.dto.response.PriceListResponse;
import com.avicare.parameters.service.PriceListService;
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
 * Farm price lists and their items. Reading needs farm access; mutating is restricted to
 * OWNER/MANAGER via the {@code @farmAccess} SpEL bean.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/price-lists")
@RequiredArgsConstructor
public class PriceListController {

  private final PriceListService priceListService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<PriceListResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        priceListService.listForFarm(farmId).stream()
            .map(PriceListController::toResponse)
            .toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<PriceListResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid CreatePriceListRequest request) {
    return ApiResponse.of(
        toResponse(
            priceListService.create(
                farmId,
                request.name(),
                request.isDefault(),
                request.validFrom(),
                request.validTo())));
  }

  @DeleteMapping("/{priceListId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public void delete(@PathVariable Long farmId, @PathVariable Long priceListId) {
    priceListService.delete(priceListId);
  }

  @GetMapping("/{priceListId}/items")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<PriceListItemResponse>> listItems(
      @PathVariable Long farmId, @PathVariable Long priceListId) {
    return ApiResponse.of(
        priceListService.listItems(priceListId).stream()
            .map(PriceListController::toItemResponse)
            .toList());
  }

  @PostMapping("/{priceListId}/items")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<PriceListItemResponse> upsertItem(
      @PathVariable Long farmId,
      @PathVariable Long priceListId,
      @RequestBody @Valid PriceListItemRequest request) {
    return ApiResponse.of(
        toItemResponse(
            priceListService.upsertItem(
                priceListId, request.productKey(), request.unitPrice(), request.currency())));
  }

  @DeleteMapping("/{priceListId}/items/{productKey}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public void removeItem(
      @PathVariable Long farmId, @PathVariable Long priceListId, @PathVariable String productKey) {
    priceListService.removeItem(priceListId, productKey);
  }

  private static PriceListResponse toResponse(PriceList list) {
    return new PriceListResponse(
        list.getId(), list.getName(), list.isDefaultList(), list.getValidFrom(), list.getValidTo());
  }

  private static PriceListItemResponse toItemResponse(PriceListItem item) {
    return new PriceListItemResponse(
        item.getId(), item.getProductKey(), item.getUnitPrice(), item.getCurrency());
  }
}
