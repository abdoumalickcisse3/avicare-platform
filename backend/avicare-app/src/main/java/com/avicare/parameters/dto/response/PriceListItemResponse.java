package com.avicare.parameters.dto.response;

import java.math.BigDecimal;

/** HTTP view of a price list item. */
public record PriceListItemResponse(
    Long id, String productKey, BigDecimal unitPrice, String currency) {}
