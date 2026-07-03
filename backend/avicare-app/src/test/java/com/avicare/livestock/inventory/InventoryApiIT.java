package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end inventory REST API over HTTP on a real PostgreSQL (Testcontainers, V1–V19, Sprint
 * B4-6): the full owner happy-path across the 7 controllers (catalog, suppliers, purchase-order
 * workflow with cascade to stock, manual movements, feed-formula clone/update, alerts), the D18
 * coupling exposure (positive + Option α 422), feature gating (403), RBAC (VETERINARIAN read-only)
 * and cross-farm isolation (404). Gating is FORCED ON. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class InventoryApiIT {

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
    // Force gating ON so the 403-without-module case is actually exercised (ADR-004).
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JwtService jwtService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private ProductionUnitRepository productionUnitRepository;

  @Test
  void fullInventoryFlow_ownerHappyPath() throws Exception {
    String owner = onboardOwner("inv-happy");
    long farmId = createFarm(owner, "Ferme Inventaire");
    owner = relogin("inv-happy");
    enableModule(owner, farmId, "module.inventory");
    enableModule(owner, farmId, "module.health.basic");
    String inv = "/api/v1/farms/" + farmId + "/inventory";

    // Catalog: pick an inventory article to order.
    JsonNode articles = data(getOk(inv + "/catalog/articles", owner));
    assertThat(articles.size()).isPositive();
    JsonNode article = articles.get(0);
    String articleKey = article.get("articleKey").asText();
    int unitPrice =
        article.path("typicalUnitPriceXof").isNumber()
            ? article.get("typicalUnitPriceXof").asInt()
            : 500;

    // Supplier.
    JsonNode supplier =
        data(
            postOk(
                inv + "/suppliers",
                owner,
                """
                {"commercialName":"Fournisseur Aliment","types":["FEED"],"city":"Thiès"}
                """));
    long supplierId = supplier.get("id").asLong();

    // Purchase order DRAFT (order number BC-YYYY-NNN).
    JsonNode po =
        data(
            postOk(
                inv + "/purchase-orders",
                owner,
                String.format(
                    """
                    {"supplierId":%d,"expectedDeliveryDate":"%s","lines":[
                      {"articleKey":"%s","articleSource":"INVENTORY","orderedQuantity":100,"unitPriceXof":%d}]}
                    """,
                    supplierId, LocalDate.now().minusDays(1), articleKey, unitPrice)));
    long poId = po.get("id").asLong();
    assertThat(po.get("status").asText()).isEqualTo("DRAFT");
    assertThat(po.get("orderNumber").asText()).startsWith("BC-");
    long itemId = po.get("items").get(0).get("id").asLong();

    // submit -> SENT, receive -> RECEIVED (cascades stock IN).
    assertThat(
            data(postOk(inv + "/purchase-orders/" + poId + "/submit", owner, null))
                .get("status")
                .asText())
        .isEqualTo("SENT");
    JsonNode received =
        data(
            postOk(
                inv + "/purchase-orders/" + poId + "/receive",
                owner,
                String.format("{\"lines\":[{\"itemId\":%d,\"receivedQuantity\":100}]}", itemId)));
    assertThat(received.get("status").asText()).isEqualTo("RECEIVED");

    // Stock item now exists with the received quantity.
    JsonNode stockItems = data(getOk(inv + "/stock-items", owner));
    JsonNode stock =
        stream(stockItems)
            .filter(s -> s.get("articleKey").asText().equals(articleKey))
            .findFirst()
            .orElseThrow();
    long stockItemId = stock.get("id").asLong();
    assertThat(stock.get("currentQuantity").asDouble()).isEqualTo(100.0);

    // The reception movement carries the PO backref.
    JsonNode movements = data(getOk(inv + "/movements?stockItemId=" + stockItemId, owner));
    assertThat(stream(movements))
        .anyMatch(
            m ->
                m.path("purchaseOrderId").asLong() == poId
                    && m.get("movementType").asText().equals("IN"));

    // Manual OUT large enough to drive the stock negative (D19 non-blocking).
    postOk(
        inv + "/movements",
        owner,
        String.format(
            "{\"stockItemId\":%d,\"movementType\":\"OUT\",\"quantity\":150,\"reason\":\"LOSS\"}",
            stockItemId));
    assertThat(
            data(getOk(inv + "/stock-items/" + stockItemId, owner))
                .get("currentQuantity")
                .asDouble())
        .isEqualTo(-50.0);

    // Feed formula: clone a platform template then update it.
    String platformKey =
        data(getOk(inv + "/catalog/feed-formulas", owner)).get(0).get("key").asText();
    JsonNode cloned =
        data(
            postOk(
                inv + "/feed-formulas/clone",
                owner,
                String.format(
                    "{\"sourceFormulaKey\":\"%s\",\"newName\":\"Ma formule\"}", platformKey)));
    long formulaId = cloned.get("id").asLong();
    JsonNode updated =
        data(
            putOk(
                inv + "/feed-formulas/" + formulaId,
                owner,
                String.format(
                    """
                    {"name":"Ma formule v2","targetPhase":"STARTER","ingredients":[
                      {"articleKey":"%s","articleSource":"INVENTORY","percentage":100}]}
                    """,
                    articleKey)));
    assertThat(updated.get("name").asText()).isEqualTo("Ma formule v2");
    assertThat(updated.get("ingredients").size()).isEqualTo(1);

    // listAllAvailable returns platform + farm formulas.
    JsonNode available = data(getOk(inv + "/feed-formulas", owner));
    assertThat(available.get("platformFormulas").size()).isPositive();
    assertThat(available.get("farmFormulas").size()).isPositive();

    // D18 positive: a vaccination drawing the medication from stock creates an OUT with backref.
    long unitId = seedUnit(farmId);
    JsonNode vacc =
        data(
            postOk(
                "/api/v1/farms/" + farmId + "/health/vaccinations",
                owner,
                String.format(
                    """
                    {"unitId":%d,"vaccineKey":"newcastle_la_sota","administeredDate":"%s",
                     "subjectsCount":1000,"stockConsumption":{"articleKey":"amoxicillin_50",
                     "articleSource":"TREATMENT","quantity":10}}
                    """,
                    unitId, LocalDate.now())));
    long vaccId = vacc.get("id").asLong();
    JsonNode lotMovements = data(getOk(inv + "/movements/by-lot?unitId=" + unitId, owner));
    assertThat(stream(lotMovements)).anyMatch(m -> m.path("vaccinationId").asLong() == vaccId);

    // Alerts: the negative stock item shows up.
    JsonNode alerts = data(getOk(inv + "/alerts", owner));
    assertThat(stream(alerts.get("negativeStockItems")))
        .anyMatch(s -> s.get("stockItemId").asLong() == stockItemId);
  }

  @Test
  void inventoryEndpoint_withoutModule_returns403() throws Exception {
    String owner = onboardOwner("inv-gate");
    long farmId = createFarm(owner, "Ferme Sans Module");
    owner = relogin("inv-gate");
    // module.inventory NOT enabled.
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/inventory/stock-items")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());
  }

  @Test
  void veterinarian_canRead_butCannotCreatePurchaseOrder() throws Exception {
    String owner = onboardOwner("inv-rbac");
    long farmId = createFarm(owner, "Ferme RBAC");
    owner = relogin("inv-rbac");
    enableModule(owner, farmId, "module.inventory");
    String inv = "/api/v1/farms/" + farmId + "/inventory";

    String vet =
        jwtService.generateAccessToken(
            new AvicarePrincipal(
                888L,
                "vet@inv.io",
                UserRole.USER,
                List.of(new Membership(farmId, FarmRole.VETERINARIAN, List.of("inventory:read")))));

    getOk(inv + "/suppliers", vet); // read allowed (explicit inventory:read grant)
    mockMvc
        .perform(
            post(inv + "/purchase-orders")
                .header("Authorization", "Bearer " + vet)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"supplierId\":1,\"lines\":[{\"articleKey\":\"x\",\"articleSource\":\"INVENTORY\",\"orderedQuantity\":1,\"unitPriceXof\":1}]}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void crossFarm_stockItem_returns404() throws Exception {
    String a = onboardOwner("inv-fa");
    long farmA = createFarm(a, "Ferme A");
    a = relogin("inv-fa");
    enableModule(a, farmA, "module.inventory");

    String b = onboardOwner("inv-fb");
    long farmB = createFarm(b, "Ferme B");
    b = relogin("inv-fb");
    enableModule(b, farmB, "module.inventory");

    // Create a stock item in farm A via a movement-less path: a received PO. Simpler: a manual IN
    // needs an existing stock item, which is created by the coupling/PO only. Use a supplier+PO.
    String invA = "/api/v1/farms/" + farmA + "/inventory";
    long supplierId =
        data(postOk(invA + "/suppliers", a, "{\"commercialName\":\"S\"}")).get("id").asLong();
    String articleKey =
        data(getOk(invA + "/catalog/articles", a)).get(0).get("articleKey").asText();
    long poId =
        data(postOk(
                invA + "/purchase-orders",
                a,
                String.format(
                    "{\"supplierId\":%d,\"lines\":[{\"articleKey\":\"%s\",\"articleSource\":\"INVENTORY\",\"orderedQuantity\":10,\"unitPriceXof\":100}]}",
                    supplierId, articleKey)))
            .get("id")
            .asLong();
    long itemId =
        data(getOk(invA + "/purchase-orders/" + poId, a)).get("items").get(0).get("id").asLong();
    postOk(invA + "/purchase-orders/" + poId + "/submit", a, null);
    postOk(
        invA + "/purchase-orders/" + poId + "/receive",
        a,
        String.format("{\"lines\":[{\"itemId\":%d,\"receivedQuantity\":10}]}", itemId));
    long stockItemId = data(getOk(invA + "/stock-items", a)).get(0).get("id").asLong();

    // Owner B reaches into farm A's stock item via farm B's path → 404.
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmB + "/inventory/stock-items/" + stockItemId)
                .header("Authorization", "Bearer " + b))
        .andExpect(status().isNotFound());
  }

  @Test
  void couplingPayload_withoutInventoryModule_returns422_andRollsBack() throws Exception {
    String owner = onboardOwner("inv-alpha");
    long farmId = createFarm(owner, "Ferme Alpha");
    owner = relogin("inv-alpha");
    enableModule(owner, farmId, "module.health.basic"); // health on, inventory OFF
    long unitId = seedUnit(farmId);
    String base = "/api/v1/farms/" + farmId + "/health";

    mockMvc
        .perform(
            post(base + "/vaccinations")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    String.format(
                        """
                        {"unitId":%d,"vaccineKey":"newcastle_la_sota","administeredDate":"%s",
                         "subjectsCount":1000,"stockConsumption":{"articleKey":"amoxicillin_50",
                         "articleSource":"TREATMENT","quantity":10}}
                        """,
                        unitId, LocalDate.now())))
        .andExpect(status().isUnprocessableEntity());

    // Option α rollback: no vaccination persisted.
    assertThat(data(getOk(base + "/vaccinations?unitId=" + unitId, owner)).size()).isZero();
  }

  // --- helpers --------------------------------------------------------

  private long seedUnit(long farmId) {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setBreedId(breedId);
    unit.setName("Lot");
    unit.setStartDate(LocalDate.now().minusDays(10));
    unit.setCurrentCount(1000);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(unit).getId();
  }

  private JsonNode data(JsonNode response) {
    return response.get("data");
  }

  private static java.util.stream.Stream<JsonNode> stream(JsonNode array) {
    return java.util.stream.StreamSupport.stream(array.spliterator(), false);
  }

  private JsonNode getOk(String url, String token) throws Exception {
    return read(
        mockMvc
            .perform(get(url).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()));
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

  private JsonNode read(org.springframework.test.web.servlet.ResultActions actions)
      throws Exception {
    return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  private String onboardOwner(String slug) throws Exception {
    String email = slug + "@inv.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"Owner\"}"))
        .andExpect(status().isCreated());
    return relogin(slug);
  }

  private String relogin(String slug) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + slug + "@inv.io\",\"password\":\"password123\"}"))
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
}
