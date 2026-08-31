package com.avicare.integrity;

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
import com.avicare.integrity.repository.IntegrityFindingRepository;
import com.avicare.integrity.service.IntegrityCheckService;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The promise of the whole chantier, on a real PostgreSQL: break a derived figure, watch the
 * nightly checks find it, correct it from the console, and see the finding close itself.
 *
 * <p>It is also what keeps the two halves honest. A check computes what a figure <i>should</i> be;
 * the recompute writes what it <i>will</i> be. Nothing in the code forces those two expressions to
 * agree — this test does, by running one after the other on the same broken row.
 *
 * <p>The grace window is set to zero here: the fixture is written milliseconds before the sweep,
 * and in production that is exactly what the window is meant to skip. CI-only where Docker is
 * unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class IntegrityFlowIT {

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
    registry.add("avicare.integrity.grace-minutes", () -> "0");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JwtService jwtService;
  @Autowired private UserRepository userRepository;
  @Autowired private StaffPermissionRepository staffPermissions;
  @Autowired private NamedParameterJdbcTemplate jdbc;
  @Autowired private IntegrityFindingRepository findings;
  @Autowired private IntegrityCheckService checkService;

  @Test
  void findsABrokenStockQuantityCorrectsItAndClosesTheFinding() throws Exception {
    String staff = staffToken("integrity:read", "integrity:recompute");
    long farmId = aFarm("Ferme Intégrité");
    long stockItemId = aStockItemWithMovement(farmId, 100, 40);

    // The truth is 40 (the last movement's quantity_after); the aggregate says 100.
    breakStockQuantity(stockItemId, 100);

    JsonNode report = data(postOk("/api/v1/admin/integrity/run", staff, null));
    assertThat(report.get("failed").asInt())
        .describedAs("every check must run against the real schema")
        .isZero();

    JsonNode finding = onlyFindingFor("stock_current_quantity", staff);
    assertThat(finding.get("severity").asText()).isEqualTo("CRITICAL");
    assertThat(finding.get("expectedValue").asText()).isEqualTo("40");
    assertThat(finding.get("actualValue").asText()).isEqualTo("100");
    assertThat(finding.get("farmId").asLong()).isEqualTo(farmId);
    assertThat(finding.get("recomputable").asBoolean()).isTrue();
    long findingId = finding.get("id").asLong();

    // A dry run writes nothing — the console always shows this before offering the button.
    JsonNode preview =
        data(getOk("/api/v1/admin/integrity/findings/" + findingId + "/preview", staff));
    assertThat(preview.get("before").asText()).isEqualTo("100");
    assertThat(preview.get("after").asText()).isEqualTo("40");
    assertThat(preview.get("applied").asBoolean()).isFalse();
    assertThat(currentQuantity(stockItemId)).isEqualTo(100);

    // Closing a finding takes a written reason, whichever way it is closed.
    mockMvc
        .perform(
            post("/api/v1/admin/integrity/findings/" + findingId + "/recompute")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"   \"}"))
        .andExpect(status().isBadRequest());

    JsonNode applied =
        data(
            postOk(
                "/api/v1/admin/integrity/findings/" + findingId + "/recompute",
                staff,
                "{\"reason\":\"écart introduit par un import raté\"}"));
    assertThat(applied.get("applied").asBoolean()).isTrue();
    assertThat(currentQuantity(stockItemId)).isEqualTo(40);

    assertThat(findings.findById(findingId).orElseThrow().getResolutionAction())
        .isEqualTo("recomputed");

    // And the check agrees it is fixed — which is the only thing tying the two formulas together.
    checkService.runAllChecks();
    assertThat(openFindingsFor(stockItemId)).isEmpty();
  }

  @Test
  void closesOnItsOwnWhatWasFixedElsewhere() throws Exception {
    String staff = staffToken("integrity:read", "integrity:recompute");
    long farmId = aFarm("Ferme Auto");
    long stockItemId = aStockItemWithMovement(farmId, 50, 20);
    breakStockQuantity(stockItemId, 50);

    checkService.runAllChecks();
    // Scoped to this fixture's own item: the tests share one database, and a global count would
    // make this assertion depend on what the other tests happened to leave behind.
    assertThat(openFindingsFor(stockItemId)).hasSize(1);

    // Someone corrected it through the application instead.
    breakStockQuantity(stockItemId, 20);
    checkService.runAllChecks();

    assertThat(openFindingsFor(stockItemId)).isEmpty();
    assertThat(findings.findAll())
        .filteredOn(
            f -> "stock_current_quantity".equals(f.getCheckKey()) && f.getEntityId() == stockItemId)
        .allSatisfy(f -> assertThat(f.getResolutionAction()).isEqualTo("auto_resolved"));
  }

  @Test
  void refusesToRecomputeAFigureNobodyIsEntitledToOverrule() throws Exception {
    String staff = staffToken("integrity:read", "integrity:recompute");
    long farmId = aFarm("Ferme Ordre");
    long orderId = anOrderWithMismatchedTotal(farmId);

    checkService.runAllChecks();
    JsonNode finding = onlyFindingFor("order_total", staff);
    // An order total disagreeing with its lines is a business conversation, not a button: the
    // console must not offer to overwrite what somebody typed.
    assertThat(finding.get("recomputable").asBoolean()).isFalse();

    mockMvc
        .perform(
            post("/api/v1/admin/integrity/findings/" + finding.get("id").asLong() + "/recompute")
                .header("Authorization", "Bearer " + staff)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"tentative\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("RECOMPUTE_NOT_SUPPORTED"));

    assertThat(orderTotal(orderId)).isEqualTo(9999);
  }

  @Test
  void isReservedToStaffHoldingTheRightPermission() throws Exception {
    String farmer = signupAndLogin("integ-intruder");

    mockMvc
        .perform(get("/api/v1/admin/integrity").header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/admin/integrity")).andExpect(status().isUnauthorized());
    // Reading findings does not entitle anyone to rewrite a farmer's figures.
    mockMvc
        .perform(
            post("/api/v1/admin/integrity/run")
                .header("Authorization", "Bearer " + staffToken("integrity:read")))
        .andExpect(status().isForbidden());
  }

  private java.util.List<com.avicare.integrity.domain.IntegrityFinding> openFindingsFor(
      long stockItemId) {
    return findings.findByCheckKeyAndResolvedAtIsNull("stock_current_quantity").stream()
        .filter(f -> f.getEntityId() == stockItemId)
        .toList();
  }

  // --- fixture ---------------------------------------------------------------------------------

  private long aFarm(String name) throws Exception {
    String token = signupAndLogin("owner-" + System.nanoTime());
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

  /** A stock item whose single movement lands on {@code after}. */
  private long aStockItemWithMovement(long farmId, int before, int after) {
    Long itemId =
        jdbc.queryForObject(
            """
            INSERT INTO stock_items(farm_id, article_key, current_quantity, unit)
            VALUES (:farmId, 'aliment-demarrage', :after, 'KG') RETURNING id
            """,
            new MapSqlParameterSource("farmId", farmId).addValue("after", after),
            Long.class);
    jdbc.update(
        """
        INSERT INTO stock_movements(stock_item_id, movement_type, movement_date, quantity,
                                    quantity_before, quantity_after, reason)
        VALUES (:id, 'OUT', CURRENT_DATE, :qty, :before, :after, 'CONSUMPTION_LOT')
        """,
        new MapSqlParameterSource("id", itemId)
            .addValue("qty", before - after)
            .addValue("before", before)
            .addValue("after", after));
    return itemId;
  }

  /** Force the aggregate away from its ledger, the way a half-applied cascade would. */
  private void breakStockQuantity(long stockItemId, int wrongValue) {
    jdbc.update(
        "UPDATE stock_items SET current_quantity = :value WHERE id = :id",
        new MapSqlParameterSource("id", stockItemId).addValue("value", wrongValue));
  }

  private int currentQuantity(long stockItemId) {
    return jdbc.queryForObject(
        "SELECT current_quantity FROM stock_items WHERE id = :id",
        new MapSqlParameterSource("id", stockItemId),
        Integer.class);
  }

  private long anOrderWithMismatchedTotal(long farmId) {
    Long clientId =
        jdbc.queryForObject(
            """
            INSERT INTO clients(farm_id, client_type, display_name)
            VALUES (:farmId, 'INDIVIDUAL', 'Client Intégrité') RETURNING id
            """,
            new MapSqlParameterSource("farmId", farmId),
            Long.class);
    Long orderId =
        jdbc.queryForObject(
            """
            INSERT INTO orders(farm_id, order_number, client_id, status, order_date, total_xof)
            VALUES (:farmId, :number, :clientId, 'PENDING', CURRENT_DATE, 9999) RETURNING id
            """,
            new MapSqlParameterSource("farmId", farmId)
                .addValue("clientId", clientId)
                .addValue(
                    "number",
                    "ORD-" + LocalDate.now().getYear() + "-" + (System.nanoTime() % 100000)),
            Long.class);
    jdbc.update(
        """
        INSERT INTO order_items(order_id, article_key, article_source, unit, quantity,
                                unit_price_xof, line_total_xof)
        VALUES (:id, 'poulet-vif', 'PRODUCTION', 'UNIT', 10, 100, 1000)
        """,
        new MapSqlParameterSource("id", orderId));
    return orderId;
  }

  private long orderTotal(long orderId) {
    return jdbc.queryForObject(
        "SELECT total_xof FROM orders WHERE id = :id",
        new MapSqlParameterSource("id", orderId),
        Long.class);
  }

  private JsonNode onlyFindingFor(String checkKey, String staff) throws Exception {
    JsonNode summary = data(getOk("/api/v1/admin/integrity?size=100", staff));
    for (JsonNode row : summary.get("findings").get("items")) {
      if (checkKey.equals(row.get("checkKey").asText())) {
        return row;
      }
    }
    throw new AssertionError("No finding reported for " + checkKey);
  }

  private JsonNode data(String json) throws Exception {
    return objectMapper.readTree(json).get("data");
  }

  private String getOk(String url, String token) throws Exception {
    return mockMvc
        .perform(get(url).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String postOk(String url, String token, String body) throws Exception {
    var request = post(url).header("Authorization", "Bearer " + token);
    if (body != null) {
      request.contentType(MediaType.APPLICATION_JSON).content(body);
    }
    return mockMvc
        .perform(request)
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String signupAndLogin(String slug) throws Exception {
    String email = slug + "@integ.io";
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
