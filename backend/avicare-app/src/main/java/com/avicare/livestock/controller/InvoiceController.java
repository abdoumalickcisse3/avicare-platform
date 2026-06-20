package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.commercial.InvoiceService;
import com.avicare.livestock.commercial.dto.CancelRequest;
import com.avicare.livestock.commercial.dto.InvoiceFromDeliveryRequest;
import com.avicare.livestock.commercial.dto.InvoiceFromSaleRequest;
import com.avicare.livestock.commercial.dto.InvoiceResponse;
import com.avicare.livestock.domain.InvoiceStatus;
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
 * Invoice endpoints (Sprint B5-5c). Invoices are generated from a sale or a delivery (supervisory,
 * OWNER/MANAGER) and raise the client's receivable (D26). Reads for any member; {@code /overdue}
 * lists unpaid invoices past due (derived). Cancel reverses the outstanding receivable.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/commercial/invoices")
@RequiredArgsConstructor
public class InvoiceController {

  private final InvoiceService invoiceService;

  @GetMapping
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<InvoiceResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) InvoiceStatus status) {
    return ApiResponse.of(
        invoiceService.listForFarm(farmId, status).stream().map(InvoiceResponse::from).toList());
  }

  @GetMapping("/overdue")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<InvoiceResponse>> overdue(@PathVariable Long farmId) {
    return ApiResponse.of(
        invoiceService.listOverdue(farmId).stream().map(InvoiceResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<InvoiceResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(InvoiceResponse.from(invoiceService.getById(farmId, id)));
  }

  @PostMapping("/from-sale")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<InvoiceResponse> fromSale(
      @PathVariable Long farmId, @RequestBody @Valid InvoiceFromSaleRequest request) {
    return ApiResponse.of(
        InvoiceResponse.from(
            invoiceService.createFromSale(
                farmId, request.saleId(), request.dueDate(), TenancyContext.currentUserId())));
  }

  @PostMapping("/from-delivery")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<InvoiceResponse> fromDelivery(
      @PathVariable Long farmId, @RequestBody @Valid InvoiceFromDeliveryRequest request) {
    return ApiResponse.of(
        InvoiceResponse.from(
            invoiceService.createFromDelivery(
                farmId, request.deliveryId(), request.dueDate(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/cancel")
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<InvoiceResponse> cancel(
      @PathVariable Long farmId, @PathVariable Long id, @RequestBody @Valid CancelRequest request) {
    return ApiResponse.of(
        InvoiceResponse.from(
            invoiceService.cancel(farmId, id, request.reason(), TenancyContext.currentUserId())));
  }
}
