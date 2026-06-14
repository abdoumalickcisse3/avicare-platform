package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.inventory.PurchaseOrderDraftCommand;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Create or fully replace a DRAFT purchase order (Sprint B4-6). The same payload backs both POST
 * (create) and PUT (update-while-draft).
 */
public record PurchaseOrderDraftRequest(
    @NotNull Long supplierId,
    LocalDate orderDate,
    LocalDate expectedDeliveryDate,
    @Size(max = 2000) String notes,
    @NotEmpty @Valid List<LineRequest> lines) {

  public record LineRequest(
      @NotBlank @Size(max = 80) String articleKey,
      @NotNull ArticleSource articleSource,
      @NotNull @Positive BigDecimal orderedQuantity,
      @NotNull @Positive Integer unitPriceXof,
      @Size(max = 500) String notes) {

    PurchaseOrderDraftCommand.Line toCommandLine() {
      return new PurchaseOrderDraftCommand.Line(
          articleKey, articleSource, orderedQuantity, unitPriceXof, notes);
    }
  }

  public PurchaseOrderDraftCommand toCommand() {
    return new PurchaseOrderDraftCommand(
        supplierId,
        orderDate,
        expectedDeliveryDate,
        notes,
        lines.stream().map(LineRequest::toCommandLine).toList());
  }
}
