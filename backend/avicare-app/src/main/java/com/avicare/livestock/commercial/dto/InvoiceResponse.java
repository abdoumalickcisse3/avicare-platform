package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceItem;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** An invoice with its lines embedded (Sprint B5-5). */
public record InvoiceResponse(
    Long id,
    Long farmId,
    String invoiceNumber,
    Long clientId,
    InvoiceSourceType sourceType,
    Long saleId,
    Long deliveryId,
    InvoiceStatus status,
    LocalDate issueDate,
    LocalDate dueDate,
    Long totalXof,
    Long amountPaidXof,
    long outstandingXof,
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

    static Line from(InvoiceItem i) {
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

  public static InvoiceResponse from(Invoice i) {
    return new InvoiceResponse(
        i.getId(),
        i.getFarmId(),
        i.getInvoiceNumber(),
        i.getClient() != null ? i.getClient().getId() : null,
        i.getSourceType(),
        i.getSaleId(),
        i.getDeliveryId(),
        i.getStatus(),
        i.getIssueDate(),
        i.getDueDate(),
        i.getTotalXof(),
        i.getAmountPaidXof(),
        i.outstandingXof(),
        i.getNotes(),
        i.getItems().stream().map(Line::from).toList());
  }
}
