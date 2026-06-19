package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryStatus;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderStatus;
import com.avicare.livestock.inventory.StockItemService;
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
 * Order → delivery flow on a real PostgreSQL (Testcontainers, V1–V21): converting an in-progress
 * order into a delivery (LIV-YYYY-NNN, OUT stock cascade D21, order marked DELIVERED) and
 * cancellation reversing the stock and reopening the order. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class DeliveryServiceIT {

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
  @Autowired private DeliveryService deliveryService;
  @Autowired private OrderService orderService;
  @Autowired private ClientService clientService;
  @Autowired private StockItemService stockItemService;

  @Test
  void convertOrderToDelivery_stockOut_orderDelivered_thenCancelReopensAndRestores()
      throws Exception {
    long farmId = createFarm();
    long clientId = createClient(farmId);
    int year = LocalDate.now().getYear();

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
                List.of(line("eggs_consumption", "10", 3000), line("chicken_meat", "5", 2500))),
            1L);
    orderService.confirm(farmId, order.getId(), 1L);
    orderService.markInProgress(farmId, order.getId(), 1L);

    Delivery delivery =
        deliveryService.createFromOrder(
            farmId,
            order.getId(),
            new DeliveryFromOrderCommand(null, "Moussa Transport", null),
            1L);

    assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.DELIVERED);
    assertThat(delivery.getDeliveryNumber()).isEqualTo(String.format("LIV-%d-001", year));
    assertThat(delivery.getItems()).hasSize(2);
    assertThat(delivery.getTotalXof()).isEqualTo(42_500L);
    assertThat(orderService.getById(farmId, order.getId()).getStatus())
        .isEqualTo(OrderStatus.DELIVERED);
    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "eggs_consumption", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("-10");

    // cancel → stock restored, order reopened to IN_PROGRESS
    Delivery cancelled = deliveryService.cancel(farmId, delivery.getId(), "retour", 1L);
    assertThat(cancelled.getStatus()).isEqualTo(DeliveryStatus.CANCELLED);
    assertThat(orderService.getById(farmId, order.getId()).getStatus())
        .isEqualTo(OrderStatus.IN_PROGRESS);
    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "eggs_consumption", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("0");
  }

  private static OrderDraftCommand.Line line(String key, String qty, int price) {
    return new OrderDraftCommand.Line(
        key, ArticleSource.INVENTORY, new BigDecimal(qty), price, null);
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
    String email = "t" + System.nanoTime() + "@delivery.io";
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
                    .content("{\"name\":\"Ferme Delivery\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
