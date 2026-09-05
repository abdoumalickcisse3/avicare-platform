package com.avicare.tenancy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

/**
 * Per-farm production focus over HTTP on a real PostgreSQL (Testcontainers, Décision 17): the focus
 * is carried on farm create/update and read back from farm_settings, with token validation. CI-only
 * where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class FarmProductionFocusIT {

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

  @Test
  void focusIsStoredOnCreate_readBack_andUpdatable() throws Exception {
    signup("owner@focus.io", "password123", "Owner");
    String owner = login("owner@focus.io", "password123");

    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme A\",\"productionFocus\":[\"broiler\"]}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.productionFocus[0]").value("broiler"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long farmId = objectMapper.readTree(json).get("data").get("id").asLong();
    owner = login("owner@focus.io", "password123");

    mockMvc
        .perform(get("/api/v1/farms/" + farmId).header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.productionFocus.length()").value(1))
        .andExpect(jsonPath("$.data.productionFocus[0]").value("broiler"));

    mockMvc
        .perform(
            put("/api/v1/farms/" + farmId)
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Ferme A\",\"productionFocus\":[\"broiler\",\"layer\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.productionFocus.length()").value(2));
  }

  @Test
  void invalidFocusToken_isRejected() throws Exception {
    signup("o2@focus.io", "password123", "Owner2");
    String owner = login("o2@focus.io", "password123");

    mockMvc
        .perform(
            post("/api/v1/farms")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Ferme B\",\"productionFocus\":[\"pig\"]}"))
        // 400 : un autre token serait accepté, donc c'est la requête qui est fausse.
        .andExpect(status().isBadRequest());
  }

  @Test
  void noFocus_defaultsToEmptyList() throws Exception {
    signup("o3@focus.io", "password123", "Owner3");
    String owner = login("o3@focus.io", "password123");

    mockMvc
        .perform(
            post("/api/v1/farms")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Ferme C\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.productionFocus.length()").value(0));
  }

  private void signup(String email, String password, String name) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\""
                        + password
                        + "\",\"fullName\":\""
                        + name
                        + "\"}"))
        .andExpect(status().isCreated());
  }

  private String login(String email, String password) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }
}
