package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryItem;
import com.avicare.livestock.domain.DeliveryStatus;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceItem;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleItem;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.repository.DeliveryRepository;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.SaleRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Invoices (Sprint B5-3). An invoice is generated explicitly from a {@link Sale} or a {@link
 * Delivery} (Décision D22): it snapshots the source lines, is minted {@code F-YYYY-NNN} per farm
 * per year (D24), starts {@code ISSUED} with {@code amountPaid=0}, and HT totals (D25). One invoice
 * per source (guarded). Issuing raises the client's receivable (encours) by the total; payments
 * (B5-4) lower it and drive the status transitions. Cancelling reverses the still-outstanding part
 * of the receivable. Walk-in (no-client) sources produce a client-less invoice that never touches
 * any receivable. RBAC is enforced at the controller layer (B5-5).
 */
@Service
@RequiredArgsConstructor
public class InvoiceService {

  private final InvoiceRepository invoiceRepository;
  private final SaleRepository saleRepository;
  private final DeliveryRepository deliveryRepository;
  private final ClientService clientService;

  @Transactional
  public Invoice createFromSale(Long farmId, Long saleId, LocalDate dueDate, Long userId) {
    Sale sale =
        saleRepository
            .findByFarmIdAndId(farmId, saleId)
            .orElseThrow(() -> NotFoundException.of("Sale", saleId));
    if (sale.getStatus() == SaleStatus.CANCELLED) {
      throw new BusinessRuleException(
          "SALE_CANCELLED", "Cannot invoice a cancelled sale " + sale.getSaleNumber());
    }
    if (invoiceRepository.findByFarmIdAndSaleId(farmId, saleId).isPresent()) {
      throw new BusinessRuleException(
          "ALREADY_INVOICED", "Sale " + sale.getSaleNumber() + " is already invoiced");
    }

    Invoice invoice = newInvoice(farmId, sale.getClient(), dueDate, userId);
    invoice.setSourceType(InvoiceSourceType.SALE);
    invoice.setSaleId(saleId);
    long total = 0;
    for (SaleItem line : sale.getItems()) {
      addLine(
          invoice,
          line.getArticleKey(),
          line.getArticleSource(),
          line.getArticleLabelSnapshot(),
          line.getUnit(),
          line.getQuantity(),
          line.getUnitPriceXof(),
          line.getLineTotalXof());
      total += line.getLineTotalXof();
    }
    return finalize(invoice, total);
  }

  @Transactional
  public Invoice createFromDelivery(Long farmId, Long deliveryId, LocalDate dueDate, Long userId) {
    Delivery delivery =
        deliveryRepository
            .findByFarmIdAndId(farmId, deliveryId)
            .orElseThrow(() -> NotFoundException.of("Delivery", deliveryId));
    if (delivery.getStatus() == DeliveryStatus.CANCELLED) {
      throw new BusinessRuleException(
          "DELIVERY_CANCELLED",
          "Cannot invoice a cancelled delivery " + delivery.getDeliveryNumber());
    }
    if (invoiceRepository.findByFarmIdAndDeliveryId(farmId, deliveryId).isPresent()) {
      throw new BusinessRuleException(
          "ALREADY_INVOICED", "Delivery " + delivery.getDeliveryNumber() + " is already invoiced");
    }

    Invoice invoice = newInvoice(farmId, delivery.getClient(), dueDate, userId);
    invoice.setSourceType(InvoiceSourceType.DELIVERY);
    invoice.setDeliveryId(deliveryId);
    long total = 0;
    for (DeliveryItem line : delivery.getItems()) {
      addLine(
          invoice,
          line.getArticleKey(),
          line.getArticleSource(),
          line.getArticleLabelSnapshot(),
          line.getUnit(),
          line.getQuantity(),
          line.getUnitPriceXof(),
          line.getLineTotalXof());
      total += line.getLineTotalXof();
    }
    return finalize(invoice, total);
  }

