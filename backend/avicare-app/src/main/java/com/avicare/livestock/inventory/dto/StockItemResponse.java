package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.StockItem;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * A farm's stock of one article (Sprint B4-6). The row only stores the article KEY; {@code label}
 * is resolved from the catalog at read time (a stock row carries no label snapshot) so clients stop
 * showing technical keys like {@code feed_starter_broiler}. It is null when the catalog no longer
 * knows that key.
 */
public record StockItemResponse(
    Long id,
    Long farmId,
    String articleKey,
    String label,
    ArticleSource articleSource,
    BigDecimal currentQuantity,
    String unit,
    BigDecimal alertThreshold,
    Integer typicalUnitPriceXof,
    LocalDateTime lastMovementAt,
    boolean active,
    String notes) {

  public static StockItemResponse from(StockItem s, Map<String, String> labels) {
    return new StockItemResponse(
        s.getId(),
        s.getFarmId(),
        s.getArticleKey(),
        labels.get(s.getArticleKey()),
        s.getArticleSource(),
        s.getCurrentQuantity(),
        s.getUnit(),
        s.getAlertThreshold(),
        s.getTypicalUnitPriceXof(),
        s.getLastMovementAt(),
        s.isActive(),
        s.getNotes());
  }
}
