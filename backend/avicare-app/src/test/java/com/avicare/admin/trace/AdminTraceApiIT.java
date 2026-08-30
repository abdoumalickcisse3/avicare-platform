package com.avicare.admin.trace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * The acceptance path of the whole chantier, on a real PostgreSQL: a call is made, the identifier
 * it returned is typed into the console, and the request comes back — with its payload masked, its
 * outcome, and nobody but staff able to read it.
 *
 * <p>Traces are written off the request thread, so the assertions poll rather than assume. CI-only
 * where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class AdminTraceApiIT {

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
    registry.add("avicare.tracing.enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository userRepository;
  @Autowired private StaffPermissionRepository staffPermissions;

  @Test
  void findsTheTraceOfAWriteFromTheIdentifierTheCallerWasGiven() throws Exception {
    String farmer = signup("trace-owner");

    String correlationId =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + farmer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Traçage\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getHeader("X-Correlation-Id");

    assertThat(correlationId).isNotBlank();

    JsonNode row = awaitTrace(correlationId);
    assertThat(row.get("method").asText()).isEqualTo("POST");
    assertThat(row.get("path").asText()).isEqualTo("/api/v1/farms");
    assertThat(row.get("statusCode").asInt()).isEqualTo(201);
    assertThat(row.get("userEmail").asText()).isEqualTo("trace-owner@trace.io");
    assertThat(row.get("hasError").asBoolean()).isFalse();

    JsonNode detail = data(getOk("/api/v1/admin/traces/" + row.get("id").asLong(), staffToken()));
    assertThat(detail.get("requestBody").asText()).contains("Ferme Traçage");
    assertThat(detail.get("routePattern").asText()).isEqualTo("/api/v1/farms");
    assertThat(detail.get("durationMs").asInt()).isNotNegative();
  }

  @Test
  void masksTheCredentialsOfALoginAndKeepsTheFailure() throws Exception {
    signup("trace-login");

    String correlationId =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"email\":\"trace-login@trace.io\",\"password\":\"definitely-wrong\"}"))
            .andReturn()
            .getResponse()
            .getHeader("X-Correlation-Id");

    JsonNode row = awaitTrace(correlationId);
    assertThat(row.get("statusCode").asInt()).isGreaterThanOrEqualTo(400);

    JsonNode detail = data(getOk("/api/v1/admin/traces/" + row.get("id").asLong(), staffToken()));
    // The whole point: a support tool must not become a password log.
    assertThat(detail.get("requestBody").asText())
        .contains("trace-login@trace.io")
        .doesNotContain("definitely-wrong");
    // A failed response is kept, because that is what the support call will be about.
    assertThat(detail.get("responseBody").asText()).isNotBlank();
  }

  @Test
  void isRefusedToEveryoneButStaffHoldingMetricsRead() throws Exception {
    String farmer = signup("trace-intruder");

    mockMvc
        .perform(get("/api/v1/admin/traces").header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/admin/traces")).andExpect(status().isUnauthorized());

    // Staff without the permission is staff, and still refused.
    mockMvc
        .perform(get("/api/v1/admin/traces").header("Authorization", "Bearer " + staffToken(null)))
        .andExpect(status().isForbidden());
  }

  /** Polls the console search until the asynchronous write lands (or the wait is called off). */
  private JsonNode awaitTrace(String correlationId) throws Exception {
    String token = staffToken();
    for (int attempt = 0; attempt < 50; attempt++) {
      JsonNode items =
          objectMapper
              .readTree(getOk("/api/v1/admin/traces?requestId=" + correlationId, token))
              .get("items");
      if (items != null && items.size() > 0) {
        return items.get(0);
      }
      Thread.sleep(100);
    }
    throw new AssertionError("No trace recorded for correlation id " + correlationId);
  }

  private String getOk(String url, String token) throws Exception {
    return mockMvc
        .perform(get(url).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private JsonNode data(String json) throws Exception {
    return objectMapper.readTree(json).get("data");
  }

  private String signup(String slug) throws Exception {
    String email = slug + "@trace.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"Owner\"}"))
        .andExpect(status().isCreated());
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private String staffToken() {
    return staffToken("metrics:read");
  }

  /** A real staff account (the audit trail of {@code trace.view} stamps its id), plus a grant. */
  private String staffToken(String permission) {
    User staff = new User();
    staff.setEmail("staff" + System.nanoTime() + "@avicare.io");
    staff.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    staff.setFullName("Platform Staff");
    staff.setRole(UserRole.ADMIN);
    staff = userRepository.save(staff);
    if (permission != null) {
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
