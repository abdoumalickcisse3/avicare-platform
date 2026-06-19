package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.inventory.StockItemService;
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
 * Direct sale flow on a real PostgreSQL (Testcontainers, V1–V21): walk-in sale creation with
 * generated V-YYYY-NNN number, the OUT stock cascade (D21, stock may go negative D19) and
 * cancellation reversing the stock with a compensating IN. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class SaleServiceIT {

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
  @Autowired private SaleService saleService;
  @Autowired private StockItemService stockItemService;

  @Test
  void walkInSale_numbering_total_stockOut_thenCancelRestoresStock() throws Exception {
    long farmId = createFarm();
    int year = java.time.LocalDate.now().getYear();

    Sale sale =
        saleService.create(
            farmId,
            new SaleCommand(
                null,
                null,
                "CASH",
                null,
                List.of(line("eggs_consumption", "10", 3000), line("chicken_meat", "5", 2500))),
            1L);
    assertThat(sale.getStatus()).isEqualTo(SaleStatus.COMPLETED);
    assertThat(sale.getSaleNumber()).isEqualTo(String.format("V-%d-001", year));
    assertThat(sale.getClient()).isNull();
    assertThat(sale.getTotalXof()).isEqualTo(42_500L); // 10*3000 + 5*2500

    // D21/D19: stock decremented, may go negative.
    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "eggs_consumption", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("-10");

    // second sale of the year → 002
    Sale sale2 =
        saleService.create(
            farmId,
            new SaleCommand(null, null, null, null, List.of(line("eggs_consumption", "1", 3000))),
            1L);
    assertThat(sale2.getSaleNumber()).isEqualTo(String.format("V-%d-002", year));

    // cancel the first sale → compensating IN restores stock (10 back, minus the 1 from sale2)
    Sale cancelled = saleService.cancel(farmId, sale.getId(), "erreur", 1L);
    assertThat(cancelled.getStatus()).isEqualTo(SaleStatus.CANCELLED);
    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "eggs_consumption", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("-1");
  }

  private static SaleCommand.Line line(String key, String qty, int price) {
    return new SaleCommand.Line(key, ArticleSource.INVENTORY, new BigDecimal(qty), price, null);
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@sale.io";
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
                    .content("{\"name\":\"Ferme Sale\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
