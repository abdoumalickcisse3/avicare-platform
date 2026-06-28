package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.inventory.StockItemService;
import com.avicare.livestock.layer.EggTrayStockService;
import com.avicare.livestock.layer.EggTrayStockUpdate;
import com.avicare.livestock.poultry.PoultryBatchCreate;
import com.avicare.livestock.poultry.PoultryBatchService;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.EggTrayStockRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.util.Base64;
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
 * Integration tests for D27 — wiring vente / livraison / commande / annulation → stock de
 * production. Verifies that PRODUCTION lines in direct sales and deliveries (a) consume the
 * production stock via LivestockFacade, (b) restock it on cancellation, (c) are only decremented at
 * delivery (not at order draft), and (d) validation guards enforce productType / productionUnitId /
 * integer quantity rules. CI-only — Testcontainers can't run on this dev machine (Docker 29.x).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class CommercialProductionIT {

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
  @Autowired private SaleService saleService;
  @Autowired private OrderService orderService;
  @Autowired private DeliveryService deliveryService;
  @Autowired private ClientService clientService;
  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private EggTrayStockService eggTrayStockService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private EggTrayStockRepository eggTrayStockRepository;
  @Autowired private SaleRepository saleRepository;
  @Autowired private StockItemService stockItemService;

  // ── Case 1: direct BROILER sale decrements current_count ────────────

  @Test
  void saleDirectBroiler_decrementsCurrentCount() throws Exception {
    FarmContext ctx = createFarm("broilersale." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 100);

    Sale sale =
        saleService.create(
            ctx.farmId(),
            new SaleCommand(null, null, "CASH", null, List.of(broilerLine(unitId, 20, 5000))),
            ctx.userId());

    assertThat(sale.getStatus().name()).isEqualTo("COMPLETED");
    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(80);
  }

  // ── Case 2: direct EGGS sale decrements full_trays_count ────────────

  @Test
  void saleDirectEggs_decrementsFullTraysCount() throws Exception {
    FarmContext ctx = createFarm("eggssale." + System.nanoTime() + "@prod.io");
    eggTrayStockService.record(ctx.farmId(), new EggTrayStockUpdate(10, 0));

    saleService.create(
        ctx.farmId(),
        new SaleCommand(null, null, "CASH", null, List.of(eggsLine(4, 2000))),
        ctx.userId());

    assertThat(eggTrayStockRepository.findByFarmId(ctx.farmId()).orElseThrow().getFullTraysCount())
        .isEqualTo(6);
  }

  // ── Case 3: oversell → 422 + no decrement + sale rolled back ────────

  @Test
  void saleBroilerOversell_throws422_noDecrement_noSalePeristed() throws Exception {
    FarmContext ctx = createFarm("oversell." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 10);
    int salesBefore = saleService.listForFarm(ctx.farmId(), null).size();

    assertThatThrownBy(
            () ->
                saleService.create(
                    ctx.farmId(),
                    new SaleCommand(
                        null, null, "CASH", null, List.of(broilerLine(unitId, 50, 5000))),
                    ctx.userId()))
        .isInstanceOf(BusinessRuleException.class);

    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(10);
    assertThat(saleService.listForFarm(ctx.farmId(), null)).hasSize(salesBefore);
  }

  // ── Case 4: order draft does NOT decrement; delivery DOES ───────────

  @Test
  void orderDraft_doesNotDecrement_deliveryDecrements() throws Exception {
    FarmContext ctx = createFarm("orderdraft." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 100);
    long clientId = createClient(ctx.farmId(), ctx.userId());

    var order =
        orderService.createDraft(
            ctx.farmId(),
            new OrderDraftCommand(
                clientId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(
                    new OrderDraftCommand.Line(
                        "BROILER",
                        ArticleSource.PRODUCTION,
                        BigDecimal.valueOf(30),
                        5000,
                        null,
                        unitId,
                        ProductType.BROILER))),
            ctx.userId());

    // draft alone: count unchanged
    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(100);

    orderService.confirm(ctx.farmId(), order.getId(), ctx.userId());
    orderService.markInProgress(ctx.farmId(), order.getId(), ctx.userId());
    deliveryService.createFromOrder(
        ctx.farmId(), order.getId(), new DeliveryFromOrderCommand(null, null, null), ctx.userId());

    // after delivery: decremented
    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(70);
  }

  // ── Case 5: cancel sale → restocks production ───────────────────────

  @Test
  void cancelSale_restocksProduction() throws Exception {
    FarmContext ctx = createFarm("cancelsale." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 100);

    Sale sale =
        saleService.create(
            ctx.farmId(),
            new SaleCommand(null, null, "CASH", null, List.of(broilerLine(unitId, 20, 5000))),
            ctx.userId());
    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(80);

    saleService.cancel(ctx.farmId(), sale.getId(), "erreur", ctx.userId());

    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(100);
  }

  // ── Case 6: validation guards ────────────────────────────────────────

  @Test
  void validationGuards_throw422WithCorrectCodes() throws Exception {
    FarmContext ctx = createFarm("validation." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 100);
    eggTrayStockService.record(ctx.farmId(), new EggTrayStockUpdate(10, 0));

    // no productType
    assertThatThrownBy(
            () ->
                saleService.create(
                    ctx.farmId(),
                    new SaleCommand(
                        null,
                        null,
                        "CASH",
                        null,
                        List.of(
                            new SaleCommand.Line(
                                "PROD",
                                ArticleSource.PRODUCTION,
                                BigDecimal.ONE,
                                1000,
                                null,
                                null,
                                null))),
                    ctx.userId()))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_LINE_TYPE_REQUIRED");

    // BROILER without productionUnitId
    assertThatThrownBy(
            () ->
                saleService.create(
                    ctx.farmId(),
                    new SaleCommand(
                        null,
                        null,
                        "CASH",
                        null,
                        List.of(
                            new SaleCommand.Line(
                                "BROILER",
                                ArticleSource.PRODUCTION,
                                BigDecimal.ONE,
                                1000,
                                null,
                                null,
                                ProductType.BROILER))),
                    ctx.userId()))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_LINE_UNIT_REQUIRED");

    // EGGS with productionUnitId (must be null for eggs)
    assertThatThrownBy(
            () ->
                saleService.create(
                    ctx.farmId(),
                    new SaleCommand(
                        null,
                        null,
                        "CASH",
                        null,
                        List.of(
                            new SaleCommand.Line(
                                "EGGS",
                                ArticleSource.PRODUCTION,
                                BigDecimal.ONE,
                                1000,
                                null,
                                unitId,
                                ProductType.EGGS))),
                    ctx.userId()))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_LINE_UNIT_FORBIDDEN");

    // non-integer quantity (e.g. 1.5)
    assertThatThrownBy(
            () ->
                saleService.create(
                    ctx.farmId(),
                    new SaleCommand(
                        null,
                        null,
                        "CASH",
                        null,
                        List.of(
                            new SaleCommand.Line(
                                "BROILER",
                                ArticleSource.PRODUCTION,
                                new BigDecimal("1.5"),
                                1000,
                                null,
                                unitId,
                                ProductType.BROILER))),
                    ctx.userId()))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_LINE_QUANTITY_INTEGER");
  }

  // ── Case 7: mixed sale (inventory + production oversell) → global rollback ──

  @Test
  void mixedSale_productionOversell_rollsBackInventoryToo() throws Exception {
    FarmContext ctx = createFarm("mixedrollback." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 10);

    // Capture inventory stock BEFORE (creates the row at qty=0 on first access)
    BigDecimal stockBefore =
        stockItemService
            .createOrGet(ctx.farmId(), ArticleSource.INVENTORY, "chicken_meat", ctx.userId())
            .getCurrentQuantity();

    // 2-line sale: line 1 = INVENTORY qty=3 (OK); line 2 = BROILER qty=50 > 10 (oversell)
    assertThatThrownBy(
            () ->
                saleService.create(
                    ctx.farmId(),
                    new SaleCommand(
                        null,
                        null,
                        "CASH",
                        null,
                        List.of(
                            inventoryLine("chicken_meat", 3, 2500), broilerLine(unitId, 50, 5000))),
                    ctx.userId()))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_INSUFFICIENT");

    // Production count must be unchanged
    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(10);

    // Inventory OUT from line 1 must have been rolled back with the transaction
    assertThat(
            stockItemService
                .createOrGet(ctx.farmId(), ArticleSource.INVENTORY, "chicken_meat", ctx.userId())
                .getCurrentQuantity())
        .isEqualByComparingTo(stockBefore);

    // No sale must be persisted for this farm
    assertThat(saleRepository.findByFarmIdOrderBySaleDateDescIdDesc(ctx.farmId())).isEmpty();
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private record FarmContext(long farmId, long userId) {}

  private FarmContext createFarm(String email) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"T\"}"))
        .andExpect(status().isCreated());

    String loginJson =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String token = objectMapper.readTree(loginJson).get("data").get("accessToken").asText();

    // Decode JWT payload (base64url, no signature needed) to extract sub = userId
    String payload = token.split("\\.")[1];
    long userId = objectMapper.readTree(Base64.getUrlDecoder().decode(payload)).get("sub").asLong();

    String farmJson =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Prod " + System.nanoTime() + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long farmId = objectMapper.readTree(farmJson).get("data").get("id").asLong();

    return new FarmContext(farmId, userId);
  }

  private Long createBatch(long farmId, long userId, int count) {
    var breed =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow();
    return poultryBatchService
        .create(
            new PoultryBatchCreate(farmId, breed.getId(), null, null, null, null, count), userId)
        .getId();
  }

  private long createClient(long farmId, long userId) {
    return clientService
        .create(
            farmId,
            new ClientCommand(
                ClientType.BUSINESS, "Client Test", null, null, null, null, null, null, null, null),
            userId)
        .getId();
  }

  private static SaleCommand.Line inventoryLine(String key, int qty, int price) {
    return new SaleCommand.Line(
        key, ArticleSource.INVENTORY, BigDecimal.valueOf(qty), price, null, null, null);
  }

  private static SaleCommand.Line broilerLine(Long unitId, int qty, int price) {
    return new SaleCommand.Line(
        "BROILER",
        ArticleSource.PRODUCTION,
        BigDecimal.valueOf(qty),
        price,
        null,
        unitId,
        ProductType.BROILER);
  }

  private static SaleCommand.Line eggsLine(int qty, int price) {
    return new SaleCommand.Line(
        "EGGS",
        ArticleSource.PRODUCTION,
        BigDecimal.valueOf(qty),
        price,
        null,
        null,
        ProductType.EGGS);
  }
}
