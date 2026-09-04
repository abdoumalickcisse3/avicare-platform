package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.PurchaseOrder;
import com.avicare.livestock.domain.PurchaseOrderItem;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** A purchase order with its lines embedded (Sprint B4-6). */
public record PurchaseOrderResponse(
    Long id,
    Long farmId,
    String orderNumber,
    Long supplierId,
    String supplierName,
    PurchaseOrderStatus status,
    LocalDate orderDate,
    LocalDate expectedDeliveryDate,
    LocalDate actualDeliveryDate,
    Long totalXof,
    String notes,
    List<Line> items) {

  @Schema(name = "PurchaseOrderLine")
  public record Line(
      Long id,
      String articleKey,
      ArticleSource articleSource,
      String articleLabelSnapshot,
      String unit,
      BigDecimal orderedQuantity,
      BigDecimal receivedQuantity,
      Integer unitPriceXof,
      Long lineTotalXof,
      String notes) {

    static Line from(PurchaseOrderItem i) {
      return new Line(
          i.getId(),
          i.getArticleKey(),
          i.getArticleSource(),
          i.getArticleLabelSnapshot(),
          i.getUnit(),
          i.getOrderedQuantity(),
          i.getReceivedQuantity(),
          i.getUnitPriceXof(),
          i.getLineTotalXof(),
          i.getNotes());
    }
  }

  public static PurchaseOrderResponse from(PurchaseOrder po) {
    return new PurchaseOrderResponse(
        po.getId(),
        po.getFarmId(),
        po.getOrderNumber(),
        po.getSupplier().getId(),
        po.getSupplier().getCommercialName(),
        po.getStatus(),
        po.getOrderDate(),
        po.getExpectedDeliveryDate(),
        po.getActualDeliveryDate(),
        po.getTotalXof(),
        po.getNotes(),
        po.getItems().stream().map(Line::from).toList());
  }
}
