package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.StockItem;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A farm's stock of one article (Sprint B4-6). */
public record StockItemResponse(
    Long id,
    Long farmId,
    String articleKey,
    ArticleSource articleSource,
    BigDecimal currentQuantity,
    String unit,
    BigDecimal alertThreshold,
    Integer typicalUnitPriceXof,
    LocalDateTime lastMovementAt,
    boolean active,
    String notes) {

  public static StockItemResponse from(StockItem s) {
    return new StockItemResponse(
        s.getId(),
        s.getFarmId(),
        s.getArticleKey(),
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
