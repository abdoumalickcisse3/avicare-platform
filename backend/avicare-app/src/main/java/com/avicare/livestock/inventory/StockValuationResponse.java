package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.ArticleSource;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;

/**
 * Current stock valuation of a farm (Sprint B4-2): per active priced article, {@code
 * currentQuantity × typicalUnitPriceXof}, plus the grand total. Articles without a snapshot price
 * are skipped.
 */
public record StockValuationResponse(List<Item> items, long totalValueXof) {

  @Schema(name = "StockValuationItem")
  public record Item(
      Long stockItemId,
      String articleKey,
      ArticleSource articleSource,
      BigDecimal currentQuantity,
      Integer unitPriceXof,
      long valueXof) {}
}
