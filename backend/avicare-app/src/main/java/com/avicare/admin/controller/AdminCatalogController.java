package com.avicare.admin.controller;

import com.avicare.admin.dto.request.UpsertCatalogItemRequest;
import com.avicare.admin.dto.response.AdminCatalogCategory;
import com.avicare.admin.dto.response.AdminCatalogItemRow;
import com.avicare.admin.service.AdminCatalogService;
import com.avicare.common.api.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform reference data, editable without a migration (console Phase 2).
 *
 * <p>One permission for reading and writing: {@code catalog:write}. There is nothing sensitive to
 * read here — it is the platform's own vocabulary — and a separate read verb would only be a right
 * nobody would ever grant alone.
 */
@RestController
@RequestMapping("/api/v1/admin/catalog")
@RequiredArgsConstructor
public class AdminCatalogController {

  private final AdminCatalogService catalogService;

  @GetMapping("/categories")
  @PreAuthorize("@adminAccess.can('catalog:write')")
  public ApiResponse<List<AdminCatalogCategory>> categories() {
    return ApiResponse.of(catalogService.categories());
  }

  @GetMapping
  @PreAuthorize("@adminAccess.can('catalog:write')")
  public ApiResponse<List<AdminCatalogItemRow>> items(@RequestParam String category) {
    return ApiResponse.of(catalogService.itemsOf(category));
  }

  @PostMapping
  @PreAuthorize("@adminAccess.can('catalog:write')")
  public ApiResponse<AdminCatalogItemRow> create(
      @RequestBody @Valid UpsertCatalogItemRequest request) {
    return ApiResponse.of(catalogService.create(request));
  }

  @PutMapping("/{id}")
  @PreAuthorize("@adminAccess.can('catalog:write')")
  public ApiResponse<AdminCatalogItemRow> update(
      @PathVariable Long id, @RequestBody @Valid UpsertCatalogItemRequest request) {
    return ApiResponse.of(catalogService.update(id, request));
  }
}
