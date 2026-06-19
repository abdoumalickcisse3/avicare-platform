package com.avicare.subscription;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.subscription.service.SubscriptionService;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * End-to-end change-request workflow on a real PostgreSQL (Testcontainers): a farm OWNER drafts and
 * submits a request to add a module; a platform ADMIN approves it; the module is then enabled on
 * the farm's subscription. Also checks that approving a non-submitted request is rejected (422).
 * CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ChangeRequestFlowIT {

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
  @Autowired private JwtService jwtService;
  @Autowired private SubscriptionService subscriptionService;
  @Autowired private UserRepository userRepository;

  @Test
  void ownerSubmits_adminApproves_moduleEnabled() throws Exception {
    String ownerAccess = signupAndAccess("owner@cr.io", "password123", "Owner");
    long farmId = createFarm(ownerAccess, "Ferme CR");
    String owner = login("owner@cr.io", "password123");

    // OWNER creates a change request to add a module.
    String createJson =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/subscription/change-requests")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"requestedPlan\":\"pro_volaille\",\"requestedModules\":[\"module.poultry.broiler\"]}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.status").value("DRAFT"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long requestId = objectMapper.readTree(createJson).get("data").get("id").asLong();

    // OWNER submits it.
    mockMvc
        .perform(
            post("/api/v1/farms/"
                    + farmId
                    + "/subscription/change-requests/"
                    + requestId
                    + "/submit")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

    // Platform ADMIN approves -> module gets enabled.
    String adminToken = adminToken();
    mockMvc
        .perform(
            post("/api/v1/admin/change-requests/" + requestId + "/approve")
                .header("Authorization", "Bearer " + adminToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("APPROVED"));

    assertEnabled(farmId);
  }

  @Test
  void approveNonSubmitted_returns422() throws Exception {
    String ownerAccess = signupAndAccess("owner2@cr.io", "password123", "Owner2");
    long farmId = createFarm(ownerAccess, "Ferme CR2");
    String owner = login("owner2@cr.io", "password123");

    String createJson =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/subscription/change-requests")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"requestedModules\":[\"module.inventory\"]}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long requestId = objectMapper.readTree(createJson).get("data").get("id").asLong();

    // Still DRAFT (not submitted) -> approve is an illegal transition.
    mockMvc
        .perform(
            post("/api/v1/admin/change-requests/" + requestId + "/approve")
                .header("Authorization", "Bearer " + adminToken()))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("INVALID_CHANGE_REQUEST_TRANSITION"));
  }

  private void assertEnabled(long farmId) {
    org.assertj.core.api.Assertions.assertThat(
            subscriptionService.isModuleEnabled(farmId, "module.poultry.broiler"))
        .isTrue();
  }

  /**
   * A token for a platform ADMIN. The user must really exist because approving a change request
   * stamps {@code reviewer_id} (FK to users), so we persist an ADMIN and mint the token for its id.
   */
  private String adminToken() {
    User admin = new User();
    admin.setEmail("admin" + System.nanoTime() + "@avicare.io");
    admin.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    admin.setFullName("Platform Admin");
    admin.setRole(UserRole.ADMIN);
    admin = userRepository.save(admin);
    return jwtService.generateAccessToken(
        new AvicarePrincipal(admin.getId(), admin.getEmail(), UserRole.ADMIN, List.of()));
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
}
