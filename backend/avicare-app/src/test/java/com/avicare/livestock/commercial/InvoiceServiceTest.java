package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryItem;
import com.avicare.livestock.domain.DeliveryStatus;
import com.avicare.livestock.domain.Invoice;
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
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link InvoiceService} — generating an invoice from a sale/delivery (numbering,
 * line snapshot, raising the client receivable D26), guarding double-invoicing, and cancellation
 * (reversing the receivable). All collaborators mocked; runs in surefire/CI (no Docker).
 */
class InvoiceServiceTest {

  private InvoiceRepository invoiceRepository;
  private SaleRepository saleRepository;
  private DeliveryRepository deliveryRepository;
  private ClientService clientService;
  private InvoiceService service;

  @BeforeEach
  void setUp() {
    invoiceRepository = Mockito.mock(InvoiceRepository.class);
    saleRepository = Mockito.mock(SaleRepository.class);
    deliveryRepository = Mockito.mock(DeliveryRepository.class);
    clientService = Mockito.mock(ClientService.class);
    service =
        new InvoiceService(invoiceRepository, saleRepository, deliveryRepository, clientService);

    when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));
    when(invoiceRepository.findByFarmIdAndSaleId(any(), any())).thenReturn(Optional.empty());
    when(invoiceRepository.findByFarmIdAndDeliveryId(any(), any())).thenReturn(Optional.empty());
    when(invoiceRepository.findMaxSequence(eq(7L), any())).thenReturn(0);
  }

  // --- createFromSale -------------------------------------------------

  @Test
  void createFromSale_issuesInvoice_snapshotsLines_raisesReceivable() {
    Sale sale = sale(20L, SaleStatus.COMPLETED, client(3L));
    sale.addItem(saleItem("eggs_consumption", "10", 3000));
    sale.addItem(saleItem("chicken_meat", "5", 2500));
    when(saleRepository.findByFarmIdAndId(7L, 20L)).thenReturn(Optional.of(sale));

    Invoice invoice = service.createFromSale(7L, 20L, LocalDate.now().plusDays(30), 42L);

    assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
    assertThat(invoice.getInvoiceNumber()).isEqualTo("F-" + LocalDate.now().getYear() + "-001");
    assertThat(invoice.getSourceType()).isEqualTo(InvoiceSourceType.SALE);
    assertThat(invoice.getSaleId()).isEqualTo(20L);
    assertThat(invoice.getClient()).isNotNull();
    assertThat(invoice.getItems()).hasSize(2);
    assertThat(invoice.getItems().get(0).getArticleLabelSnapshot()).isEqualTo("Oeufs");
    assertThat(invoice.getTotalXof()).isEqualTo(42_500L);
    assertThat(invoice.getAmountPaidXof()).isZero();

    // D26: issuing raises the client's receivable by the invoice total.
    verify(clientService).adjustBalance(7L, 3L, 42_500L);
  }

  @Test
  void createFromSale_walkInSale_doesNotTouchReceivable() {
    Sale sale = sale(20L, SaleStatus.COMPLETED, null);
    sale.addItem(saleItem("eggs_consumption", "2", 3000));
    when(saleRepository.findByFarmIdAndId(7L, 20L)).thenReturn(Optional.of(sale));

    Invoice invoice = service.createFromSale(7L, 20L, null, 42L);

    assertThat(invoice.getClient()).isNull();
    assertThat(invoice.getTotalXof()).isEqualTo(6_000L);
    verify(clientService, never())
        .adjustBalance(any(), any(), org.mockito.ArgumentMatchers.anyLong());
  }

  @Test
  void createFromSale_numbersAreSequentialPerYear() {
    Sale sale = sale(20L, SaleStatus.COMPLETED, null);
    sale.addItem(saleItem("eggs_consumption", "1", 3000));
    when(saleRepository.findByFarmIdAndId(7L, 20L)).thenReturn(Optional.of(sale));
    when(invoiceRepository.findMaxSequence(eq(7L), any())).thenReturn(11);

    Invoice invoice = service.createFromSale(7L, 20L, null, 42L);

    assertThat(invoice.getInvoiceNumber()).isEqualTo("F-" + LocalDate.now().getYear() + "-012");
  }

  @Test
  void createFromSale_unknownSaleThrowsNotFound() {
    when(saleRepository.findByFarmIdAndId(7L, 99L)).thenReturn(Optional.empty());

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(() -> service.createFromSale(7L, 99L, null, 42L));
  }

  @Test
  void createFromSale_cancelledSaleThrowsBusinessRule() {
    Sale sale = sale(20L, SaleStatus.CANCELLED, null);
    when(saleRepository.findByFarmIdAndId(7L, 20L)).thenReturn(Optional.of(sale));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.createFromSale(7L, 20L, null, 42L));
  }

  @Test
  void createFromSale_alreadyInvoicedThrowsBusinessRule() {
    Sale sale = sale(20L, SaleStatus.COMPLETED, null);
    sale.addItem(saleItem("eggs_consumption", "1", 3000));
    when(saleRepository.findByFarmIdAndId(7L, 20L)).thenReturn(Optional.of(sale));
    when(invoiceRepository.findByFarmIdAndSaleId(7L, 20L)).thenReturn(Optional.of(new Invoice()));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.createFromSale(7L, 20L, null, 42L));
  }

  // --- createFromDelivery ---------------------------------------------

  @Test
  void createFromDelivery_issuesInvoiceFromDelivery_raisesReceivable() {
    Delivery delivery = delivery(30L, DeliveryStatus.DELIVERED, client(3L));
    delivery.addItem(deliveryItem("eggs_consumption", "10", 3000));
    when(deliveryRepository.findByFarmIdAndId(7L, 30L)).thenReturn(Optional.of(delivery));

    Invoice invoice = service.createFromDelivery(7L, 30L, null, 42L);

    assertThat(invoice.getSourceType()).isEqualTo(InvoiceSourceType.DELIVERY);
    assertThat(invoice.getDeliveryId()).isEqualTo(30L);
    assertThat(invoice.getTotalXof()).isEqualTo(30_000L);
    verify(clientService).adjustBalance(7L, 3L, 30_000L);
  }

  @Test
  void createFromDelivery_alreadyInvoicedThrowsBusinessRule() {
    Delivery delivery = delivery(30L, DeliveryStatus.DELIVERED, null);
    delivery.addItem(deliveryItem("eggs_consumption", "1", 3000));
    when(deliveryRepository.findByFarmIdAndId(7L, 30L)).thenReturn(Optional.of(delivery));
    when(invoiceRepository.findByFarmIdAndDeliveryId(7L, 30L))
        .thenReturn(Optional.of(new Invoice()));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.createFromDelivery(7L, 30L, null, 42L));
  }

  // --- cancel ---------------------------------------------------------

  @Test
  void cancel_reversesReceivableByOutstanding() {
    Invoice invoice = stored(50L, InvoiceStatus.ISSUED, client(3L), 42_500L, 0L);

    Invoice result = service.cancel(7L, 50L, "erreur", 42L);

    assertThat(result.getStatus()).isEqualTo(InvoiceStatus.CANCELLED);
    assertThat(result.getCancellationReason()).isEqualTo("erreur");
    assertThat(result.getCancelledBy()).isEqualTo(42L);
    verify(clientService).adjustBalance(7L, 3L, -42_500L);
  }

  @Test
  void cancel_walkInInvoice_doesNotTouchReceivable() {
    stored(50L, InvoiceStatus.ISSUED, null, 6_000L, 0L);

    service.cancel(7L, 50L, "erreur", 42L);

    verify(clientService, never())
        .adjustBalance(any(), any(), org.mockito.ArgumentMatchers.anyLong());
  }

  @Test
  void cancel_alreadyCancelledThrowsBusinessRule() {
    stored(50L, InvoiceStatus.CANCELLED, null, 6_000L, 0L);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.cancel(7L, 50L, "encore", 42L));
  }

  @Test
  void cancel_paidInvoiceThrowsBusinessRule() {
    stored(50L, InvoiceStatus.PAID, client(3L), 6_000L, 6_000L);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.cancel(7L, 50L, "trop tard", 42L));
  }

  @Test
  void listOverdue_delegatesToRepository() {
    Invoice overdue = stored(50L, InvoiceStatus.ISSUED, client(3L), 6_000L, 0L);
    when(invoiceRepository.findOverdue(eq(7L), any())).thenReturn(List.of(overdue));

    assertThat(service.listOverdue(7L)).containsExactly(overdue);
  }

  // --- helpers --------------------------------------------------------

  private Invoice stored(Long id, InvoiceStatus status, Client client, long total, long paid) {
    Invoice invoice = new Invoice();
    invoice.setId(id);
    invoice.setFarmId(7L);
    invoice.setStatus(status);
    invoice.setClient(client);
    invoice.setInvoiceNumber("F-2026-001");
    invoice.setSourceType(InvoiceSourceType.SALE);
    invoice.setSaleId(20L);
    invoice.setIssueDate(LocalDate.now());
    invoice.setTotalXof(total);
    invoice.setAmountPaidXof(paid);
    when(invoiceRepository.findByFarmIdAndId(7L, id)).thenReturn(Optional.of(invoice));
    return invoice;
  }

  private static Sale sale(Long id, SaleStatus status, Client client) {
    Sale sale = new Sale();
    sale.setId(id);
    sale.setFarmId(7L);
    sale.setStatus(status);
    sale.setClient(client);
    sale.setSaleNumber("V-2026-001");
    sale.setSaleDate(LocalDate.now());
    return sale;
  }

  private static Delivery delivery(Long id, DeliveryStatus status, Client client) {
    Delivery delivery = new Delivery();
    delivery.setId(id);
    delivery.setFarmId(7L);
    delivery.setStatus(status);
    delivery.setClient(client);
    delivery.setDeliveryNumber("LIV-2026-001");
    delivery.setDeliveryDate(LocalDate.now());
    return delivery;
  }

  private static SaleItem saleItem(String articleKey, String qty, int unitPriceXof) {
    SaleItem i = new SaleItem();
    i.setArticleKey(articleKey);
    i.setArticleSource(ArticleSource.INVENTORY);
    i.setArticleLabelSnapshot("eggs_consumption".equals(articleKey) ? "Oeufs" : "Poulet");
    i.setUnit("u");
    i.setQuantity(new BigDecimal(qty));
    i.setUnitPriceXof(unitPriceXof);
    i.setLineTotalXof((long) Integer.parseInt(qty) * unitPriceXof);
    return i;
  }

  private static DeliveryItem deliveryItem(String articleKey, String qty, int unitPriceXof) {
    DeliveryItem i = new DeliveryItem();
    i.setArticleKey(articleKey);
    i.setArticleSource(ArticleSource.INVENTORY);
    i.setArticleLabelSnapshot("eggs_consumption".equals(articleKey) ? "Oeufs" : "Poulet");
    i.setUnit("u");
    i.setQuantity(new BigDecimal(qty));
    i.setUnitPriceXof(unitPriceXof);
    i.setLineTotalXof((long) Integer.parseInt(qty) * unitPriceXof);
    return i;
  }

  private static Client client(Long id) {
    Client c = new Client();
    c.setId(id);
    c.setFarmId(7L);
    c.setClientType(ClientType.BUSINESS);
    c.setDisplayName("Ferme du Soleil");
    c.setCurrentBalanceXof(0L);
    c.setActive(true);
    return c;
  }
}
