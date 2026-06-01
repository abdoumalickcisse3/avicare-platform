package com.avicare.parameters.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.parameters.dto.request.CatalogOverrideRequest;
import com.avicare.parameters.dto.response.CatalogEntryResponse;
import com.avicare.parameters.service.CatalogService;
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
 * Farm-level catalog: the effective list (platform + customizations) and a farm's overrides /
 * disables. Reading needs farm access; mutating is restricted to OWNER/MANAGER.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/catalog/{category}")
@RequiredArgsConstructor
public class FarmCatalogController {

  private final CatalogService catalogService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<CatalogEntryResponse>> list(
      @PathVariable Long farmId, @PathVariable String category) {
    List<CatalogEntryResponse> entries =
        catalogService.listForFarm(farmId, category).stream()
            .map(e -> new CatalogEntryResponse(e.category(), e.key(), e.value(), e.custom()))
            .toList();
    return ApiResponse.of(entries);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<CatalogEntryResponse> override(
      @PathVariable Long farmId,
      @PathVariable String category,
      @RequestBody @Valid CatalogOverrideRequest request) {
    var saved = catalogService.override(farmId, category, request.key(), request.value());
    return ApiResponse.of(
        new CatalogEntryResponse(
            saved.getCategory(),
            saved.getKey(),
            saved.getValue(),
            saved.getCatalogItemId() == null));
  }

  @DeleteMapping("/{key}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public void disable(
      @PathVariable Long farmId, @PathVariable String category, @PathVariable String key) {
    catalogService.disable(farmId, category, key);
  }
}
