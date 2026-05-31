package com.avicare.identity;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
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
 * Full auth flow against a real PostgreSQL (Testcontainers) and the live security chain: signup →
 * authenticated profile read → refresh (rotation) → logout → the rotated-then-logged-out token is
 * rejected. Runs the V1 Flyway migration on a clean DB. RSA keys are injected in-memory.
 *
 * <p>CI-only on dev machines where Testcontainers can't reach the Docker daemon (see project
 * memory); GitHub Actions runs it on a standard daemon.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class AuthFlowIT {

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
  void signupLoginRefreshLogout_fullFlow() throws Exception {
    // 1. signup -> 201 + token pair
    String signupBody =
        """
        {"email":"owner@avicare.io","password":"password123","fullName":"Awa Diop"}
        """;
    String signupJson =
        mockMvc
            .perform(
                post("/api/v1/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(signupBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
            .andReturn()
            .getResponse()
            .getContentAsString();

    JsonNode signup = objectMapper.readTree(signupJson).get("data");
    String access = signup.get("accessToken").asText();
    String refresh = signup.get("refreshToken").asText();

    // 2. authenticated profile read with the access token
    mockMvc
        .perform(get("/api/v1/account/profile").header("Authorization", "Bearer " + access))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.email").value("owner@avicare.io"))
        .andExpect(jsonPath("$.data.role").value("USER"));

    // 3. duplicate signup -> 409
    mockMvc
        .perform(
            post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(signupBody))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_USED"));

    // 4. login -> 200
    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner@avicare.io\",\"password\":\"password123\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accessToken").isNotEmpty());

    // 5. refresh -> 200 + a new refresh token (rotation)
    String refreshJson =
        mockMvc
            .perform(
                post("/api/v1/auth/refresh")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"refreshToken\":\"" + refresh + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String rotated = objectMapper.readTree(refreshJson).get("data").get("refreshToken").asText();

    // 6. the old refresh token is now single-use-consumed -> 401
    mockMvc
        .perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refresh + "\"}"))
        .andExpect(status().isUnauthorized());

    // 7. logout the rotated token, then it too is rejected
    mockMvc
        .perform(
            post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + rotated + "\"}"))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + rotated + "\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void login_wrongPassword_returns401() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"bob@avicare.io\",\"password\":\"password123\",\"fullName\":\"Bob\"}"))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@avicare.io\",\"password\":\"wrongpass\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));
  }

  @Test
  void profile_withoutToken_returns401() throws Exception {
    mockMvc.perform(get("/api/v1/account/profile")).andExpect(status().isUnauthorized());
  }
}
