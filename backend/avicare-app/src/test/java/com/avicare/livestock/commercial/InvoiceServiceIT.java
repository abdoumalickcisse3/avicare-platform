package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.Sale;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.time.LocalDate;
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
 * Invoice flow on a real PostgreSQL (Testcontainers, V1–V22): generating an invoice from a sale
 * (F-YYYY-NNN, line snapshot, raising the client receivable), the one-invoice-per-source guard,
 * cancellation reversing the receivable, the delivery source path and the derived overdue listing.
 * CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class InvoiceServiceIT {

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
  @Autowired private InvoiceService invoiceService;
  @Autowired private SaleService saleService;
  @Autowired private OrderService orderService;
  @Autowired private DeliveryService deliveryService;
  @Autowired private ClientService clientService;

  @Test
  void invoiceFromSale_raisesReceivable_guardsDoubleInvoicing_cancelReverses() throws Exception {
    long farmId = createFarm();
    long clientId = createClient(farmId);
    int year = LocalDate.now().getYear();

    Sale sale =
        saleService.create(
            farmId,
            new SaleCommand(
                clientId,
                null,
                "CREDIT",
                null,
                null,
                List.of(
                    saleLine("eggs_consumption", "10", 3000), saleLine("chicken_meat", "5", 2500))),
            1L);

    Invoice invoice =
        invoiceService.createFromSale(farmId, sale.getId(), LocalDate.now().plusDays(30), 1L);
    assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
    assertThat(invoice.getInvoiceNumber()).isEqualTo(String.format("F-%d-001", year));
    assertThat(invoice.getSourceType()).isEqualTo(InvoiceSourceType.SALE);
    assertThat(invoice.getItems()).hasSize(2);
    assertThat(invoice.getTotalXof()).isEqualTo(42_500L);
    // encours raised by the invoice total
    assertThat(clientService.getById(farmId, clientId).getCurrentBalanceXof()).isEqualTo(42_500L);

    // one invoice per source
    assertThatThrownBy(() -> invoiceService.createFromSale(farmId, sale.getId(), null, 1L))
        .isInstanceOf(BusinessRuleException.class);

    // cancel reverses the receivable
    invoiceService.cancel(farmId, invoice.getId(), "erreur", 1L);
    assertThat(clientService.getById(farmId, clientId).getCurrentBalanceXof()).isZero();
  }

  @Test
  void invoiceFromDelivery_andOverdueListing() throws Exception {
    long farmId = createFarm();
    long clientId = createClient(farmId);

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
                List.of(orderLine("eggs_consumption", "4", 3000))),
            1L);
    orderService.confirm(farmId, order.getId(), 1L);
    orderService.markInProgress(farmId, order.getId(), 1L);
    Delivery delivery =
        deliveryService.createFromOrder(
            farmId, order.getId(), new DeliveryFromOrderCommand(null, null, null), 1L);

    // due yesterday → shows up as overdue
    Invoice invoice =
        invoiceService.createFromDelivery(
            farmId, delivery.getId(), LocalDate.now().minusDays(1), 1L);
    assertThat(invoice.getSourceType()).isEqualTo(InvoiceSourceType.DELIVERY);
    assertThat(invoice.getDeliveryId()).isEqualTo(delivery.getId());
    assertThat(invoice.getTotalXof()).isEqualTo(12_000L);

    assertThat(invoiceService.listOverdue(farmId))
        .extracting(Invoice::getId)
        .containsExactly(invoice.getId());
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

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@invoice.io";
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
                    .content("{\"name\":\"Ferme Invoice\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
