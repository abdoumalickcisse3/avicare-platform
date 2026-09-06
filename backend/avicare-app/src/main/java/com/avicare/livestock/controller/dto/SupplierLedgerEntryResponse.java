package com.avicare.livestock.controller.dto;

import com.avicare.livestock.inventory.SupplierStatementLine;
import java.time.LocalDate;

/** Une ligne de relevé telle que l'interface la lit. */
public record SupplierLedgerEntryResponse(
    Long id,
    LocalDate entryDate,
    String direction,
    String source,
    long amountXof,
    String label,
    String method,
    String reference,
    Long purchaseOrderId,
    long runningBalanceXof) {

  public static SupplierLedgerEntryResponse from(SupplierStatementLine line) {
    return new SupplierLedgerEntryResponse(
        line.id(),
        line.entryDate(),
        line.direction().name(),
        line.source().name(),
        line.amountXof(),
        line.label(),
        line.method(),
        line.reference(),
        line.purchaseOrderId(),
        line.runningBalanceXof());
  }
}
