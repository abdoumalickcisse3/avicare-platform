package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryItem;
import com.avicare.livestock.domain.DeliveryStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** A delivery with its lines embedded (Sprint B5-5). */
public record DeliveryResponse(
    Long id,
    Long farmId,
    String deliveryNumber,
    Long orderId,
    Long clientId,
    DeliveryStatus status,
    LocalDate deliveryDate,
    String carrier,
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

    static Line from(DeliveryItem i) {
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

  public static DeliveryResponse from(Delivery d) {
    return new DeliveryResponse(
        d.getId(),
        d.getFarmId(),
        d.getDeliveryNumber(),
        d.getOrder() != null ? d.getOrder().getId() : null,
        d.getClient() != null ? d.getClient().getId() : null,
        d.getStatus(),
        d.getDeliveryDate(),
        d.getCarrier(),
        d.getTotalXof(),
        d.getNotes(),
        d.getItems().stream().map(Line::from).toList());
  }
}
