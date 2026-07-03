package com.avicare.tenancy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * End-to-end proof that livestock module READ endpoints are gated by {@code resource:read}
 * permission (not just farm membership) on a real PostgreSQL (Testcontainers). A real provisioned
 * FARMER member — who has a genuine membership on the farm and therefore passes {@code hasAccess} —
 * is refused a GET on inventory / commercial routes because the FARMER role default permissions
 * (poultry + health only) do not include {@code inventory:read} / {@code commercial:read}; the
 * OWNER (permission {@code "*"}) is let through. Gating FORCED ON. CI-only where Docker is
 * unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ModulePermissionIT {

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
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void farmer_withoutInventoryRead_isForbidden_owner_isOk() throws Exception {
    String owner = onboardOwner("mpe-inv");
    long farmId = createFarm(owner, "Ferme Inventaire");
    owner = relogin("mpe-inv");
    enableModule(owner, farmId, "module.inventory");

    // Real provisioned FARMER: default perms = poultry + health only, NO inventory:read.
    String farmerPw = addMember(owner, farmId, "Farmer Inv", "mpe-inv-farmer@co.io", "FARMER");
    String farmer = loginWith("mpe-inv-farmer@co.io", farmerPw);

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/inventory/stock-items")
                .header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/inventory/stock-items")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk());
  }

  @Test
  void farmer_withoutCommercialRead_isForbidden_owner_isOk() throws Exception {
    String owner = onboardOwner("mpe-com");
    long farmId = createFarm(owner, "Ferme Commerciale");
    owner = relogin("mpe-com");
    enableModule(owner, farmId, "module.commercial.basic");

    // Real provisioned FARMER: default perms = poultry + health only, NO commercial:read.
    String farmerPw = addMember(owner, farmId, "Farmer Com", "mpe-com-farmer@co.io", "FARMER");
    String farmer = loginWith("mpe-com-farmer@co.io", farmerPw);

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/commercial/clients")
                .header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/commercial/clients")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk());
  }

  @Test
  void farmer_withoutSettingsRead_isForbidden_owner_isOk() throws Exception {
    String owner = onboardOwner("mpe-set");
    long farmId = createFarm(owner, "Ferme Réglages");
    owner = relogin("mpe-set");

    // Real provisioned FARMER: default perms = poultry + health only, NO settings:read.
    String farmerPw = addMember(owner, farmId, "Farmer Set", "mpe-set-farmer@co.io", "FARMER");
    String farmer = loginWith("mpe-set-farmer@co.io", farmerPw);

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/settings")
                .header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/settings").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk());
  }

  // --- helpers (copied verbatim from com.avicare.livestock.commercial.ClientOrderApiIT) --------

  private String onboardOwner(String slug) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + slug
                        + "@co.io\",\"password\":\"password123\",\"fullName\":\"Owner\"}"))
        .andExpect(status().isCreated());
    return relogin(slug);
  }

  private String relogin(String slug) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + slug + "@co.io\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private long createFarm(String token, String name) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }

  private void enableModule(String token, long farmId, String moduleKey) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/subscription/modules")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"" + moduleKey + "\",\"mode\":\"HARD\"}"))
        .andExpect(status().isCreated());
  }

  private String addMember(
      String ownerToken, long farmId, String fullName, String email, String role) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/users")
                    .header("Authorization", "Bearer " + ownerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"fullName\":\""
                            + fullName
                            + "\",\"email\":\""
                            + email
                            + "\",\"role\":\""
                            + role
                            + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("temporaryPassword").asText();
  }

  private String loginWith(String email, String password) throws Exception {
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
