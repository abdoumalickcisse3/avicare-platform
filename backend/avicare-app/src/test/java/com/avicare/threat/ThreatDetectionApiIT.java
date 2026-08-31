package com.avicare.threat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import com.avicare.threat.repository.BlockedIpRepository;
import com.avicare.threat.repository.SecurityEventRepository;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Brute force and rate limiting on a real PostgreSQL.
 *
 * <p>Each test speaks from its own address through {@code X-Forwarded-For} — which is how the real
 * deployment identifies callers behind Caddy, and which also keeps one test's block from shutting
 * the others out.
 *
 * <p>The failed-login path is the one that earns an integration test rather than a unit one:
 * recording happens inside the transaction the authentication failure is about to roll back, and
 * only a real database says whether the event survived. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ThreatDetectionApiIT {

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
    registry.add("avicare.security.rate-limit.enabled", () -> "true");
    registry.add("avicare.security.ip-blocking.enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository userRepository;
  @Autowired private StaffPermissionRepository staffPermissions;
  @Autowired private SecurityEventRepository events;
  @Autowired private BlockedIpRepository blockedIps;

  @Test
  void survivesTheRollbackOfTheSignInItRecords() throws Exception {
    String ip = "203.0.113.11";

    failLogin(ip);

    // Recording runs inside AuthService.login, which then throws. Joining that transaction would
    // roll the event back with it, and the detector would count to zero forever.
    assertThat(events.findAll()).filteredOn(e -> ip.equals(e.getIpAddress())).isNotEmpty();
  }

  @Test
  void shutsTheDoorAfterFiveFailuresAndRefusesEverythingFromThatAddress() throws Exception {
    String ip = "203.0.113.12";

    for (int attempt = 0; attempt < 5; attempt++) {
      failLogin(ip);
    }

    assertThat(blockedIps.findById(ip)).isPresent();
    assertThat(blockedIps.findById(ip).orElseThrow().getBlockedBy()).isEqualTo("AUTO_BRUTEFORCE");

    // Not just the sign-in route: the address is refused everywhere, before authentication runs.
    mockMvc
        .perform(get("/api/v1/farms").header("X-Forwarded-For", ip))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ADDRESS_BLOCKED"));

    // Health stays reachable: a blocked address must never make the platform look down to its own
    // monitoring. Reachable, not healthy — whether the probe reports UP depends on what is running
    // beside it (no Redis in CI), and that is another test's business. What matters here is that
    // the answer is not a refusal.
    mockMvc
        .perform(get("/actuator/health").header("X-Forwarded-For", ip))
        .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(403));
  }

  @Test
  void capsHowFastOneAddressCanAskForAPasswordReset() throws Exception {
    String ip = "203.0.113.13";
    for (int attempt = 0; attempt < 5; attempt++) {
      mockMvc.perform(resetRequest(ip));
    }

    mockMvc
        .perform(resetRequest(ip))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));

    // Recorded once, not once per rejected request: under a flood, that is how the incident becomes
    // a second incident.
    assertThat(events.findAll()).filteredOn(e -> ip.equals(e.getIpAddress())).hasSize(1);
  }

  @Test
  void letsStaffBlockAndReleaseAnAddressByHand() throws Exception {
    String staff = staffToken("security:read", "security:manage");

    mockMvc
        .perform(
            post("/api/v1/admin/security/block")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ipAddress\":\"203.0.113.20\",\"reason\":\"scraping\",\"minutes\":30}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.blockedBy").isNotEmpty())
        .andExpect(jsonPath("$.data.minutesRemaining").isNumber());

    assertThat(blockedIps.findById("203.0.113.20")).isPresent();

    mockMvc
        .perform(
            post("/api/v1/admin/security/unblock")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"ipAddress\":\"203.0.113.20\",\"reason\":\"faux positif\",\"minutes\":1}"))
        .andExpect(status().isOk());

    assertThat(blockedIps.findById("203.0.113.20")).isEmpty();
  }

  @Test
  void separatesLookingFromActing() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/admin/security")
                .header("Authorization", "Bearer " + staffToken("security:read")))
        .andExpect(status().isOk());

    // Reading the timeline does not entitle anyone to lock a farmer out.
    mockMvc
        .perform(
            post("/api/v1/admin/security/block")
                .header("Authorization", "Bearer " + staffToken("security:read"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ipAddress\":\"203.0.113.30\",\"reason\":\"x\",\"minutes\":5}"))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/admin/security")).andExpect(status().isUnauthorized());
  }

  @Test
  void refusesABlockWithNoReasonOrNoEnd() throws Exception {
    String staff = staffToken("security:manage");

    mockMvc
        .perform(
            post("/api/v1/admin/security/block")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ipAddress\":\"203.0.113.40\",\"reason\":\"  \",\"minutes\":30}"))
        .andExpect(status().isBadRequest());

    // Longer than a week is almost certainly a mistake: whole towns share one operator NAT.
    mockMvc
        .perform(
            post("/api/v1/admin/security/block")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"ipAddress\":\"203.0.113.41\",\"reason\":\"trop long\",\"minutes\":99999}"))
        .andExpect(status().isBadRequest());
  }

  private void failLogin(String ip) throws Exception {
    mockMvc.perform(
        post("/api/v1/auth/login")
            .header("X-Forwarded-For", ip)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"cible@jawdi.app\",\"password\":\"mauvais\"}"));
  }

  private MockHttpServletRequestBuilder resetRequest(String ip) {
    return post("/api/v1/auth/password-reset/request")
        .header("X-Forwarded-For", ip)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"quelqu-un@jawdi.app\"}");
  }

  private String staffToken(String... permissions) {
    User staff = new User();
    staff.setEmail("staff" + System.nanoTime() + "@avicare.io");
    staff.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    staff.setFullName("Platform Staff");
    staff.setRole(UserRole.ADMIN);
    staff = userRepository.save(staff);
    for (String permission : permissions) {
      StaffPermission grant = new StaffPermission();
      grant.setUserId(staff.getId());
      grant.setPermission(permission);
      grant.setGrantedBy(staff.getId());
      staffPermissions.save(grant);
    }
    return jwtService.generateAccessToken(
        new AvicarePrincipal(staff.getId(), staff.getEmail(), UserRole.ADMIN, List.of()));
  }
}
