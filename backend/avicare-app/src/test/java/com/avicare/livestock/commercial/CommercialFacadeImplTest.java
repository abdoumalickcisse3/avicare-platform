package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.OrderRepository;
import com.avicare.livestock.repository.PaymentRepository;
import com.avicare.livestock.repository.SaleItemRepository;
import com.avicare.livestock.repository.SaleRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link CommercialFacadeImpl} — the public read surface of the commercial sub-domain
 * (doc 03 §4.9): mapping client credit and invoice summaries. Collaborators mocked.
 */
class CommercialFacadeImplTest {

  private ClientService clientService;
  private InvoiceService invoiceService;
  private CommercialFacade facade;

  @BeforeEach
  void setUp() {
    clientService = Mockito.mock(ClientService.class);
    invoiceService = Mockito.mock(InvoiceService.class);
    facade =
        new CommercialFacadeImpl(
            clientService,
            invoiceService,
            Mockito.mock(SaleRepository.class),
            Mockito.mock(InvoiceRepository.class),
            Mockito.mock(OrderRepository.class),
            Mockito.mock(SaleItemRepository.class),
            Mockito.mock(PaymentRepository.class));
  }

  @Test
  void getClientCredit_mapsClientAndCreditStatus() {
    Client client = new Client();
    client.setId(3L);
    client.setFarmId(7L);
    client.setClientType(ClientType.BUSINESS);
    client.setDisplayName("Ferme du Soleil");
    client.setCreditLimitXof(500_000L);
    client.setCurrentBalanceXof(600_000L);
    when(clientService.getById(7L, 3L)).thenReturn(client);
    when(clientService.projectCredit(7L, 3L, 0L))
        .thenReturn(new CreditStatus(true, 600_000L, 500_000L, 120));

    ClientCreditInfo info = facade.getClientCredit(7L, 3L);

    assertThat(info.clientId()).isEqualTo(3L);
    assertThat(info.displayName()).isEqualTo("Ferme du Soleil");
    assertThat(info.creditLimitXof()).isEqualTo(500_000L);
    assertThat(info.currentBalanceXof()).isEqualTo(600_000L);
    assertThat(info.overLimit()).isTrue();
    assertThat(info.overLimitPercent()).isEqualTo(120);
  }

  @Test
  void findInvoiceById_mapsInvoiceWithOutstanding() {
    Invoice invoice = invoice(50L, client(3L), 42_500L, 10_000L);
    when(invoiceService.getById(7L, 50L)).thenReturn(invoice);

    InvoiceInfo info = facade.findInvoiceById(7L, 50L);

    assertThat(info.id()).isEqualTo(50L);
    assertThat(info.invoiceNumber()).isEqualTo("F-2026-001");
    assertThat(info.clientId()).isEqualTo(3L);
    assertThat(info.status()).isEqualTo(InvoiceStatus.PARTIALLY_PAID);
    assertThat(info.totalXof()).isEqualTo(42_500L);
    assertThat(info.amountPaidXof()).isEqualTo(10_000L);
    assertThat(info.outstandingXof()).isEqualTo(32_500L);
  }

  @Test
  void findInvoiceById_walkInInvoiceHasNullClientId() {
    Invoice invoice = invoice(50L, null, 6_000L, 0L);
    when(invoiceService.getById(7L, 50L)).thenReturn(invoice);

    assertThat(facade.findInvoiceById(7L, 50L).clientId()).isNull();
  }

  private static Invoice invoice(Long id, Client client, long total, long paid) {
    Invoice invoice = new Invoice();
    invoice.setId(id);
    invoice.setFarmId(7L);
    invoice.setClient(client);
    invoice.setInvoiceNumber("F-2026-001");
    invoice.setSourceType(InvoiceSourceType.SALE);
    invoice.setSaleId(20L);
    invoice.setStatus(paid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.ISSUED);
    invoice.setIssueDate(LocalDate.now());
    invoice.setDueDate(LocalDate.now().plusDays(30));
    invoice.setTotalXof(total);
    invoice.setAmountPaidXof(paid);
    return invoice;
  }

  private static Client client(Long id) {
    Client c = new Client();
    c.setId(id);
    c.setFarmId(7L);
    c.setClientType(ClientType.BUSINESS);
    c.setDisplayName("Ferme du Soleil");
    c.setCurrentBalanceXof(0L);
    return c;
  }
}
