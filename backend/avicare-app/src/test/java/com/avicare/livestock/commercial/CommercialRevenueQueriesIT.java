package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the two lifetime revenue aggregates on a real PostgreSQL, seeded through the real
 * services (no fabricated ids — every row satisfies the {@code invoices.farm_id/sale_id/
 * delivery_id} FKs): COMPLETED sales total ({@link SaleRepository#sumAllRevenue}) and paid-amount
 * total on DELIVERY-sourced invoices ({@link InvoiceRepository#sumPaidFromDeliveries}), with
 * SALE-sourced and CANCELLED rows proven excluded. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class CommercialRevenueQueriesIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private SaleRepository saleRepository;
  @Autowired private InvoiceRepository invoiceRepository;
  @Autowired private SaleService saleService;
  @Autowired private OrderService orderService;
  @Autowired private DeliveryService deliveryService;
  @Autowired private InvoiceService invoiceService;
  @Autowired private PaymentService paymentService;
  @Autowired private ClientService clientService;

  @Test
  void sumAllRevenue_countsCompletedSale_excludesCancelledSale() throws Exception {
    long farmId = createFarm("revenue");

    Sale completed =
        saleService.create(
            farmId,
            new SaleCommand(
                null, null, "CASH", null, List.of(saleLine("eggs_consumption", "10", 3000))),
            1L);
    assertThat(completed.getStatus()).isEqualTo(SaleStatus.COMPLETED);

    Sale toCancel =
        saleService.create(
            farmId,
            new SaleCommand(
                null, null, "CASH", null, List.of(saleLine("eggs_consumption", "5", 3000))),
            1L);
    saleService.cancel(farmId, toCancel.getId(), "erreur", 1L);

    // Only the COMPLETED sale (30 000) is counted; the CANCELLED one (15 000) is excluded.
    assertThat(saleRepository.sumAllRevenue(farmId)).isEqualTo(30_000L);
  }

  @Test
  void sumPaidFromDeliveries_countsDeliveryPayments_excludesSaleAndCancelled() throws Exception {
    long farmId = createFarm("delivery-revenue");
    long clientId = createClient(farmId);

    // DELIVERY-sourced invoice, partially paid → counted (5 000).
    Invoice deliveryInvoiceA = createDeliveryInvoice(farmId, clientId, "4", 3000); // total 12 000
    paymentService.record(
        farmId,
        new PaymentCommand(deliveryInvoiceA.getId(), 5_000L, PaymentMethod.CASH, null, null, null),
        1L);

    // DELIVERY-sourced invoice, partially paid then CANCELLED → excluded despite amount_paid > 0.
    Invoice deliveryInvoiceB = createDeliveryInvoice(farmId, clientId, "2", 3000); // total 6 000
    paymentService.record(
        farmId,
        new PaymentCommand(deliveryInvoiceB.getId(), 3_000L, PaymentMethod.CASH, null, null, null),
        1L);
    invoiceService.cancel(farmId, deliveryInvoiceB.getId(), "erreur", 1L);

    // SALE-sourced invoice, fully paid → excluded (no double count with the sale aggregate).
    Sale sale =
        saleService.create(
            farmId,
            new SaleCommand(
                clientId, null, "CREDIT", null, List.of(saleLine("eggs_consumption", "10", 3000))),
            1L);
    Invoice saleInvoice = invoiceService.createFromSale(farmId, sale.getId(), null, 1L);
    paymentService.record(
        farmId,
        new PaymentCommand(saleInvoice.getId(), 30_000L, PaymentMethod.CASH, null, null, null),
        1L);

    assertThat(invoiceRepository.sumPaidFromDeliveries(farmId)).isEqualTo(5_000L);
  }

  private Invoice createDeliveryInvoice(long farmId, long clientId, String qty, int price)
      throws Exception {
    Order order =
        orderService.createDraft(
            farmId,
            new OrderDraftCommand(
                clientId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(orderLine("eggs_consumption", qty, price))),
            1L);
    orderService.confirm(farmId, order.getId(), 1L);
    orderService.markInProgress(farmId, order.getId(), 1L);
    Delivery delivery =
        deliveryService.createFromOrder(
            farmId, order.getId(), new DeliveryFromOrderCommand(null, null, null), 1L);
    return invoiceService.createFromDelivery(farmId, delivery.getId(), null, 1L);
  }

  private static SaleCommand.Line saleLine(String key, String qty, int price) {
    return new SaleCommand.Line(
        key, ArticleSource.INVENTORY, new BigDecimal(qty), price, null, null, null);
  }

  private static OrderDraftCommand.Line orderLine(String key, String qty, int price) {
    return new OrderDraftCommand.Line(
        key, ArticleSource.INVENTORY, new BigDecimal(qty), price, null, null, null);
  }

  private long createClient(long farmId) {
    Client c =
        clientService.create(
            farmId,
            new ClientCommand(
                ClientType.BUSINESS,
                "Ferme du Soleil",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null),
            1L);
    return c.getId();
  }

  private long createFarm(String tag) throws Exception {
    String email = "t" + System.nanoTime() + "@" + tag + ".io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"T\"}"))
        .andExpect(status().isCreated());
    String token =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("accessToken")
            .asText();
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Revenue\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
