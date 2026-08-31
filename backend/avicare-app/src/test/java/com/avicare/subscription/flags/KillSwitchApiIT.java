package com.avicare.subscription.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.LocalDateTime;
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
 * The kill switch end to end, on a real PostgreSQL: one click in the console and a module stops
 * answering for every farm — including for the staff member who threw the switch.
 *
 * <p>Gating is forced ON so the difference between "not subscribed" (403) and "cut right now" (503)
 * is actually exercised. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class KillSwitchApiIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();
  private static final String INVENTORY = "module.inventory";

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
    registry.add("avicare.flags.enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository userRepository;
  @Autowired private StaffPermissionRepository staffPermissions;
  @Autowired private FeatureFlagRepository flagRepository;
  @Autowired private FeatureFlagService flagService;

  @Test
  void cutsAModuleForEveryFarmAndGivesItBackWhenLifted() throws Exception {
    String farmer = signup("cut-owner");
    long farmId = createFarm(farmer, "Ferme Coupure");
    farmer = login("cut-owner");
    enableModule(farmer, farmId, INVENTORY);
    String suppliers = "/api/v1/farms/" + farmId + "/inventory/suppliers";
    String staff = staffToken("flags:manage");

    mockMvc
        .perform(get(suppliers).header("Authorization", "Bearer " + farmer))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/v1/admin/flags/" + INVENTORY + "/killswitch")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"comptage de stock faux\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.killswitchActive").value(true))
        .andExpect(jsonPath("$.data.secondsRemaining").isNumber());

    // 503, not 403: the farmer's subscription is intact and the feature is coming back.
    mockMvc
        .perform(get(suppliers).header("Authorization", "Bearer " + farmer))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.code").value("FEATURE_TEMPORARILY_UNAVAILABLE"))
        .andExpect(jsonPath("$.properties.reason").value("comptage de stock faux"));

    mockMvc
        .perform(
            post("/api/v1/admin/flags/" + INVENTORY + "/killswitch/lift")
                .header("Authorization", "Bearer " + staff))
        .andExpect(status().isOk());

    mockMvc
        .perform(get(suppliers).header("Authorization", "Bearer " + farmer))
        .andExpect(status().isOk());
  }

  @Test
  void isNotSomethingStaffCanWalkPast() throws Exception {
    String farmer = signup("cut-bypass");
    long farmId = createFarm(farmer, "Ferme Bypass");
    farmer = login("cut-bypass");
    enableModule(farmer, farmId, INVENTORY);
    String staff = staffToken("flags:manage");

    cut(staff, "bug de cascade");
    try {
      // A platform admin normally bypasses every gate. A cut exists to stop data being written,
      // and staff write the same data through the same endpoints.
      mockMvc
          .perform(
              get("/api/v1/farms/" + farmId + "/inventory/suppliers")
                  .header("Authorization", "Bearer " + staff))
          .andExpect(status().isServiceUnavailable());
    } finally {
      lift(staff);
    }
  }

  @Test
  void refusesACutWithNoReasonGiven() throws Exception {
    String staff = staffToken("flags:manage");

    mockMvc
        .perform(
            post("/api/v1/admin/flags/" + INVENTORY + "/killswitch")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"  \"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void isReservedToStaffHoldingFlagsManage() throws Exception {
    String farmer = signup("cut-intruder");

    mockMvc
        .perform(get("/api/v1/admin/flags").header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/admin/flags")).andExpect(status().isUnauthorized());
    // Staff, but holding another permission: still refused.
    mockMvc
        .perform(
            get("/api/v1/admin/flags")
                .header("Authorization", "Bearer " + staffToken("metrics:read")))
        .andExpect(status().isForbidden());
  }

  @Test
  void lapsedCutsAreSweptAndTheTrailSaysNobodyDidIt() throws Exception {
    String staff = staffToken("flags:manage");
    cut(staff, "à expirer");

    FeatureFlag flag = flagRepository.findByFlagKey(INVENTORY).orElseThrow();
    flag.setKillswitchExpiresAt(LocalDateTime.now().minusMinutes(1));
    flagRepository.save(flag);

    flagService.sweepExpiredKillswitches();

    assertThat(flagRepository.findByFlagKey(INVENTORY).orElseThrow().isKillswitchActive())
        .isFalse();

    JsonNode history =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        get("/api/v1/admin/flags/history")
                            .header("Authorization", "Bearer " + staff))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data");

    JsonNode expiry = history.get(0);
    assertThat(expiry.get("action").asText()).isEqualTo("killswitch.expire");
    assertThat(expiry.get("flagKey").asText()).isEqualTo(INVENTORY);
    // Nobody threw this one — the platform lifted it on its own.
    assertThat(expiry.get("actorUserId").isNull()).isTrue();
  }

  private void cut(String staffToken, String reason) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/flags/" + INVENTORY + "/killswitch")
                .header("Authorization", "Bearer " + staffToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"" + reason + "\"}"))
        .andExpect(status().isOk());
  }

  private void lift(String staffToken) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/flags/" + INVENTORY + "/killswitch/lift")
                .header("Authorization", "Bearer " + staffToken))
        .andExpect(status().isOk());
  }

  private String signup(String slug) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + slug
                        + "@flags.io\",\"password\":\"password123\",\"fullName\":\"Owner\"}"))
        .andExpect(status().isCreated());
    return login(slug);
  }

  private String login(String slug) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + slug + "@flags.io\",\"password\":\"password123\"}"))
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

  private String staffToken(String permission) {
    User staff = new User();
    staff.setEmail("staff" + System.nanoTime() + "@avicare.io");
    staff.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    staff.setFullName("Platform Staff");
    staff.setRole(UserRole.ADMIN);
    staff = userRepository.save(staff);
    StaffPermission grant = new StaffPermission();
    grant.setUserId(staff.getId());
    grant.setPermission(permission);
    grant.setGrantedBy(staff.getId());
    staffPermissions.save(grant);
    return jwtService.generateAccessToken(
        new AvicarePrincipal(staff.getId(), staff.getEmail(), UserRole.ADMIN, List.of()));
  }
}
