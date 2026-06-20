package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.commercial.DeliveryService;
import com.avicare.livestock.commercial.dto.CancelRequest;
import com.avicare.livestock.commercial.dto.DeliveryFromOrderRequest;
import com.avicare.livestock.commercial.dto.DeliveryResponse;
import com.avicare.livestock.domain.DeliveryStatus;
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
 * Delivery endpoints (Sprint B5-5b). A delivery converts an in-progress order (field op,
 * OWNER/MANAGER/FARMER): it decrements stock (D21) and marks the order DELIVERED. Cancel (reverses
 * stock + reopens the order) is supervisory (OWNER/MANAGER).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/commercial/deliveries")
@RequiredArgsConstructor
public class DeliveryController {

  private final DeliveryService deliveryService;

  @GetMapping
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<DeliveryResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) DeliveryStatus status) {
    return ApiResponse.of(
        deliveryService.listForFarm(farmId, status).stream().map(DeliveryResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<DeliveryResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(DeliveryResponse.from(deliveryService.getById(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_FARMER)
  public ApiResponse<DeliveryResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid DeliveryFromOrderRequest request) {
    return ApiResponse.of(
        DeliveryResponse.from(
            deliveryService.createFromOrder(
                farmId, request.orderId(), request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/cancel")
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<DeliveryResponse> cancel(
      @PathVariable Long farmId, @PathVariable Long id, @RequestBody @Valid CancelRequest request) {
    return ApiResponse.of(
        DeliveryResponse.from(
            deliveryService.cancel(farmId, id, request.reason(), TenancyContext.currentUserId())));
  }
}
