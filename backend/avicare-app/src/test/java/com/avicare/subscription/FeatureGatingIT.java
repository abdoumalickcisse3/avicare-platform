package com.avicare.subscription;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.subscription.service.SubscriptionService;
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
 * End-to-end feature-gating flow on a real PostgreSQL (Testcontainers): a test-only endpoint
 * guarded by {@code @features.isEnabled(#farmId, 'module.poultry.broiler')} returns 403 while the
 * module is not on the farm's subscription, and 200 once enabled. The token is minted for an OWNER
 * of the farm so {@code @farmAccess} (request-level) passes and only the feature gate decides.
 * CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
@org.springframework.context.annotation.Import(FeatureGatingIT.GatedController.class)
class FeatureGatingIT {

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
    // Force gating ON so this test exercises the real gate even if a dev exported
    // avicare.features.gating-enabled=false in their environment (ADR-004).
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private SubscriptionService subscriptionService;

  @Test
  void gatedEndpoint_403WhenModuleOff_then200WhenEnabled() throws Exception {
    // Sign up + create a farm -> the caller becomes OWNER.
    String access = signupAndAccess("gate@farm.io", "password123", "Gate");
    long farmId = createFarm(access, "Ferme Gate");

    // A fresh login carries the OWNER membership in the JWT (so @farmAccess passes).
    String owner = login("gate@farm.io", "password123");

    // Module not enabled yet -> feature gate denies (403).
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/gated").header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());

    // Enable the module on the farm's subscription.
    subscriptionService.enableModule(
        farmId, "module.poultry.broiler", com.avicare.subscription.domain.FeatureMode.HARD, null);

    // Now the gate opens (200).
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/gated").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.farmId").value(farmId));
  }

  private String signupAndAccess(String email, String password, String name) throws Exception {
    String body =
        "{\"email\":\""
            + email
            + "\",\"password\":\""
            + password
            + "\",\"fullName\":\""
            + name
            + "\"}";
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private long createFarm(String access, String name) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + access)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
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

  /** Test-only endpoint exercising the {@code @features} gate. */
  @org.springframework.web.bind.annotation.RestController
  static class GatedController {
    @org.springframework.web.bind.annotation.GetMapping("/api/v1/farms/{farmId}/gated")
    @org.springframework.security.access.prepost.PreAuthorize(
        "@features.isEnabled(#farmId, 'module.poultry.broiler')")
    java.util.Map<String, Object> gated(
        @org.springframework.web.bind.annotation.PathVariable Long farmId) {
      return java.util.Map.of("farmId", farmId);
    }
  }
}
