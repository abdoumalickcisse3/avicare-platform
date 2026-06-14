package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.ArticleSource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Input to create or fully replace a DRAFT purchase order (Sprint B4-3). {@code orderDate} defaults
 * to today when null. Each line references a catalog article (inventory item or medication); its
 * label and unit are snapshot at order time.
 */
public record PurchaseOrderDraftCommand(
    Long supplierId,
    LocalDate orderDate,
    LocalDate expectedDeliveryDate,
    String notes,
    List<Line> lines) {

  public record Line(
      String articleKey,
      ArticleSource articleSource,
      BigDecimal orderedQuantity,
      Integer unitPriceXof,
      String notes) {}
}
