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
 * disables. Reading needs the {@code settings:read} permission; mutating is restricted to
 * OWNER/MANAGER.
 *
 * <p>Module-gated categories (health: vaccines/treatments/programs) additionally require the
 * relevant {@code module.health.*} feature — this generic route reaches the same {@code
 * catalog_items} as {@code HealthCatalogController}, so without {@link #MODULE_GATE} it could be
 * used to bypass that module gate. See {@link com.avicare.parameters.access.CatalogGate}.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/catalog/{category}")
@RequiredArgsConstructor
public class FarmCatalogController {

  /**
   * SpEL fragment enforcing the feature module a category is gated behind, reusing the shared {@code
   * @features} bean. Categories with no module requirement ({@code moduleFor == null}) pass freely.
   */
  private static final String MODULE_GATE =
      " and (@catalogGate.moduleFor(#category) == null"
          + " or @features.isEnabled(#farmId, @catalogGate.moduleFor(#category)))";

  private final CatalogService catalogService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasPermission(#farmId, 'settings:read')" + MODULE_GATE)
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
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)"
          + MODULE_GATE)
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
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)"
          + MODULE_GATE)
  public void disable(
      @PathVariable Long farmId, @PathVariable String category, @PathVariable String key) {
    catalogService.disable(farmId, category, key);
  }
}
