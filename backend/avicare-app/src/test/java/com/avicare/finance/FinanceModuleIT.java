package com.avicare.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.LocalDate;
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
 * End-to-end finance REST API over HTTP on a real PostgreSQL (Testcontainers, Sprint B6 P1, task
 * B5): a manual expense feeds the farm-wide analytics (total expenses, margin) and the farm summary
 * (SUM Object[] mapping against real Postgres); a purchase-order reception and a manual valued
 * stock movement each auto-record an expense (PURCHASE / STOCK_ENTRY) that cannot be edited (422);
 * a real provisioned FARMER (default perms have no {@code finance:read}) is refused, and so is an
 * owner on a farm without {@code module.finance} enabled. Gating is FORCED ON. CI-only where Docker
 * is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class FinanceModuleIT {

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
  void manualExpense_feedsFarmAnalyticsAndSummary() throws Exception {
    String owner = onboardOwner("fin-manual");
    long farmId = createFarm(owner, "Ferme Finance Manuelle");
    owner = relogin("fin-manual");
    enableModule(owner, farmId, "module.finance");
    enableModule(owner, farmId, "module.poultry.broiler");

    long breedId = data(getOk("/api/v1/breeds?species=POULTRY", owner)).get(0).get("id").asLong();
    long unitId =
        data(postCreated(
                "/api/v1/farms/" + farmId + "/production-units",
                owner,
                String.format(
                    "{\"name\":\"Lot A\",\"breedId\":%d,\"initialCount\":100,\"startDate\":\"%s\"}",
                    breedId, LocalDate.now())))
            .get("id")
            .asLong();

    String fin = "/api/v1/farms/" + farmId + "/finance";
    JsonNode expense =
        data(
            postCreated(
                fin + "/expenses",
                owner,
                String.format(
                    "{\"categoryKey\":\"feed\",\"amountXof\":50000,\"expenseDate\":\"%s\","
                        + "\"label\":\"Aliment\",\"productionUnitId\":%d}",
                    LocalDate.now(), unitId)));
    assertThat(expense.get("source").asText()).isEqualTo("MANUAL");

    JsonNode analytics = data(getOk(fin + "/analytics", owner));
    assertThat(analytics.get("totalExpenseXof").asLong()).isEqualTo(50000);
    assertThat(analytics.get("totalRevenueXof").asLong()).isZero();
    assertThat(analytics.get("marginXof").asLong()).isEqualTo(-50000);

    // Real-Postgres SUM(Object[]) mapping (B2 review follow-up).
    JsonNode summary = data(getOk(fin + "/summary", owner));
    assertThat(summary.get("totalXof").asLong()).isEqualTo(50000);
    assertThat(stream(summary.get("categories")))
        .anyMatch(
            c ->
                c.get("categoryKey").asText().equals("feed")
                    && c.get("amountXof").asLong() == 50000);
  }

  @Test
  void purchaseOrderReception_recordsPurchaseExpense_andCannotBeEdited() throws Exception {
    String owner = onboardOwner("fin-purchase");
    long farmId = createFarm(owner, "Ferme Achat");
    owner = relogin("fin-purchase");
    enableModule(owner, farmId, "module.finance");
    enableModule(owner, farmId, "module.inventory");
    String inv = "/api/v1/farms/" + farmId + "/inventory";
    String fin = "/api/v1/farms/" + farmId + "/finance";

    String articleKey =
        data(getOk(inv + "/catalog/articles", owner)).get(0).get("articleKey").asText();
    int unitPrice = 600;
    int quantity = 100;

    long supplierId =
        data(postCreated(inv + "/suppliers", owner, "{\"commercialName\":\"Fournisseur Aliment\"}"))
            .get("id")
            .asLong();

    JsonNode po =
        data(
            postCreated(
                inv + "/purchase-orders",
                owner,
                String.format(
                    """
                    {"supplierId":%d,"lines":[
                      {"articleKey":"%s","articleSource":"INVENTORY","orderedQuantity":%d,"unitPriceXof":%d}]}
                    """,
                    supplierId, articleKey, quantity, unitPrice)));
    long poId = po.get("id").asLong();
    long itemId = po.get("items").get(0).get("id").asLong();

    postOk(inv + "/purchase-orders/" + poId + "/submit", owner, null);
    postOk(
        inv + "/purchase-orders/" + poId + "/receive",
        owner,
        String.format("{\"lines\":[{\"itemId\":%d,\"receivedQuantity\":%d}]}", itemId, quantity));

    long expectedAmount = (long) quantity * unitPrice;
    JsonNode expenses = data(getOk(fin + "/expenses", owner));
    JsonNode purchaseExpense =
        stream(expenses)
            .filter(
                e ->
                    e.get("source").asText().equals("PURCHASE")
                        && e.get("amountXof").asLong() == expectedAmount)
            .findFirst()
            .orElseThrow();
    long expenseId = purchaseExpense.get("id").asLong();

    // Guard: auto-recorded expenses cannot be edited (422 EXPENSE_NOT_EDITABLE).
    mockMvc
        .perform(
            put(fin + "/expenses/" + expenseId)
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    String.format(
                        "{\"categoryKey\":\"feed\",\"amountXof\":1,\"expenseDate\":\"%s\","
                            + "\"label\":\"x\"}",
                        LocalDate.now())))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.code")
                .value("EXPENSE_NOT_EDITABLE"));
  }

  @Test
  void manualValuedStockEntry_recordsStockEntryExpense() throws Exception {
    String owner = onboardOwner("fin-stock");
    long farmId = createFarm(owner, "Ferme Stock");
    owner = relogin("fin-stock");
    enableModule(owner, farmId, "module.finance");
    enableModule(owner, farmId, "module.inventory");
    String inv = "/api/v1/farms/" + farmId + "/inventory";
    String fin = "/api/v1/farms/" + farmId + "/finance";

    String articleKey =
        data(getOk(inv + "/catalog/articles", owner)).get(0).get("articleKey").asText();

    // Bootstrap a stock item via a small PO reception (movements require an existing stock item).
    long supplierId =
        data(postCreated(inv + "/suppliers", owner, "{\"commercialName\":\"Fournisseur\"}"))
            .get("id")
            .asLong();
    JsonNode po =
        data(
            postCreated(
                inv + "/purchase-orders",
                owner,
                String.format(
                    """
                    {"supplierId":%d,"lines":[
                      {"articleKey":"%s","articleSource":"INVENTORY","orderedQuantity":10,"unitPriceXof":100}]}
                    """,
                    supplierId, articleKey)));
    long itemId = po.get("items").get(0).get("id").asLong();
    postOk(inv + "/purchase-orders/" + po.get("id").asLong() + "/submit", owner, null);
    postOk(
        inv + "/purchase-orders/" + po.get("id").asLong() + "/receive",
        owner,
        String.format("{\"lines\":[{\"itemId\":%d,\"receivedQuantity\":10}]}", itemId));
    long stockItemId =
        stream(data(getOk(inv + "/stock-items", owner)))
            .filter(s -> s.get("articleKey").asText().equals(articleKey))
            .findFirst()
            .orElseThrow()
            .get("id")
            .asLong();

    int quantity = 20;
    int unitPriceXof = 750;
    postCreated(
        inv + "/movements",
        owner,
        String.format(
            "{\"stockItemId\":%d,\"movementType\":\"IN\",\"quantity\":%d,\"reason\":\"GIFT\","
                + "\"unitPriceXof\":%d}",
            stockItemId, quantity, unitPriceXof));

    long expectedAmount = (long) quantity * unitPriceXof;
    JsonNode expenses = data(getOk(fin + "/expenses", owner));
    assertThat(stream(expenses))
        .anyMatch(
            e ->
                e.get("source").asText().equals("STOCK_ENTRY")
                    && e.get("amountXof").asLong() == expectedAmount);
  }

  @Test
  void farmer_withoutFinanceRead_isForbidden_owner_withoutModule_isForbidden() throws Exception {
    String owner = onboardOwner("fin-rbac");
    long farmId = createFarm(owner, "Ferme RBAC Finance");
    owner = relogin("fin-rbac");
    enableModule(owner, farmId, "module.finance");

    // Real provisioned FARMER: default perms = poultry + health only, NO finance:read.
    String farmerPw = addMember(owner, farmId, "Farmer Fin", "fin-rbac-farmer@co.io", "FARMER");
    String farmer = loginWith("fin-rbac-farmer@co.io", farmerPw);

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/finance/expenses")
                .header("Authorization", "Bearer " + farmer))
        .andExpect(status().isForbidden());

    // A second farm, owner, module.finance NOT enabled.
    String owner2 = onboardOwner("fin-rbac-nomod");
    long farmId2 = createFarm(owner2, "Ferme Sans Module Finance");
    owner2 = relogin("fin-rbac-nomod");

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId2 + "/finance/expenses")
                .header("Authorization", "Bearer " + owner2))
        .andExpect(status().isForbidden());
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

  private JsonNode read(ResultActions actions) throws Exception {
    return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  // --- bootstrap helpers (copied verbatim from com.avicare.tenancy.ModulePermissionIT) ----------

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
