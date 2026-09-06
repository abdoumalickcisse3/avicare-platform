package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.controller.dto.SupplierLedgerEntryRequest;
import com.avicare.livestock.controller.dto.SupplierLedgerEntryResponse;
import com.avicare.livestock.controller.dto.SupplierStatementResponse;
import com.avicare.livestock.inventory.SupplierBalance;
import com.avicare.livestock.inventory.SupplierLedgerCommand;
import com.avicare.livestock.inventory.SupplierLedgerService;
import com.avicare.livestock.inventory.SupplierStatementLine;
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

/** Le compte-courant fournisseur : solde, relevé, versements et dettes de carnet. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/suppliers")
@RequiredArgsConstructor
public class SupplierLedgerController {

  private final SupplierLedgerService supplierLedgerService;

  @GetMapping("/balances")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<List<SupplierBalance>> balances(@PathVariable Long farmId) {
    return ApiResponse.of(supplierLedgerService.balances(farmId));
  }

  @GetMapping("/{supplierId}/ledger")
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<SupplierStatementResponse> statement(
      @PathVariable Long farmId, @PathVariable Long supplierId) {
    List<SupplierStatementLine> lines = supplierLedgerService.statement(farmId, supplierId);
    return ApiResponse.of(
        new SupplierStatementResponse(
            supplierId,
            supplierLedgerService.balance(farmId, supplierId),
            lines.stream().map(SupplierLedgerEntryResponse::from).toList()));
  }

  @PostMapping("/{supplierId}/ledger/payments")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<Long> recordPayment(
      @PathVariable Long farmId,
      @PathVariable Long supplierId,
      @RequestBody @Valid SupplierLedgerEntryRequest request) {
    return ApiResponse.of(
        supplierLedgerService
            .recordPayment(farmId, supplierId, toCommand(request), TenancyContext.currentUserId())
            .getId());
  }

  @PostMapping("/{supplierId}/ledger/charges")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public ApiResponse<Long> recordCharge(
      @PathVariable Long farmId,
      @PathVariable Long supplierId,
      @RequestBody @Valid SupplierLedgerEntryRequest request) {
    return ApiResponse.of(
        supplierLedgerService
            .recordCharge(farmId, supplierId, toCommand(request), TenancyContext.currentUserId())
            .getId());
  }

  @DeleteMapping("/{supplierId}/ledger/entries/{entryId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(InventoryAccess.WRITE_MANAGER)
  public void deleteEntry(
      @PathVariable Long farmId, @PathVariable Long supplierId, @PathVariable Long entryId) {
    supplierLedgerService.deleteEntry(farmId, entryId);
  }

  private static SupplierLedgerCommand toCommand(SupplierLedgerEntryRequest r) {
    return new SupplierLedgerCommand(
        r.amountXof(),
        r.entryDate(),
        r.label(),
        r.method(),
        r.reference(),
        r.notes(),
        r.notifySupplier() == null || r.notifySupplier());
  }
}
