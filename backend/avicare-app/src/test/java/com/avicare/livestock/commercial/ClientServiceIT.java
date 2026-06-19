package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
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
 * Client directory + indicative credit (D26) on a real PostgreSQL (Testcontainers, V1–V20): CRUD,
 * soft delete, receivable adjustment and the never-blocking over-limit logic. CI-only where Docker
 * is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ClientServiceIT {

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
  @Autowired private ClientService clientService;

  @Test
  void crud_softDelete_andCreditLifecycle() throws Exception {
    long farmId = createFarm();

    Client created =
        clientService.create(
            farmId,
            new ClientCommand(
                ClientType.BUSINESS,
                "Ferme du Soleil",
                "Soleil SARL",
                "+221770000000",
                "soleil@example.com",
                "Route de Rufisque",
                "Dakar",
                500_000L,
                "30 jours",
                "VIP"),
            1L);
    assertThat(created.getId()).isNotNull();
    assertThat(created.getCurrentBalanceXof()).isZero();
    assertThat(created.isActive()).isTrue();

    // update
    Client updated =
        clientService.update(
            farmId,
            created.getId(),
            new ClientCommand(
                ClientType.WHOLESALER,
                "Grossiste Soleil",
                null,
                null,
                null,
                null,
                null,
                1_000_000L,
                null,
                null));
    assertThat(updated.getClientType()).isEqualTo(ClientType.WHOLESALER);
    assertThat(updated.getCreditLimitXof()).isEqualTo(1_000_000L);

    // adjustBalance: charge then partial payment
    clientService.adjustBalance(farmId, created.getId(), 1_200_000L);
    assertThat(clientService.getById(farmId, created.getId()).getCurrentBalanceXof())
        .isEqualTo(1_200_000L);

    // over limit (1.2M > 1M) — flagged but never blocks
    CreditStatus over = clientService.projectCredit(farmId, created.getId(), 0L);
    assertThat(over.overLimit()).isTrue();
    assertThat(over.overLimitPercent()).isEqualTo(120);
    assertThat(clientService.listOverCreditLimit(farmId))
        .extracting(Client::getId)
        .containsExactly(created.getId());

    clientService.adjustBalance(farmId, created.getId(), -1_000_000L);
    CreditStatus under = clientService.projectCredit(farmId, created.getId(), 0L);
    assertThat(under.overLimit()).isFalse();
    assertThat(clientService.listOverCreditLimit(farmId)).isEmpty();

    // soft delete removes it from the active listing
    clientService.deactivate(farmId, created.getId());
    assertThat(clientService.listForFarm(farmId)).isEmpty();
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@client.io";
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
                    .content("{\"name\":\"Ferme Client\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
