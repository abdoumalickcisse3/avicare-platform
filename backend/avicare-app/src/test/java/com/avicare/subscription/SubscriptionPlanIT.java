package com.avicare.subscription;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
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

/**
 * Plan → Modules mapping over HTTP on a real PostgreSQL (Testcontainers, V1–V11): the public plans
 * catalog (assembled from {@code catalog_items 'bundles'}, Décision 16) and applying a plan to a
 * farm (resolve modules server-side, reconcile, set plan_key). CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class SubscriptionPlanIT {

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
  void plansCatalog_isPublic_andV1Only() throws Exception {
    mockMvc
        .perform(get("/api/v1/subscription/plans")) // no Authorization header
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(4)) // tabaski_edition (V2) excluded
        .andExpect(jsonPath("$.data[?(@.key=='pro_volaille')].recommended").value(hasItem(true)))
        .andExpect(jsonPath("$.data[?(@.key=='sur_mesure')].custom").value(hasItem(true)))
        .andExpect(
            jsonPath("$.data[?(@.key=='ferme_complete')].modules[*]")
                .value(hasItems("module.health.basic", "module.commercial.basic")));
  }

  @Test
  void applyPlan_resolvesModulesAndSetsPlanKey_thenReconcilesOnChange() throws Exception {
    signup("owner@plan.io", "password123", "Owner");
    String owner = login("owner@plan.io", "password123");
    long farmId = createFarm(owner, "Ferme Plan");
    owner = login("owner@plan.io", "password123");

    String base = "/api/v1/farms/" + farmId + "/subscription";

    // Apply Pro → 5 modules + plan_key set.
    mockMvc
        .perform(applyPlan(base, owner, "pro_volaille"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.planKey").value("pro_volaille"))
        .andExpect(jsonPath("$.data.modules.length()").value(5));

    // Re-apply Pro → no-op, still Pro.
    mockMvc
        .perform(applyPlan(base, owner, "pro_volaille"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.planKey").value("pro_volaille"))
        .andExpect(jsonPath("$.data.modules.length()").value(5));

    // Downgrade to Starter → reconciled to exactly 3 modules.
    mockMvc
        .perform(applyPlan(base, owner, "starter_volaille"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.planKey").value("starter_volaille"))
        .andExpect(jsonPath("$.data.modules.length()").value(3))
        .andExpect(jsonPath("$.data.modules[*]").value(hasItem("module.health.basic")));

    mockMvc
        .perform(get(base + "/modules").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(3));
  }

  @Test
  void applyPlan_customPlan_isRejected() throws Exception {
    signup("o2@plan.io", "password123", "Owner2");
    String owner = login("o2@plan.io", "password123");
    long farmId = createFarm(owner, "Ferme Q");
    owner = login("o2@plan.io", "password123");

    mockMvc
        .perform(applyPlan("/api/v1/farms/" + farmId + "/subscription", owner, "sur_mesure"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void applyPlan_unknownPlan_is404() throws Exception {
    signup("o3@plan.io", "password123", "Owner3");
    String owner = login("o3@plan.io", "password123");
    long farmId = createFarm(owner, "Ferme R");
    owner = login("o3@plan.io", "password123");

    mockMvc
        .perform(applyPlan("/api/v1/farms/" + farmId + "/subscription", owner, "nope"))
        .andExpect(status().isNotFound());
  }

  // --- helpers --------------------------------------------------------

  private static org.springframework.test.web.servlet.RequestBuilder applyPlan(
      String base, String token, String planKey) {
    return post(base + "/plan")
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"planKey\":\"" + planKey + "\"}");
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
