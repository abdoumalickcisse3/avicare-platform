package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.domain.Payment;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.PaymentStatus;
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
 * Payment flow on a real PostgreSQL (Testcontainers, V1–V23): recording payments against an invoice
 * (P-YYYY-NNN, invoice → PARTIALLY_PAID → PAID, encours lowered), the overpayment guard, and
 * voiding a payment (reverses the invoice and the receivable). CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class PaymentServiceIT {

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
  @Autowired private PaymentService paymentService;
  @Autowired private InvoiceService invoiceService;
  @Autowired private SaleService saleService;
  @Autowired private ClientService clientService;

  @Test
  void partialThenFullPayment_movesStatus_lowersEncours_thenVoidReverses() throws Exception {
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
                List.of(line("eggs_consumption", "10", 3000), line("chicken_meat", "5", 2500))),
            1L);
    Invoice invoice = invoiceService.createFromSale(farmId, sale.getId(), null, 1L);
    assertThat(clientService.getById(farmId, clientId).getCurrentBalanceXof()).isEqualTo(42_500L);

    // partial payment → PARTIALLY_PAID, encours down
    Payment p1 =
        paymentService.record(
            farmId,
            new PaymentCommand(
                invoice.getId(), 10_000L, PaymentMethod.MOBILE_MONEY, null, "WAVE-1", null),
            1L);
    assertThat(p1.getPaymentNumber()).isEqualTo(String.format("P-%d-001", year));
    assertThat(p1.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
    assertThat(invoiceService.getById(farmId, invoice.getId()).getStatus())
        .isEqualTo(InvoiceStatus.PARTIALLY_PAID);
    assertThat(clientService.getById(farmId, clientId).getCurrentBalanceXof()).isEqualTo(32_500L);

    // overpayment refused (outstanding is 32 500)
    assertThatThrownBy(
            () ->
                paymentService.record(
                    farmId,
                    new PaymentCommand(
                        invoice.getId(), 99_000L, PaymentMethod.CASH, null, null, null),
                    1L))
        .isInstanceOf(BusinessRuleException.class);

    // pay the remainder → PAID, encours zero
    Payment p2 =
        paymentService.record(
            farmId,
            new PaymentCommand(invoice.getId(), 32_500L, PaymentMethod.CASH, null, null, null),
            1L);
    assertThat(invoiceService.getById(farmId, invoice.getId()).getStatus())
        .isEqualTo(InvoiceStatus.PAID);
    assertThat(clientService.getById(farmId, clientId).getCurrentBalanceXof()).isZero();

    // void the second payment → back to PARTIALLY_PAID, encours restored
    paymentService.voidPayment(farmId, p2.getId(), "erreur", 1L);
    assertThat(invoiceService.getById(farmId, invoice.getId()).getStatus())
        .isEqualTo(InvoiceStatus.PARTIALLY_PAID);
    assertThat(clientService.getById(farmId, clientId).getCurrentBalanceXof()).isEqualTo(32_500L);
  }

  private static SaleCommand.Line line(String key, String qty, int price) {
    return new SaleCommand.Line(
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
    String email = "t" + System.nanoTime() + "@payment.io";
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
                    .content("{\"name\":\"Ferme Payment\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
