package com.avicare.reporting.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/** E2E: the /activity endpoint returns a merged feed with RBAC. CI-only (Docker). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ActivityControllerIT {

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
  @Autowired private com.avicare.livestock.commercial.ClientService clientService;
  @Autowired private com.avicare.livestock.commercial.SaleService saleService;

  @Test
  void activityEndpoint_returnsMergedFeed() throws Exception {
    String email = "t" + System.nanoTime() + "@actapi.io";
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
    long farmId =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/farms")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Ferme Act\"}"))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("id")
            .asLong();

    // Seed one COMPLETED sale so the merged feed carries a real item (mirrors
    // CommercialActivityIT).
    // An INVENTORY-article sale also emits a stock OUT movement, so the feed exercises both
    // sources.
    long clientId =
        clientService
            .create(
                farmId,
                new com.avicare.livestock.commercial.ClientCommand(
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
    saleService.create(
        farmId,
        new com.avicare.livestock.commercial.SaleCommand(
            clientId,
            null,
            "CREDIT",
            null,
            java.util.List.of(
                new com.avicare.livestock.commercial.SaleCommand.Line(
                    "eggs_consumption",
                    com.avicare.livestock.domain.ArticleSource.INVENTORY,
                    new java.math.BigDecimal("10"),
                    3000,
                    null,
                    null,
                    null))),
        1L);

    // The login token predates the farm, so it lacks the new OWNER membership → re-login.
    String freshToken =
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

    String body =
        mockMvc
            .perform(
                get("/api/v1/farms/" + farmId + "/activity?limit=20")
                    .header("Authorization", "Bearer " + freshToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data").isArray())
            .andReturn()
            .getResponse()
            .getContentAsString();
    boolean hasSale = false;
    for (com.fasterxml.jackson.databind.JsonNode n : objectMapper.readTree(body).get("data")) {
      if ("SALE".equals(n.get("kind").asText())) {
        hasSale = true;
      }
    }
    org.assertj.core.api.Assertions.assertThat(hasSale)
        .as("activity feed contains the seeded SALE")
        .isTrue();
  }
}
