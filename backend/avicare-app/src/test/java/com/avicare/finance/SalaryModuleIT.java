package com.avicare.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end salary and advance REST API over HTTP on a real PostgreSQL (Testcontainers, Sprint B6
 * P2, task S3): a farm owner sets a monthly salary for a real provisioned FARMER, the FARMER
 * self-requests an advance ({@code /api/v1/my/advances}, ungated), the owner approves it (which
 * immediately records a SALARY expense), then generates the monthly salary (deducting the
 * outstanding advance) and pays it (recording a second SALARY expense); regenerating the same
 * period is refused. A second scenario checks self-service isolation and RBAC: a FARMER can only
 * browse their own advances and is refused on the manager-only salary endpoints, an owner of
 * another farm cannot reach a self-service route on a farm they don't belong to, and setting a
 * salary for a non-member is refused. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class SalaryModuleIT {

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
  void advanceThenSalaryGeneration_deductsAdvance_andRegenerationIsRefused() throws Exception {
    String owner = onboardOwner("sal-cycle");
    long farmId = createFarm(owner, "Ferme Salaires");
    owner = relogin("sal-cycle");
    enableModule(owner, farmId, "module.finance");

    String farmerPw = addMember(owner, farmId, "Farmer Sal", "sal-cycle-farmer@co.io", "FARMER");
    long farmerId = memberId(owner, farmId, "sal-cycle-farmer@co.io");
    String farmer = loginWith("sal-cycle-farmer@co.io", farmerPw);

    String fin = "/api/v1/farms/" + farmId + "/finance";

    putOk(
        fin + "/salary-settings",
        owner,
        String.format("{\"userId\":%d,\"monthlySalaryXof\":120000}", farmerId));

    JsonNode advance =
        data(
            postCreated(
                "/api/v1/my/advances",
                farmer,
                String.format(
                    "{\"farmId\":%d,\"amountXof\":30000,\"reason\":\"urgence\"}", farmId)));
    assertThat(advance.get("status").asText()).isEqualTo("PENDING");
    long advanceId = advance.get("id").asLong();

    JsonNode pending = data(getOk(fin + "/advances?status=PENDING", owner));
    assertThat(stream(pending)).anyMatch(a -> a.get("id").asLong() == advanceId);

    JsonNode approved = data(postOk(fin + "/advances/" + advanceId + "/approve", owner, null));
    assertThat(approved.get("status").asText()).isEqualTo("APPROVED");

    JsonNode expensesAfterAdvance = data(getOk(fin + "/expenses", owner));
    assertThat(stream(expensesAfterAdvance))
        .anyMatch(
            e ->
                e.get("source").asText().equals("SALARY")
                    && e.get("amountXof").asLong() == 30000
                    && e.get("label").asText().equals("Avance sur salaire"));

    JsonNode generated =
        data(postCreated(fin + "/salaries/generate", owner, "{\"period\":\"2026-07\"}"));
    assertThat(generated).hasSize(1);
    JsonNode salary = generated.get(0);
    assertThat(salary.get("grossXof").asLong()).isEqualTo(120000);
    assertThat(salary.get("advanceDeductedXof").asLong()).isEqualTo(30000);
    assertThat(salary.get("netXof").asLong()).isEqualTo(90000);
    assertThat(salary.get("status").asText()).isEqualTo("DUE");
    long salaryId = salary.get("id").asLong();

    JsonNode paid = data(postOk(fin + "/salaries/" + salaryId + "/pay", owner, null));
    assertThat(paid.get("status").asText()).isEqualTo("PAID");

    JsonNode expensesAfterPay = data(getOk(fin + "/expenses", owner));
    assertThat(stream(expensesAfterPay))
        .anyMatch(
            e ->
                e.get("source").asText().equals("SALARY")
                    && e.get("amountXof").asLong() == 90000
                    && e.get("label").asText().equals("Salaire 2026-07"));

    mockMvc
        .perform(
            post(fin + "/salaries/generate")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"period\":\"2026-07\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SALARY_PERIOD_EXISTS"));
  }

  @Test
  void selfServiceIsolation_andManagerOnlyRbac() throws Exception {
    String owner = onboardOwner("sal-rbac");
    long farmId = createFarm(owner, "Ferme RBAC Salaires");
    owner = relogin("sal-rbac");
    enableModule(owner, farmId, "module.finance");

    String farmerPw = addMember(owner, farmId, "Farmer Rbac", "sal-rbac-farmer@co.io", "FARMER");
    long farmerId = memberId(owner, farmId, "sal-rbac-farmer@co.io");
    String farmer = loginWith("sal-rbac-farmer@co.io", farmerPw);

    postCreated(
        "/api/v1/my/advances",
        farmer,
        String.format("{\"farmId\":%d,\"amountXof\":15000,\"reason\":\"depense\"}", farmId));

    // FARMER sees their own advance via the self-service route.
    JsonNode mine = data(getOk("/api/v1/my/advances?farmId=" + farmId, farmer));
    assertThat(stream(mine)).anyMatch(a -> a.get("userId").asLong() == farmerId);

    // FARMER has no finance:read -> refused on the manager-side salaries route.
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/finance/salaries")
                .header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());

    // An owner with no membership on farmId cannot reach the self-service route on it either.
    String owner2 = onboardOwner("sal-rbac-other");
    createFarm(owner2, "Ferme Autre");
    owner2 = relogin("sal-rbac-other");
    mockMvc
        .perform(
            get("/api/v1/my/advances?farmId=" + farmId).header("Authorization", "Bearer " + owner2))
        .andExpect(status().isForbidden());

    // Setting a salary for a non-member is refused.
    mockMvc
        .perform(
            put("/api/v1/farms/" + farmId + "/finance/salary-settings")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":999999999,\"monthlySalaryXof\":50000}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("NOT_A_MEMBER"));
  }

  // --- HTTP helpers -----------------------------------------------------

  private JsonNode data(JsonNode response) {
    return response.get("data");
  }

  private static Stream<JsonNode> stream(JsonNode array) {
    return StreamSupport.stream(array.spliterator(), false);
  }

  private JsonNode getOk(String url, String token) throws Exception {
    return read(
        mockMvc
            .perform(get(url).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()));
  }

  private JsonNode postCreated(String url, String token, String body) throws Exception {
    var req = post(url).header("Authorization", "Bearer " + token);
    if (body != null) {
      req = req.contentType(MediaType.APPLICATION_JSON).content(body);
    }
    return read(mockMvc.perform(req).andExpect(status().isCreated()));
  }

  private JsonNode postOk(String url, String token, String body) throws Exception {
    var req = post(url).header("Authorization", "Bearer " + token);
    if (body != null) {
      req = req.contentType(MediaType.APPLICATION_JSON).content(body);
    }
    return read(mockMvc.perform(req).andExpect(status().is2xxSuccessful()));
  }

  private JsonNode putOk(String url, String token, String body) throws Exception {
    return read(
        mockMvc
            .perform(
                put(url)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isOk()));
  }

  private JsonNode read(ResultActions actions) throws Exception {
    return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  // --- bootstrap helpers (copied verbatim from com.avicare.finance.FinanceModuleIT) -------------

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

  private long memberId(String ownerToken, long farmId, String email) throws Exception {
    JsonNode members = data(getOk("/api/v1/farms/" + farmId + "/users", ownerToken));
    return stream(members)
        .filter(m -> m.get("email").asText().equals(email))
        .findFirst()
        .orElseThrow()
        .get("userId")
        .asLong();
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
