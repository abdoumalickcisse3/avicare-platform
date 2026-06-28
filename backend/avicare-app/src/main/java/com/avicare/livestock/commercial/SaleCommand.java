package com.avicare.livestock.commercial;

import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.ArticleSource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Input to record a direct sale (Sprint B5-2). {@code clientId} is OPTIONAL (null = a walk-in cash
 * sale). {@code saleDate} defaults to today when null. Each line references a sellable
 * PRODUCT-subcategory article; its label and unit are snapshot at sale time. {@code unitPriceXof}
 * is HT only (D25). For PRODUCTION lines, {@code productType} drives label/unit derivation; {@code
 * productionUnitId} is required for BROILER and forbidden for EGGS (D27).
 */
public record SaleCommand(
    Long clientId, LocalDate saleDate, String paymentMethod, String notes, List<Line> lines) {

  public record Line(
      String articleKey,
      ArticleSource articleSource,
      BigDecimal quantity,
      Integer unitPriceXof,
      String notes,
      Long productionUnitId,
      ProductType productType) {}
}
