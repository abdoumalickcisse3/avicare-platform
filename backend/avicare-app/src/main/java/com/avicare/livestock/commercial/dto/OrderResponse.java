package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderItem;
import com.avicare.livestock.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** A sales order with its lines embedded (Sprint B5-5). */
public record OrderResponse(
    Long id,
    Long farmId,
    String orderNumber,
    Long clientId,
    OrderStatus status,
    LocalDate orderDate,
    LocalDate expectedDeliveryDate,
    LocalDate actualDeliveryDate,
    String deliveryAddress,
    String deliveryNotes,
    String expectedPaymentMethod,
    String salesChannelKey,
    LocalDate expectedPaymentDueDate,
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

    static Line from(OrderItem i) {
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

  public static OrderResponse from(Order o) {
    return new OrderResponse(
        o.getId(),
        o.getFarmId(),
        o.getOrderNumber(),
        o.getClient() != null ? o.getClient().getId() : null,
        o.getStatus(),
        o.getOrderDate(),
        o.getExpectedDeliveryDate(),
        o.getActualDeliveryDate(),
        o.getDeliveryAddress(),
        o.getDeliveryNotes(),
        o.getExpectedPaymentMethod(),
        o.getSalesChannelKey(),
        o.getExpectedPaymentDueDate(),
        o.getTotalXof(),
        o.getNotes(),
        o.getItems().stream().map(Line::from).toList());
  }
}