  /**
   * Cancel an invoice that is not fully paid: reverse the still-outstanding part of the client's
   * receivable and mark it CANCELLED.
   */
  @Transactional
  public Invoice cancel(Long farmId, Long invoiceId, String reason, Long userId) {
    Invoice invoice = load(farmId, invoiceId);
    if (invoice.getStatus() == InvoiceStatus.CANCELLED
        || invoice.getStatus() == InvoiceStatus.PAID) {
      throw new BusinessRuleException(
          "INVALID_INVOICE_TRANSITION",
          "Cannot cancel an invoice in status " + invoice.getStatus());
    }
    if (invoice.getClient() != null && invoice.outstandingXof() != 0) {
      clientService.adjustBalance(farmId, invoice.getClient().getId(), -invoice.outstandingXof());
    }
    invoice.setStatus(InvoiceStatus.CANCELLED);
    invoice.setCancelledBy(userId);
    invoice.setCancelledAt(LocalDateTime.now());
    invoice.setCancellationReason(reason);
    return invoice;
  }

  @Transactional(readOnly = true)
  public Invoice getById(Long farmId, Long invoiceId) {
    return load(farmId, invoiceId);
  }

  @Transactional(readOnly = true)
  public List<Invoice> listForFarm(Long farmId, InvoiceStatus statusFilter) {
    return statusFilter != null
        ? invoiceRepository.findByFarmIdAndStatusOrderByIssueDateDescIdDesc(farmId, statusFilter)
        : invoiceRepository.findByFarmIdOrderByIssueDateDescIdDesc(farmId);
  }

  @Transactional(readOnly = true)
  public List<Invoice> listOverdue(Long farmId) {
    return invoiceRepository.findOverdue(farmId, LocalDate.now());
  }

  // --- internals ------------------------------------------------------

  private Invoice load(Long farmId, Long invoiceId) {
    return invoiceRepository
        .findByFarmIdAndId(farmId, invoiceId)
        .orElseThrow(() -> NotFoundException.of("Invoice", invoiceId));
  }

  private Invoice newInvoice(Long farmId, Client client, LocalDate dueDate, Long userId) {
    Invoice invoice = new Invoice();
    invoice.setFarmId(farmId);
    invoice.setClient(client);
    invoice.setStatus(InvoiceStatus.ISSUED);
    invoice.setIssueDate(LocalDate.now());
    invoice.setDueDate(dueDate);
    invoice.setAmountPaidXof(0L);
    invoice.setCreatedBy(userId);
    invoice.setInvoiceNumber(generateInvoiceNumber(farmId, LocalDate.now().getYear()));
    return invoice;
  }

  /** Persist the invoice with its computed total and raise the client's receivable (D26). */
  private Invoice finalize(Invoice invoice, long total) {
    invoice.setTotalXof(total);
    Invoice saved = invoiceRepository.save(invoice);
    if (saved.getClient() != null && total != 0) {
      clientService.adjustBalance(saved.getFarmId(), saved.getClient().getId(), total);
    }
    return saved;
  }

  private static void addLine(
      Invoice invoice,
      String articleKey,
      ArticleSource articleSource,
      String labelSnapshot,
      String unit,
      BigDecimal quantity,
      Integer unitPriceXof,
      Long lineTotalXof) {
    InvoiceItem item = new InvoiceItem();
    item.setArticleKey(articleKey);
    item.setArticleSource(articleSource);
    item.setArticleLabelSnapshot(labelSnapshot);
    item.setUnit(unit);
    item.setQuantity(quantity);
    item.setUnitPriceXof(unitPriceXof);
    item.setLineTotalXof(lineTotalXof);
    invoice.addItem(item);
  }

  private String generateInvoiceNumber(Long farmId, int year) {
    int next = invoiceRepository.findMaxSequence(farmId, "F-" + year + "-%") + 1;
    return String.format("F-%d-%03d", year, next);
  }
}
