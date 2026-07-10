package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.Sale;
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

/** Verifies CommercialFacade.recentActivity (sales + payments) on a real DB. CI-only. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class CommercialActivityIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
    r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    r.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    r.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private CommercialFacade commercialFacade;
  @Autowired private SaleService saleService;
  @Autowired private InvoiceService invoiceService;
  @Autowired private PaymentService paymentService;
  @Autowired private ClientService clientService;

  @Test
  void recentActivity_includesSaleAndPayment() throws Exception {
    long farmId = createFarm();
    long clientId =
        clientService
            .create(
                farmId,
                new ClientCommand(
                    com.avicare.livestock.domain.ClientType.BUSINESS,
                    "Ferme du Soleil",
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null),
                1L)
            .getId();

    Sale sale =
        saleService.create(
            farmId,
            new SaleCommand(
                clientId,
                null,
                "CREDIT",
                null,
                List.of(
                    new SaleCommand.Line(
                        "eggs_consumption",
                        ArticleSource.INVENTORY,
                        new BigDecimal("10"),
                        3000,
                        null,
                        null,
                        null))),
            1L);
    Invoice inv = invoiceService.createFromSale(farmId, sale.getId(), null, 1L);
    paymentService.record(
        farmId, new PaymentCommand(inv.getId(), 30_000L, PaymentMethod.CASH, null, null, null), 1L);

    List<ActivityItem> items = commercialFacade.recentActivity(farmId, 20);

    assertThat(items).extracting(ActivityItem::kind).contains("SALE", "PAYMENT");
    assertThat(items)
        .extracting(ActivityItem::label)
        .anyMatch(l -> l.startsWith("Vente "))
        .anyMatch(l -> l.startsWith("Paiement reçu "));
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@act.io";
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
                    .content("{\"name\":\"Ferme Act\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
