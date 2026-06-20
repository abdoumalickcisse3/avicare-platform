package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.commercial.PaymentService;
import com.avicare.livestock.commercial.dto.CancelRequest;
import com.avicare.livestock.commercial.dto.PaymentRequest;
import com.avicare.livestock.commercial.dto.PaymentResponse;
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
 * Payment endpoints (Sprint B5-5c). A payment is received against one invoice (supervisory,
 * OWNER/MANAGER): it advances the invoice (PARTIALLY_PAID / PAID) and lowers the client receivable
 * (D26). Voiding reverses both. Reads for any member ({@code ?invoiceId} filters to one invoice).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/commercial/payments")
@RequiredArgsConstructor
public class PaymentController {

  private final PaymentService paymentService;

  @GetMapping
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<PaymentResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) Long invoiceId) {
    return ApiResponse.of(
        (invoiceId != null
                ? paymentService.listForInvoice(farmId, invoiceId)
                : paymentService.listForFarm(farmId))
            .stream().map(PaymentResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<PaymentResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(PaymentResponse.from(paymentService.getById(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<PaymentResponse> record(
      @PathVariable Long farmId, @RequestBody @Valid PaymentRequest request) {
    return ApiResponse.of(
        PaymentResponse.from(
            paymentService.record(farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/void")
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<PaymentResponse> voidPayment(
      @PathVariable Long farmId, @PathVariable Long id, @RequestBody @Valid CancelRequest request) {
    return ApiResponse.of(
        PaymentResponse.from(
            paymentService.voidPayment(
                farmId, id, request.reason(), TenancyContext.currentUserId())));
  }
}
