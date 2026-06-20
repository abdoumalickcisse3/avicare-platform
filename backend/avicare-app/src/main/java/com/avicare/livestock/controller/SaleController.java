package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.commercial.SaleService;
import com.avicare.livestock.commercial.dto.CancelRequest;
import com.avicare.livestock.commercial.dto.SaleRequest;
import com.avicare.livestock.commercial.dto.SaleResponse;
import com.avicare.livestock.domain.SaleStatus;
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
 * Direct sale endpoints (Sprint B5-5b). A sale is supervisory (OWNER/MANAGER): it decrements
 * PRODUCT stock immediately (D21). Reads for any farm member; cancel reverses the stock.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/commercial/sales")
@RequiredArgsConstructor
public class SaleController {

  private final SaleService saleService;

  @GetMapping
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<SaleResponse>> list(
      @PathVariable Long farmId, @RequestParam(required = false) SaleStatus status) {
    return ApiResponse.of(
        saleService.listForFarm(farmId, status).stream().map(SaleResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<SaleResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(SaleResponse.from(saleService.getById(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<SaleResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid SaleRequest request) {
    return ApiResponse.of(
        SaleResponse.from(
            saleService.create(farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PostMapping("/{id}/cancel")
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<SaleResponse> cancel(
      @PathVariable Long farmId, @PathVariable Long id, @RequestBody @Valid CancelRequest request) {
    return ApiResponse.of(
        SaleResponse.from(
            saleService.cancel(farmId, id, request.reason(), TenancyContext.currentUserId())));
  }
}
