package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.inventory.PurchaseOrderReceiveCommand;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Receive a SENT purchase order (Sprint B4-6) — received quantity per order line. */
public record PurchaseOrderReceiveRequest(
    LocalDate actualDeliveryDate, @NotEmpty @Valid List<LineReceipt> lines) {

  @Schema(name = "PurchaseOrderLineReceipt")
  public record LineReceipt(
      @NotNull Long itemId, @NotNull @PositiveOrZero BigDecimal receivedQuantity) {

    PurchaseOrderReceiveCommand.LineReceipt toCommandLine() {
      return new PurchaseOrderReceiveCommand.LineReceipt(itemId, receivedQuantity);
    }
  }

  public PurchaseOrderReceiveCommand toCommand() {
    return new PurchaseOrderReceiveCommand(
        actualDeliveryDate, lines.stream().map(LineReceipt::toCommandLine).toList());
  }
}
