package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import com.avicare.livestock.inventory.PurchaseOrderService;
import com.avicare.livestock.inventory.dto.PurchaseOrderCancelRequest;
import com.avicare.livestock.inventory.dto.PurchaseOrderDraftRequest;
import com.avicare.livestock.inventory.dto.PurchaseOrderReceiveRequest;
import com.avicare.livestock.inventory.dto.PurchaseOrderResponse;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Purchase order workflow endpoints (Sprint B4-6): {@code DRAFT → SENT → RECEIVED}, plus cancel.
 * Reception cascades to stock (IN movements) in the service. Drafts are editable only while DRAFT.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

  private final PurchaseOrderService purchaseOrderService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<PurchaseOrderResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) PurchaseOrderStatus status) {
    return ApiResponse.of(
        purchaseOrderService.listForFarm(farmId, status).stream()
            .map(PurchaseOrderResponse::from)
            .toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<PurchaseOrderResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(PurchaseOrderResponse.from(purchaseOrderService.getById(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<PurchaseOrderResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid PurchaseOrderDraftRequest request) {
    return ApiResponse.of(
        PurchaseOrderResponse.from(
            purchaseOrderService.createDraft(
                farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PutMapping("/{id}")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<PurchaseOrderResponse> update(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid PurchaseOrderDraftRequest request) {
    return ApiResponse.of(
        PurchaseOrderResponse.from(
            purchaseOrderService.updateDraft(
                farmId, id, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/submit")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<PurchaseOrderResponse> submit(
      @PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(
        PurchaseOrderResponse.from(
            purchaseOrderService.submitToSupplier(farmId, id, TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/receive")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<PurchaseOrderResponse> receive(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid PurchaseOrderReceiveRequest request) {
    return ApiResponse.of(
        PurchaseOrderResponse.from(
            purchaseOrderService.receive(
                farmId, id, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/cancel")
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<PurchaseOrderResponse> cancel(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody(required = false) @Valid PurchaseOrderCancelRequest request) {
    String reason = request != null ? request.reason() : null;
    return ApiResponse.of(
        PurchaseOrderResponse.from(
            purchaseOrderService.cancel(farmId, id, reason, TenancyContext.currentUserId())));
  }
}
