package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.commercial.OrderService;
import com.avicare.livestock.commercial.dto.CancelRequest;
import com.avicare.livestock.commercial.dto.OrderDraftRequest;
import com.avicare.livestock.commercial.dto.OrderResponse;
import com.avicare.livestock.domain.OrderStatus;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sales order endpoints (Sprint B5-5): the strict 5-state workflow (D23). Creation and the field
 * transitions (confirm, start-preparation) are open to OWNER/MANAGER/FARMER; cancellation is
 * restricted to OWNER/MANAGER. Delivery (the DELIVERED transition) happens through the delivery
 * endpoint (B5-5b), not here.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/commercial/orders")
@RequiredArgsConstructor
public class OrderController {

  private final OrderService orderService;

  @GetMapping
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<OrderResponse>> list(
      @PathVariable Long farmId,
      @RequestParam(required = false) OrderStatus status,
      @RequestParam(required = false) Long clientId) {
    List<OrderResponse> orders =
        (clientId != null
                ? orderService.listForClient(farmId, clientId)
                : orderService.listForFarm(farmId, status))
            .stream().map(OrderResponse::from).toList();
    return ApiResponse.of(orders);
  }

  @GetMapping("/{id}")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<OrderResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(OrderResponse.from(orderService.getById(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_FARMER)
  public ApiResponse<OrderResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid OrderDraftRequest request) {
    return ApiResponse.of(
        OrderResponse.from(
            orderService.createDraft(farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/confirm")
  @PreAuthorize(CommercialAccess.WRITE_FARMER)
  public ApiResponse<OrderResponse> confirm(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(
        OrderResponse.from(orderService.confirm(farmId, id, TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/start-preparation")
  @PreAuthorize(CommercialAccess.WRITE_FARMER)
  public ApiResponse<OrderResponse> startPreparation(
      @PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(
        OrderResponse.from(
            orderService.markInProgress(farmId, id, TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/cancel")
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<OrderResponse> cancel(
      @PathVariable Long farmId, @PathVariable Long id, @RequestBody @Valid CancelRequest request) {
    return ApiResponse.of(
        OrderResponse.from(
            orderService.cancel(farmId, id, request.reason(), TenancyContext.currentUserId())));
  }
}
