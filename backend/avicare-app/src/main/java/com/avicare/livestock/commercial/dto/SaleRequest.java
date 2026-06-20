package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.commercial.SaleCommand;
import com.avicare.livestock.domain.ArticleSource;
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

/** Record a direct sale (Sprint B5-5). {@code clientId} optional (walk-in cash sale). */
public record SaleRequest(
    Long clientId,
    LocalDate saleDate,
    @Size(max = 40) String paymentMethod,
    @Size(max = 2000) String notes,
    @NotEmpty @Valid List<LineRequest> lines) {

  public record LineRequest(
      @NotBlank @Size(max = 80) String articleKey,
      @NotNull ArticleSource articleSource,
      @NotNull @Positive BigDecimal quantity,
      @NotNull @PositiveOrZero Integer unitPriceXof,
      @Size(max = 500) String notes) {

    SaleCommand.Line toCommandLine() {
      return new SaleCommand.Line(articleKey, articleSource, quantity, unitPriceXof, notes);
    }
  }

  public SaleCommand toCommand() {
    return new SaleCommand(
        clientId,
        saleDate,
        paymentMethod,
        notes,
        lines.stream().map(LineRequest::toCommandLine).toList());
  }
}
