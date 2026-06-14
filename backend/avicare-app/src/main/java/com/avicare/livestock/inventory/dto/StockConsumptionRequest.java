package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.inventory.StockConsumption;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Optional stock consumption attached to a source action's request body (Sprint B4-6, Décision
 * D18). Present only when the caller wants the action to draw from stock; maps to the service-side
 * {@link StockConsumption}. When the field is sent but {@code module.inventory} is inactive the
 * service rejects it with 422 (Option α).
 */
public record StockConsumptionRequest(
    @NotBlank @Size(max = 80) String articleKey,
    @NotNull ArticleSource articleSource,
    @NotNull @Positive BigDecimal quantity,
    @Size(max = 500) String notes) {

  public StockConsumption toModel() {
    return new StockConsumption(articleKey, articleSource, quantity, notes);
  }
}
