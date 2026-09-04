package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.commercial.OrderDraftCommand;
import com.avicare.livestock.domain.ArticleSource;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Create a sales order (Sprint B5-5). */
public record OrderDraftRequest(
    @NotNull Long clientId,
    LocalDate orderDate,
    LocalDate expectedDeliveryDate,
    @Size(max = 2000) String deliveryAddress,
    @Size(max = 2000) String deliveryNotes,
    @Size(max = 40) String expectedPaymentMethod,
    @Size(max = 80) String salesChannelKey,
    LocalDate expectedPaymentDueDate,
    @Size(max = 2000) String notes,
    @NotEmpty @Valid List<LineRequest> lines) {

  @Schema(name = "OrderLineRequest")
  public record LineRequest(
      @NotBlank @Size(max = 80) String articleKey,
      @NotNull ArticleSource articleSource,
      @NotNull @Positive BigDecimal quantity,
      @NotNull @PositiveOrZero Integer unitPriceXof,
      @Size(max = 500) String notes,
      Long productionUnitId,
      ProductType productType) {

    OrderDraftCommand.Line toCommandLine() {
      return new OrderDraftCommand.Line(
          articleKey, articleSource, quantity, unitPriceXof, notes, productionUnitId, productType);
    }
  }

  public OrderDraftCommand toCommand() {
    return new OrderDraftCommand(
        clientId,
        orderDate,
        expectedDeliveryDate,
        deliveryAddress,
        deliveryNotes,
        expectedPaymentMethod,
        salesChannelKey,
        expectedPaymentDueDate,
        notes,
        lines.stream().map(LineRequest::toCommandLine).toList());
  }
}
