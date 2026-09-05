package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderStatus;
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
 * Sales order workflow on a real PostgreSQL (Testcontainers, V1–V20): draft creation with generated
 * ORD-YYYY-NNN number, total and PRODUCT-article snapshot/validation, the strict 5-state machine
 * (valid + invalid transitions, D23) and cancellation. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class OrderServiceIT {

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
  @Autowired private OrderService orderService;
  @Autowired private ClientService clientService;

  @Test
  void draftNumbering_total_snapshots_andFullWorkflow() throws Exception {
    long farmId = createFarm();
    long clientId = createClient(farmId);
    int year = LocalDate.now().getYear();

    Order order =
        orderService.createDraft(
            farmId,
            new OrderDraftCommand(
                clientId,
                LocalDate.now(),
                null,
                "Marché Sandaga",
                null,
                "CASH",
                null,
                null,
                null,
                List.of(line("eggs_consumption", "10", 3000), line("chicken_meat", "5", 2500))),
            1L);
    assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
    assertThat(order.getOrderNumber()).isEqualTo(String.format("ORD-%d-001", year));
    assertThat(order.getTotalXof()).isEqualTo(42_500L); // 10*3000 + 5*2500
    assertThat(order.getItems()).hasSize(2);
    assertThat(order.getItems().get(0).getArticleLabelSnapshot()).isNotBlank();
    assertThat(order.getItems().get(0).getUnit()).isNotBlank();

    // second order of the year → 002
    Order order2 =
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
                null,
                List.of(line("eggs_consumption", "1", 3000))),
            1L);
    assertThat(order2.getOrderNumber()).isEqualTo(String.format("ORD-%d-002", year));

    // PENDING → CONFIRMED → IN_PROGRESS → DELIVERED
    orderService.confirm(farmId, order.getId(), 1L);
    assertThat(orderService.getById(farmId, order.getId()).getStatus())
        .isEqualTo(OrderStatus.CONFIRMED);
    orderService.markInProgress(farmId, order.getId(), 1L);
    assertThat(orderService.getById(farmId, order.getId()).getStatus())
        .isEqualTo(OrderStatus.IN_PROGRESS);
    Order delivered = orderService.markDelivered(farmId, order.getId(), LocalDate.now(), 1L);
    assertThat(delivered.getStatus()).isEqualTo(OrderStatus.DELIVERED);
    assertThat(delivered.getActualDeliveryDate()).isEqualTo(LocalDate.now());

    // a delivered order can no longer be cancelled or transitioned
    assertThatThrownBy(() -> orderService.cancel(farmId, order.getId(), "trop tard", 1L))
        .isInstanceOf(BusinessRuleException.class);
    assertThatThrownBy(() -> orderService.confirm(farmId, order.getId(), 1L))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void cancellation_andValidationGuards() throws Exception {
    long farmId = createFarm();
    long clientId = createClient(farmId);

    // cancel from CONFIRMED
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
                null,
                List.of(line("eggs_consumption", "2", 3000))),
            1L);
    orderService.confirm(farmId, order.getId(), 1L);
    orderService.cancel(farmId, order.getId(), "client annulé", 1L);
    assertThat(orderService.getById(farmId, order.getId()).getStatus())
        .isEqualTo(OrderStatus.CANCELLED);

    // unknown client → 404
    assertThatThrownBy(
            () ->
                orderService.createDraft(
                    farmId,
                    new OrderDraftCommand(
                        999_999L,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        List.of(line("eggs_consumption", "1", 3000))),
                    1L))
        .isInstanceOf(NotFoundException.class);

    // a non-PRODUCT article (feed) cannot be sold → 422
    assertThatThrownBy(
            () ->
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
                        null,
                        List.of(line("feed_layer", "10", 300))),
                    1L))
        // 422 : l'article existe, c'est le domaine qui refuse de le vendre.
        .isInstanceOf(BusinessRuleException.class);
  }

  private static OrderDraftCommand.Line line(String key, String qty, int price) {
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
    String email = "t" + System.nanoTime() + "@order.io";
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
                    .content("{\"name\":\"Ferme Order\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
