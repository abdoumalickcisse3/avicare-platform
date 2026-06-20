package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleItem;
import com.avicare.livestock.domain.SaleStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** A direct sale with its lines embedded (Sprint B5-5). */
public record SaleResponse(
    Long id,
    Long farmId,
    String saleNumber,
    Long clientId,
    SaleStatus status,
    LocalDate saleDate,
    String paymentMethod,
    Long totalXof,
    String notes,
    List<Line> items) {

  public record Line(
      Long id,
      String articleKey,
      ArticleSource articleSource,
      String articleLabelSnapshot,
      String unit,
      BigDecimal quantity,
      Integer unitPriceXof,
      Long lineTotalXof,
      String notes) {

    static Line from(SaleItem i) {
      return new Line(
          i.getId(),
          i.getArticleKey(),
          i.getArticleSource(),
          i.getArticleLabelSnapshot(),
          i.getUnit(),
          i.getQuantity(),
          i.getUnitPriceXof(),
          i.getLineTotalXof(),
          i.getNotes());
    }
  }

  public static SaleResponse from(Sale s) {
    return new SaleResponse(
        s.getId(),
        s.getFarmId(),
        s.getSaleNumber(),
        s.getClient() != null ? s.getClient().getId() : null,
        s.getStatus(),
        s.getSaleDate(),
        s.getPaymentMethod(),
        s.getTotalXof(),
        s.getNotes(),
        s.getItems().stream().map(Line::from).toList());
  }
}
