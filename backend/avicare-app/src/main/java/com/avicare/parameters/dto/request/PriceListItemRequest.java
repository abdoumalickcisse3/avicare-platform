package com.avicare.parameters.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Upsert a priced product in a price list. Currency defaults to XOF when blank. */
public record PriceListItemRequest(
    @NotBlank @Size(max = 100) String productKey,
    @NotNull @PositiveOrZero BigDecimal unitPrice,
    @Size(max = 3) String currency) {}
