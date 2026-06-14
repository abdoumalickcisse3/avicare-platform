package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.inventory.SupplierService;
import com.avicare.livestock.inventory.dto.SupplierRequest;
import com.avicare.livestock.inventory.dto.SupplierResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Per-farm supplier directory CRUD (Sprint B4-6). Soft-delete via {@code active=false}. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/suppliers")
@RequiredArgsConstructor
public class SupplierController {

  private final SupplierService supplierService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<SupplierResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        supplierService.listForFarm(farmId).stream().map(SupplierResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<SupplierResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(SupplierResponse.from(supplierService.get(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<SupplierResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid SupplierRequest request) {
    return ApiResponse.of(
        SupplierResponse.from(
            supplierService.create(farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PutMapping("/{id}")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<SupplierResponse> update(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid SupplierRequest request) {
    return ApiResponse.of(
        SupplierResponse.from(
            supplierService.update(
                farmId, id, request.toCommand(), TenancyContext.currentUserId())));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    supplierService.deactivate(farmId, id, TenancyContext.currentUserId());
  }
}
