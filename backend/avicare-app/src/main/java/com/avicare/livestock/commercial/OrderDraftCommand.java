package com.avicare.livestock.commercial;

import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.ArticleSource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Input to create a PENDING sales order (Sprint B5-1). {@code orderDate} defaults to today when
 * null. Each line references a sellable catalog article (a PRODUCT-subcategory inventory item in
 * V1); its label and unit are snapshot at order time. {@code unitPriceXof} is HT only (D25). For
 * PRODUCTION lines, {@code productType} drives label/unit derivation; {@code productionUnitId} is
 * required for BROILER and forbidden for EGGS (D27).
 */
public record OrderDraftCommand(
    Long clientId,
    LocalDate orderDate,
    LocalDate expectedDeliveryDate,
    String deliveryAddress,
    String deliveryNotes,
    String expectedPaymentMethod,
    LocalDate expectedPaymentDueDate,
    String notes,
    List<Line> lines) {

  public record Line(
      String articleKey,
      ArticleSource articleSource,
      BigDecimal quantity,
      Integer unitPriceXof,
      String notes,
      Long productionUnitId,
      ProductType productType) {}
}
